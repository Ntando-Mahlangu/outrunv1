import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentSession } from "@/lib/session";
import { getCurrentOrganization } from "@/lib/org";
import { runWhatIfSimulation } from "@/lib/growth-partner/whatif";
import { UserFacingError, RateLimitError } from "@/lib/errors";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { captureError } from "@/lib/observability";
import { parseJsonBody } from "@/lib/validate-request";

const GENERIC_ERROR =
  "We couldn't run that simulation right now. Please try again in a moment.";

const runWhatIfSimulationSchema = z.object({
  question: z
    .string({ message: "Ask a what-if question first." })
    .trim()
    .min(1, "Ask a what-if question first."),
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

  const parsed = await parseJsonBody(request, runWhatIfSimulationSchema);
  if (parsed.error) return parsed.error;
  const { question } = parsed.data;

  try {
    await checkRateLimit(`ai:${organization.id}`, RATE_LIMITS.AI.limit, RATE_LIMITS.AI.windowSeconds);
    const result = await runWhatIfSimulation(organization.id, question.trim());
    return NextResponse.json({ result });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json({ error: error.message }, { status: 429 });
    }
    if (error instanceof UserFacingError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    captureError("growth-partner.whatif", error, { organizationId: organization.id });
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 502 });
  }
}
