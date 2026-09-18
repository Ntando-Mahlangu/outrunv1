import { prisma } from "@/lib/prisma";
import type { GrowthBlueprintData } from "./schema";

type ScoreCategories = GrowthBlueprintData["scoreCategories"];

function diffCategories(previous: ScoreCategories, current: ScoreCategories) {
  return current
    .map((c) => {
      const prev = previous.find((p) => p.category === c.category);
      return prev && prev.score !== c.score
        ? { category: c.category, from: prev.score, to: c.score, delta: c.score - prev.score }
        : null;
    })
    .filter((d): d is NonNullable<typeof d> => d !== null);
}

// Most-recent events shown per version gap, not every event logged in
// that window — a long-lived, active org can easily log hundreds of
// events between two Blueprint regenerations, and this page renders one
// line per event.
const MAX_EVENTS_PER_GAP = 15;

/**
 * docs/outrun/05 "VERSION HISTORY" — score changes plus the actual
 * Business Brain events logged between two versions, so a change is
 * shown alongside real evidence of what happened (e.g. a campaign
 * launched) rather than an invented causal narrative the AI can't
 * actually verify.
 */
export async function getBlueprintHistory(organizationId: string) {
  const versions = await prisma.growthBlueprint.findMany({
    where: { organizationId },
    orderBy: { version: "asc" },
    select: { version: true, growthScore: true, scoreCategories: true, createdAt: true },
  });
  if (versions.length === 0) return [];

  // One bounded query per version gap rather than pulling every Event the
  // org has ever logged into memory and filtering in JS — the previous
  // approach did O(versions x events) work and scaled with the org's
  // entire lifetime event count, not just what this page actually shows.
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
        ? diffCategories(
            previous.scoreCategories as ScoreCategories,
            current.scoreCategories as ScoreCategories,
          )
        : [];

      return {
        version: current.version,
        growthScore: current.growthScore,
        previousGrowthScore: previous?.growthScore ?? null,
        createdAt: current.createdAt,
        categoryDeltas,
        eventsSince: eventsPerGap[i] ?? [],
      };
    })
    .reverse();
}
