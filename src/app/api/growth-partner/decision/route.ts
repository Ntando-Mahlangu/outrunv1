import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentSession } from "@/lib/session";
import { getCurrentOrganization } from "@/lib/org";
import { getDecision } from "@/lib/growth-partner/decision";
import { UserFacingError, RateLimitError } from "@/lib/errors";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { captureError } from "@/lib/observability";
import { parseJsonBody } from "@/lib/validate-request";

const GENERIC_ERROR =
  "The Decision Engine couldn't respond right now. Please try again in a moment.";

const getDecisionSchema = z.object({
  question: z
    .string({ message: "Ask a decision question first." })
    .trim()
    .min(1, "Ask a decision question first."),
});

export async function POST(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const organization = await getCurrentOrganization(session.user.id);
  if (!organization) {
    return NextResponse.json({ error: "No workspace found for this account." }, { status: 404 });
  }

  const parsed = await parseJsonBody(request, getDecisionSchema);
  if (parsed.error) return parsed.error;
  const { question } = parsed.data;

  try {
    await checkRateLimit(`ai:${organization.id}`, RATE_LIMITS.AI.limit, RATE_LIMITS.AI.windowSeconds);
    const result = await getDecision(organization.id, question.trim());
    return NextResponse.json({ result });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json({ error: error.message }, { status: 429 });
    }
    if (error instanceof UserFacingError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    captureError("growth-partner.decision", error, { organizationId: organization.id });
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 502 });
  }
}
