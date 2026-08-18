import { UsageEventType } from "@prisma/client";
import { getCompanyDataProvider } from "@/lib/leads";
import { scoreCompany } from "@/lib/leads/scoring";
import * as companyRepository from "@/lib/repositories/company-repository";
import { checkAndRecordUsage } from "@/lib/billing/usage";
import { UserFacingError } from "@/lib/errors";
import { logEvent, EventType } from "@/lib/memory/log-event";
import { createNotification, NotificationType } from "@/lib/notifications/create-notification";
import { captureError } from "@/lib/observability";
import { researchCompany } from "@/lib/prospects/research";
import { createCampaign } from "@/lib/campaigns/create";
import type { GrowthBlueprintData } from "@/lib/growth-blueprint/schema";

export type SecondWowResult = {
  companiesFound: number;
  companiesResearched: number;
  campaignId: string | null;
  outreachGenerated: number;
};

// Small enough to leave most of a Free org's monthly research (10) and
// outreach (5) allotment for the user's own exploration afterward, per
// docs/outrun/14's PAYWALL STRATEGY ("show value, then let limits bite") —
// still large enough to feel like real, unmistakable work got done before
// the user asked for anything, per docs/outrun/03 "SECOND WOW MOMENT".
const AUTO_RESEARCH_COUNT = 3;

/**
 * docs/outrun/03 "SECOND WOW MOMENT" — "Outrun has already worked... The
 * user should feel: 'I haven't even done anything yet.'" Runs once, right
 * after the very first Growth Blueprint is generated (never on a
 * regeneration — see the `version === 1` check at the call site in
 * src/lib/jobs/queue.ts): searches using the Blueprint's own ICP, scores
 * and researches the best-fit matches, then builds one ready-to-review
 * campaign from them.
 *
 * Never throws — every step degrades gracefully (no lead-data-provider
 * configured, a usage limit already hit, an individual research call
 * failing) since this runs as a bonus on top of an already-successful
 * Blueprint job; a failure here must never mark that job FAILED. A
 * genuinely empty result (companiesFound: 0) is the honest outcome when
 * nothing could be generated — never fabricated to look like it worked.
 */
export async function generateSecondWow(
  organizationId: string,
  icp: GrowthBlueprintData["idealCustomerProfile"],
): Promise<SecondWowResult> {
  const empty: SecondWowResult = {
    companiesFound: 0,
    companiesResearched: 0,
    campaignId: null,
    outreachGenerated: 0,
  };

  let provider;
  try {
    provider = getCompanyDataProvider();
  } catch (error) {
    captureError("onboarding.second-wow.no-provider", error, { organizationId });
    return empty;
  }

  try {
    await checkAndRecordUsage(organizationId, UsageEventType.COMPANY_SEARCH);
  } catch (error) {
    if (error instanceof UserFacingError) return empty;
    throw error;
  }

  const query = `${icp.industry} in ${icp.location}`;
  // No AI query-parsing call in this path (unlike /api/prospects/search) —
  // this already-multi-step onboarding chain shouldn't spend another AI
  // call just to derive OSM tags, so osmTags is left empty. OsmPlacesProvider
  // falls back to generic business tags in that case (see osm-provider.ts),
  // which is an honest degrade: still scoped to the ICP's location, just not
  // filtered to its industry on the free provider.
  const results = await provider.search({ placesQuery: query, location: icp.location, osmTags: [] });
  if (results.length === 0) return empty;

  const companies = await Promise.all(
    results.map((result) => {
      const score = scoreCompany(result, icp);
      return companyRepository.upsertFromSearchResult(organizationId, result, score);
    }),
  );
  companies.sort((a, b) => (b.fitScore ?? 0) - (a.fitScore ?? 0));

  await logEvent(
    organizationId,
    EventType.COMPANY_SEARCHED,
    `Automatically searched "${query}" — ${companies.length} result${companies.length === 1 ? "" : "s"}.`,
  );

  const researchedIds: string[] = [];
  for (const company of companies.slice(0, AUTO_RESEARCH_COUNT)) {
    try {
      await checkAndRecordUsage(organizationId, UsageEventType.COMPANY_RESEARCH);
    } catch (error) {
      if (error instanceof UserFacingError) break;
      throw error;
    }

    try {
      await researchCompany(company.id, organizationId);
      researchedIds.push(company.id);
    } catch (error) {
      captureError("onboarding.second-wow.research", error, { organizationId, companyId: company.id });
    }
  }

  if (researchedIds.length === 0) {
    return { ...empty, companiesFound: companies.length };
  }

  try {
    const campaign = await createCampaign(organizationId, {
      name: `${icp.industry} Outreach`,
      objective: `Reach out to the best-fit ${icp.industry.toLowerCase()} prospects Outrun found and start conversations that lead to new business.`,
      companyIds: researchedIds,
    });

    await createNotification(
      organizationId,
      NotificationType.CAMPAIGN_FINISHED,
      "Your first campaign is ready",
      `Outrun found ${companies.length} qualified prospects, researched ${researchedIds.length} of them, and prepared ${campaign.generatedCount} outreach message${campaign.generatedCount === 1 ? "" : "s"} — ready to review.`,
      `/campaigns/${campaign.campaignId}`,
    );

    return {
      companiesFound: companies.length,
      companiesResearched: researchedIds.length,
      campaignId: campaign.campaignId,
      outreachGenerated: campaign.generatedCount,
    };
  } catch (error) {
    captureError("onboarding.second-wow.campaign", error, { organizationId });
    return { ...empty, companiesFound: companies.length, companiesResearched: researchedIds.length };
  }
}
