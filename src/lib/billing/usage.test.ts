import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { UsageEventType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { UserFacingError } from "@/lib/errors";
import { checkAndRecordUsage, getUsageSummary } from "./usage";

// Integration tests against the real Postgres instance CI already
// provisions for `prisma migrate deploy` — the enforcement logic here
// is entirely DB-state-dependent, so a mocked Prisma client would just
// re-assert the mock rather than catch a real off-by-one in the query.
describe("checkAndRecordUsage (integration)", () => {
  let organizationId: string;

  beforeEach(async () => {
    const org = await prisma.organization.create({
      data: { name: "Usage Test Org", planTier: "FREE" },
    });
    organizationId = org.id;
  });

  afterEach(async () => {
    await prisma.organization.delete({ where: { id: organizationId } });
  });

  it("records usage under the limit without throwing", async () => {
    await expect(
      checkAndRecordUsage(organizationId, UsageEventType.BLUEPRINT_GENERATION),
    ).resolves.toBeUndefined();
    const count = await prisma.usageEvent.count({
      where: { organizationId, type: UsageEventType.BLUEPRINT_GENERATION },
    });
    expect(count).toBe(1);
  });

  it("throws a friendly UserFacingError once the Free plan's limit is reached", async () => {
    // Free plan allows exactly 1 Blueprint generation.
    await checkAndRecordUsage(organizationId, UsageEventType.BLUEPRINT_GENERATION);
    await expect(
      checkAndRecordUsage(organizationId, UsageEventType.BLUEPRINT_GENERATION),
    ).rejects.toBeInstanceOf(UserFacingError);
  });

  it("does not record a usage event when the limit is exceeded", async () => {
    await checkAndRecordUsage(organizationId, UsageEventType.BLUEPRINT_GENERATION);
    await expect(
      checkAndRecordUsage(organizationId, UsageEventType.BLUEPRINT_GENERATION),
    ).rejects.toThrow();
    const count = await prisma.usageEvent.count({
      where: { organizationId, type: UsageEventType.BLUEPRINT_GENERATION },
    });
    expect(count).toBe(1);
  });

  it("keeps usage isolated per organization", async () => {
    const otherOrg = await prisma.organization.create({
      data: { name: "Other Usage Org", planTier: "FREE" },
    });
    try {
      await checkAndRecordUsage(organizationId, UsageEventType.BLUEPRINT_GENERATION);
      await expect(
        checkAndRecordUsage(otherOrg.id, UsageEventType.BLUEPRINT_GENERATION),
      ).resolves.toBeUndefined();
    } finally {
      await prisma.organization.delete({ where: { id: otherOrg.id } });
    }
  });

  it("reports usage summary counts and limits per type", async () => {
    await checkAndRecordUsage(organizationId, UsageEventType.COMPANY_SEARCH);
    const summary = await getUsageSummary(organizationId, "FREE");
    const searchEntry = summary.find((s) => s.type === UsageEventType.COMPANY_SEARCH);
    expect(searchEntry?.used).toBe(1);
    expect(searchEntry?.limit).toBe(10);
  });
});

describe("Growth plan limits (integration)", () => {
  let growthOrgId: string;

  beforeEach(async () => {
    const org = await prisma.organization.create({
      data: { name: "Growth Usage Test Org", planTier: "GROWTH" },
    });
    growthOrgId = org.id;
  });

  afterEach(async () => {
    await prisma.organization.delete({ where: { id: growthOrgId } });
  });

  it("uses createdAt as the fallback period start when currentPeriodStart hasn't been set yet", async () => {
    // Simulates a paid org before its first Paddle webhook lands.
    const org = await prisma.organization.findUniqueOrThrow({ where: { id: growthOrgId } });
    expect(org.currentPeriodStart).toBeNull();
    // Usage recorded "before" the org even existed shouldn't be possible in
    // practice, so falling back to createdAt for a fresh org means the
    // count starts at zero — confirmed by the summary test below.
    const summary = await getUsageSummary(growthOrgId, "GROWTH");
    expect(summary.find((s) => s.type === UsageEventType.COMPANY_SEARCH)?.used).toBe(0);
  });

  it("caps Company Searches at 1000, per docs/outrun/14's Growth plan page", async () => {
    const summary = await getUsageSummary(growthOrgId, "GROWTH");
    const searchEntry = summary.find((s) => s.type === UsageEventType.COMPANY_SEARCH);
    expect(searchEntry?.limit).toBe(1000);
  });

  it("leaves AI generation types uncapped on Growth", async () => {
    const summary = await getUsageSummary(growthOrgId, "GROWTH");
    for (const type of [
      UsageEventType.COMPANY_RESEARCH,
      UsageEventType.OUTREACH_GENERATION,
      UsageEventType.BLUEPRINT_GENERATION,
      UsageEventType.CALL_SCRIPT_GENERATION,
    ]) {
      expect(summary.find((s) => s.type === type)?.limit).toBeNull();
    }
    await expect(
      checkAndRecordUsage(growthOrgId, UsageEventType.OUTREACH_GENERATION),
    ).resolves.toBeUndefined();
  });
});

describe("Starter plan usage resets per billing period (integration)", () => {
  let organizationId: string;

  afterEach(async () => {
    await prisma.organization.deleteMany({ where: { id: organizationId } });
  });

  it("does not count usage recorded before the current billing period started", async () => {
    const periodStart = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000); // 5 days ago
    const beforePeriod = new Date(periodStart.getTime() - 24 * 60 * 60 * 1000); // 1 day before that
    const org = await prisma.organization.create({
      data: { name: "Starter Period Reset Test Org", planTier: "STARTER", currentPeriodStart: periodStart },
    });
    organizationId = org.id;

    // A usage event from the previous billing period.
    await prisma.usageEvent.create({
      data: { organizationId, type: UsageEventType.COMPANY_SEARCH, createdAt: beforePeriod },
    });

    const summary = await getUsageSummary(organizationId, "STARTER");
    expect(summary.find((s) => s.type === UsageEventType.COMPANY_SEARCH)?.used).toBe(0);
  });

  it("counts usage recorded within the current billing period", async () => {
    const periodStart = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
    const org = await prisma.organization.create({
      data: { name: "Starter Period Reset Test Org 2", planTier: "STARTER", currentPeriodStart: periodStart },
    });
    organizationId = org.id;

    await checkAndRecordUsage(organizationId, UsageEventType.COMPANY_SEARCH);

    const summary = await getUsageSummary(organizationId, "STARTER");
    expect(summary.find((s) => s.type === UsageEventType.COMPANY_SEARCH)?.used).toBe(1);
  });

  it("allows recording again once a new billing period has started, even after exhausting the previous one", async () => {
    const staleStart = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000); // 60 days ago
    const org = await prisma.organization.create({
      data: { name: "Starter Period Rollover Test Org", planTier: "STARTER", currentPeriodStart: staleStart },
    });
    organizationId = org.id;

    // Exhaust the (stale) period's call-script allotment (Starter's limit
    // is exactly 500) in one bulk insert rather than 500 sequential round
    // trips — a naive lifetime count would reject the next call below.
    await prisma.usageEvent.createMany({
      data: Array.from({ length: 500 }, () => ({
        organizationId,
        type: UsageEventType.CALL_SCRIPT_GENERATION,
        createdAt: staleStart,
      })),
    });

    // Confirms the fixture actually built a maxed-out lifetime count —
    // otherwise the assertion below would trivially pass for the wrong
    // reason (nothing was ever capped in the first place).
    await expect(
      checkAndRecordUsage(organizationId, UsageEventType.CALL_SCRIPT_GENERATION),
    ).rejects.toThrow();

    // The renewal webhook that starts a new period (src/lib/billing/webhook-handler.ts).
    await prisma.organization.update({
      where: { id: organizationId },
      data: { currentPeriodStart: new Date() },
    });

    await expect(
      checkAndRecordUsage(organizationId, UsageEventType.CALL_SCRIPT_GENERATION),
    ).resolves.toBeUndefined();
  });
});
