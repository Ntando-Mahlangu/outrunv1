import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import type { Opportunity } from "@prisma/client";
import { executeOpportunity } from "./execute";
import { UserFacingError } from "@/lib/errors";

describe("executeOpportunity (integration)", () => {
  let organizationId: string;

  beforeEach(async () => {
    const org = await prisma.organization.create({ data: { name: "Opportunity Execute Test Org" } });
    organizationId = org.id;
  });

  afterEach(async () => {
    await prisma.organization.delete({ where: { id: organizationId } });
  });

  async function seedCompany(sourceId: string, fitScore: number) {
    return prisma.company.create({
      data: { organizationId, source: "test", sourceId, name: `Co ${sourceId}`, fitScore },
    });
  }

  function fakeOpportunity(overrides: Partial<Opportunity>): Opportunity {
    return {
      id: "opp-1",
      organizationId,
      type: "HIGH_FIT_UNCONTACTED",
      dedupeKey: "HIGH_FIT_UNCONTACTED",
      title: "2 high-fit prospects sitting untouched",
      summary: "Test",
      whyItMatters: "Test",
      evidence: [],
      confidence: 80,
      estimatedImpact: "Medium",
      estimatedValue: null,
      recommendedAction: "Test",
      actionType: "CREATE_LEAD_LIST_AND_CALL",
      actionPayload: null,
      relatedCompanyIds: null,
      status: "DETECTED",
      detectedAt: new Date(),
      resolvedAt: null,
      launchedByUserId: null,
      executionResult: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    };
  }

  it("CREATE_LEAD_LIST_AND_CALL re-derives the current company set and creates a lead list", async () => {
    const a = await seedCompany("exec-a", 90);
    const b = await seedCompany("exec-b", 90);

    const result = await executeOpportunity(fakeOpportunity({ relatedCompanyIds: ["stale-id"] }));
    expect(result.companyCount).toBe(2);

    const entries = await prisma.leadListCompany.findMany({
      where: { leadListId: result.leadListId as string },
    });
    expect(entries.map((e) => e.companyId).sort()).toEqual([a.id, b.id].sort());
  });

  it("CREATE_LEAD_LIST_AND_CALL refuses to launch once the leads have already been handled", async () => {
    // No qualifying companies exist — the condition resolved before Launch was clicked.
    await expect(executeOpportunity(fakeOpportunity({}))).rejects.toThrow(UserFacingError);
  });

  it("CREATE_LEAD_LIST_AND_CALL avoids a lead-list name collision", async () => {
    await seedCompany("exec-c", 90);
    await prisma.leadList.create({
      data: { organizationId, name: `2 high-fit prospects sitting untouched — ${new Date().toLocaleDateString()}` },
    });

    const result = await executeOpportunity(fakeOpportunity({}));
    expect(result.leadListId).toBeDefined();
    expect(result.leadListName).not.toBe(
      `2 high-fit prospects sitting untouched — ${new Date().toLocaleDateString()}`,
    );
  });

  it("SUGGEST_SEARCH returns a deep link with no database write", async () => {
    const result = await executeOpportunity(
      fakeOpportunity({ actionType: "SUGGEST_SEARCH", actionPayload: { query: "Plumbing" } }),
    );
    expect(result.deepLink).toBe("/prospects?q=Plumbing");
  });

  it("REVIEW_ONLY acknowledges with no database write", async () => {
    const result = await executeOpportunity(fakeOpportunity({ actionType: "REVIEW_ONLY" }));
    expect(result.acknowledged).toBe(true);
  });
});
