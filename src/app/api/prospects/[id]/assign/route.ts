import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentSession } from "@/lib/session";
import { getCurrentOrganization, getMembershipFor } from "@/lib/org";
import { prisma } from "@/lib/prisma";
import * as companyRepository from "@/lib/repositories/company-repository";
import { captureError } from "@/lib/observability";
import { parseJsonBody } from "@/lib/validate-request";

const GENERIC_ERROR = "We couldn't do that right now. Please try again in a moment.";

const assignSchema = z.object({
  assignedToUserId: z.string().nullable(),
});

// docs/outrun/12 team collaboration — assigns a prospect to a teammate so a
// workspace with multiple sellers knows who owns working it. Any member can
// assign (matches the low-friction bar already set for Contact status
// changes), but the target must actually belong to this organization —
// otherwise a company could point at a user with no access to it at all.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const organization = await getCurrentOrganization(session.user.id);
  if (!organization) {
    return NextResponse.json({ error: "No workspace found." }, { status: 404 });
  }

  const { id } = await params;
  const company = await companyRepository.findByIdForOrg(organization.id, id);
  if (!company) {
    return NextResponse.json({ error: "That prospect could not be found." }, { status: 404 });
  }

  const parsed = await parseJsonBody(request, assignSchema);
  if (parsed.error) return parsed.error;
  const { assignedToUserId } = parsed.data;

  if (assignedToUserId) {
    const targetMembership = await getMembershipFor(assignedToUserId, organization.id);
    if (!targetMembership) {
      return NextResponse.json(
        { error: "That teammate isn't part of this workspace." },
        { status: 400 },
      );
    }
  }

  try {
    const updated = await companyRepository.setAssignedTo(id, assignedToUserId);
    return NextResponse.json({ company: updated });
  } catch (error) {
    captureError("prospects.assign", error, { organizationId: organization.id, companyId: id });
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 502 });
  }
}
