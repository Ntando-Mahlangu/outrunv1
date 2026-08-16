import { RecommendationRating } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { UserFacingError } from "@/lib/errors";
import { logEvent, EventType } from "@/lib/memory/log-event";

const RATING_LABEL: Record<RecommendationRating, string> = {
  HELPFUL: "Helpful",
  NOT_HELPFUL: "Not Helpful",
  DISMISSED: "Dismissed",
};

/**
 * docs/outrun/08 "FEEDBACK LOOP" — one rating per Opportunity Feed item
 * per org. Re-rating the same item updates it rather than piling up
 * history, since only the current verdict matters for filtering the
 * feed and informing future recommendations.
 */
export async function rateRecommendation(
  organizationId: string,
  itemId: string,
  itemTitle: string,
  rating: RecommendationRating,
) {
  if (!itemId.trim() || !itemTitle.trim()) {
    throw new UserFacingError("That recommendation could not be found.");
  }

  await prisma.recommendationFeedback.upsert({
    where: { organizationId_itemId: { organizationId, itemId } },
    create: { organizationId, itemId, itemTitle, rating },
    update: { itemTitle, rating },
  });

  await logEvent(
    organizationId,
    EventType.RECOMMENDATION_RATED,
    `Marked "${itemTitle}" as ${RATING_LABEL[rating]}.`,
  );
}

/** Item ids the user has dismissed — filtered out of the live Opportunity Feed. */
export async function getDismissedItemIds(organizationId: string): Promise<Set<string>> {
  const rows = await prisma.recommendationFeedback.findMany({
    where: { organizationId, rating: "DISMISSED" },
    select: { itemId: true },
  });
  return new Set(rows.map((r) => r.itemId));
}
