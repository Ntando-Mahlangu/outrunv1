import { prisma } from "@/lib/prisma";
import { getBusinessContext } from "@/lib/memory/context";
import { getCallActivitySummary } from "@/lib/prospects/call-insights";
import type { GrowthBlueprintData } from "@/lib/growth-blueprint/schema";

export type RiskUrgency = "Now" | "This Week" | "Monitor";

export type Signal = {
  severity: "High" | "Medium" | "Low";
  title: string;
  // What's true, and why it's a risk — an observed fact, never the fix.
  reason: string;
  // The concrete next step, separate from the fact above (Article IV/VIII
  // — never blur an observation and a recommendation into one field).
  recommendation: string;
  urgency: RiskUrgency;
};

const STALE_BLUEPRINT_DAYS = 30;

// Same "statistically-honest" spirit as the Opportunity Engine's
// detectors (src/lib/opportunities/detect.ts): a trend only counts once
// there's a real prior sample to compare against, and the drop is large
// enough to not be normal week-to-week noise.
const TREND_WINDOW_DAYS = 14;
const TREND_MIN_SAMPLE = 5;
const TREND_DECLINE_RATIO = 0.4;
const NO_FOLLOWUP_WINDOW_DAYS = 14;
const WEAK_SEO_HEALTH_SCORE = 50;

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

/**
 * Cheap, deterministic signals computed from data already on hand — no AI
 * call needed for "is anything obviously wrong". Kept separate from the
 * Growth Partner chat so it's instant and always available, even before
 * asking a question (docs/outrun/10 "RISK DETECTION").
 */
export async function getRisksAndOpportunities(organizationId: string): Promise<Signal[]> {
  const context = await getBusinessContext(organizationId);
  const signals: Signal[] = [];

  if (!context.blueprint) {
    signals.push({
      severity: "High",
      title: "No Growth Blueprint yet",
      reason: "There's no scored, evidence-based growth strategy guiding what to do next.",
      recommendation: "Generate your Growth Blueprint.",
      urgency: "Now",
    });
    return signals;
  }

  const daysSinceBlueprint = Math.floor(
    (Date.now() - context.blueprint.createdAt.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (daysSinceBlueprint > STALE_BLUEPRINT_DAYS) {
    signals.push({
      severity: "Medium",
      title: "Growth Blueprint is out of date",
      reason: `Last generated ${daysSinceBlueprint} days ago — your business has likely changed since then.`,
      recommendation: "Regenerate your Growth Blueprint to get an up-to-date strategy.",
      urgency: "This Week",
    });
  }

  if (context.campaigns.length === 0) {
    signals.push({
      severity: "Medium",
      title: "No campaigns running",
      reason: "You have prospects researched but no campaign built around them yet.",
      recommendation: "Build a campaign from your researched prospects.",
      urgency: "This Week",
    });
  }

  if (context.businessProfile && context.businessProfile.acquisitionChannels.length === 1) {
    signals.push({
      severity: "Medium",
      title: "Single acquisition channel",
      reason: `You currently rely only on "${context.businessProfile.acquisitionChannels[0]}" — a single channel is a concentration risk.`,
      recommendation: "Test a second acquisition channel to reduce that dependency.",
      urgency: "Monitor",
    });
  }

  const [recentLeads, priorLeads] = await Promise.all([
    prisma.company.count({ where: { organizationId, createdAt: { gte: daysAgo(TREND_WINDOW_DAYS) } } }),
    prisma.company.count({
      where: { organizationId, createdAt: { gte: daysAgo(TREND_WINDOW_DAYS * 2), lt: daysAgo(TREND_WINDOW_DAYS) } },
    }),
  ]);
  if (priorLeads >= TREND_MIN_SAMPLE && recentLeads <= priorLeads * (1 - TREND_DECLINE_RATIO)) {
    signals.push({
      severity: "Medium",
      title: "Lead generation is slowing",
      reason: `Only ${recentLeads} new prospect${recentLeads === 1 ? "" : "s"} found in the last ${TREND_WINDOW_DAYS} days, down from ${priorLeads} in the ${TREND_WINDOW_DAYS} days before that.`,
      recommendation: "Run a new prospect search to keep the pipeline fed.",
      urgency: "This Week",
    });
  }

  const [recentActivity, priorActivity] = await Promise.all([
    getCallActivitySummary(organizationId, daysAgo(TREND_WINDOW_DAYS), new Date()),
    getCallActivitySummary(organizationId, daysAgo(TREND_WINDOW_DAYS * 2), daysAgo(TREND_WINDOW_DAYS)),
  ]);
  if (priorActivity.total >= TREND_MIN_SAMPLE && recentActivity.total <= priorActivity.total * (1 - TREND_DECLINE_RATIO)) {
    signals.push({
      severity: "Medium",
      title: "Pipeline activity is declining",
      reason: `${recentActivity.total} call${recentActivity.total === 1 ? "" : "s"} logged in the last ${TREND_WINDOW_DAYS} days, down from ${priorActivity.total} in the ${TREND_WINDOW_DAYS} days before that.`,
      recommendation: "Block time for a calling session to get the pipeline moving again.",
      urgency: "This Week",
    });
  }

  const [engagedContactCount, recentCallCount] = await Promise.all([
    prisma.contact.count({
      where: { company: { organizationId }, relationshipStatus: { in: ["CONTACTED", "RESPONDED", "QUALIFIED"] } },
    }),
    prisma.callLog.count({
      where: { company: { organizationId }, createdAt: { gte: daysAgo(NO_FOLLOWUP_WINDOW_DAYS) } },
    }),
  ]);
  if (engagedContactCount > 0 && recentCallCount === 0) {
    signals.push({
      severity: "High",
      title: "No follow-up activity",
      reason: `You have ${engagedContactCount} contact${engagedContactCount === 1 ? "" : "s"} already in conversation, but no calls have been logged in ${NO_FOLLOWUP_WINDOW_DAYS}+ days.`,
      recommendation: "Start a calling session to follow up before these leads go cold.",
      urgency: "Now",
    });
  }

  const latestSeoAnalysis = await prisma.seoAnalysis.findFirst({
    where: { organizationId },
    orderBy: { version: "desc" },
    select: { healthScore: true },
  });
  if (latestSeoAnalysis && latestSeoAnalysis.healthScore < WEAK_SEO_HEALTH_SCORE) {
    signals.push({
      severity: "Medium",
      title: `Weak SEO health score (${latestSeoAnalysis.healthScore}/100)`,
      reason: "Your last SEO crawl found real technical or content gaps holding back organic visibility.",
      recommendation: "Review the SEO page for the specific quick wins found in your last crawl.",
      urgency: "Monitor",
    });
  }

  const scoreCategories = context.blueprint.scoreCategories as GrowthBlueprintData["scoreCategories"];
  for (const category of scoreCategories) {
    if (category.score < 40) {
      signals.push({
        severity: "Low",
        title: `${category.category} is scoring low (${category.score}/100)`,
        reason: category.reason,
        recommendation: category.recommendation,
        urgency: "Monitor",
      });
    }
  }

  return signals;
}
