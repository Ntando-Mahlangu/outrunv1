import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentSession } from "@/lib/session";
import { getCurrentOrganization } from "@/lib/org";
import { prisma } from "@/lib/prisma";
import { BlueprintView } from "@/components/growth-blueprint/blueprint-view";
import type { BusinessSnapshot, GrowthBlueprintData, WebsiteAnalysis } from "@/lib/growth-blueprint/schema";

export default async function BlueprintHistoryVersionPage({
  params,
}: {
  params: Promise<{ version: string }>;
}) {
  const session = await getCurrentSession();
  if (!session) redirect("/sign-in");

  const organization = await getCurrentOrganization(session.user.id);
  if (!organization) redirect("/sign-in");

  const { version } = await params;
  const blueprint = await prisma.growthBlueprint.findFirst({
    where: { organizationId: organization.id, version: Number.parseInt(version, 10) },
  });
  if (!blueprint) notFound();

  return (
    <div className="py-16">
      <div className="mx-auto max-w-4xl space-y-4">
        <Link
          href="/blueprint/history"
          className="text-sm text-[var(--color-accent-text)] hover:underline"
        >
          ← Version history
        </Link>
        <a
          href={`/api/blueprint/export?format=markdown&version=${blueprint.version}`}
          className="ml-4 text-sm text-[var(--color-accent-text)] hover:underline"
        >
          Export this version (Markdown)
        </a>
        <BlueprintView
          organizationName={organization.name}
          blueprint={{
            version: blueprint.version,
            growthScore: blueprint.growthScore,
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
    </div>
  );
}
