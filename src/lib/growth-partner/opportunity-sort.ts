import type { ImpactLevel } from "@/components/ui/badge";

// Split out from opportunity-feed.ts (which pulls in Prisma, logEvent, and
// now the webhook dispatcher's node:dns-based SSRF guard) specifically so
// this file — the only part opportunity-feed-panel.tsx (a "use client"
// component) actually needs — has zero server-only imports. A client
// component statically importing a file that transitively reaches
// node:dns breaks the browser bundle even if the client code never calls
// the function that uses it.
export type OpportunityFeedItem = {
  id: string;
  source: "Growth Blueprint" | "SEO Analysis" | "Unactioned Prospects" | "Reply Rate Trend";
  title: string;
  description: string;
  estimatedImpact: ImpactLevel | null;
  estimatedEffort: ImpactLevel | null;
  confidence: number | null;
  recommendedAction: string;
};

export type OpportunitySort = "roi" | "fastest" | "lowest-effort" | "confidence";

const IMPACT_WEIGHT: Record<ImpactLevel, number> = { High: 3, Medium: 2, Low: 1 };
const EFFORT_EASE_WEIGHT: Record<ImpactLevel, number> = { Low: 3, Medium: 2, High: 1 };

/**
 * docs/outrun/10 "OPPORTUNITY FEED" sort options. "Highest ROI" is a
 * transparent, computed proxy (impact × ease of effort) from the labels
 * above — not a fabricated dollar figure. Items missing a dimension (e.g.
 * SEO quick wins have no impact score) sort after items that have it.
 */
export function sortOpportunities(
  items: OpportunityFeedItem[],
  sort: OpportunitySort,
): OpportunityFeedItem[] {
  const impact = (i: OpportunityFeedItem) => (i.estimatedImpact ? IMPACT_WEIGHT[i.estimatedImpact] : 0);
  const ease = (i: OpportunityFeedItem) =>
    i.estimatedEffort ? EFFORT_EASE_WEIGHT[i.estimatedEffort] : 0;
  const confidence = (i: OpportunityFeedItem) => i.confidence ?? -1;

  const sorted = [...items];
  switch (sort) {
    case "roi":
      sorted.sort((a, b) => impact(b) * ease(b) - impact(a) * ease(a));
      break;
    case "fastest":
      sorted.sort((a, b) => ease(b) - ease(a) || impact(b) - impact(a));
      break;
    case "lowest-effort":
      sorted.sort((a, b) => ease(b) - ease(a));
      break;
    case "confidence":
      sorted.sort((a, b) => confidence(b) - confidence(a));
      break;
  }
  return sorted;
}
