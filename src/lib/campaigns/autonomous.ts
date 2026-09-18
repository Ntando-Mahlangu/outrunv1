import type { Campaign, MembershipRole, PlanTier } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { UserFacingError } from "@/lib/errors";
import { sendOutreachMessage } from "@/lib/outreach/send";
import { isEmailSendingConfigured } from "@/lib/email";
import { logEvent, EventType } from "@/lib/memory/log-event";
import { createNotification, NotificationType } from "@/lib/notifications/create-notification";
import { captureError } from "@/lib/observability";
import { canSendAutonomously } from "@/lib/teams/permissions";
import { isFeatureEnabled, FEATURE_FLAGS } from "@/lib/billing/feature-flags";

const MIN_DAILY_LIMIT = 1;
const MAX_DAILY_LIMIT = 500;

// docs/outrun/07 "AUTONOMOUS GROWTH MODE" lists "Declining reply rates" as
// one of the things this mode is supposed to watch for and act on — a real
// circuit breaker on this app's own send failures (already-retried by
// sendEmail's withRetry, so a FAILED status here means genuinely broken,
// not a transient blip), not a fabricated "engagement score." Below this
// sample size, one or two bad addresses can't trip the breaker; at or
// above it, a majority-failing run pauses the campaign and hands it back
// to a human rather than continuing to burn the daily budget on the same
// broken run.
const MIN_SAMPLE_FOR_PAUSE = 3;
const FAILURE_RATE_PAUSE_THRESHOLD = 0.5;

export function shouldAutoPauseForFailures(attempted: number, failed: number): boolean {
  if (attempted < MIN_SAMPLE_FOR_PAUSE) return false;
  return failed / attempted >= FAILURE_RATE_PAUSE_THRESHOLD;
}

/**
 * Autonomous Growth Mode, deliberately scoped narrow (docs/outrun/07):
 * it only auto-sends messages already generated within a campaign the
 * owner reviewed and launched — it never generates or launches a
 * campaign on its own, and it never fires without an explicit opt-in
 * per campaign, an Owner/Admin, and a user-set daily cap.
 */
export async function setAutonomousSending(
  organizationId: string,
  actingRole: MembershipRole,
  planTier: PlanTier,
  campaignId: string,
  enabled: boolean,
  dailyLimit: number,
) {
  if (!canSendAutonomously(actingRole)) {
    throw new UserFacingError("Only workspace owners and admins can change autonomous sending.");
  }
  if (!Number.isInteger(dailyLimit) || dailyLimit < MIN_DAILY_LIMIT || dailyLimit > MAX_DAILY_LIMIT) {
    throw new UserFacingError(`Daily limit must be between ${MIN_DAILY_LIMIT} and ${MAX_DAILY_LIMIT}.`);
  }

  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, organizationId },
  });
  if (!campaign) {
    throw new UserFacingError("That campaign could not be found.");
  }
  if (enabled && !isFeatureEnabled(planTier, FEATURE_FLAGS.AUTONOMOUS_SENDING, organizationId)) {
    throw new UserFacingError("Autonomous sending is an Unlimited plan feature — upgrade to turn it on.");
  }
  if (enabled && !isEmailSendingConfigured()) {
    throw new UserFacingError(
      "Email sending isn't configured yet. Add RESEND_API_KEY before enabling autonomous sending.",
    );
  }

  return prisma.campaign.update({
    where: { id: campaign.id },
    data: {
      autonomousSendEnabled: enabled,
      autonomousDailyLimit: dailyLimit,
      autonomousSendEnabledAt: enabled ? new Date() : null,
    },
  });
}

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/**
 * Sends up to this campaign's remaining daily budget of not-yet-sent
 * messages. Safe to call repeatedly — it only ever acts on NOT_SENT/
 * FAILED messages with a contact email, and always re-checks the daily
 * count fresh so a lowered or disabled limit takes effect immediately.
 */
export async function runAutonomousSendForCampaign(campaign: Campaign) {
  if (!campaign.autonomousSendEnabled || campaign.status !== "READY") {
    return { attempted: 0, sent: 0, failed: 0 };
  }
  if (!isEmailSendingConfigured()) {
    return { attempted: 0, sent: 0, failed: 0 };
  }

  const sentToday = await prisma.outreachMessage.count({
    where: {
      campaignId: campaign.id,
      sendStatus: "SENT",
      sentAt: { gte: startOfToday() },
    },
  });
  const remainingBudget = campaign.autonomousDailyLimit - sentToday;

  await prisma.campaign.update({
    where: { id: campaign.id },
    data: { lastAutonomousSendAt: new Date() },
  });

  if (remainingBudget <= 0) {
    return { attempted: 0, sent: 0, failed: 0 };
  }

  const pending = await prisma.outreachMessage.findMany({
    where: {
      campaignId: campaign.id,
      sendStatus: { in: ["NOT_SENT", "FAILED"] },
      company: { contactEmail: { not: null } },
    },
    take: remainingBudget,
    orderBy: { createdAt: "asc" },
  });

  let sent = 0;
  let failed = 0;

  for (const message of pending) {
    try {
      await sendOutreachMessage(campaign.organizationId, message.id);
      sent += 1;
    } catch {
      failed += 1;
    }
  }

  if (pending.length > 0) {
    await logEvent(
      campaign.organizationId,
      EventType.AUTONOMOUS_SEND_RUN,
      `Autonomous sending for "${campaign.name}": sent ${sent} of ${pending.length} attempted.`,
    );
  }

  let paused = false;
  if (shouldAutoPauseForFailures(pending.length, failed)) {
    await prisma.campaign.update({
      where: { id: campaign.id },
      data: { autonomousSendEnabled: false },
    });
    await logEvent(
      campaign.organizationId,
      EventType.AUTONOMOUS_SEND_PAUSED,
      `Autonomous sending for "${campaign.name}" paused automatically: ${failed} of ${pending.length} sends failed.`,
    );
    await createNotification(
      campaign.organizationId,
      NotificationType.AUTONOMOUS_SEND_PAUSED,
      "Autonomous sending paused",
      `"${campaign.name}" had ${failed} of ${pending.length} sends fail in a row, so autonomous sending was turned off. Review the campaign before re-enabling it.`,
      `/campaigns/${campaign.id}`,
    );
    paused = true;
  }

  return { attempted: pending.length, sent, failed, paused };
}

/**
 * Entry point for the scheduled job (src/app/api/cron/autonomous-send).
 * Iterates every campaign across every workspace that has opted in —
 * this route has no session, so it's the only place that reaches across
 * organizations.
 */
export async function runAutonomousSendTick() {
  const campaigns = await prisma.campaign.findMany({
    // organization: { deletedAt: null } — a deleted workspace's own
    // interactive routes already disappear (src/lib/org.ts), but this
    // cron has no session and reaches straight into Campaign, so it's
    // the one place that needs its own explicit check: without it, a
    // deleted workspace would keep sending real outreach emails to
    // prospects indefinitely.
    where: { autonomousSendEnabled: true, status: "READY", organization: { deletedAt: null } },
  });

  const results = {
    campaignsChecked: campaigns.length,
    totalSent: 0,
    totalFailed: 0,
    campaignsPaused: 0,
  };

  for (const campaign of campaigns) {
    try {
      const result = await runAutonomousSendForCampaign(campaign);
      results.totalSent += result.sent;
      results.totalFailed += result.failed;
      if (result.paused) results.campaignsPaused += 1;
    } catch (error) {
      captureError("campaigns.autonomous.tick", error, { campaignId: campaign.id });
    }
  }

  return results;
}
