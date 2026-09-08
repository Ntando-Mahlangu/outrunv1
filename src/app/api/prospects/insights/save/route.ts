import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { getCurrentOrganization } from "@/lib/org";
import { saveCallOutcomePatternsToMemory } from "@/lib/prospects/call-insights";
import { RateLimitError } from "@/lib/errors";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { captureError } from "@/lib/observability";

const GENERIC_ERROR = "We couldn't save that right now. Please try again in a moment.";

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
    await checkRateLimit(
      `prospects-insights-save:${organization.id}`,
      RATE_LIMITS.EXPORT.limit,
      RATE_LIMITS.EXPORT.windowSeconds,
    );
    const result = await saveCallOutcomePatternsToMemory(organization.id);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json({ error: error.message }, { status: 429 });
    }
    captureError("prospects.insights.save", error, { organizationId: organization.id });
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 502 });
  }
}
