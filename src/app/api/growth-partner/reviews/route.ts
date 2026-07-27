import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { ReviewPeriod } from "@prisma/client";
import { getCurrentSession } from "@/lib/session";
import { getCurrentOrganization } from "@/lib/org";
import { prisma } from "@/lib/prisma";
import { generateStrategicReview } from "@/lib/growth-partner/strategic-review";
import { UserFacingError, RateLimitError } from "@/lib/errors";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { captureError } from "@/lib/observability";
import { parseJsonBody } from "@/lib/validate-request";

const PERIODS: ReviewPeriod[] = ["WEEKLY", "MONTHLY", "QUARTERLY"];
const GENERIC_ERROR =
  "We couldn't generate that review right now. Please try again in a moment.";

const generateStrategicReviewSchema = z.object({
  period: z.enum(PERIODS as [ReviewPeriod, ...ReviewPeriod[]], {
    message: "Choose a valid review period.",
  }),
});

export async function GET() {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const organization = await getCurrentOrganization(session.user.id);
  if (!organization) {
    return NextResponse.json({ error: "No workspace found for this account." }, { status: 404 });
  }

  const reviews = await prisma.strategicReview.findMany({
    where: { organizationId: organization.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ reviews });
}

export async function POST(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const organization = await getCurrentOrganization(session.user.id);
  if (!organization) {
    return NextResponse.json({ error: "No workspace found for this account." }, { status: 404 });
  }

  const parsed = await parseJsonBody(request, generateStrategicReviewSchema);
  if (parsed.error) return parsed.error;
  const { period } = parsed.data;

  try {
    await checkRateLimit(`ai:${organization.id}`, RATE_LIMITS.AI.limit, RATE_LIMITS.AI.windowSeconds);
    const review = await generateStrategicReview(organization.id, period);
    return NextResponse.json({ review });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json({ error: error.message }, { status: 429 });
    }
    if (error instanceof UserFacingError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    captureError("growth-partner.reviews.create", error, { organizationId: organization.id });
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 502 });
  }
}
