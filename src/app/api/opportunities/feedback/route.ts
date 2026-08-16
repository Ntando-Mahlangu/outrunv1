import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { RecommendationRating } from "@prisma/client";
import { getCurrentSession } from "@/lib/session";
import { getCurrentOrganization } from "@/lib/org";
import { rateRecommendation } from "@/lib/growth-partner/recommendation-feedback";
import { UserFacingError } from "@/lib/errors";
import { captureError } from "@/lib/observability";
import { parseJsonBody } from "@/lib/validate-request";

const GENERIC_ERROR = "We couldn't save that right now. Please try again in a moment.";

const provideFeedbackSchema = z.object({
  itemId: z.string({ message: "That recommendation could not be found." }),
  itemTitle: z.string({ message: "That recommendation could not be found." }),
  rating: z.nativeEnum(RecommendationRating, { message: "Choose a valid rating." }),
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

  const parsed = await parseJsonBody(request, provideFeedbackSchema);
  if (parsed.error) return parsed.error;
  const { itemId, itemTitle, rating } = parsed.data;

  try {
    await rateRecommendation(organization.id, itemId, itemTitle, rating);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof UserFacingError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    captureError("opportunities.feedback", error, { organizationId: organization.id });
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 502 });
  }
}
