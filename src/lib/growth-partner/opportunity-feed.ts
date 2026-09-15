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

/**
 * docs/outrun/10 "OPPORTUNITY FEED" — Growth Blueprint opportunities and
 * SEO quick wins (both AI-generated, versioned, with their own detail
 * pages already). The two real, deterministic signals that used to live
 * here (unactioned high-fit prospects, a declining reply-rate trend) have
 * moved to the durable, launchable Opportunity Engine
 * (src/lib/opportunities/detect.ts) — one system of record instead of a
 * live-computed one with no lifecycle. SEO quick wins aren't individually
 * scored by the AI, so their impact/confidence are left null instead of a
 * fabricated number — only their effort is set, since "quick win" already
 * implies low effort by definition.
 */
export async function getOpportunityFeed(organizationId: string): Promise<OpportunityFeedItem[]> {
  const [blueprint, seoAnalysis, dismissedIds] = await Promise.all([
    prisma.growthBlueprint.findFirst({
      where: { organizationId },
      orderBy: { version: "desc" },
    }),
    prisma.seoAnalysis.findFirst({
      where: { organizationId },
      orderBy: { version: "desc" },
    }),
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

  // docs/outrun/08 "FEEDBACK LOOP" — a Dismissed rating removes the item
  // from the live feed, not just the one time the user clicked it.
  return items.filter((item) => !dismissedIds.has(item.id));
}
