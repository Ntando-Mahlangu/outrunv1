import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { getCurrentOrganization } from "@/lib/org";
import { captureError } from "@/lib/observability";

const GENERIC_ERROR = "We couldn't dismiss that right now. Please try again in a moment.";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const organization = await getCurrentOrganization(session.user.id);
  if (!organization) {
    return NextResponse.json({ error: "No workspace found for this account." }, { status: 404 });
  }

  const { id } = await params;
  const opportunity = await prisma.opportunity.findFirst({ where: { id, organizationId: organization.id } });
  if (!opportunity) {
    return NextResponse.json({ error: "That opportunity could not be found." }, { status: 404 });
  }
  if (opportunity.status !== "DETECTED") {
    return NextResponse.json({ error: "This opportunity has already been resolved." }, { status: 409 });
  }

  try {
    const updated = await prisma.opportunity.update({
      where: { id: opportunity.id },
      data: { status: "DISMISSED", resolvedAt: new Date() },
    });
    return NextResponse.json({ opportunity: updated });
  } catch (error) {
    captureError("opportunities.dismiss", error, { organizationId: organization.id, opportunityId: id });
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 502 });
  }
}
