import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { runOpportunityDetection } from "./detect";

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

describe("runOpportunityDetection (integration)", () => {
  let organizationId: string;

  beforeEach(async () => {
    const org = await prisma.organization.create({ data: { name: "Opportunity Detect Test Org" } });
    organizationId = org.id;
  });

  afterEach(async () => {
    await prisma.organization.delete({ where: { id: organizationId } });
  });

  async function seedCompany(sourceId: string, extra: Record<string, unknown> = {}) {
    return prisma.company.create({
      data: { organizationId, source: "test", sourceId, name: `Co ${sourceId}`, ...extra },
    });
  }

  describe("Dormant Leads", () => {
    it("detects contacts engaged but untouched for 21+ days, once at least 3 qualify", async () => {
      for (let i = 0; i < 3; i++) {
        const company = await seedCompany(`dormant-${i}`);
        await prisma.contact.create({
          data: { companyId: company.id, name: `Contact ${i}`, relationshipStatus: "CONTACTED" },
        });
      }

      const result = await runOpportunityDetection(organizationId);
      expect(result.created).toBeGreaterThanOrEqual(1);

      const opp = await prisma.opportunity.findUnique({
        where: { organizationId_dedupeKey: { organizationId, dedupeKey: "DORMANT_LEADS" } },
      });
      expect(opp).not.toBeNull();
      expect(opp?.status).toBe("DETECTED");
      expect(opp?.actionType).toBe("CREATE_LEAD_LIST_AND_CALL");
      expect((opp?.relatedCompanyIds as string[]).length).toBe(3);
    });

    it("does not surface below the minimum count", async () => {
      const company = await seedCompany("dormant-solo");
      await prisma.contact.create({
        data: { companyId: company.id, name: "Solo Contact", relationshipStatus: "CONTACTED" },
      });

      await runOpportunityDetection(organizationId);
      const opp = await prisma.opportunity.findUnique({
        where: { organizationId_dedupeKey: { organizationId, dedupeKey: "DORMANT_LEADS" } },
      });
      expect(opp).toBeNull();
    });

    it("does not count a contact recently called as dormant", async () => {
      for (let i = 0; i < 3; i++) {
        const company = await seedCompany(`recent-${i}`);
        const contact = await prisma.contact.create({
          data: { companyId: company.id, name: `Contact ${i}`, relationshipStatus: "CONTACTED" },
        });
        // Two of three were touched recently; only one is actually dormant.
        if (i < 2) {
          await prisma.callLog.create({
            data: {
              companyId: company.id,
              contactId: contact.id,
              loggedByUserId: "user-1",
              loggedByName: "Test User",
              outcome: "ANSWERED",
              createdAt: daysAgo(1),
            },
          });
        }
      }

      await runOpportunityDetection(organizationId);
      const opp = await prisma.opportunity.findUnique({
        where: { organizationId_dedupeKey: { organizationId, dedupeKey: "DORMANT_LEADS" } },
      });
      expect(opp).toBeNull(); // only 1 of 3 qualifies, below DORMANT_MIN_COUNT
    });

    it("ignores a contact that was never engaged (still NEW)", async () => {
      for (let i = 0; i < 3; i++) {
        const company = await seedCompany(`new-${i}`);
        await prisma.contact.create({ data: { companyId: company.id, name: `Contact ${i}` } });
      }

      await runOpportunityDetection(organizationId);
      const opp = await prisma.opportunity.findUnique({
        where: { organizationId_dedupeKey: { organizationId, dedupeKey: "DORMANT_LEADS" } },
      });
      expect(opp).toBeNull();
    });
  });

  describe("High-Fit Uncontacted", () => {
    it("detects a high-fit company with no outreach and no calls", async () => {
      await seedCompany("high-fit-1", { fitScore: 85 });

      await runOpportunityDetection(organizationId);
      const opp = await prisma.opportunity.findUnique({
        where: { organizationId_dedupeKey: { organizationId, dedupeKey: "HIGH_FIT_UNCONTACTED" } },
      });
      expect(opp).not.toBeNull();
      expect(opp?.title).toContain("1 high-fit prospect");
    });

    it("does not surface a company below the fit threshold", async () => {
      await seedCompany("low-fit-1", { fitScore: 40 });
      await runOpportunityDetection(organizationId);
      const opp = await prisma.opportunity.findUnique({
        where: { organizationId_dedupeKey: { organizationId, dedupeKey: "HIGH_FIT_UNCONTACTED" } },
      });
      expect(opp).toBeNull();
    });

    it("does not surface a high-fit company that already has outreach", async () => {
      const company = await seedCompany("contacted-1", { fitScore: 90 });
      await prisma.outreachMessage.create({
        data: { companyId: company.id, subject: "Hi", body: "Hello", openingRationale: "Test" },
      });
      await runOpportunityDetection(organizationId);
      const opp = await prisma.opportunity.findUnique({
        where: { organizationId_dedupeKey: { organizationId, dedupeKey: "HIGH_FIT_UNCONTACTED" } },
      });
      expect(opp).toBeNull();
    });

    it("does not surface a high-fit company that has already been called", async () => {
      const company = await seedCompany("called-1", { fitScore: 90 });
      await prisma.callLog.create({
        data: {
          companyId: company.id,
          loggedByUserId: "user-1",
          loggedByName: "Test User",
          outcome: "NO_ANSWER",
        },
      });
      await runOpportunityDetection(organizationId);
      const opp = await prisma.opportunity.findUnique({
        where: { organizationId_dedupeKey: { organizationId, dedupeKey: "HIGH_FIT_UNCONTACTED" } },
      });
      expect(opp).toBeNull();
    });

    it("estimates potential value once an average customer value is on file", async () => {
      await prisma.businessProfile.create({
        data: {
          organizationId,
          description: "Test",
          idealCustomer: "Test",
          sellingLocations: [],
          acquisitionChannels: [],
          growthChallenge: "Test",
          mainGoal: "Test",
          competitors: [],
          avgCustomerValue: 500,
        },
      });
      await seedCompany("value-1", { fitScore: 90 });
      await seedCompany("value-2", { fitScore: 90 });

      await runOpportunityDetection(organizationId);
      const opp = await prisma.opportunity.findUnique({
        where: { organizationId_dedupeKey: { organizationId, dedupeKey: "HIGH_FIT_UNCONTACTED" } },
      });
      expect(opp?.estimatedValue).toBe(1000);
    });

    it("leaves potential value unset without an average customer value on file", async () => {
      await seedCompany("no-value-1", { fitScore: 90 });
      await runOpportunityDetection(organizationId);
      const opp = await prisma.opportunity.findUnique({
        where: { organizationId_dedupeKey: { organizationId, dedupeKey: "HIGH_FIT_UNCONTACTED" } },
      });
      expect(opp?.estimatedValue).toBeNull();
    });
  });

  describe("Stalled Callbacks", () => {
    it("detects an overdue, still-pending follow-up task and resolves it to the company", async () => {
      const company = await seedCompany("callback-1");
      await prisma.task.create({
        data: {
          organizationId,
          title: `Follow up with ${company.name}`,
          description: "Asked for a callback.",
          impact: "High",
          status: "PENDING",
          dueDate: daysAgo(3),
        },
      });

      await runOpportunityDetection(organizationId);
      const opp = await prisma.opportunity.findUnique({
        where: { organizationId_dedupeKey: { organizationId, dedupeKey: "STALLED_CALLBACKS" } },
      });
      expect(opp).not.toBeNull();
      expect(opp?.relatedCompanyIds).toEqual([company.id]);
    });

    it("does not surface a follow-up task that isn't due yet", async () => {
      const company = await seedCompany("callback-future");
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 2);
      await prisma.task.create({
        data: {
          organizationId,
          title: `Follow up with ${company.name}`,
          description: "Test",
          impact: "High",
          status: "PENDING",
          dueDate,
        },
      });

      await runOpportunityDetection(organizationId);
      const opp = await prisma.opportunity.findUnique({
        where: { organizationId_dedupeKey: { organizationId, dedupeKey: "STALLED_CALLBACKS" } },
      });
      expect(opp).toBeNull();
    });

    it("does not surface an already-completed follow-up task", async () => {
      const company = await seedCompany("callback-done");
      await prisma.task.create({
        data: {
          organizationId,
          title: `Follow up with ${company.name}`,
          description: "Test",
          impact: "High",
          status: "COMPLETED",
          dueDate: daysAgo(3),
          completedAt: daysAgo(1),
        },
      });

      await runOpportunityDetection(organizationId);
      const opp = await prisma.opportunity.findUnique({
        where: { organizationId_dedupeKey: { organizationId, dedupeKey: "STALLED_CALLBACKS" } },
      });
      expect(opp).toBeNull();
    });

    it("does not surface a follow-up task whose company can no longer be resolved by name", async () => {
      // The company was renamed/deleted after the task was created — the
      // task's title still references the old name, which no longer
      // matches any Company row. Regression test: this must not count
      // toward the opportunity, since it can never be launched (Launch
      // re-resolves the same way and would find zero companies).
      await prisma.task.create({
        data: {
          organizationId,
          title: "Follow up with A Company That No Longer Exists",
          description: "Asked for a callback.",
          impact: "High",
          status: "PENDING",
          dueDate: daysAgo(3),
        },
      });

      await runOpportunityDetection(organizationId);
      const opp = await prisma.opportunity.findUnique({
        where: { organizationId_dedupeKey: { organizationId, dedupeKey: "STALLED_CALLBACKS" } },
      });
      expect(opp).toBeNull();
    });
  });

  describe("Segment Expansion", () => {
    it("surfaces an industry that converts meaningfully better than another, given enough calls", async () => {
      const plumbing = await Promise.all(
        Array.from({ length: 5 }, (_, i) => seedCompany(`seg-plumb-${i}`, { category: "Plumbing" })),
      );
      const roofing = await Promise.all(
        Array.from({ length: 5 }, (_, i) => seedCompany(`seg-roof-${i}`, { category: "Roofing" })),
      );

      for (const [i, company] of plumbing.entries()) {
        await prisma.callLog.create({
          data: {
            companyId: company.id,
            loggedByUserId: "user-1",
            loggedByName: "Test User",
            outcome: i < 4 ? "ANSWERED" : "NO_ANSWER", // 80% positive
          },
        });
      }
      for (const [i, company] of roofing.entries()) {
        await prisma.callLog.create({
          data: {
            companyId: company.id,
            loggedByUserId: "user-1",
            loggedByName: "Test User",
            outcome: i < 1 ? "ANSWERED" : "NO_ANSWER", // 20% positive
          },
        });
      }

      await runOpportunityDetection(organizationId);
      const opp = await prisma.opportunity.findUnique({
        where: { organizationId_dedupeKey: { organizationId, dedupeKey: "SEGMENT_EXPANSION:Plumbing" } },
      });
      expect(opp).not.toBeNull();
      expect(opp?.actionType).toBe("SUGGEST_SEARCH");
      expect((opp?.actionPayload as { query: string }).query).toBe("Plumbing");
    });

    it("does not surface a segment pattern without enough total calls", async () => {
      const company = await seedCompany("seg-sparse", { category: "Plumbing" });
      await prisma.callLog.create({
        data: {
          companyId: company.id,
          loggedByUserId: "user-1",
          loggedByName: "Test User",
          outcome: "ANSWERED",
        },
      });

      await runOpportunityDetection(organizationId);
      const opportunities = await prisma.opportunity.findMany({
        where: { organizationId, type: "SEGMENT_EXPANSION" },
      });
      expect(opportunities).toEqual([]);
    });
  });

  describe("sweep lifecycle", () => {
    it("refreshes an existing DETECTED opportunity instead of duplicating it", async () => {
      await seedCompany("refresh-1", { fitScore: 90 });
      const first = await runOpportunityDetection(organizationId);
      expect(first.created).toBe(1);

      await seedCompany("refresh-2", { fitScore: 90 });
      const second = await runOpportunityDetection(organizationId);
      expect(second.created).toBe(0);
      expect(second.refreshed).toBe(1);

      const rows = await prisma.opportunity.findMany({
        where: { organizationId, dedupeKey: "HIGH_FIT_UNCONTACTED" },
      });
      expect(rows).toHaveLength(1);
      expect(rows[0]?.title).toContain("2 high-fit prospects");
    });

    it("never touches a LAUNCHED opportunity even if the condition still holds", async () => {
      await seedCompany("launched-1", { fitScore: 90 });
      await runOpportunityDetection(organizationId);
      const opp = await prisma.opportunity.findUniqueOrThrow({
        where: { organizationId_dedupeKey: { organizationId, dedupeKey: "HIGH_FIT_UNCONTACTED" } },
      });
      await prisma.opportunity.update({
        where: { id: opp.id },
        data: { status: "LAUNCHED", resolvedAt: new Date(), launchedByUserId: "user-1" },
      });

      const result = await runOpportunityDetection(organizationId);
      expect(result.created).toBe(0);
      expect(result.refreshed).toBe(0);

      const stillLaunched = await prisma.opportunity.findUniqueOrThrow({ where: { id: opp.id } });
      expect(stillLaunched.status).toBe("LAUNCHED");
    });

    it("respects a dismissal until the cooldown window has passed", async () => {
      await seedCompany("dismissed-1", { fitScore: 90 });
      await runOpportunityDetection(organizationId);
      const opp = await prisma.opportunity.findUniqueOrThrow({
        where: { organizationId_dedupeKey: { organizationId, dedupeKey: "HIGH_FIT_UNCONTACTED" } },
      });
      await prisma.opportunity.update({
        where: { id: opp.id },
        data: { status: "DISMISSED", resolvedAt: new Date() },
      });

      const tooSoon = await runOpportunityDetection(organizationId);
      expect(tooSoon.resurfaced).toBe(0);
      const stillDismissed = await prisma.opportunity.findUniqueOrThrow({ where: { id: opp.id } });
      expect(stillDismissed.status).toBe("DISMISSED");

      // Simulate the cooldown having passed.
      await prisma.opportunity.update({ where: { id: opp.id }, data: { resolvedAt: daysAgo(30) } });
      const afterCooldown = await runOpportunityDetection(organizationId);
      expect(afterCooldown.resurfaced).toBe(1);
      const resurfaced = await prisma.opportunity.findUniqueOrThrow({ where: { id: opp.id } });
      expect(resurfaced.status).toBe("DETECTED");
    });

    it("expires a DETECTED opportunity once the underlying condition resolves on its own", async () => {
      const company = await seedCompany("expiring-1", { fitScore: 90 });
      const first = await runOpportunityDetection(organizationId);
      expect(first.created).toBe(1);

      // The condition resolves itself — someone logged a call outside the
      // opportunity flow entirely.
      await prisma.callLog.create({
        data: {
          companyId: company.id,
          loggedByUserId: "user-1",
          loggedByName: "Test User",
          outcome: "NO_ANSWER",
        },
      });

      const second = await runOpportunityDetection(organizationId);
      expect(second.expired).toBe(1);
      const opp = await prisma.opportunity.findUniqueOrThrow({
        where: { organizationId_dedupeKey: { organizationId, dedupeKey: "HIGH_FIT_UNCONTACTED" } },
      });
      expect(opp.status).toBe("EXPIRED");
    });
  });
});
