import { UsageEventType, type PlanTier } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { UserFacingError } from "@/lib/errors";

// docs/outrun/14 plan allotments. Growth and Unlimited are now real,
// purchasable tiers (see plans.ts) — Growth's page gives one concrete
// number ("1000 Company Searches") and calls everything else on it
// unlimited ("Unlimited AI Reports", "Unlimited Campaigns"), so only
// COMPANY_SEARCH gets a real cap here; the rest are intentionally
// absent from GROWTH's record, same as an absent PlanTier entirely,
// which checkAndRecordUsage/getUsageSummary already treat as no limit.
// Unlimited has no entry at all — "Unlimited Everything" per its own
// plan page, not just AI generation types.
const LIMITS: Partial<Record<PlanTier, Partial<Record<UsageEventType, number>>>> = {
  FREE: {
    [UsageEventType.COMPANY_SEARCH]: 10,
    [UsageEventType.COMPANY_RESEARCH]: 10,
    [UsageEventType.OUTREACH_GENERATION]: 5,
    [UsageEventType.BLUEPRINT_GENERATION]: 1,
    [UsageEventType.CALL_SCRIPT_GENERATION]: 5,
  },
  STARTER: {
    [UsageEventType.COMPANY_SEARCH]: 250,
    [UsageEventType.COMPANY_RESEARCH]: 250,
    [UsageEventType.OUTREACH_GENERATION]: 500,
    [UsageEventType.BLUEPRINT_GENERATION]: 1_000_000, // "unlimited" in practice
    [UsageEventType.CALL_SCRIPT_GENERATION]: 500,
  },
  GROWTH: {
    [UsageEventType.COMPANY_SEARCH]: 1000,
  },
};

// FREE's cap is intentionally lifetime — it's the "unlock more with
// Starter" hook (docs/outrun/03), not a monthly allotment, since a Free
// workspace has no billing period to reset on. STARTER/GROWTH are real
// recurring subscriptions and doc 14's Billing Dashboard explicitly
// shows "Monthly Usage" alongside "Renewal Date" — those caps need to
// reset every period, or a customer who exhausts them once stays locked
// out for the life of the subscription despite paying every month.
const PERIODIC_TIERS: PlanTier[] = ["STARTER", "GROWTH"];

/** Start of the window a usage count should be scoped to — null means lifetime (FREE, and UNLIMITED which has no caps at all). */
function periodStartFor(
  planTier: PlanTier,
  organization: { currentPeriodStart: Date | null; createdAt: Date },
): Date | null {
  if (!PERIODIC_TIERS.includes(planTier)) return null;
  // currentPeriodStart is set from Paddle's own currentBillingPeriod on
  // every subscription webhook (including renewals) — falls back to
  // createdAt only for the brief window before that first webhook lands.
  return organization.currentPeriodStart ?? organization.createdAt;
}

const UPGRADE_MESSAGE: Record<UsageEventType, string> = {
  [UsageEventType.COMPANY_SEARCH]:
    "Great start — you've used all your Free searches. Upgrade to Starter to keep finding qualified companies.",
  [UsageEventType.COMPANY_RESEARCH]:
    "You've used all your Free AI company reports. Upgrade to Starter to keep researching prospects.",
  [UsageEventType.OUTREACH_GENERATION]:
    "You've used all your Free outreach generations. Upgrade to Starter to keep writing outreach.",
  [UsageEventType.BLUEPRINT_GENERATION]:
    "The Free plan includes one Growth Blueprint. Upgrade to Starter for unlimited Blueprint updates.",
  [UsageEventType.CALL_SCRIPT_GENERATION]:
    "You've used all your Free call scripts. Upgrade to Starter to keep generating call scripts.",
};

/**
 * Throws a friendly UserFacingError once the org's plan allotment for
 * this usage type is exhausted; otherwise resolves and lets the caller
 * proceed. Read-only — does not record anything itself. Split out from
 * recordUsage() below so an action whose real work happens later,
 * asynchronously (e.g. Blueprint generation — see src/lib/jobs/queue.ts)
 * can check the limit up front without charging the org's allotment for
 * an attempt that hasn't actually succeeded yet.
 */
export async function assertUsageAvailable(organizationId: string, type: UsageEventType) {
  const organization = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: { planTier: true, currentPeriodStart: true, createdAt: true },
  });

  const limit = LIMITS[organization.planTier]?.[type];
  if (limit != null) {
    const periodStart = periodStartFor(organization.planTier, organization);
    const used = await prisma.usageEvent.count({
      where: { organizationId, type, ...(periodStart ? { createdAt: { gte: periodStart } } : {}) },
    });
    if (used >= limit) {
      throw new UserFacingError(UPGRADE_MESSAGE[type]);
    }
  }
}

/** Records one unit of usage against the org's allotment. Call only once the billable action has actually succeeded. */
export async function recordUsage(organizationId: string, type: UsageEventType) {
  await prisma.usageEvent.create({ data: { organizationId, type } });
}

/**
 * Call before performing a billable action whose success/failure is known
 * synchronously, in the same request (e.g. a single AI call). Throws a
 * friendly UserFacingError once the org's plan allotment is exhausted;
 * otherwise records the event and lets the caller proceed. This is the
 * enforcement point for that case — nothing about plan limits lives in
 * the UI layer. For an action whose real work happens later,
 * asynchronously, use assertUsageAvailable() before starting it and
 * recordUsage() once it actually succeeds, instead of this combined helper.
 */
export async function checkAndRecordUsage(organizationId: string, type: UsageEventType) {
  await assertUsageAvailable(organizationId, type);
  await recordUsage(organizationId, type);
}

export async function getUsageSummary(organizationId: string, planTier: PlanTier) {
  const organization = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
    select: { currentPeriodStart: true, createdAt: true },
  });
  const periodStart = periodStartFor(planTier, organization);

  const types = Object.values(UsageEventType);
  const counts = await Promise.all(
    types.map((type) =>
      prisma.usageEvent.count({
        where: { organizationId, type, ...(periodStart ? { createdAt: { gte: periodStart } } : {}) },
      }),
    ),
  );

  return types.map((type, i) => ({
    type,
    used: counts[i] ?? 0,
    limit: LIMITS[planTier]?.[type] ?? null,
  }));
}
