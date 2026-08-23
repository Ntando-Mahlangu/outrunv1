import { NextRequest, NextResponse } from "next/server";
import { EventType } from "@prisma/client";
import { getCurrentSession } from "@/lib/session";
import { getCurrentOrganization } from "@/lib/org";
import { parseCompaniesCsv } from "@/lib/prospects/import-csv";
import { scoreCompany } from "@/lib/leads/scoring";
import * as companyRepository from "@/lib/repositories/company-repository";
import * as growthBlueprintRepository from "@/lib/repositories/growth-blueprint-repository";
import { logEvent } from "@/lib/memory/log-event";
import { UserFacingError, RateLimitError } from "@/lib/errors";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import type { GrowthBlueprintData } from "@/lib/growth-blueprint/schema";
import { captureError } from "@/lib/observability";

const GENERIC_ERROR = "We couldn't import that file right now. Please try again in a moment.";
const MAX_FILE_BYTES = 2 * 1024 * 1024;

// docs/outrun/06 — the manual counterpart to /api/prospects/search: brings
// in a lead list gathered outside Outrun (e.g. a manually-run Google Maps
// export tool) without Outrun itself scraping anything. Feeds the exact
// same scoreCompany/upsertFromSearchResult pipeline every search provider
// uses, so imported companies behave identically to searched ones.
export async function POST(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const organization = await getCurrentOrganization(session.user.id);
  if (!organization) {
    return NextResponse.json({ error: "No workspace found for this account." }, { status: 404 });
  }

  try {
    await checkRateLimit(
      `prospects-import:${organization.id}`,
      RATE_LIMITS.IMPORT.limit,
      RATE_LIMITS.IMPORT.windowSeconds,
    );

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Choose a CSV file to import." }, { status: 400 });
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: "That file is too large — the limit is 2MB." }, { status: 400 });
    }

    const text = await file.text();
    const { companies: rows, skipped } = parseCompaniesCsv(text);

    if (rows.length === 0) {
      return NextResponse.json(
        { error: skipped[0] ?? "That file doesn't have any usable rows." },
        { status: 400 },
      );
    }

    const latestBlueprint = await growthBlueprintRepository.findLatestIcpForOrg(organization.id);
    const icp = (latestBlueprint?.idealCustomerProfile ??
      null) as GrowthBlueprintData["idealCustomerProfile"] | null;

    const companies = await Promise.all(
      rows.map((row) => {
        const score = scoreCompany(row, icp);
        return companyRepository.upsertFromSearchResult(organization.id, row, score);
      }),
    );

    companies.sort((a, b) => (b.fitScore ?? 0) - (a.fitScore ?? 0));

    await logEvent(
      organization.id,
      EventType.COMPANY_IMPORTED,
      `Imported ${companies.length} compan${companies.length === 1 ? "y" : "ies"} from a CSV file.`,
    );

    return NextResponse.json({ companies, skipped });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json({ error: error.message }, { status: 429 });
    }
    if (error instanceof UserFacingError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    captureError("prospects.import", error, { organizationId: organization.id });
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 502 });
  }
}
