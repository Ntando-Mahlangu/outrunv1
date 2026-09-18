import { describe, it, expect, afterEach } from "vitest";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSeoHistory } from "./history";

function seoAnalysisFixture(
  organizationId: string,
  version: number,
  healthScore: number,
  categories: Prisma.InputJsonValue,
  createdAt: Date,
) {
  return {
    organizationId,
    version,
    healthScore,
    executiveSummary: "Test summary",
    categories,
    quickWins: ["Add alt text"],
    keywordSuggestions: [],
    contentIdeas: [],
    createdAt,
  };
}

describe("getSeoHistory (integration)", () => {
  let organizationId: string;

  afterEach(async () => {
    if (organizationId) await prisma.organization.delete({ where: { id: organizationId } });
  });

  it("attributes each event to the correct analysis gap by its timestamp", async () => {
    const org = await prisma.organization.create({ data: { name: "SEO History Test Org" } });
    organizationId = org.id;

    const v1At = new Date("2026-01-01T00:00:00Z");
    const v2At = new Date("2026-02-01T00:00:00Z");
    await prisma.seoAnalysis.createMany({
      data: [
        seoAnalysisFixture(organizationId, 1, 40, [], v1At),
        seoAnalysisFixture(organizationId, 2, 55, [], v2At),
      ],
    });

    await prisma.event.createMany({
      data: [
        { organizationId, type: "COMPANY_SEARCHED", summary: "before v1", createdAt: new Date("2025-12-01T00:00:00Z") },
        { organizationId, type: "COMPANY_SEARCHED", summary: "inside gap", createdAt: new Date("2026-01-15T00:00:00Z") },
        { organizationId, type: "COMPANY_SEARCHED", summary: "after v2", createdAt: new Date("2026-03-01T00:00:00Z") },
      ],
    });

    const history = await getSeoHistory(organizationId);
    const v2Entry = history.find((h) => h.version === 2);
    expect(v2Entry?.eventsSince.map((e) => e.summary)).toEqual(["inside gap"]);

    const v1Entry = history.find((h) => h.version === 1);
    expect(v1Entry?.eventsSince).toEqual([]);
  });

  it("caps events per gap to the most recent 15", async () => {
    const org = await prisma.organization.create({ data: { name: "SEO History Cap Test Org" } });
    organizationId = org.id;

    const v1At = new Date("2026-01-01T00:00:00Z");
    const v2At = new Date("2026-02-01T00:00:00Z");
    await prisma.seoAnalysis.createMany({
      data: [
        seoAnalysisFixture(organizationId, 1, 40, [], v1At),
        seoAnalysisFixture(organizationId, 2, 55, [], v2At),
      ],
    });

    await prisma.event.createMany({
      data: Array.from({ length: 20 }, (_, i) => ({
        organizationId,
        type: "COMPANY_SEARCHED" as const,
        summary: `event ${i}`,
        createdAt: new Date(v1At.getTime() + (i + 1) * 60_000),
      })),
    });

    const history = await getSeoHistory(organizationId);
    const v2Entry = history.find((h) => h.version === 2);
    expect(v2Entry?.eventsSince.length).toBe(15);
    expect(v2Entry?.eventsSince[0]?.summary).toBe("event 19");
  });

  it("diffs per-category scores between consecutive analyses, newest first", async () => {
    const org = await prisma.organization.create({ data: { name: "SEO History Diff Test Org" } });
    organizationId = org.id;

    await prisma.seoAnalysis.createMany({
      data: [
        seoAnalysisFixture(
          organizationId,
          1,
          40,
          [{ category: "Technical SEO", score: 30 }, { category: "Content", score: 50 }],
          new Date("2026-01-01T00:00:00Z"),
        ),
        seoAnalysisFixture(
          organizationId,
          2,
          55,
          [{ category: "Technical SEO", score: 60 }, { category: "Content", score: 50 }],
          new Date("2026-02-01T00:00:00Z"),
        ),
      ],
    });

    const history = await getSeoHistory(organizationId);
    // Newest first, matching the timeline's rendering order.
    expect(history.map((h) => h.version)).toEqual([2, 1]);

    const v2Entry = history.find((h) => h.version === 2);
    expect(v2Entry?.previousHealthScore).toBe(40);
    expect(v2Entry?.categoryDeltas).toEqual([
      { category: "Technical SEO", from: 30, to: 60, delta: 30 },
    ]);

    const v1Entry = history.find((h) => h.version === 1);
    expect(v1Entry?.previousHealthScore).toBeNull();
    expect(v1Entry?.categoryDeltas).toEqual([]);
  });
});
