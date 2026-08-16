import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { getOpportunityFeed } from "./opportunity-feed";
import { rateRecommendation } from "./recommendation-feedback";

describe("getOpportunityFeed (integration)", () => {
  let organizationId: string;

  beforeEach(async () => {
    const org = await prisma.organization.create({ data: { name: "Opportunity Feed Test Org" } });
    organizationId = org.id;
  });

  afterEach(async () => {
    await prisma.organization.delete({ where: { id: organizationId } });
  });

  it("surfaces high-fit companies that have never been contacted", async () => {
    await prisma.company.create({
      data: {
        organizationId,
        source: "test",
        sourceId: "unactioned-1",
        name: "Untouched High-Fit Co",
        fitScore: 85,
      },
    });

    const items = await getOpportunityFeed(organizationId);
    const item = items.find((i) => i.source === "Unactioned Prospects");
    expect(item).toBeDefined();
    expect(item?.title).toContain("1 high-fit prospect");
  });

  it("does not surface unactioned prospects below the fit-score threshold", async () => {
    await prisma.company.create({
      data: {
        organizationId,
        source: "test",
        sourceId: "low-fit-1",
        name: "Low Fit Co",
        fitScore: 40,
      },
    });

    const items = await getOpportunityFeed(organizationId);
    expect(items.find((i) => i.source === "Unactioned Prospects")).toBeUndefined();
  });

  it("does not surface a high-fit company that already has outreach", async () => {
    const company = await prisma.company.create({
      data: {
        organizationId,
        source: "test",
        sourceId: "contacted-1",
        name: "Already Contacted Co",
        fitScore: 90,
      },
    });
    await prisma.outreachMessage.create({
      data: {
        companyId: company.id,
        subject: "Hi",
        body: "Hello",
        openingRationale: "Test",
      },
    });

    const items = await getOpportunityFeed(organizationId);
    expect(items.find((i) => i.source === "Unactioned Prospects")).toBeUndefined();
  });

  it("surfaces a declining reply rate when recent performance drops sharply", async () => {
    const company = await prisma.company.create({
      data: { organizationId, source: "test", sourceId: "trend-1", name: "Trend Co" },
    });

    const now = Date.now();
    const day = 24 * 60 * 60 * 1000;

    // Prior window (15-28 days ago): 5 sent, 4 replies = 80%
    for (let i = 0; i < 5; i++) {
      await prisma.outreachMessage.create({
        data: {
          companyId: company.id,
          subject: `Prior ${i}`,
          body: "Hello",
          openingRationale: "Test",
          sendStatus: "SENT",
          sentAt: new Date(now - (15 + i) * day),
          gotReply: i < 4,
        },
      });
    }
    // Recent window (0-13 days ago): 5 sent, 0 replies = 0%
    for (let i = 0; i < 5; i++) {
      await prisma.outreachMessage.create({
        data: {
          companyId: company.id,
          subject: `Recent ${i}`,
          body: "Hello",
          openingRationale: "Test",
          sendStatus: "SENT",
          sentAt: new Date(now - i * day),
          gotReply: false,
        },
      });
    }

    const items = await getOpportunityFeed(organizationId);
    const item = items.find((i) => i.source === "Reply Rate Trend");
    expect(item).toBeDefined();
    expect(item?.description).toContain("0%");
    expect(item?.description).toContain("80%");
  });

  it("does not surface a reply-rate trend without enough samples in both windows", async () => {
    const company = await prisma.company.create({
      data: { organizationId, source: "test", sourceId: "trend-2", name: "Sparse Co" },
    });
    await prisma.outreachMessage.create({
      data: {
        companyId: company.id,
        subject: "Only one",
        body: "Hello",
        openingRationale: "Test",
        sendStatus: "SENT",
        sentAt: new Date(),
        gotReply: false,
      },
    });

    const items = await getOpportunityFeed(organizationId);
    expect(items.find((i) => i.source === "Reply Rate Trend")).toBeUndefined();
  });

  it("returns no items for a brand-new organization", async () => {
    const items = await getOpportunityFeed(organizationId);
    expect(items).toEqual([]);
  });

  it("filters out items the user has dismissed via feedback", async () => {
    await prisma.company.create({
      data: {
        organizationId,
        source: "test",
        sourceId: "unactioned-dismissed",
        name: "Untouched High-Fit Co",
        fitScore: 85,
      },
    });

    const before = await getOpportunityFeed(organizationId);
    const item = before.find((i) => i.source === "Unactioned Prospects");
    expect(item).toBeDefined();

    await rateRecommendation(organizationId, item!.id, item!.title, "DISMISSED");

    const after = await getOpportunityFeed(organizationId);
    expect(after.find((i) => i.source === "Unactioned Prospects")).toBeUndefined();
  });
});
