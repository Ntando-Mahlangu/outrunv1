import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { getOpportunityFeed } from "./opportunity-feed";
import { rateRecommendation } from "./recommendation-feedback";

// The two real, deterministic signals this feed used to compute live
// (unactioned high-fit prospects, a declining reply-rate trend) moved to
// the durable Opportunity Engine — see src/lib/opportunities/detect.test.ts
// for their coverage now. This file only covers what's still here:
// Growth Blueprint opportunities, SEO quick wins, and the dismiss filter.
describe("getOpportunityFeed (integration)", () => {
  let organizationId: string;

  beforeEach(async () => {
    const org = await prisma.organization.create({ data: { name: "Opportunity Feed Test Org" } });
    organizationId = org.id;
  });

  afterEach(async () => {
    await prisma.organization.delete({ where: { id: organizationId } });
  });

  it("returns no items for a brand-new organization", async () => {
    const items = await getOpportunityFeed(organizationId);
    expect(items).toEqual([]);
  });

  it("surfaces SEO quick wins from the latest SEO analysis", async () => {
    await prisma.seoAnalysis.create({
      data: {
        organizationId,
        version: 1,
        healthScore: 60,
        executiveSummary: "Test summary",
        categories: [],
        quickWins: ["Add alt text to product images"],
        keywordSuggestions: [],
        contentIdeas: [],
      },
    });

    const items = await getOpportunityFeed(organizationId);
    const item = items.find((i) => i.source === "SEO Analysis");
    expect(item).toBeDefined();
    expect(item?.title).toBe("Add alt text to product images");
    expect(item?.estimatedEffort).toBe("Low");
  });

  it("filters out items the user has dismissed via feedback", async () => {
    await prisma.seoAnalysis.create({
      data: {
        organizationId,
        version: 1,
        healthScore: 60,
        executiveSummary: "Test summary",
        categories: [],
        quickWins: ["Fix broken internal links"],
        keywordSuggestions: [],
        contentIdeas: [],
      },
    });

    const before = await getOpportunityFeed(organizationId);
    const item = before.find((i) => i.source === "SEO Analysis");
    expect(item).toBeDefined();

    await rateRecommendation(organizationId, item!.id, item!.title, "DISMISSED");

    const after = await getOpportunityFeed(organizationId);
    expect(after.find((i) => i.source === "SEO Analysis")).toBeUndefined();
  });
});
