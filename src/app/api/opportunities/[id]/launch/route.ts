import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { getCurrentOrganization } from "@/lib/org";
import { executeOpportunity } from "@/lib/opportunities/execute";
import { logEvent, EventType } from "@/lib/memory/log-event";
import { UserFacingError } from "@/lib/errors";
import { captureError } from "@/lib/observability";

const GENERIC_ERROR = "We couldn't launch that right now. Please try again in a moment.";

/**
 * "Review & Launch" (docs/outrun/10 "GROWTH OPPORTUNITY ENGINE" Execute
 * step) — the one click that both approves and acts on a detected
 * opportunity. Nothing here ever fires without this explicit request:
 * the sweep that detects opportunities never calls this itself.
 */
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
    const executionResult = await executeOpportunity(opportunity);

    const updated = await prisma.opportunity.update({
      where: { id: opportunity.id },
      data: {
        status: "LAUNCHED",
        resolvedAt: new Date(),
        launchedByUserId: session.user.id,
        executionResult: executionResult as Prisma.InputJsonValue,
      },
    });

    await logEvent(organization.id, EventType.OPPORTUNITY_LAUNCHED, `Launched: ${opportunity.title}`);

    return NextResponse.json({ opportunity: updated });
  } catch (error) {
    if (error instanceof UserFacingError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    captureError("opportunities.launch", error, { organizationId: organization.id, opportunityId: id });
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 502 });
  }
}
