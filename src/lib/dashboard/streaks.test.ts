import { describe, it, expect, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { getGrowthStreaks } from "./streaks";

function daysAgo(days: number): Date {
  const d = new Date();
  d.setUTCHours(12, 0, 0, 0); // fixed mid-day time, clear of any midnight edge
  d.setUTCDate(d.getUTCDate() - days);
  return d;
}

describe("getGrowthStreaks (integration)", () => {
  let organizationId: string;

  afterEach(async () => {
    if (organizationId) await prisma.organization.delete({ where: { id: organizationId } });
  });

  it("counts consecutive active days ending today", async () => {
    const org = await prisma.organization.create({ data: { name: "Streaks Test Org" } });
    organizationId = org.id;

    await prisma.event.createMany({
      data: [0, 1, 2].map((days) => ({
        organizationId,
        type: "COMPANY_SEARCHED" as const,
        summary: "test",
        createdAt: daysAgo(days),
      })),
    });

    const { growthStreakDays } = await getGrowthStreaks(organizationId);
    expect(growthStreakDays).toBe(3);
  });

  it("does not let a burst of events on recent days hide an earlier active day within the streak", async () => {
    const org = await prisma.organization.create({ data: { name: "Streaks Burst Test Org" } });
    organizationId = org.id;

    // A row-count-capped query (the previous implementation, take: 500)
    // would fill its entire limit with same-day rows here, pushing
    // "3 days ago" out of the fetched set and truncating the streak at 2
    // instead of the true 4.
    await prisma.event.createMany({
      data: Array.from({ length: 600 }, (_, i) => ({
        organizationId,
        type: "COMPANY_SEARCHED" as const,
        summary: "test",
        createdAt: daysAgo(0),
      })),
    });
    await prisma.event.createMany({
      data: [1, 2, 3].map((days) => ({
        organizationId,
        type: "COMPANY_SEARCHED" as const,
        summary: "test",
        createdAt: daysAgo(days),
      })),
    });

    const { growthStreakDays } = await getGrowthStreaks(organizationId);
    expect(growthStreakDays).toBe(4);
  });

  it("returns a zero streak with no recent events", async () => {
    const org = await prisma.organization.create({ data: { name: "Streaks Empty Test Org" } });
    organizationId = org.id;

    const { growthStreakDays } = await getGrowthStreaks(organizationId);
    expect(growthStreakDays).toBe(0);
  });
});
