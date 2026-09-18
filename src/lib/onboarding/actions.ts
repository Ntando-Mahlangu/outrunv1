"use server";

import { revalidateTag } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/session";
import { getCurrentOrganization } from "@/lib/org";
import { orgProfileTag } from "@/lib/cache-tags";
import { businessDiscoverySchema, type BusinessDiscoveryInput } from "./schema";

export async function saveBusinessDiscovery(input: BusinessDiscoveryInput) {
  const session = await getCurrentSession();
  if (!session) throw new Error("Not signed in.");

  const organization = await getCurrentOrganization(session.user.id);
  if (!organization) throw new Error("No workspace found for this account.");

  const result = businessDiscoverySchema.safeParse(input);
  if (!result.success) {
    // Never let ZodError.message reach the client — it's a
    // JSON-stringified issue array, not something a user should see.
    // Each field's own schema message is already written to be
    // human-readable, so surface just the first one.
    throw new Error(result.error.issues[0]?.message ?? "Please check your answers and try again.");
  }
  const parsed = result.data;

  await prisma.$transaction([
    prisma.businessProfile.upsert({
      where: { organizationId: organization.id },
      create: {
        organizationId: organization.id,
        description: parsed.description,
        idealCustomer: parsed.idealCustomer,
        sellingLocations: parsed.sellingLocations,
        acquisitionChannels: parsed.acquisitionChannels,
        growthChallenge: parsed.growthChallenge,
        avgCustomerValue: parsed.avgCustomerValue,
        mainGoal: parsed.mainGoal,
        competitors: parsed.competitors,
      },
      update: {
        description: parsed.description,
        idealCustomer: parsed.idealCustomer,
        sellingLocations: parsed.sellingLocations,
        acquisitionChannels: parsed.acquisitionChannels,
        growthChallenge: parsed.growthChallenge,
        avgCustomerValue: parsed.avgCustomerValue,
        mainGoal: parsed.mainGoal,
        competitors: parsed.competitors,
      },
    }),
    prisma.organization.update({
      where: { id: organization.id },
      data: {
        website: parsed.website,
        growthStage: parsed.growthStage,
      },
    }),
  ]);

  revalidateTag(orgProfileTag(organization.id), "max");

  return { organizationId: organization.id };
}
