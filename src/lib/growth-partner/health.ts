import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { growthBlueprintTag } from "@/lib/cache-tags";
import type { GrowthBlueprintData } from "@/lib/growth-blueprint/schema";

export type HealthCategory = {
  category: string;
  score: number;
  trend: number | null;
  status: string;
  mainIssue: string | null;
  fastestImprovement: string;
};

export type BusinessHealth = {
  overall: number;
  overallTrend: number | null;
  categories: HealthCategory[];
};

const LOW_SCORE_THRESHOLD = 60;

/**
 * docs/outrun/10 "BUSINESS HEALTH SCORE" — deliberately reuses the Growth
 * Blueprint's own score and per-category breakdown rather than running a
 * second, parallel AI-scoring pipeline. Two different numbers both
 * claiming to be "the" health score would contradict each other and
 * erode trust; this way there's one source of truth, just presented with
 * trend (vs. the previous Blueprint version) and framed per docs/outrun/10's
 * "status / main issue / fastest improvement" structure. "Main issue" is
 * only populated when a category is actually scoring low — otherwise
 * there's honestly nothing to flag, and we don't invent one.
 */
export async function getBusinessHealth(organizationId: string): Promise<BusinessHealth | null> {
  // Same underlying rows as the growth-blueprint repository reads, so it
  // shares that tag — regenerating a Blueprint invalidates both together.
  const versions = await unstable_cache(
    () =>
      prisma.growthBlueprint.findMany({
        where: { organizationId },
        orderBy: { version: "desc" },
        take: 2,
        select: { growthScore: true, scoreCategories: true },
      }),
    ["business-health-versions", organizationId],
    { tags: [growthBlueprintTag(organizationId)], revalidate: 300 },
  )();
  const [latest, previous] = versions;
  if (!latest) return null;

  const latestCategories = latest.scoreCategories as GrowthBlueprintData["scoreCategories"];
  const previousCategories = previous?.scoreCategories as
    | GrowthBlueprintData["scoreCategories"]
    | undefined;

  const categories: HealthCategory[] = latestCategories.map((c) => {
    const prev = previousCategories?.find((p) => p.category === c.category);
    return {
      category: c.category,
      score: c.score,
      trend: prev ? c.score - prev.score : null,
      status: c.reason,
      mainIssue: c.score < LOW_SCORE_THRESHOLD ? c.reason : null,
      fastestImprovement: c.recommendation,
    };
  });

  return {
    overall: latest.growthScore,
    overallTrend: previous ? latest.growthScore - previous.growthScore : null,
    categories,
  };
}
