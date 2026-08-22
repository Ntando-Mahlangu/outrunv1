import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { EventType } from "@prisma/client";
import { getCurrentSession } from "@/lib/session";
import { getCurrentOrganization } from "@/lib/org";
import { prisma } from "@/lib/prisma";
import * as companyRepository from "@/lib/repositories/company-repository";
import { logEvent } from "@/lib/memory/log-event";
import { captureError } from "@/lib/observability";
import { parseJsonBody } from "@/lib/validate-request";

const GENERIC_ERROR = "We couldn't do that right now. Please try again in a moment.";

const OUTCOME_LABEL: Record<string, string> = {
  ANSWERED: "answered",
  VOICEMAIL: "went to voicemail",
  NO_ANSWER: "wasn't answered",
  CALLBACK_REQUESTED: "asked for a callback",
  NOT_INTERESTED: "wasn't interested",
  WRONG_NUMBER: "was a wrong number",
  DO_NOT_CALL: "asked not to be called again",
};

const createCallLogSchema = z.object({
  contactId: z.string().nullable().optional(),
  outcome: z.enum(
    ["ANSWERED", "VOICEMAIL", "NO_ANSWER", "CALLBACK_REQUESTED", "NOT_INTERESTED", "WRONG_NUMBER", "DO_NOT_CALL"],
    { message: "Choose a valid call outcome." },
  ),
  notes: z.string().optional(),
});

// docs/outrun/07 "COLD CALL SCRIPT" — logs what happened on an actual call,
// distinct from the script itself. Kept as its own resource (not folded
// into Contact.relationshipStatus) since a company can be called many
// times with different outcomes, while relationshipStatus is a single
// current-state field the user sets manually.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  const parsed = await parseJsonBody(request, createCallLogSchema);
  if (parsed.error) return parsed.error;
  const { contactId, outcome, notes } = parsed.data;

  if (contactId) {
    const contact = await prisma.contact.findFirst({ where: { id: contactId, companyId: id } });
    if (!contact) {
      return NextResponse.json({ error: "That contact could not be found." }, { status: 404 });
    }
  }

  try {
    const callLog = await prisma.callLog.create({
      data: {
        companyId: id,
        contactId: contactId ? contactId : null,
        loggedByUserId: session.user.id,
        loggedByName: session.user.name,
        outcome,
        notes: notes ? notes : null,
      },
    });

    await logEvent(
      organization.id,
      EventType.CALL_LOGGED,
      `Call with ${company.name} ${OUTCOME_LABEL[outcome]}.`,
    );

    return NextResponse.json({ callLog });
  } catch (error) {
    captureError("prospects.calls.create", error, { organizationId: organization.id, companyId: id });
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 502 });
  }
}
