import { describe, it, expect, afterEach, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { runStrategicReviewTick } from "./strategic-review";

describe("runStrategicReviewTick (integration)", () => {
  let organizationId: string;

  afterEach(async () => {
    if (organizationId) await prisma.organization.deleteMany({ where: { id: organizationId } });
    vi.restoreAllMocks();
  });

  it("never attempts a review for a soft-deleted organization, even one otherwise due", async () => {
    const org = await prisma.organization.create({
      data: { name: "Strategic Review Tick Test Org (deleted)", deletedAt: new Date() },
    });
    organizationId = org.id;
    await prisma.businessProfile.create({
      data: {
        organizationId,
        description: "Test business",
        idealCustomer: "Test customer",
        sellingLocations: ["United States"],
        acquisitionChannels: ["Referrals"],
        growthChallenge: "Test challenge",
        mainGoal: "Test goal",
        competitors: [],
      },
    });

    const observability = await import("@/lib/observability");
    const captureErrorSpy = vi.spyOn(observability, "captureError").mockImplementation(() => {});

    await runStrategicReviewTick();

    // If the deletedAt filter were missing, this org (due for every
    // period, no ANTHROPIC_API_KEY configured in the test env) would
    // reach generateStrategicReview, throw, and get logged here with
    // this exact organizationId. Never being called with it is proof the
    // org was excluded from the tick's query entirely, not just that
    // generation happened to fail for an unrelated reason.
    const callsForThisOrg = captureErrorSpy.mock.calls.filter(
      (call) => (call[2] as { organizationId?: string } | undefined)?.organizationId === organizationId,
    );
    expect(callsForThisOrg).toHaveLength(0);

    const reviews = await prisma.strategicReview.findMany({ where: { organizationId } });
    expect(reviews).toHaveLength(0);
  });
});
