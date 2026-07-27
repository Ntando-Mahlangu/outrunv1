import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import type { generateCoachFeedback as GenerateCoachFeedback } from "./coach";

describe("generateCoachFeedback (integration)", () => {
  let organizationId: string;
  let generateCoachFeedback: typeof GenerateCoachFeedback;

  beforeAll(async () => {
    // No ANTHROPIC_API_KEY in this test environment — generateCoachFeedback
    // must swallow that failure and return null rather than throwing, since
    // a task completion should never be blocked by the AI Coach failing.
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    vi.resetModules();
    ({ generateCoachFeedback } = await import("./coach"));
  });

  afterAll(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  beforeEach(async () => {
    const org = await prisma.organization.create({ data: { name: "Coach Test Org" } });
    organizationId = org.id;
    await prisma.businessProfile.create({
      data: {
        organizationId,
        description: "A plumbing company",
        idealCustomer: "Homeowners",
        sellingLocations: ["Local"],
        acquisitionChannels: ["Referrals"],
        growthChallenge: "Finding leads",
        avgCustomerValue: null,
        mainGoal: "First customer",
        competitors: [],
      },
    });
  });

  afterEach(async () => {
    await prisma.organization.delete({ where: { id: organizationId } });
  });

  it("returns null rather than throwing when no AI provider is configured", async () => {
    const result = await generateCoachFeedback(organizationId, {
      title: "Launch first campaign",
      description: "Send outreach to the top 10 researched prospects.",
      completionNotes: null,
    });
    expect(result).toBeNull();
  });
});
