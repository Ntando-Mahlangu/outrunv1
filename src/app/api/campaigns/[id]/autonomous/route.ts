import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentSession } from "@/lib/session";
import { getCurrentOrganization, getMembershipFor } from "@/lib/org";
import { setAutonomousSending } from "@/lib/campaigns/autonomous";
import { UserFacingError } from "@/lib/errors";
import { captureError } from "@/lib/observability";
import { parseJsonBody } from "@/lib/validate-request";

const GENERIC_ERROR =
  "We couldn't update autonomous sending right now. Please try again in a moment.";

const setAutonomousSendingSchema = z.object({
  enabled: z.boolean({ message: "Missing autonomous sending settings." }),
  dailyLimit: z.number({ message: "Missing autonomous sending settings." }),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const organization = await getCurrentOrganization(session.user.id);
  if (!organization) {
    return NextResponse.json({ error: "No workspace found for this account." }, { status: 404 });
  }
  const membership = await getMembershipFor(session.user.id, organization.id);
  if (!membership) {
    return NextResponse.json({ error: "No workspace found for this account." }, { status: 404 });
  }

  const { id } = await params;
  const parsed = await parseJsonBody(request, setAutonomousSendingSchema);
  if (parsed.error) return parsed.error;
  const { enabled, dailyLimit } = parsed.data;

  try {
    const campaign = await setAutonomousSending(
      organization.id,
      membership.role,
      organization.planTier,
      id,
      enabled,
      Math.round(dailyLimit),
    );
    return NextResponse.json({ campaign });
  } catch (error) {
    if (error instanceof UserFacingError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    captureError("campaigns.autonomous.route", error, { organizationId: organization.id, campaignId: id });
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 502 });
  }
}
