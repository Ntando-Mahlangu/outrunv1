import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { saveGrowthPartnerQuery, getRecentGrowthPartnerQueries } from "./query-history";

describe("growth partner query history (integration)", () => {
  let organizationId: string;

  beforeEach(async () => {
    const org = await prisma.organization.create({ data: { name: "Query History Test Org" } });
    organizationId = org.id;
  });

  afterEach(async () => {
    await prisma.organization.delete({ where: { id: organizationId } });
  });

  it("persists the full structured result, not just the question", async () => {
    const result = { recommendation: "Raise prices 10%", confidence: "High" };
    await saveGrowthPartnerQuery(organizationId, "DECISION", "Should I raise prices?", result);

    const [entry] = await getRecentGrowthPartnerQueries<typeof result>(organizationId, "DECISION");
    expect(entry?.question).toBe("Should I raise prices?");
    expect(entry?.result).toEqual(result);
  });

  it("keeps DECISION and WHAT_IF histories separate", async () => {
    await saveGrowthPartnerQuery(organizationId, "DECISION", "A decision question", { a: 1 });
    await saveGrowthPartnerQuery(organizationId, "WHAT_IF", "A what-if question", { b: 2 });

    const decisions = await getRecentGrowthPartnerQueries(organizationId, "DECISION");
    const whatIfs = await getRecentGrowthPartnerQueries(organizationId, "WHAT_IF");
    expect(decisions).toHaveLength(1);
    expect(whatIfs).toHaveLength(1);
    expect(decisions[0]?.question).toBe("A decision question");
    expect(whatIfs[0]?.question).toBe("A what-if question");
  });

  it("returns entries newest first", async () => {
    await saveGrowthPartnerQuery(organizationId, "DECISION", "First", { n: 1 });
    await saveGrowthPartnerQuery(organizationId, "DECISION", "Second", { n: 2 });

    const entries = await getRecentGrowthPartnerQueries(organizationId, "DECISION");
    expect(entries.map((e) => e.question)).toEqual(["Second", "First"]);
  });
});
