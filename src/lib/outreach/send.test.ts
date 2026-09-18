import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { updateOutreachMessageContent } from "./send";
import type { sendOutreachMessage as SendOutreachMessage, sendCampaignOutreach as SendCampaignOutreach } from "./send";

describe("updateOutreachMessageContent (integration)", () => {
  let organizationId: string;
  let companyId: string;

  beforeEach(async () => {
    const org = await prisma.organization.create({ data: { name: "Edit Outreach Test Org" } });
    organizationId = org.id;
    const company = await prisma.company.create({
      data: { organizationId, source: "test", sourceId: "edit-outreach-1", name: "Edit Outreach Co" },
    });
    companyId = company.id;
  });

  afterEach(async () => {
    await prisma.organization.delete({ where: { id: organizationId } });
  });

  it("lets the owner edit a not-yet-sent message's subject and body", async () => {
    const message = await prisma.outreachMessage.create({
      data: { companyId, subject: "Original subject", body: "Original body", openingRationale: "Rationale" },
    });

    const updated = await updateOutreachMessageContent(organizationId, message.id, {
      subject: "Edited subject",
      body: "Edited body",
      linkedinMessage: "Edited LinkedIn draft",
    });

    expect(updated.subject).toBe("Edited subject");
    expect(updated.body).toBe("Edited body");
    expect(updated.linkedinMessage).toBe("Edited LinkedIn draft");
  });

  it("refuses to edit a message that has already been sent", async () => {
    const message = await prisma.outreachMessage.create({
      data: {
        companyId,
        subject: "Sent subject",
        body: "Sent body",
        openingRationale: "Rationale",
        sendStatus: "SENT",
        sentAt: new Date(),
      },
    });

    await expect(
      updateOutreachMessageContent(organizationId, message.id, {
        subject: "New subject",
        body: "New body",
        linkedinMessage: null,
      }),
    ).rejects.toThrow("This message has already been sent and can't be edited.");

    const stillOriginal = await prisma.outreachMessage.findUniqueOrThrow({ where: { id: message.id } });
    expect(stillOriginal.subject).toBe("Sent subject");
  });

  it("rejects editing a message from another organization", async () => {
    const message = await prisma.outreachMessage.create({
      data: { companyId, subject: "Subject", body: "Body", openingRationale: "Rationale" },
    });
    const otherOrg = await prisma.organization.create({ data: { name: "Other Org" } });
    try {
      await expect(
        updateOutreachMessageContent(otherOrg.id, message.id, {
          subject: "Hijacked subject",
          body: "Hijacked body",
          linkedinMessage: null,
        }),
      ).rejects.toThrow("That message could not be found.");
    } finally {
      await prisma.organization.delete({ where: { id: otherOrg.id } });
    }
  });
});

describe("paused-campaign send guard (integration)", () => {
  let organizationId: string;
  let companyId: string;
  let campaignId: string;
  let messageId: string;
  let sendOutreachMessage: typeof SendOutreachMessage;
  let sendCampaignOutreach: typeof SendCampaignOutreach;

  beforeAll(async () => {
    // email.ts reads RESEND_API_KEY once at module load, so the key has to
    // be stubbed and the module graph reset before importing ./send — only
    // the "is a paused campaign rejected before any send is attempted" path
    // is under test here, which throws before sendEmail() is ever called,
    // so this never reaches the real Resend API regardless of the key.
    vi.stubEnv("RESEND_API_KEY", "test-key-for-paused-guard-only");
    vi.resetModules();
    ({ sendOutreachMessage, sendCampaignOutreach } = await import("./send"));
  });

  afterAll(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  beforeEach(async () => {
    const org = await prisma.organization.create({ data: { name: "Send Guard Test Org" } });
    organizationId = org.id;
    const company = await prisma.company.create({
      data: {
        organizationId,
        source: "google_places",
        sourceId: "send-guard-1",
        name: "Send Guard Test Co",
        contactEmail: "prospect@example.com",
      },
    });
    companyId = company.id;
    const campaign = await prisma.campaign.create({
      data: {
        organizationId,
        name: "Send Guard Campaign",
        objective: "Book calls",
        status: "PAUSED",
      },
    });
    campaignId = campaign.id;
    const message = await prisma.outreachMessage.create({
      data: {
        companyId,
        campaignId,
        subject: "Hi",
        body: "Body",
        openingRationale: "Rationale",
      },
    });
    messageId = message.id;
  });

  afterEach(async () => {
    await prisma.organization.delete({ where: { id: organizationId } });
  });

  it("sendOutreachMessage rejects a message belonging to a paused campaign", async () => {
    await expect(sendOutreachMessage(organizationId, messageId)).rejects.toThrow(
      "This campaign is paused. Resume it before sending.",
    );
  });

  it("sendCampaignOutreach rejects sending on a paused campaign", async () => {
    await expect(sendCampaignOutreach(organizationId, campaignId)).rejects.toThrow(
      "This campaign is paused. Resume it before sending.",
    );
  });
});
