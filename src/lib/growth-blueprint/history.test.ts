import { describe, it, expect, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { getBlueprintHistory } from "./history";

const scoreCategories = [{ category: "Marketing", score: 50 }];

function blueprintFixture(organizationId: string, version: number, growthScore: number, createdAt: Date) {
  return {
    organizationId,
    version,
    growthScore,
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

describe("getBlueprintHistory (integration)", () => {
  let organizationId: string;

  afterEach(async () => {
    if (organizationId) await prisma.organization.delete({ where: { id: organizationId } });
  });

  it("attributes each event to the correct version gap by its timestamp", async () => {
    const org = await prisma.organization.create({ data: { name: "Blueprint History Test Org" } });
    organizationId = org.id;

    const v1At = new Date("2026-01-01T00:00:00Z");
    const v2At = new Date("2026-02-01T00:00:00Z");
    await prisma.growthBlueprint.createMany({
      data: [
        blueprintFixture(organizationId, 1, 40, v1At),
        blueprintFixture(organizationId, 2, 55, v2At),
      ],
    });

    await prisma.event.createMany({
      data: [
        // Before v1 entirely — must not appear anywhere.
        { organizationId, type: "COMPANY_SEARCHED", summary: "before v1", createdAt: new Date("2025-12-01T00:00:00Z") },
        // Inside the v1→v2 gap.
        { organizationId, type: "COMPANY_SEARCHED", summary: "inside gap", createdAt: new Date("2026-01-15T00:00:00Z") },
        // After v2 — must not appear (no v3 to close this gap).
        { organizationId, type: "COMPANY_SEARCHED", summary: "after v2", createdAt: new Date("2026-03-01T00:00:00Z") },
      ],
    });

    const history = await getBlueprintHistory(organizationId);
    const v2Entry = history.find((h) => h.version === 2);
    expect(v2Entry?.eventsSince.map((e) => e.summary)).toEqual(["inside gap"]);

    const v1Entry = history.find((h) => h.version === 1);
    expect(v1Entry?.eventsSince).toEqual([]);
  });

  it("caps events per gap to the most recent, without loading the org's entire event history", async () => {
    const org = await prisma.organization.create({ data: { name: "Blueprint History Cap Test Org" } });
    organizationId = org.id;

    const v1At = new Date("2026-01-01T00:00:00Z");
    const v2At = new Date("2026-02-01T00:00:00Z");
    await prisma.growthBlueprint.createMany({
      data: [
        blueprintFixture(organizationId, 1, 40, v1At),
        blueprintFixture(organizationId, 2, 55, v2At),
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

    const history = await getBlueprintHistory(organizationId);
    const v2Entry = history.find((h) => h.version === 2);
    expect(v2Entry?.eventsSince.length).toBe(15);
    // Most recent first, matching the panel's "most recent" ordering.
    expect(v2Entry?.eventsSince[0]?.summary).toBe("event 19");
  });
});
