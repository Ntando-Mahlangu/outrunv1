import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { BlueprintView } from "@/components/growth-blueprint/blueprint-view";
import type { BusinessSnapshot, GrowthBlueprintData, WebsiteAnalysis } from "@/lib/growth-blueprint/schema";

export default async function SharedBlueprintPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const organization = await prisma.organization.findUnique({
    where: { blueprintShareToken: token },
  });
  if (!organization || !organization.blueprintShareEnabled) notFound();

  const blueprint = await prisma.growthBlueprint.findFirst({
    where: { organizationId: organization.id },
    orderBy: { version: "desc" },
  });
  if (!blueprint) notFound();

  const previousBlueprint = await prisma.growthBlueprint.findFirst({
    where: { organizationId: organization.id, version: { lt: blueprint.version } },
    orderBy: { version: "desc" },
    select: { growthScore: true },
  });

  return (
    <main className="min-h-screen bg-[var(--color-bg-primary)] px-4 py-16">
      <div className="mx-auto max-w-4xl">
        <p className="mb-6 text-center text-xs text-[var(--color-text-muted)]">
          Shared read-only view — always shows {organization.name}&apos;s latest Growth Blueprint.
        </p>
        <BlueprintView
          organizationName={organization.name}
          blueprint={{
            version: blueprint.version,
            growthScore: blueprint.growthScore,
            createdAt: blueprint.createdAt,
            previousGrowthScore: previousBlueprint?.growthScore,
            executiveSummary: blueprint.executiveSummary,
            confidenceNotes: blueprint.confidenceNotes,
            businessSnapshot: blueprint.businessSnapshot as BusinessSnapshot,
            strengths: blueprint.strengths as GrowthBlueprintData["strengths"],
            weaknesses: blueprint.weaknesses as GrowthBlueprintData["weaknesses"],
            biggestBottleneck: blueprint.biggestBottleneck as GrowthBlueprintData["biggestBottleneck"],
            opportunities: blueprint.opportunities as GrowthBlueprintData["opportunities"],
            growthStrategy: blueprint.growthStrategy as GrowthBlueprintData["growthStrategy"],
            idealCustomerProfile:
              blueprint.idealCustomerProfile as GrowthBlueprintData["idealCustomerProfile"],
            roadmap: blueprint.roadmap as GrowthBlueprintData["roadmap"],
            websiteAnalysis: blueprint.websiteAnalysis as WebsiteAnalysis | null,
            scoreCategories: blueprint.scoreCategories as GrowthBlueprintData["scoreCategories"],
          }}
        />
      </div>
    </main>
  );
}
