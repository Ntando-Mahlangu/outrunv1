import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentSession } from "@/lib/session";
import { getCurrentOrganization } from "@/lib/org";
import { generateSEOContent } from "@/lib/seo/content";
import { SEO_CONTENT_TYPES } from "@/lib/seo/content-schema";
import { UserFacingError, RateLimitError } from "@/lib/errors";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { captureError } from "@/lib/observability";
import { isFeatureEnabled, FEATURE_FLAGS } from "@/lib/billing/feature-flags";
import { parseJsonBody } from "@/lib/validate-request";

const GENERIC_ERROR =
  "We couldn't generate that content right now. Please try again in a moment.";

const generateSEOContentSchema = z.object({
  headline: z.string({ message: "Missing content idea details." }),
  targetKeyword: z.string({ message: "Missing content idea details." }),
  businessGoal: z.string({ message: "Missing content idea details." }),
  contentType: z.enum(SEO_CONTENT_TYPES, { message: "Missing content type." }),
});

export async function POST(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const organization = await getCurrentOrganization(session.user.id);
  if (!organization) {
    return NextResponse.json({ error: "No workspace found." }, { status: 404 });
  }
  if (!isFeatureEnabled(organization.planTier, FEATURE_FLAGS.SEO_ENGINE, organization.id)) {
    return NextResponse.json(
      { error: "The SEO Engine is available on the Starter plan and above. Upgrade to unlock it." },
      { status: 403 },
    );
  }

  const parsed = await parseJsonBody(request, generateSEOContentSchema);
  if (parsed.error) return parsed.error;
  const { headline, targetKeyword, businessGoal, contentType } = parsed.data;

  try {
    await checkRateLimit(`ai:${organization.id}`, RATE_LIMITS.AI.limit, RATE_LIMITS.AI.windowSeconds);
    const piece = await generateSEOContent(organization.id, {
      headline,
      targetKeyword,
      businessGoal,
      contentType,
    });
    return NextResponse.json({ piece });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json({ error: error.message }, { status: 429 });
    }
    if (error instanceof UserFacingError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    captureError("seo.content", error, { organizationId: organization.id });
    return NextResponse.json({ error: GENERIC_ERROR }, { status: 502 });
  }
}
