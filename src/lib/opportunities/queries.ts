import type { ImpactLevel } from "@/components/ui/badge";
import { prisma } from "@/lib/prisma";
import { IMPACT_WEIGHT } from "@/lib/growth-partner/opportunity-sort";

/** Open opportunities, highest-value first (impact weight × confidence —
 * the same transparent, computed-not-fabricated ROI proxy the Opportunity
 * Feed already uses, see opportunity-sort.ts). */
export async function getOpenOpportunities(organizationId: string) {
  const opportunities = await prisma.opportunity.findMany({
    where: { organizationId, status: "DETECTED" },
  });
  return opportunities.sort((a, b) => {
    const scoreA = IMPACT_WEIGHT[a.estimatedImpact as ImpactLevel] * a.confidence;
    const scoreB = IMPACT_WEIGHT[b.estimatedImpact as ImpactLevel] * b.confidence;
    return scoreB - scoreA;
  });
}

/** Launched/Dismissed/Expired opportunities — the "Track" step: what
 * happened to a recommendation after it left the open list. */
export async function getOpportunityHistory(organizationId: string, limit = 20) {
  return prisma.opportunity.findMany({
    where: { organizationId, status: { not: "DETECTED" } },
    orderBy: { resolvedAt: "desc" },
    take: limit,
  });
}
