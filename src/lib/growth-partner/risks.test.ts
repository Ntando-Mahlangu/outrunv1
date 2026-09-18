import { describe, it, expect, afterEach, vi } from "vitest";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// getBusinessContext reads the latest Blueprint through a repository that
// wraps the query in Next's unstable_cache, which throws outside a real
// request context (no incremental cache handler in a Vitest run). Mocked
// down to the same underlying query, uncached, so this still exercises
// real seeded data end to end.
vi.mock("@/lib/repositories/growth-blueprint-repository", () => ({
  findLatestForOrg: (organizationId: string) =>
    prisma.growthBlueprint.findFirst({ where: { organizationId }, orderBy: { version: "desc" } }),
}));

const { getRisksAndOpportunities } = await import("./risks");

const STALE_DAYS_AGO = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000);

function blueprintFixture(organizationId: string, createdAt: Date, scoreCategories: Prisma.InputJsonValue) {
  return {
    organizationId,
    version: 1,
    growthScore: 50,
    executiveSummary: "Test summary",
    businessSnapshot: {},
    strengths: [],
    weaknesses: [],
    biggestBottleneck: {},
    opportunities: [],
    growthStrategy: {},
    idealCustomerProfile: {},
    roadmap: [],
    scoreCategories,
    confidenceNotes: "Test",
    createdAt,
  };
}

describe("getRisksAndOpportunities (integration)", () => {
  let organizationId: string;

  afterEach(async () => {
    if (organizationId) await prisma.organization.delete({ where: { id: organizationId } });
  });

  it("every signal carries a reason distinct from its recommendation, plus an urgency", async () => {
    const org = await prisma.organization.create({ data: { name: "Risks Test Org (no blueprint)" } });
    organizationId = org.id;

    const [signal] = await getRisksAndOpportunities(organizationId);
    expect(signal?.title).toBe("No Growth Blueprint yet");
    expect(signal?.reason).not.toBe(signal?.recommendation);
    expect(signal?.urgency).toBe("Now");
  });

  it("surfaces a stale-blueprint signal with a This Week urgency once a Blueprint exists", async () => {
    const org = await prisma.organization.create({ data: { name: "Risks Test Org (stale)" } });
    organizationId = org.id;
    await prisma.growthBlueprint.create({
      data: blueprintFixture(organizationId, STALE_DAYS_AGO, [{ category: "Positioning", score: 80, reason: "x", recommendation: "y" }]),
    });

    const signals = await getRisksAndOpportunities(organizationId);
    const stale = signals.find((s) => s.title === "Growth Blueprint is out of date");
    expect(stale?.urgency).toBe("This Week");
    expect(stale?.severity).toBe("Medium");
  });

  it("carries the score category's own reason/recommendation instead of swapping them", async () => {
    const org = await prisma.organization.create({ data: { name: "Risks Test Org (low score)" } });
    organizationId = org.id;
    await prisma.growthBlueprint.create({
      data: blueprintFixture(organizationId, new Date(), [
        { category: "SEO Readiness", score: 20, reason: "No sitemap or meta descriptions found.", recommendation: "Add a sitemap and meta descriptions." },
      ]),
    });

    const signals = await getRisksAndOpportunities(organizationId);
    const low = signals.find((s) => s.title.startsWith("SEO Readiness"));
    expect(low?.reason).toBe("No sitemap or meta descriptions found.");
    expect(low?.recommendation).toBe("Add a sitemap and meta descriptions.");
    expect(low?.urgency).toBe("Monitor");
  });
});
