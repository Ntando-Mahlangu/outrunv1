import { prisma } from "@/lib/prisma";
import type { GrowthBlueprintData } from "@/lib/growth-blueprint/schema";
import { getDismissedItemIds } from "./recommendation-feedback";
import type { OpportunityFeedItem } from "./opportunity-sort";

// Type-only re-export (erased at compile time, no runtime import) for
// convenience — anything needing sortOpportunities() itself must import
// straight from ./opportunity-sort, not through this file, since this
// file's own imports (recommendation-feedback -> log-event -> the
// webhook dispatcher's node:dns-based SSRF guard) are server-only and
// must never be reachable from a "use client" component.
export type { OpportunityFeedItem, OpportunitySort } from "./opportunity-sort";

const UNACTIONED_MIN_FIT_SCORE = 70;
const TREND_WINDOW_DAYS = 14;
const TREND_MIN_SAMPLE = 5;
const TREND_MIN_DECLINE_POINTS = 10;

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

/** docs/outrun/07 "AUTONOMOUS GROWTH MODE — new companies matching ICP."
 * A live re-search against the lead-data provider on every read would
 * burn API quota silently on each page load, so this surfaces something
 * just as real and free to compute: high-fit companies Outrun already
 * found that nobody has reached out to yet. */
async function getUnactionedProspectsOpportunity(
  organizationId: string,
): Promise<OpportunityFeedItem | null> {
  const count = await prisma.company.count({
    where: {
      organizationId,
      fitScore: { gte: UNACTIONED_MIN_FIT_SCORE },
      outreachMessages: { none: {} },
    },
  });
  if (count === 0) return null;

  return {
    id: "unactioned-prospects",
    source: "Unactioned Prospects",
    title: `${count} high-fit prospect${count === 1 ? "" : "s"} found but never contacted`,
    description:
      "These companies scored as strong matches for your ideal customer profile, but no outreach has been sent to any of them yet.",
    estimatedImpact: null,
    estimatedEffort: "Low",
    confidence: null,
    recommendedAction: "Add them to a campaign, or research them individually from Prospects.",
  };
}

/** docs/outrun/07 "AUTONOMOUS GROWTH MODE — declining reply rates." A
 * real time-windowed comparison (last 14 days vs. the 14 before that),
 * not a cross-sectional bucket split — same honesty bar as the
 * Improvement Loop: only surfaces once both windows clear a minimum
 * sample size and the drop clears a minimum size, never off a couple of
 * sends. */
async function getReplyRateTrendOpportunity(
  organizationId: string,
): Promise<OpportunityFeedItem | null> {
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
    id: "reply-rate-trend",
    source: "Reply Rate Trend",
    title: "Reply rate has dropped recently",
    description: `Your reply rate over the last ${TREND_WINDOW_DAYS} days is ${recentRate}%, down from ${priorRate}% in the ${TREND_WINDOW_DAYS} days before that.`,
    estimatedImpact: null,
    estimatedEffort: null,
    confidence: null,
    recommendedAction: "Check the Improvement Loop on Campaigns for what's working right now.",
  };
}

/**
 * docs/outrun/10 "OPPORTUNITY FEED" and docs/outrun/07 "AUTONOMOUS GROWTH
 * MODE" share this one feed — Growth Blueprint opportunities and SEO
 * quick wins (both AI-generated), plus two real, deterministic signals
 * computed straight from send/reply data (unactioned high-fit prospects,
 * a declining reply-rate trend). Three of the doc's other autonomous
 * signals — emerging industries, competitor changes, pricing
 * observations — have no real data source anywhere in this app (no
 * market-data feed, no competitor/pricing tracking), so building
 * "detectors" for them would mean fabricating signals; they're left out
 * rather than faked. SEO quick wins aren't individually scored by the
 * AI, so their impact/confidence are left null instead of a fabricated
 * number — only their effort is set, since "quick win" already implies
 * low effort by definition.
 */
export async function getOpportunityFeed(organizationId: string): Promise<OpportunityFeedItem[]> {
  const [blueprint, seoAnalysis, unactionedProspects, replyRateTrend, dismissedIds] = await Promise.all([
    prisma.growthBlueprint.findFirst({
      where: { organizationId },
      orderBy: { version: "desc" },
    }),
    prisma.seoAnalysis.findFirst({
      where: { organizationId },
      orderBy: { version: "desc" },
    }),
    getUnactionedProspectsOpportunity(organizationId),
    getReplyRateTrendOpportunity(organizationId),
    getDismissedItemIds(organizationId),
  ]);

  const items: OpportunityFeedItem[] = [];

  if (blueprint) {
    const opportunities = blueprint.opportunities as GrowthBlueprintData["opportunities"];
    opportunities.forEach((o, i) => {
      items.push({
        id: `blueprint-${blueprint.version}-${i}`,
        source: "Growth Blueprint",
        title: o.title,
        description: o.description,
        estimatedImpact: o.estimatedImpact,
        estimatedEffort: o.estimatedEffort,
        confidence: o.confidence,
        recommendedAction: o.recommendedAction,
      });
    });
  }

  if (seoAnalysis) {
    const quickWins = seoAnalysis.quickWins as string[];
    quickWins.forEach((win, i) => {
      items.push({
        id: `seo-${seoAnalysis.version}-${i}`,
        source: "SEO Analysis",
        title: win,
        description: "Identified as a quick win in your latest SEO analysis.",
        estimatedImpact: null,
        estimatedEffort: "Low",
        confidence: null,
        recommendedAction: "Review and implement from the SEO page.",
      });
    });
  }

  if (unactionedProspects) items.push(unactionedProspects);
  if (replyRateTrend) items.push(replyRateTrend);

  // docs/outrun/08 "FEEDBACK LOOP" — a Dismissed rating removes the item
  // from the live feed, not just the one time the user clicked it.
  return items.filter((item) => !dismissedIds.has(item.id));
}
