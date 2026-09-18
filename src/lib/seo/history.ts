import { prisma } from "@/lib/prisma";
import type { SEOAnalysisData } from "./schema";

type Categories = SEOAnalysisData["categories"];

function diffCategories(previous: Categories, current: Categories) {
  return current
    .map((c) => {
      const prev = previous.find((p) => p.category === c.category);
      return prev && prev.score !== c.score
        ? { category: c.category, from: prev.score, to: c.score, delta: c.score - prev.score }
        : null;
    })
    .filter((d): d is NonNullable<typeof d> => d !== null);
}

// Same reasoning as Growth Blueprint history's cap (src/lib/growth-blueprint/history.ts)
// — most-recent events per gap, not every event an active org logged in
// that window.
const MAX_EVENTS_PER_GAP = 15;

/**
 * docs/outrun/09's analogue to the Growth Blueprint's Version History —
 * health score changes across SEO analyses, plus the real Business
 * Brain events logged between two of them (new content drafted, a
 * campaign launched, etc.), so an SEO trend is shown next to actual
 * evidence of what happened rather than an invented narrative.
 */
export async function getSeoHistory(organizationId: string) {
  const versions = await prisma.seoAnalysis.findMany({
    where: { organizationId },
    orderBy: { version: "asc" },
    select: {
      version: true,
      healthScore: true,
      categories: true,
      executiveSummary: true,
      quickWins: true,
      createdAt: true,
    },
  });
  if (versions.length === 0) return [];

  const eventsPerGap = await Promise.all(
    versions.map((current, i) => {
      const previous = versions[i - 1];
      if (!previous) return Promise.resolve([]);
      return prisma.event.findMany({
        where: { organizationId, createdAt: { gt: previous.createdAt, lte: current.createdAt } },
        orderBy: { createdAt: "desc" },
        take: MAX_EVENTS_PER_GAP,
      });
    }),
  );

  return versions
    .map((current, i) => {
      const previous = versions[i - 1];
      const categoryDeltas = previous
        ? diffCategories(previous.categories as Categories, current.categories as Categories)
        : [];

      return {
        version: current.version,
        healthScore: current.healthScore,
        previousHealthScore: previous?.healthScore ?? null,
        createdAt: current.createdAt,
        executiveSummary: current.executiveSummary,
        quickWins: current.quickWins as string[],
        categoryDeltas,
        eventsSince: eventsPerGap[i] ?? [],
      };
    })
    .reverse();
}
