import { describe, expect, it, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { UserFacingError } from "@/lib/errors";
import { shouldAutoPauseForFailures, runAutonomousSendTick, setAutonomousSending } from "./autonomous";

describe("shouldAutoPauseForFailures", () => {
  it("never pauses below the minimum sample size, even at 100% failure", () => {
    expect(shouldAutoPauseForFailures(1, 1)).toBe(false);
    expect(shouldAutoPauseForFailures(2, 2)).toBe(false);
  });

  it("pauses once the failure rate reaches 50% at the minimum sample size", () => {
    expect(shouldAutoPauseForFailures(3, 1)).toBe(false);
    expect(shouldAutoPauseForFailures(4, 2)).toBe(true);
  });

  it("pauses on a majority-failing larger run", () => {
    expect(shouldAutoPauseForFailures(10, 6)).toBe(true);
  });

  it("does not pause on a mostly-succeeding larger run", () => {
    expect(shouldAutoPauseForFailures(10, 2)).toBe(false);
  });

  it("does not pause when nothing was attempted", () => {
    expect(shouldAutoPauseForFailures(0, 0)).toBe(false);
  });
});

describe("runAutonomousSendTick (integration)", () => {
  let orgIds: string[] = [];

  afterEach(async () => {
    await prisma.organization.deleteMany({ where: { id: { in: orgIds } } });
    orgIds = [];
  });

  it("skips campaigns belonging to a soft-deleted organization", async () => {
    const deletedOrg = await prisma.organization.create({
      data: { name: "Autonomous Tick Test Org (deleted)", deletedAt: new Date() },
    });
    orgIds = [deletedOrg.id];

    const campaign = await prisma.campaign.create({
      data: {
        organizationId: deletedOrg.id,
        name: "Deleted Org Campaign",
        objective: "Test",
        status: "READY",
        autonomousSendEnabled: true,
      },
    });

    await runAutonomousSendTick();

    // runAutonomousSendForCampaign unconditionally stamps
    // lastAutonomousSendAt the moment it processes a campaign, before it
    // even checks for pending messages — so this staying null is proof
    // the deleted org's campaign was never touched by the tick at all,
    // regardless of how many other (unrelated) campaigns exist in the DB.
    const after = await prisma.campaign.findUniqueOrThrow({ where: { id: campaign.id } });
    expect(after.lastAutonomousSendAt).toBeNull();
  });
});

describe("setAutonomousSending (integration)", () => {
  let orgIds: string[] = [];

  afterEach(async () => {
    await prisma.organization.deleteMany({ where: { id: { in: orgIds } } });
    orgIds = [];
  });

  async function seedCampaign(planTier: "FREE" | "STARTER" | "GROWTH" | "UNLIMITED") {
    const org = await prisma.organization.create({
      data: { name: "Autonomous Sending Test Org", planTier },
    });
    orgIds.push(org.id);
    const campaign = await prisma.campaign.create({
      data: { organizationId: org.id, name: "Test Campaign", objective: "Test", status: "READY" },
    });
    return { organizationId: org.id, campaignId: campaign.id };
  }

  it("rejects a Manager trying to enable autonomous sending, even on the Unlimited plan", async () => {
    const { organizationId, campaignId } = await seedCampaign("UNLIMITED");
    await expect(
      setAutonomousSending(organizationId, "MANAGER", "UNLIMITED", campaignId, true, 10),
    ).rejects.toThrow(UserFacingError);
  });

  it("rejects enabling autonomous sending below the Unlimited plan", async () => {
    const { organizationId, campaignId } = await seedCampaign("GROWTH");
    await expect(
      setAutonomousSending(organizationId, "OWNER", "GROWTH", campaignId, true, 10),
    ).rejects.toThrow(/Unlimited plan/);
  });

  it("allows disabling autonomous sending regardless of plan tier", async () => {
    const { organizationId, campaignId } = await seedCampaign("FREE");
    const campaign = await setAutonomousSending(organizationId, "OWNER", "FREE", campaignId, false, 10);
    expect(campaign.autonomousSendEnabled).toBe(false);
  });
});
