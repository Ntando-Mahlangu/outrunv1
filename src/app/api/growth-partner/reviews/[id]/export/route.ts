import { NextRequest, NextResponse } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { getCurrentOrganization } from "@/lib/org";
import { prisma } from "@/lib/prisma";
import { strategicReviewToPdfBuffer } from "@/lib/growth-partner/strategic-review-pdf";
import { RateLimitError } from "@/lib/errors";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";
import { captureError } from "@/lib/observability";
import { logAuditEvent, AuditAction } from "@/lib/audit/log-audit-event";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getCurrentSession();
  if (!session) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const organization = await getCurrentOrganization(session.user.id);
  if (!organization) {
    return NextResponse.json({ error: "No workspace found." }, { status: 404 });
  }

  try {
    await checkRateLimit(
      `export:${organization.id}`,
      RATE_LIMITS.EXPORT.limit,
      RATE_LIMITS.EXPORT.windowSeconds,
    );
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json({ error: error.message }, { status: 429 });
    }
    throw error;
  }

  const { id } = await params;
  const review = await prisma.strategicReview.findFirst({
    where: { id, organizationId: organization.id },
  });
  if (!review) {
    return NextResponse.json({ error: "That review could not be found." }, { status: 404 });
  }

  await logAuditEvent(organization.id, AuditAction.DATA_EXPORTED, {
    actorUserId: session.user.id,
    targetType: "strategic_review",
    targetId: review.id,
    metadata: { period: review.period },
  });

  try {
    const buffer = await strategicReviewToPdfBuffer(organization.name, review);
    const filenameBase = `${organization.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${review.period.toLowerCase()}-review`;
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filenameBase}.pdf"`,
      },
    });
  } catch (error) {
    captureError("growth-partner.reviews.export", error, { organizationId: organization.id, reviewId: id });
    return NextResponse.json(
      { error: "We couldn't generate that PDF right now. Please try again in a moment." },
      { status: 502 },
    );
  }
}
