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

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

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

  const CLEAN_SCORE_CATEGORIES = [{ category: "Positioning", score: 90, reason: "x", recommendation: "y" }];

  it("flags lead generation slowing once new-prospect volume drops 40%+ against a real prior sample", async () => {
    const org = await prisma.organization.create({ data: { name: "Risks Test Org (lead gen slowing)" } });
    organizationId = org.id;
    await prisma.growthBlueprint.create({ data: blueprintFixture(organizationId, new Date(), CLEAN_SCORE_CATEGORIES) });

    // Prior 14-day window: 6 leads. Recent 14-day window: 1 lead (an 83% drop).
    await prisma.company.createMany({
      data: Array.from({ length: 6 }, (_, i) => ({
        organizationId,
        source: "test",
        sourceId: `prior-lead-${i}`,
        name: `Prior Lead ${i}`,
        createdAt: daysAgo(20),
      })),
    });
    await prisma.company.create({
      data: { organizationId, source: "test", sourceId: "recent-lead-0", name: "Recent Lead", createdAt: daysAgo(2) },
    });

    const signals = await getRisksAndOpportunities(organizationId);
    const slowing = signals.find((s) => s.title === "Lead generation is slowing");
    expect(slowing).toBeDefined();
    expect(slowing?.urgency).toBe("This Week");
  });

  it("does not flag lead generation slowing without a real prior sample", async () => {
    const org = await prisma.organization.create({ data: { name: "Risks Test Org (lead gen, no sample)" } });
    organizationId = org.id;
    await prisma.growthBlueprint.create({ data: blueprintFixture(organizationId, new Date(), CLEAN_SCORE_CATEGORIES) });

    // Only 2 leads in the prior window — below the minimum sample.
    await prisma.company.createMany({
      data: Array.from({ length: 2 }, (_, i) => ({
        organizationId,
        source: "test",
        sourceId: `sparse-lead-${i}`,
        name: `Sparse Lead ${i}`,
        createdAt: daysAgo(20),
      })),
    });

    const signals = await getRisksAndOpportunities(organizationId);
    expect(signals.find((s) => s.title === "Lead generation is slowing")).toBeUndefined();
  });

  it("flags no follow-up activity when engaged contacts exist but no calls were logged recently", async () => {
    const org = await prisma.organization.create({ data: { name: "Risks Test Org (no follow-up)" } });
    organizationId = org.id;
    await prisma.growthBlueprint.create({ data: blueprintFixture(organizationId, new Date(), CLEAN_SCORE_CATEGORIES) });

    const company = await prisma.company.create({
      data: { organizationId, source: "test", sourceId: "no-followup-co", name: "No Follow-up Co" },
    });
    await prisma.contact.create({
      data: { companyId: company.id, name: "Engaged Contact", relationshipStatus: "CONTACTED" },
    });

    const signals = await getRisksAndOpportunities(organizationId);
    const noFollowUp = signals.find((s) => s.title === "No follow-up activity");
    expect(noFollowUp).toBeDefined();
    expect(noFollowUp?.urgency).toBe("Now");
    expect(noFollowUp?.severity).toBe("High");
  });

  it("does not flag no follow-up activity once a recent call has been logged", async () => {
    const org = await prisma.organization.create({ data: { name: "Risks Test Org (has follow-up)" } });
    organizationId = org.id;
    await prisma.growthBlueprint.create({ data: blueprintFixture(organizationId, new Date(), CLEAN_SCORE_CATEGORIES) });

    const company = await prisma.company.create({
      data: { organizationId, source: "test", sourceId: "has-followup-co", name: "Has Follow-up Co" },
    });
    await prisma.contact.create({
      data: { companyId: company.id, name: "Engaged Contact", relationshipStatus: "CONTACTED" },
    });
    await prisma.callLog.create({
      data: { companyId: company.id, loggedByUserId: "user-1", loggedByName: "Test User", outcome: "ANSWERED" },
    });

    const signals = await getRisksAndOpportunities(organizationId);
    expect(signals.find((s) => s.title === "No follow-up activity")).toBeUndefined();
  });

  it("flags a weak SEO health score from the latest crawl", async () => {
    const org = await prisma.organization.create({ data: { name: "Risks Test Org (weak SEO)" } });
    organizationId = org.id;
    await prisma.growthBlueprint.create({ data: blueprintFixture(organizationId, new Date(), CLEAN_SCORE_CATEGORIES) });
    await prisma.seoAnalysis.create({
      data: {
        organizationId,
        version: 1,
        healthScore: 35,
        executiveSummary: "Test summary",
        categories: [],
        quickWins: [],
        keywordSuggestions: [],
        contentIdeas: [],
      },
    });

    const signals = await getRisksAndOpportunities(organizationId);
    const weakSeo = signals.find((s) => s.title.startsWith("Weak SEO health score"));
    expect(weakSeo).toBeDefined();
    expect(weakSeo?.urgency).toBe("Monitor");
  });

  it("does not flag SEO when the latest health score is healthy", async () => {
    const org = await prisma.organization.create({ data: { name: "Risks Test Org (healthy SEO)" } });
    organizationId = org.id;
    await prisma.growthBlueprint.create({ data: blueprintFixture(organizationId, new Date(), CLEAN_SCORE_CATEGORIES) });
    await prisma.seoAnalysis.create({
      data: {
        organizationId,
        version: 1,
        healthScore: 80,
        executiveSummary: "Test summary",
        categories: [],
        quickWins: [],
        keywordSuggestions: [],
        contentIdeas: [],
      },
    });

    const signals = await getRisksAndOpportunities(organizationId);
    expect(signals.find((s) => s.title.startsWith("Weak SEO health score"))).toBeUndefined();
  });
});
