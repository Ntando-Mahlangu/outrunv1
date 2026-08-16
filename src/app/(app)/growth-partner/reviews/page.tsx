import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/session";
import { getCurrentOrganization } from "@/lib/org";
import { prisma } from "@/lib/prisma";
import { ReviewsPageClient } from "@/components/growth-partner/reviews-page-client";

export default async function StrategicReviewsPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/sign-in");

  const organization = await getCurrentOrganization(session.user.id);
  if (!organization) redirect("/sign-in");

  const reviews = await prisma.strategicReview.findMany({
    where: { organizationId: organization.id },
    orderBy: { createdAt: "desc" },
  });

  return <ReviewsPageClient initialReviews={reviews} />;
}
