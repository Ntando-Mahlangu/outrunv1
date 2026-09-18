import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { logEvent, EventType } from "@/lib/memory/log-event";
import { createNotification, NotificationType } from "@/lib/notifications/create-notification";
import { captureError } from "@/lib/observability";
import { analyzeCallOutcomePatterns } from "@/lib/prospects/call-insights";
import {
  DORMANT_MIN_DAYS_SINCE_TOUCH,
  DORMANT_MIN_COUNT,
  UNCONTACTED_MIN_FIT_SCORE,
  STALLED_CALLBACK_MIN_COUNT,
  DISMISS_COOLDOWN_DAYS,
} from "./thresholds";
import type { DetectedCandidate, OpportunityType } from "./types";

const FOLLOW_UP_TASK_PREFIX = "Follow up with ";
const TREND_WINDOW_DAYS = 14;
const TREND_MIN_SAMPLE = 5;
const TREND_MIN_DECLINE_POINTS = 10;

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function daysSince(date: Date): number {
  return Math.floor((Date.now() - date.getTime()) / (24 * 60 * 60 * 1000));
}

function clampConfidence(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

type DetectorContext = { avgCustomerValue: number | null };

// ============================================================
// Dormant Leads
// ============================================================

type DormantContact = { contactId: string; contactName: string; companyId: string; companyName: string; lastTouchAt: Date | null };

/**
 * A contact someone already engaged with (relationshipStatus moved past
 * NEW) but hasn't been touched — by call or sent outreach — in a while.
 * The real grain here is deliberate: OutreachMessage has no contactId
 * (it's sent to a company, not a named person), so "last touch" is the
 * most recent of the contact's own calls, a company-wide call with no
 * named contact recorded, or a sent message to that company — never a
 * claim more precise than the schema actually supports.
 */
export async function findDormantLeadContacts(organizationId: string): Promise<DormantContact[]> {
  const contacts = await prisma.contact.findMany({
    where: {
      company: { organizationId },
      relationshipStatus: { in: ["CONTACTED", "RESPONDED", "QUALIFIED"] },
    },
    select: {
      id: true,
      name: true,
      companyId: true,
      company: { select: { name: true } },
      callLogs: { select: { createdAt: true }, orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (contacts.length === 0) return [];

  const companyIds = Array.from(new Set(contacts.map((c) => c.companyId)));
  const [companyCalls, companyOutreach] = await Promise.all([
    prisma.callLog.findMany({
      where: { companyId: { in: companyIds }, contactId: null },
      select: { companyId: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.outreachMessage.findMany({
      where: { companyId: { in: companyIds }, sendStatus: "SENT" },
      select: { companyId: true, sentAt: true },
    }),
  ]);

  const lastCompanyCall = new Map<string, Date>();
  for (const c of companyCalls) {
    if (!lastCompanyCall.has(c.companyId)) lastCompanyCall.set(c.companyId, c.createdAt);
  }
  const lastCompanyOutreach = new Map<string, Date>();
  for (const m of companyOutreach) {
    if (!m.sentAt) continue;
    const existing = lastCompanyOutreach.get(m.companyId);
    if (!existing || m.sentAt > existing) lastCompanyOutreach.set(m.companyId, m.sentAt);
  }

  const cutoff = daysAgo(DORMANT_MIN_DAYS_SINCE_TOUCH);
  const dormant: DormantContact[] = [];
  for (const contact of contacts) {
    const candidates = [
      contact.callLogs[0]?.createdAt,
      lastCompanyCall.get(contact.companyId),
      lastCompanyOutreach.get(contact.companyId),
    ].filter((d): d is Date => Boolean(d));
    const lastTouchAt = candidates.length > 0 ? new Date(Math.max(...candidates.map((d) => d.getTime()))) : null;

    if (!lastTouchAt || lastTouchAt <= cutoff) {
      dormant.push({
        contactId: contact.id,
        contactName: contact.name,
        companyId: contact.companyId,
        companyName: contact.company.name,
        lastTouchAt,
      });
    }
  }
  return dormant;
}

async function detectDormantLeads(
  organizationId: string,
  ctx: DetectorContext,
): Promise<DetectedCandidate | null> {
  const dormant = await findDormantLeadContacts(organizationId);
  if (dormant.length < DORMANT_MIN_COUNT) return null;

  const companyIds = Array.from(new Set(dormant.map((d) => d.companyId)));
  const evidence = dormant.slice(0, 5).map((d) =>
    d.lastTouchAt
      ? `${d.contactName} at ${d.companyName} — last touched ${daysSince(d.lastTouchAt)} days ago`
      : `${d.contactName} at ${d.companyName} — no recorded touch since becoming a lead`,
  );
  if (dormant.length > 5) evidence.push(`...and ${dormant.length - 5} more.`);

  return {
    type: "DORMANT_LEADS",
    dedupeKey: "DORMANT_LEADS",
    title: `${dormant.length} dormant lead${dormant.length === 1 ? "" : "s"} need follow-up`,
    summary: `${dormant.length} contact${dormant.length === 1 ? "" : "s"} you already engaged with haven't been touched in ${DORMANT_MIN_DAYS_SINCE_TOUCH}+ days.`,
    whyItMatters:
      "These aren't cold prospects — someone already had a real conversation with them. Letting them go quiet risks losing deals you already invested time into.",
    evidence,
    confidence: clampConfidence(55 + dormant.length * 3),
    estimatedImpact: dormant.length >= 8 ? "High" : "Medium",
    estimatedValue: ctx.avgCustomerValue != null ? ctx.avgCustomerValue * companyIds.length : null,
    recommendedAction: "Create a fresh call list from these companies and pick up where you left off.",
    actionType: "CREATE_LEAD_LIST_AND_CALL",
    relatedCompanyIds: companyIds,
  };
}

// ============================================================
// High-Fit Uncontacted
// ============================================================

type UncontactedCompany = { id: string; name: string; fitScore: number | null };

/** Migrated from the old growth-partner/opportunity-feed.ts live signal,
 * now also requiring no CallLog (not just no OutreachMessage) — a
 * company someone already cold-called isn't "never actioned" just
 * because no email went out. */
export async function findHighFitUncontactedCompanies(organizationId: string): Promise<UncontactedCompany[]> {
  return prisma.company.findMany({
    where: {
      organizationId,
      fitScore: { gte: UNCONTACTED_MIN_FIT_SCORE },
      outreachMessages: { none: {} },
      callLogs: { none: {} },
    },
    select: { id: true, name: true, fitScore: true },
    orderBy: { fitScore: "desc" },
  });
}

async function detectHighFitUncontacted(
  organizationId: string,
  ctx: DetectorContext,
): Promise<DetectedCandidate | null> {
  const companies = await findHighFitUncontactedCompanies(organizationId);
  if (companies.length === 0) return null;

  const evidence = companies
    .slice(0, 5)
    .map((c) => `${c.name} — Fit Score ${c.fitScore}, never called or emailed`);
  if (companies.length > 5) evidence.push(`...and ${companies.length - 5} more.`);

  return {
    type: "HIGH_FIT_UNCONTACTED",
    dedupeKey: "HIGH_FIT_UNCONTACTED",
    title: `${companies.length} high-fit prospect${companies.length === 1 ? "" : "s"} sitting untouched`,
    summary: `${companies.length} companies scored ${UNCONTACTED_MIN_FIT_SCORE}+ Fit Score but have never been called or emailed.`,
    whyItMatters:
      "You already found and scored these as strong matches for your ideal customer profile — the only thing missing is the first touch.",
    evidence,
    confidence: clampConfidence(70 + Math.min(15, companies.length)),
    estimatedImpact: companies.length >= 5 ? "High" : "Medium",
    estimatedValue: ctx.avgCustomerValue != null ? ctx.avgCustomerValue * companies.length : null,
    recommendedAction: "Create a call list from these companies and start reaching out.",
    actionType: "CREATE_LEAD_LIST_AND_CALL",
    relatedCompanyIds: companies.map((c) => c.id),
  };
}

// ============================================================
// Stalled Callbacks
// ============================================================

type StalledCallback = { taskId: string; companyId: string; companyName: string; daysOverdue: number };

/**
 * A callback the company asked for (src/app/api/prospects/[id]/calls
 * auto-creates a "Follow up with {name}" Task on CALLBACK_REQUESTED)
 * that's now overdue and still sitting PENDING — a promise made and not
 * kept. Task has no real companyId column, so the company is resolved
 * from the task's own title text (the exact template that route writes);
 * if a future change to that template ever changes the wording, this
 * query needs updating alongside it.
 *
 * A task whose company can no longer be resolved by name (renamed,
 * deleted, or name-collided with another company — Company.name has no
 * uniqueness constraint) is dropped rather than surfaced with a null
 * companyId: it would otherwise count toward the opportunity but can
 * never actually be launched, leaving a permanently-stuck "opportunity"
 * that only Dismiss can clear.
 */
export async function findStalledCallbacks(organizationId: string): Promise<StalledCallback[]> {
  const tasks = await prisma.task.findMany({
    where: {
      organizationId,
      status: "PENDING",
      dueDate: { lt: new Date() },
      title: { startsWith: FOLLOW_UP_TASK_PREFIX },
    },
    select: { id: true, title: true, dueDate: true },
  });
  if (tasks.length === 0) return [];

  const names = tasks.map((t) => t.title.slice(FOLLOW_UP_TASK_PREFIX.length));
  const companies = await prisma.company.findMany({
    where: { organizationId, name: { in: names } },
    select: { id: true, name: true },
  });
  const companyByName = new Map(companies.map((c) => [c.name, c]));

  const resolved: StalledCallback[] = [];
  for (const t of tasks) {
    const name = t.title.slice(FOLLOW_UP_TASK_PREFIX.length);
    const company = companyByName.get(name);
    if (!company) continue;
    resolved.push({
      taskId: t.id,
      companyId: company.id,
      companyName: name,
      daysOverdue: t.dueDate ? daysSince(t.dueDate) : 0,
    });
  }
  return resolved;
}

async function detectStalledCallbacks(organizationId: string): Promise<DetectedCandidate | null> {
  const stalled = await findStalledCallbacks(organizationId);
  if (stalled.length < STALLED_CALLBACK_MIN_COUNT) return null;

  const companyIds = stalled.map((s) => s.companyId);
  const evidence = stalled
    .slice(0, 5)
    .map((s) => `${s.companyName} — promised a callback, ${s.daysOverdue} day${s.daysOverdue === 1 ? "" : "s"} overdue`);
  if (stalled.length > 5) evidence.push(`...and ${stalled.length - 5} more.`);

  return {
    type: "STALLED_CALLBACKS",
    dedupeKey: "STALLED_CALLBACKS",
    title: `${stalled.length} overdue callback${stalled.length === 1 ? "" : "s"} — a promise not kept`,
    summary: `${stalled.length} compan${stalled.length === 1 ? "y" : "ies"} asked for a callback and the follow-up is now overdue.`,
    whyItMatters:
      "A missed callback is a warm lead going cold for a reason entirely within your control — this is the closest thing to a pure revenue leak in your pipeline.",
    evidence,
    confidence: clampConfidence(75 + Math.min(15, stalled.length * 2)),
    estimatedImpact: "High",
    estimatedValue: null,
    recommendedAction: "Create a call list from these companies and follow up today.",
    actionType: "CREATE_LEAD_LIST_AND_CALL",
    relatedCompanyIds: companyIds,
  };
}

// ============================================================
// Segment Expansion
// ============================================================

async function detectSegmentExpansion(organizationId: string): Promise<DetectedCandidate[]> {
  const { patterns } = await analyzeCallOutcomePatterns(organizationId);
  const industryPattern = patterns.find((p) => p.dimension === "Industry");
  if (!industryPattern) return [];

  return [
    {
      type: "SEGMENT_EXPANSION",
      dedupeKey: `SEGMENT_EXPANSION:${industryPattern.winningBucket}`,
      title: `${industryPattern.winningBucket} companies are converting well — worth finding more`,
      summary: industryPattern.insight,
      whyItMatters:
        "This pattern already cleared the same statistical bar as every other calling insight in Outrun — a real, sample-backed gap between how this segment responds versus the rest of your pipeline.",
      evidence: [industryPattern.insight, `Based on ${industryPattern.sampleSize} logged calls.`],
      confidence: clampConfidence(55 + (industryPattern.winningRate - industryPattern.comparisonRate) / 2),
      estimatedImpact: "Medium",
      estimatedValue: null,
      recommendedAction: `Search for more ${industryPattern.winningBucket} companies to prospect.`,
      actionType: "SUGGEST_SEARCH",
      actionPayload: { query: industryPattern.winningBucket },
    },
  ];
}

// ============================================================
// Reply Rate Decline
// ============================================================

/** Migrated verbatim from the old growth-partner/opportunity-feed.ts
 * live signal — same honesty bar (real 14-day windows, real minimum
 * sample), now durable and trackable instead of recomputed on every
 * page load with no way to act on or dismiss it for good. */
async function detectReplyRateDecline(organizationId: string): Promise<DetectedCandidate | null> {
  const [recent, prior] = await Promise.all([
    prisma.outreachMessage.findMany({
      where: {
        company: { organizationId },
        sendStatus: "SENT",
        sentAt: { gte: daysAgo(TREND_WINDOW_DAYS) },
      },
      select: { gotReply: true },
    }),
    prisma.outreachMessage.findMany({
      where: {
        company: { organizationId },
        sendStatus: "SENT",
        sentAt: { gte: daysAgo(TREND_WINDOW_DAYS * 2), lt: daysAgo(TREND_WINDOW_DAYS) },
      },
      select: { gotReply: true },
    }),
  ]);

  if (recent.length < TREND_MIN_SAMPLE || prior.length < TREND_MIN_SAMPLE) return null;

  const recentRate = Math.round((recent.filter((m) => m.gotReply).length / recent.length) * 100);
  const priorRate = Math.round((prior.filter((m) => m.gotReply).length / prior.length) * 100);
  const decline = priorRate - recentRate;
  if (decline < TREND_MIN_DECLINE_POINTS) return null;

  return {
    type: "REPLY_RATE_DECLINE",
    dedupeKey: "REPLY_RATE_DECLINE",
    title: "Reply rate has dropped recently",
    summary: `Your reply rate over the last ${TREND_WINDOW_DAYS} days is ${recentRate}%, down from ${priorRate}% in the ${TREND_WINDOW_DAYS} days before that.`,
    whyItMatters:
      "A declining reply rate compounds — the longer messaging that isn't landing keeps going out, the more of your pipeline it touches.",
    evidence: [
      `Last ${TREND_WINDOW_DAYS} days: ${recentRate}% reply rate (${recent.length} sent).`,
      `Prior ${TREND_WINDOW_DAYS} days: ${priorRate}% reply rate (${prior.length} sent).`,
    ],
    confidence: clampConfidence(50 + Math.min(recent.length, prior.length)),
    estimatedImpact: "Medium",
    estimatedValue: null,
    recommendedAction: "Check the Improvement Loop on Campaigns for what's working right now.",
    actionType: "REVIEW_ONLY",
  };
}

// ============================================================
// Sweep: upsert / refresh / resurface / expire
// ============================================================

export type DetectionResult = { created: number; refreshed: number; resurfaced: number; expired: number };

function candidateData(c: DetectedCandidate) {
  return {
    title: c.title,
    summary: c.summary,
    whyItMatters: c.whyItMatters,
    evidence: c.evidence as Prisma.InputJsonValue,
    confidence: c.confidence,
    estimatedImpact: c.estimatedImpact,
    estimatedValue: c.estimatedValue,
    recommendedAction: c.recommendedAction,
    actionType: c.actionType,
    actionPayload: (c.actionPayload ?? null) as Prisma.InputJsonValue,
    relatedCompanyIds: (c.relatedCompanyIds ?? null) as Prisma.InputJsonValue,
  };
}

/**
 * Runs every detector for one organization and reconciles the results
 * against what's already persisted (docs/outrun/10 "GROWTH OPPORTUNITY
 * ENGINE" Detect step). A DETECTED row is refreshed in place; a LAUNCHED
 * row is never touched once a user has acted on it; a DISMISSED row only
 * resurfaces after DISMISS_COOLDOWN_DAYS (respecting the user's "no");
 * an EXPIRED row (the condition resolved on its own, not a user
 * decision) resurfaces immediately if it becomes true again. Anything
 * still DETECTED that this sweep no longer finds true is EXPIRED — the
 * underlying condition resolved without anyone launching or dismissing it.
 */
export async function runOpportunityDetection(organizationId: string): Promise<DetectionResult> {
  const businessProfile = await prisma.businessProfile.findUnique({
    where: { organizationId },
    select: { avgCustomerValue: true },
  });
  const ctx: DetectorContext = { avgCustomerValue: businessProfile?.avgCustomerValue ?? null };

  const [dormant, highFit, stalled, segments, replyDecline] = await Promise.all([
    detectDormantLeads(organizationId, ctx),
    detectHighFitUncontacted(organizationId, ctx),
    detectStalledCallbacks(organizationId),
    detectSegmentExpansion(organizationId),
    detectReplyRateDecline(organizationId),
  ]);

  const candidates: DetectedCandidate[] = [dormant, highFit, stalled, replyDecline].filter(
    (c): c is DetectedCandidate => c !== null,
  );
  candidates.push(...segments);

  const result: DetectionResult = { created: 0, refreshed: 0, resurfaced: 0, expired: 0 };
  const createdTitles: string[] = [];

  for (const candidate of candidates) {
    const existing = await prisma.opportunity.findUnique({
      where: { organizationId_dedupeKey: { organizationId, dedupeKey: candidate.dedupeKey } },
    });

    if (!existing) {
      await prisma.opportunity.create({
        data: { organizationId, type: candidate.type, dedupeKey: candidate.dedupeKey, ...candidateData(candidate) },
      });
      result.created += 1;
      createdTitles.push(candidate.title);
      await logEvent(organizationId, EventType.OPPORTUNITY_DETECTED, `Detected: ${candidate.title}`);
      continue;
    }

    if (existing.status === "DETECTED") {
      await prisma.opportunity.update({ where: { id: existing.id }, data: candidateData(candidate) });
      result.refreshed += 1;
      continue;
    }

    if (existing.status === "LAUNCHED") {
      continue; // never touch a row the user already acted on
    }

    if (existing.status === "EXPIRED") {
      await prisma.opportunity.update({
        where: { id: existing.id },
        data: { status: "DETECTED", detectedAt: new Date(), resolvedAt: null, ...candidateData(candidate) },
      });
      result.resurfaced += 1;
      continue;
    }

    // DISMISSED — respect the user's decision until the cooldown passes.
    const cooledDown = existing.resolvedAt && daysSince(existing.resolvedAt) >= DISMISS_COOLDOWN_DAYS;
    if (cooledDown) {
      await prisma.opportunity.update({
        where: { id: existing.id },
        data: { status: "DETECTED", detectedAt: new Date(), resolvedAt: null, ...candidateData(candidate) },
      });
      result.resurfaced += 1;
    }
  }

  const freshKeys = new Set(candidates.map((c) => c.dedupeKey));
  const stillDetected = await prisma.opportunity.findMany({
    where: { organizationId, status: "DETECTED" },
    select: { id: true, dedupeKey: true },
  });
  const toExpire = stillDetected.filter((o) => !freshKeys.has(o.dedupeKey));
  if (toExpire.length > 0) {
    await prisma.opportunity.updateMany({
      where: { id: { in: toExpire.map((o) => o.id) } },
      data: { status: "EXPIRED", resolvedAt: new Date() },
    });
    result.expired = toExpire.length;
  }

  if (createdTitles.length > 0) {
    const title =
      createdTitles.length === 1
        ? "New growth opportunity found"
        : `${createdTitles.length} new growth opportunities found`;
    await createNotification(
      organizationId,
      NotificationType.OPPORTUNITY_DETECTED,
      title,
      createdTitles.slice(0, 3).join(" · "),
      "/opportunities",
    );
  }

  return result;
}

/** Entry point for the scheduled sweep (src/app/api/cron/opportunity-engine),
 * mirroring runStrategicReviewTick()'s per-org, never-abort-the-sweep shape. */
export async function runOpportunityDetectionTick(): Promise<{
  organizationsChecked: number;
  created: number;
  failed: number;
}> {
  const organizations = await prisma.organization.findMany({
    where: { businessProfile: { isNot: null }, deletedAt: null },
    select: { id: true },
  });

  const result = { organizationsChecked: organizations.length, created: 0, failed: 0 };
  for (const org of organizations) {
    try {
      const { created } = await runOpportunityDetection(org.id);
      result.created += created;
    } catch (error) {
      result.failed += 1;
      captureError("opportunities.detect.tick", error, { organizationId: org.id });
    }
  }
  return result;
}

/** Re-derives the current, real company set for a given opportunity type —
 * used at Launch time so a CREATE_LEAD_LIST_AND_CALL never trusts a
 * potentially-stale stored company list (see src/lib/opportunities/execute.ts). */
export async function resolveCurrentCompanyIds(
  organizationId: string,
  type: OpportunityType,
): Promise<string[]> {
  switch (type) {
    case "DORMANT_LEADS":
      return Array.from(new Set((await findDormantLeadContacts(organizationId)).map((d) => d.companyId)));
    case "HIGH_FIT_UNCONTACTED":
      return (await findHighFitUncontactedCompanies(organizationId)).map((c) => c.id);
    case "STALLED_CALLBACKS":
      return (await findStalledCallbacks(organizationId)).map((s) => s.companyId);
    case "SEGMENT_EXPANSION":
    case "REPLY_RATE_DECLINE":
      return [];
  }
}
