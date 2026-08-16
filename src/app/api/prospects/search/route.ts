import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { UsageEventType } from "@prisma/client";
import { getCurrentSession } from "@/lib/session";
import { getCurrentOrganization } from "@/lib/org";
import { getCompanyDataProvider, getActiveCompanyDataProviderName } from "@/lib/leads";
import { scoreCompany } from "@/lib/leads/scoring";
import { parseSearchQuery, applyPostFilters } from "@/lib/leads/query-parser";
import * as companyRepository from "@/lib/repositories/company-repository";
import * as growthBlueprintRepository from "@/lib/repositories/growth-blueprint-repository";
import { checkAndRecordUsage } from "@/lib/billing/usage";
import { logEvent, EventType } from "@/lib/memory/log-event";
import { UserFacingError, RateLimitError } from "@/lib/errors";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import type { GrowthBlueprintData } from "@/lib/growth-blueprint/schema";
import { captureError } from "@/lib/observability";
import { parseJsonBody } from "@/lib/validate-request";

const GENERIC_ERROR =
  "We couldn't complete that search right now. Please try again in a moment.";

const searchProspectsSchema = z.object({
  query: z
    .string()
    .trim()
    .min(3, "Describe who you're looking for — e.g. \"plumbers in Austin, Texas\"."),
});

export async function POST(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const organization = await getCurrentOrganization(session.user.id);
  if (!organization) {
    return NextResponse.json(
      { error: "No workspace found for this account." },
      { status: 404 },
    );
  }

  const parsed = await parseJsonBody(request, searchProspectsSchema);
  if (parsed.error) return parsed.error;
  const { query } = parsed.data;

  try {
    await checkRateLimit(
      `search:${organization.id}`,
      RATE_LIMITS.SEARCH.limit,
      RATE_LIMITS.SEARCH.windowSeconds,
    );
    await checkAndRecordUsage(organization.id, UsageEventType.COMPANY_SEARCH);

    const parsedQuery = await parseSearchQuery(query);

    const provider = getCompanyDataProvider();
    const rawResults = await provider.search({
      placesQuery: parsedQuery.placesQuery,
      location: parsedQuery.location,
      osmTags: parsedQuery.osmTags,
    });
    const results = applyPostFilters(rawResults, parsedQuery.postFilters);

    const latestBlueprint = await growthBlueprintRepository.findLatestIcpForOrg(organization.id);
    const icp = (latestBlueprint?.idealCustomerProfile ??
      null) as GrowthBlueprintData["idealCustomerProfile"] | null;

    const companies = await Promise.all(
      results.map((result) => {
        const score = scoreCompany(result, icp);
        return companyRepository.upsertFromSearchResult(organization.id, result, score);
      }),
    );

    companies.sort((a, b) => (b.fitScore ?? 0) - (a.fitScore ?? 0));

    await logEvent(
      organization.id,
      EventType.COMPANY_SEARCHED,
      `Searched "${query}" — ${companies.length} result${companies.length === 1 ? "" : "s"}.`,
    );

    return NextResponse.json({
      companies,
      interpretation: {
        searchedFor: parsedQuery.placesQuery,
        unsupportedIntents: parsedQuery.unsupportedIntents,
        provider: getActiveCompanyDataProviderName(),
      },
    });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json({ error: error.message }, { status: 429 });
    }
    if (error instanceof UserFacingError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    captureError("prospects.search", error, { organizationId: organization.id });
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 502 });
  }
}
