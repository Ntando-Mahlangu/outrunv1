import { prisma } from "@/lib/prisma";
import type { OutreachData } from "@/lib/prospects/outreach-schema";
import type { VariantLabel } from "@/lib/prospects/outreach";

export function create(input: {
  companyId: string;
  campaignId?: string;
  data: OutreachData;
  variant?: VariantLabel;
}) {
  return prisma.outreachMessage.create({
    data: {
      companyId: input.companyId,
      campaignId: input.campaignId,
      subject: input.data.subject,
      body: input.data.body,
      openingRationale: input.data.openingRationale,
      linkedinMessage: input.data.linkedinMessage,
      variantLabel: input.variant ?? null,
    },
  });
}

export function findByIdForOrg(organizationId: string, id: string) {
  return prisma.outreachMessage.findFirst({
    where: { id, company: { organizationId } },
    include: { company: true },
  });
}
