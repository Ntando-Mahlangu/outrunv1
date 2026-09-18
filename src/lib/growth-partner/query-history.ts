import { prisma } from "@/lib/prisma";
import type { Prisma, GrowthPartnerQueryType } from "@prisma/client";

const HISTORY_LIMIT = 10;

/** Newest-first, capped list — this is a "recent history" view, not a
 * full audit log (that's what Event already covers). */
export async function getRecentGrowthPartnerQueries<T>(
  organizationId: string,
  type: GrowthPartnerQueryType,
): Promise<{ id: string; question: string; result: T; createdAt: Date }[]> {
  const rows = await prisma.growthPartnerQuery.findMany({
    where: { organizationId, type },
    orderBy: { createdAt: "desc" },
    take: HISTORY_LIMIT,
    select: { id: true, question: true, result: true, createdAt: true },
  });
  return rows.map((r) => ({ ...r, result: r.result as T }));
}

export async function saveGrowthPartnerQuery(
  organizationId: string,
  type: GrowthPartnerQueryType,
  question: string,
  result: unknown,
) {
  await prisma.growthPartnerQuery.create({
    data: { organizationId, type, question, result: result as Prisma.InputJsonValue },
  });
}
