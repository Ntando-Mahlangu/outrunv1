import { prisma } from "@/lib/prisma";
import { sendEmail, isEmailSendingConfigured } from "@/lib/email";
import { UserFacingError } from "@/lib/errors";
import { logEvent, EventType } from "@/lib/memory/log-event";
import { captureError } from "@/lib/observability";

/**
 * Sends one previously-generated OutreachMessage to its company's contact
 * email (docs/outrun/07). This is a distinct, explicit action from
 * generating the message — nothing goes out until a human clicks Send.
 */
export async function sendOutreachMessage(organizationId: string, messageId: string) {
  if (!isEmailSendingConfigured()) {
    throw new UserFacingError(
      "Email sending isn't configured yet. Add RESEND_API_KEY to send outreach.",
    );
  }

  const message = await prisma.outreachMessage.findFirst({
    where: { id: messageId, company: { organizationId } },
    include: { company: true, followUpTo: true, campaign: true },
  });
  if (!message) {
    throw new UserFacingError("That message could not be found.");
  }
  if (!message.company.contactEmail) {
    throw new UserFacingError(
      "Add a contact email for this prospect before sending.",
    );
  }
  // docs/outrun/04 "Pause" — a paused campaign shouldn't quietly keep
  // sending. This is the single choke point (see below), so pausing here
  // covers manual sends, "Send All", and autonomous sending in one place.
  if (message.campaign?.status === "PAUSED") {
    throw new UserFacingError("This campaign is paused. Resume it before sending.");
  }

  // docs/outrun/07 "FOLLOW-UP SEQUENCES" — a follow-up can't jump its
  // scheduled date, and stops entirely once the prospect has replied to
  // the message it follows up on. This is the single choke point every
  // send path (manual, "Send All", autonomous) goes through, so the rule
  // only needs to live here once.
  if (message.followUpToId) {
    if (message.scheduledFor && message.scheduledFor > new Date()) {
      throw new UserFacingError(
        `This follow-up isn't due until ${message.scheduledFor.toLocaleDateString()}.`,
      );
    }
    if (message.followUpTo?.gotReply) {
      throw new UserFacingError(
        "This prospect already replied — the follow-up sequence has been stopped.",
      );
    }
  }

  try {
    await sendEmail({
      to: message.company.contactEmail,
      subject: message.subject,
      text: message.body,
    });
  } catch (error) {
    await prisma.outreachMessage.update({
      where: { id: message.id },
      data: { sendStatus: "FAILED" },
    });
    captureError("outreach.send", error, { organizationId, messageId });
    throw new UserFacingError(
      "We couldn't send that message right now. Please try again in a moment.",
    );
  }

  const updated = await prisma.outreachMessage.update({
    where: { id: message.id },
    data: { sendStatus: "SENT", sentAt: new Date() },
  });

  await logEvent(
    organizationId,
    EventType.OUTREACH_SENT,
    `Sent outreach to ${message.company.name} (${message.company.contactEmail}).`,
  );

  return updated;
}

/**
 * Sends every not-yet-sent message in a campaign that has a contact email,
 * one at a time so a single failure doesn't stop the rest. Returns a
 * summary rather than throwing on partial failure — the caller decides
 * how to surface per-message outcomes.
 */
export async function sendCampaignOutreach(organizationId: string, campaignId: string) {
  const campaign = await prisma.campaign.findFirst({
    where: { id: campaignId, organizationId },
    include: { messages: { include: { company: true } } },
  });
  if (!campaign) {
    throw new UserFacingError("That campaign could not be found.");
  }
  if (campaign.status === "PAUSED") {
    throw new UserFacingError("This campaign is paused. Resume it before sending.");
  }

  if (!isEmailSendingConfigured()) {
    throw new UserFacingError(
      "Email sending isn't configured yet. Add RESEND_API_KEY to send outreach.",
    );
  }

  const byId = new Map(campaign.messages.map((m) => [m.id, m]));

  let sent = 0;
  let failed = 0;
  let skippedNoEmail = 0;
  let skippedNotDue = 0;
  let skippedReplied = 0;

  for (const message of campaign.messages) {
    if (message.sendStatus === "SENT") continue;
    if (!message.company.contactEmail) {
      skippedNoEmail += 1;
      continue;
    }
    if (message.followUpToId) {
      if (message.scheduledFor && message.scheduledFor > new Date()) {
        skippedNotDue += 1;
        continue;
      }
      if (byId.get(message.followUpToId)?.gotReply) {
        skippedReplied += 1;
        continue;
      }
    }

    try {
      await sendOutreachMessage(organizationId, message.id);
      sent += 1;
    } catch {
      failed += 1;
    }
  }

  const messages = await prisma.outreachMessage.findMany({
    where: { campaignId },
    include: { company: true },
    orderBy: { createdAt: "asc" },
  });

  return { sent, failed, skippedNoEmail, skippedNotDue, skippedReplied, messages };
}

/**
 * Lets the owner edit AI-generated outreach before it goes out
 * (docs/outrun/07 "AI writes... the owner reviews, edits, and approves").
 * Only allowed while the message is still NOT_SENT/FAILED — once it's
 * actually gone out, the record needs to keep reflecting what a real
 * prospect received, not a later rewrite.
 */
export async function updateOutreachMessageContent(
  organizationId: string,
  messageId: string,
  updates: { subject: string; body: string; linkedinMessage: string | null },
) {
  const message = await prisma.outreachMessage.findFirst({
    where: { id: messageId, company: { organizationId } },
  });
  if (!message) {
    throw new UserFacingError("That message could not be found.");
  }
  if (message.sendStatus === "SENT") {
    throw new UserFacingError("This message has already been sent and can't be edited.");
  }

  return prisma.outreachMessage.update({
    where: { id: message.id },
    data: updates,
  });
}

/**
 * Manually records whether a prospect replied (docs/outrun/07 "A/B
 * TESTING" comparison). There's no inbound-email integration to detect
 * this automatically, so it's a plain user-reported toggle — never
 * inferred from anything else.
 */
export async function setOutreachReplyStatus(
  organizationId: string,
  messageId: string,
  gotReply: boolean,
) {
  const message = await prisma.outreachMessage.findFirst({
    where: { id: messageId, company: { organizationId } },
  });
  if (!message) {
    throw new UserFacingError("That message could not be found.");
  }

  return prisma.outreachMessage.update({
    where: { id: message.id },
    data: { gotReply },
  });
}
