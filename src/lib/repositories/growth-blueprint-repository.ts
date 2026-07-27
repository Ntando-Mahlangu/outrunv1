import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import { growthBlueprintTag } from "@/lib/cache-tags";

function fetchLatestForOrg(organizationId: string) {
  return prisma.growthBlueprint.findFirst({
    where: { organizationId },
    orderBy: { version: "desc" },
  });
}

type LatestBlueprint = Awaited<ReturnType<typeof fetchLatestForOrg>>;

// unstable_cache round-trips its return value through JSON, which turns
// the createdAt Date into a string — revive it so callers get a real Date
// instance back, exactly like an uncached Prisma call would return.
function reviveBlueprintDates(blueprint: LatestBlueprint): LatestBlueprint {
  return blueprint && { ...blueprint, createdAt: new Date(blueprint.createdAt) };
}

// docs/outrun/12 "CACHING" — the latest Blueprint (and the Growth Score
// living on it) is read on nearly every dashboard/growth-partner request but
// only changes when a new Blueprint version is generated
// (src/lib/growth-blueprint/generate.ts, which calls revalidateTag on the
// same tag right after its write transaction commits).
export async function findLatestForOrg(organizationId: string) {
  const blueprint = await unstable_cache(
    () => fetchLatestForOrg(organizationId),
    ["growth-blueprint-latest", organizationId],
    { tags: [growthBlueprintTag(organizationId)], revalidate: 300 },
  )();
  return reviveBlueprintDates(blueprint);
}

/** Only the ICP field — used by prospect search to score fit against it. */
export function findLatestIcpForOrg(organizationId: string) {
  return unstable_cache(
    () =>
      prisma.growthBlueprint.findFirst({
        where: { organizationId },
        orderBy: { version: "desc" },
        select: { idealCustomerProfile: true },
      }),
    ["growth-blueprint-latest-icp", organizationId],
    { tags: [growthBlueprintTag(organizationId)], revalidate: 300 },
  )();
}
