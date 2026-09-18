import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentSession } from "@/lib/session";
import { getCurrentOrganization } from "@/lib/org";
import { updateOutreachMessageContent } from "@/lib/outreach/send";
import { UserFacingError } from "@/lib/errors";
import { captureError } from "@/lib/observability";
import { parseJsonBody } from "@/lib/validate-request";

const GENERIC_ERROR = "We couldn't save that edit right now. Please try again in a moment.";

const updateMessageSchema = z.object({
  subject: z.string().trim().min(1, "Subject can't be empty.").max(200, "Keep the subject under 200 characters."),
  body: z.string().trim().min(1, "Message body can't be empty.").max(5000, "Keep the message under 5000 characters."),
  linkedinMessage: z
    .string()
    .trim()
    .max(500, "Keep the LinkedIn message under 500 characters.")
    .nullable()
    .optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const organization = await getCurrentOrganization(session.user.id);
  if (!organization) {
    return NextResponse.json({ error: "No workspace found for this account." }, { status: 404 });
  }

  const { id } = await params;
  const parsed = await parseJsonBody(request, updateMessageSchema);
  if (parsed.error) return parsed.error;
  const { subject, body, linkedinMessage } = parsed.data;

  try {
    const message = await updateOutreachMessageContent(organization.id, id, {
      subject,
      body,
      linkedinMessage: linkedinMessage ?? null,
    });
    return NextResponse.json({ message });
  } catch (error) {
    if (error instanceof UserFacingError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    captureError("outreach.update.route", error, { organizationId: organization.id, messageId: id });
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 502 });
  }
}
