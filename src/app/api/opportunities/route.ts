import { NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { getCurrentOrganization } from "@/lib/org";
import { getOpenOpportunities, getOpportunityHistory } from "@/lib/opportunities/queries";

export async function GET() {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const organization = await getCurrentOrganization(session.user.id);
  if (!organization) {
    return NextResponse.json({ error: "No workspace found for this account." }, { status: 404 });
  }

  const [open, history] = await Promise.all([
    getOpenOpportunities(organization.id),
    getOpportunityHistory(organization.id),
  ]);

  return NextResponse.json({ open, history });
}
