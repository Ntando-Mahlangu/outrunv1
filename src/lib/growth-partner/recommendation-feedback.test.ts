import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { rateRecommendation, getDismissedItemIds } from "./recommendation-feedback";

describe("recommendation-feedback (integration)", () => {
  let organizationId: string;

  beforeEach(async () => {
    const org = await prisma.organization.create({ data: { name: "Feedback Test Org" } });
    organizationId = org.id;
  });

  afterEach(async () => {
    await prisma.organization.delete({ where: { id: organizationId } });
  });

  it("records a rating and logs an event", async () => {
    await rateRecommendation(organizationId, "seo-1-0", "Add meta descriptions", "HELPFUL");

    const row = await prisma.recommendationFeedback.findUnique({
      where: { organizationId_itemId: { organizationId, itemId: "seo-1-0" } },
    });
    expect(row?.rating).toBe("HELPFUL");

    const event = await prisma.event.findFirst({ where: { organizationId, type: "RECOMMENDATION_RATED" } });
    expect(event?.summary).toContain("Add meta descriptions");
  });

  it("re-rating the same item updates rather than duplicates", async () => {
    await rateRecommendation(organizationId, "seo-1-0", "Add meta descriptions", "HELPFUL");
    await rateRecommendation(organizationId, "seo-1-0", "Add meta descriptions", "DISMISSED");

    const rows = await prisma.recommendationFeedback.findMany({ where: { organizationId } });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.rating).toBe("DISMISSED");
  });

  it("getDismissedItemIds only returns items rated DISMISSED", async () => {
    await rateRecommendation(organizationId, "item-helpful", "Helpful one", "HELPFUL");
    await rateRecommendation(organizationId, "item-dismissed", "Dismissed one", "DISMISSED");

    const dismissed = await getDismissedItemIds(organizationId);
    expect(dismissed.has("item-dismissed")).toBe(true);
    expect(dismissed.has("item-helpful")).toBe(false);
  });
});
