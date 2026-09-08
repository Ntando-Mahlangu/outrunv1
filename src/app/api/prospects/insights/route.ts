import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { getCurrentOrganization } from "@/lib/org";
import { analyzeCallOutcomePatterns } from "@/lib/prospects/call-insights";
import { captureError } from "@/lib/observability";

const GENERIC_ERROR = "We couldn't load that right now. Please try again in a moment.";

export async function GET() {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const organization = await getCurrentOrganization(session.user.id);
  if (!organization) {
    return NextResponse.json({ error: "No workspace found for this account." }, { status: 404 });
  }

  try {
    const result = await analyzeCallOutcomePatterns(organization.id);
    return NextResponse.json(result);
  } catch (error) {
    captureError("prospects.insights.get", error, { organizationId: organization.id });
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 502 });
  }
}
