import { prisma } from "@/lib/prisma";

const RECENT_FAILURE_WINDOW_MS = 24 * 60 * 60 * 1000;

export function getInFlightBlueprintJob(organizationId: string) {
  return prisma.job.findFirst({
    where: {
      organizationId,
      type: "BLUEPRINT_GENERATION",
      status: { in: ["PENDING", "RUNNING"] },
    },
  });
}

// Only a *recent* failure is still worth explaining — runJob()
// (src/lib/jobs/queue.ts) only guarantees errorMessage is safe to show
// verbatim for jobs it has sanitized itself; that guarantee doesn't
// retroactively cover rows written before that logic existed. Bounding to
// the last 24h means any pre-fix leftover ages out on its own rather than
// being shown as if it were the reason generation is blocked right now —
// which may no longer even be true.
export function getRecentFailedBlueprintJob(organizationId: string) {
  return prisma.job.findFirst({
    where: {
      organizationId,
      type: "BLUEPRINT_GENERATION",
      status: "FAILED",
      completedAt: { gte: new Date(Date.now() - RECENT_FAILURE_WINDOW_MS) },
    },
    orderBy: { createdAt: "desc" },
  });
}
