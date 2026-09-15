import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { getCurrentOrganization } from "@/lib/org";
import { runOpportunityDetection } from "@/lib/opportunities/detect";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { RateLimitError } from "@/lib/errors";
import { captureError } from "@/lib/observability";

const GENERIC_ERROR = "We couldn't rescan for opportunities right now. Please try again in a moment.";

/** On-demand rescan for the current org (the "Rescan" button on
 * /opportunities) — the same 5 deterministic detectors the scheduled
 * sweep runs (src/app/api/cron/opportunity-engine), just for one
 * workspace, on request. No AI calls, so this is cheap enough for the
 * SEARCH rate-limit tier rather than a dedicated one. */
export async function POST() {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const organization = await getCurrentOrganization(session.user.id);
  if (!organization) {
    return NextResponse.json({ error: "No workspace found for this account." }, { status: 404 });
  }

  try {
    await checkRateLimit(`search:${organization.id}`, RATE_LIMITS.SEARCH.limit, RATE_LIMITS.SEARCH.windowSeconds);
    const result = await runOpportunityDetection(organization.id);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json({ error: error.message }, { status: 429 });
    }
    captureError("opportunities.detect", error, { organizationId: organization.id });
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 502 });
  }
}
