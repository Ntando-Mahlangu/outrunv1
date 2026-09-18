import { UsageEventType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { UserFacingError } from "@/lib/errors";
import { checkAndRecordUsage } from "@/lib/billing/usage";
import { generateOutreach, VARIANT_LABELS, type VariantLabel } from "@/lib/prospects/outreach";
import { generateCampaignStrategy } from "./strategy";
import { type CampaignStrategyData } from "./strategy-schema";
import { logEvent, EventType } from "@/lib/memory/log-event";
import { captureError } from "@/lib/observability";
import * as campaignRepository from "@/lib/repositories/campaign-repository";
import * as companyRepository from "@/lib/repositories/company-repository";

/**
 * As-even-as-possible counts across all of VARIANT_LABELS, then shuffled
 * (Fisher-Yates) so position in the array doesn't determine which
 * variant a company gets — `companies` may already be ordered by fit
 * score or search relevance, and a straight i%N split would otherwise
 * bias each variant toward a different slice of that ordering.
 */
export function buildVariantAssignment(count: number): VariantLabel[] {
  const assignment = Array.from({ length: count }, (_, i) => VARIANT_LABELS[i % VARIANT_LABELS.length]!);
  for (let i = assignment.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = assignment[i]!;
    assignment[i] = assignment[j]!;
    assignment[j] = temp;
  }
  return assignment;
}

export async function createCampaign(
  organizationId: string,
  input: {
    name: string;
    objective: string;
    companyIds: string[];
    abTest?: boolean;
    /** Precomputed at the Strategy Review step (docs/outrun/07 STEP 3) so
     * launching doesn't silently re-run — and potentially change — the
     * strategy the user already reviewed. Falls back to generating fresh
     * if the caller didn't go through that step. */
    strategy?: CampaignStrategyData;
    audienceSource?: string;
  },
) {
  const organization = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
    include: { businessProfile: true },
  });
  if (!organization.businessProfile) {
    throw new UserFacingError("Finish Business Discovery before launching a campaign.");
  }

  const companies = await companyRepository.findManyByIdsForOrgWithResearch(
    organizationId,
    input.companyIds,
  );
  if (companies.length === 0) {
    throw new UserFacingError(
      "Select at least one researched prospect to build a campaign around.",
    );
  }

  const strategy =
    input.strategy ??
    (await generateCampaignStrategy({
      objective: input.objective,
      businessDescription: organization.businessProfile.description,
      idealCustomer: organization.businessProfile.idealCustomer,
      companies: companies.map((c) => ({
        name: c.name,
        category: c.category,
        fitScore: c.fitScore,
      })),
    }));

  const campaign = await campaignRepository.create({
    organizationId,
    name: input.name,
    objective: input.objective,
    strategyRationale: strategy.rationale,
    strategyConfidence: strategy.confidence,
    strategyChannel: strategy.recommendedChannel,
    strategyStrengths: strategy.expectedStrengths,
    strategyWeaknesses: strategy.potentialWeaknesses,
    audienceSource: input.audienceSource ?? "Manual Selection",
  });

  let generatedCount = 0;
  let limitReached = false;

  // docs/outrun/07 "A/B TESTING" — split the audience across all three
  // opening/CTA angles as evenly as the count allows, in a randomized
  // assignment (not a straight i%N alternation) so which variant a
  // company gets never correlates with whatever order `companies`
  // happened to arrive in — the comparison stays fair either way.
  const variantAssignment = input.abTest ? buildVariantAssignment(companies.length) : null;

  for (const [i, company] of companies.entries()) {
    try {
      await checkAndRecordUsage(organizationId, UsageEventType.OUTREACH_GENERATION);
    } catch (error) {
      if (error instanceof UserFacingError) {
        limitReached = true;
        break;
      }
      throw error;
    }

    try {
      const variant = variantAssignment?.[i];
      await generateOutreach(company.id, organizationId, campaign.id, variant);
      generatedCount += 1;
    } catch (error) {
      captureError("campaigns.create.outreach", error, { organizationId, companyId: company.id });
    }
  }

  await campaignRepository.updateStatus(campaign.id, generatedCount > 0 ? "READY" : "DRAFT");

  await logEvent(
    organizationId,
    EventType.CAMPAIGN_CREATED,
    `Campaign "${input.name}" created with ${generatedCount} message${generatedCount === 1 ? "" : "s"}.`,
  );

  return { campaignId: campaign.id, generatedCount, requestedCount: companies.length, limitReached };
}
