import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/session";
import { getCurrentOrganization } from "@/lib/org";
import { prisma } from "@/lib/prisma";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import Link from "next/link";
import { BlueprintView } from "@/components/growth-blueprint/blueprint-view";
import { BlueprintActions } from "@/components/growth-blueprint/blueprint-actions";
import { SecondWowSection } from "@/components/growth-blueprint/second-wow-section";
import { isFeatureEnabled, FEATURE_FLAGS } from "@/lib/billing/feature-flags";
import * as companyRepository from "@/lib/repositories/company-repository";
import type { BusinessSnapshot, GrowthBlueprintData, WebsiteAnalysis } from "@/lib/growth-blueprint/schema";

export default async function BlueprintPage({
  searchParams,
}: {
  searchParams: Promise<{ blueprintLimitReached?: string }>;
}) {
  const { blueprintLimitReached } = await searchParams;
  const session = await getCurrentSession();
  if (!session) redirect("/sign-in");

  const organization = await getCurrentOrganization(session.user.id);
  if (!organization) redirect("/sign-in");
  if (!organization.businessProfile) redirect("/onboarding");

  const [blueprint, versionCount] = await Promise.all([
    prisma.growthBlueprint.findFirst({
      where: { organizationId: organization.id },
      orderBy: { version: "desc" },
    }),
    prisma.growthBlueprint.count({ where: { organizationId: organization.id } }),
  ]);

  // Dashboard's own empty state (src/app/(app)/dashboard/page.tsx) handles
  // "no Blueprint yet" gracefully — kicking off generation or showing
  // progress — without ever dead-ending the user, so it's the fallback
  // here too rather than a dedicated generating page.
  if (!blueprint) redirect("/dashboard");

  // docs/outrun/03 "SECOND WOW MOMENT" — only ever shown next to the very
  // first Blueprint (src/lib/jobs/queue.ts only chains
  // src/lib/onboarding/second-wow.ts on version 1), and only when it
  // actually produced a campaign — a genuinely empty result (no lead-data
  // provider configured, nothing found) shows nothing here rather than
  // fabricating numbers.
  let secondWow: {
    companiesFound: number;
    companiesResearched: number;
    outreachCount: number;
    campaignId: string;
  } | null = null;

  if (blueprint.version === 1) {
    const secondWowJob = await prisma.job.findFirst({
      where: { organizationId: organization.id, type: "SECOND_WOW_GENERATION" },
      orderBy: { createdAt: "desc" },
    });

    if (secondWowJob?.status === "SUCCEEDED" && secondWowJob.resultId) {
      const [companyStats, companiesResearched, outreachCount] = await Promise.all([
        companyRepository.countForOrg(organization.id),
        companyRepository.countResearchedForOrg(organization.id),
        prisma.outreachMessage.count({ where: { campaignId: secondWowJob.resultId } }),
      ]);
      secondWow = {
        companiesFound: companyStats._count.id,
        companiesResearched,
        outreachCount,
        campaignId: secondWowJob.resultId,
      };
    }
  }

  return (
    <main className="min-h-screen bg-[var(--color-bg-primary)] px-4 py-16 print:bg-white print:px-0 print:py-0">
      <div className="mx-auto max-w-4xl space-y-8">
        {blueprintLimitReached === "1" && (
          <div className="rounded-[var(--radius-md)] border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 p-4 text-sm text-[var(--color-text-secondary)] print:hidden">
            Your business info was saved, but the Free plan includes only one Growth Blueprint —
            here&apos;s the one you already have.{" "}
            <Link href="/billing" className="text-[var(--color-accent-text)] hover:underline">
              Upgrade to Starter
            </Link>{" "}
            to regenerate it anytime your business changes.
          </div>
        )}

        <div className="print:hidden">
          <BlueprintActions
            hasHistory={versionCount > 1}
            canExport={isFeatureEnabled(
              organization.planTier,
              FEATURE_FLAGS.GROWTH_BLUEPRINT_EXPORT,
              organization.id,
            )}
            initialShareEnabled={organization.blueprintShareEnabled}
            initialShareToken={organization.blueprintShareToken}
          />
        </div>

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

        {secondWow && (
          <SecondWowSection
            companiesFound={secondWow.companiesFound}
            companiesResearched={secondWow.companiesResearched}
            outreachCount={secondWow.outreachCount}
            campaignId={secondWow.campaignId}
          />
        )}

        {!secondWow && (
          <div className="flex justify-center pb-8 print:hidden">
            <Link href="/dashboard" className={cn(buttonVariants({ size: "lg" }))}>
              Continue to Dashboard
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
