import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { RawCompanyResult } from "@/lib/leads/types";
import type { LeadScore } from "@/lib/leads/scoring";

/**
 * docs/outrun/13 "REPOSITORY LAYER" — "Services interact with
 * repositories. Repositories interact with Prisma." This module (plus
 * campaign-repository, outreach-message-repository, growth-blueprint-
 * repository) covers the highest-traffic models; every query shape here
 * matches an existing call site exactly, migrated in place rather than
 * redesigned, so this is a structural change only.
 */

export function findByIdForOrg(organizationId: string, id: string) {
  return prisma.company.findFirst({ where: { id, organizationId } });
}

export function findByIdForOrgWithMessages(organizationId: string, id: string) {
  return prisma.company.findFirst({
    where: { id, organizationId },
    include: { outreachMessages: { orderBy: { createdAt: "desc" } } },
  });
}

export function findManyByIdsForOrgWithResearch(organizationId: string, ids: string[]) {
  return prisma.company.findMany({
    where: { id: { in: ids }, organizationId, research: { not: Prisma.DbNull } },
  });
}

/** Unlike findManyByIdsForOrgWithResearch, includes companies that
 * haven't been researched yet — used by bulk actions (export, save)
 * that operate on whatever the user selected, not just researched ones. */
export function findManyByIdsForOrg(organizationId: string, ids: string[]) {
  return prisma.company.findMany({ where: { id: { in: ids }, organizationId } });
}

export function setManySaved(organizationId: string, ids: string[], isSaved: boolean) {
  return prisma.company.updateMany({
    where: { id: { in: ids }, organizationId },
    data: { isSaved },
  });
}

export function findAllForOrg(organizationId: string) {
  return prisma.company.findMany({ where: { organizationId } });
}

export async function findResearchedForOrg(
  organizationId: string,
  options: { take?: number } = {},
) {
  const companies = await prisma.company.findMany({
    where: { organizationId, research: { not: Prisma.DbNull } },
    orderBy: { fitScore: "desc" },
    take: options.take,
    select: {
      id: true,
      name: true,
      category: true,
      fitScore: true,
      fitReason: true,
      isSaved: true,
      rating: true,
      reviewCount: true,
      website: true,
      _count: { select: { outreachMessages: true } },
    },
  });
  // docs/outrun/07 STEP 2 "AI Recommended Prospects" needs to know which
  // companies have never been sent outreach yet — flattened here so
  // callers don't need to reach into Prisma's _count shape.
  return companies.map(({ _count, ...c }) => ({ ...c, hasOutreach: _count.outreachMessages > 0 }));
}

export function countResearchedForOrg(organizationId: string) {
  return prisma.company.count({
    where: { organizationId, research: { not: Prisma.DbNull } },
  });
}

export function countForOrg(organizationId: string) {
  return prisma.company.aggregate({ where: { organizationId }, _count: { id: true } });
}

export function updateResearch(id: string, research: Prisma.InputJsonValue) {
  return prisma.company.update({ where: { id }, data: { research } });
}

export function updateCallScript(id: string, callScript: Prisma.InputJsonValue) {
  return prisma.company.update({ where: { id }, data: { callScript } });
}

export function updateContactEmail(id: string, contactEmail: string | null) {
  return prisma.company.update({ where: { id }, data: { contactEmail } });
}

export function setSaved(id: string, isSaved: boolean) {
  return prisma.company.update({ where: { id }, data: { isSaved } });
}

export function setAssignedTo(id: string, assignedToUserId: string | null) {
  return prisma.company.update({ where: { id }, data: { assignedToUserId } });
}

export function upsertFromSearchResult(
  organizationId: string,
  result: RawCompanyResult,
  score: LeadScore,
) {
  return prisma.company.upsert({
    where: {
      organizationId_source_sourceId: {
        organizationId,
        source: result.source,
        sourceId: result.sourceId,
      },
    },
    create: {
      organizationId,
      source: result.source,
      sourceId: result.sourceId,
      name: result.name,
      category: result.category,
      website: result.website,
      phone: result.phone,
      formattedAddress: result.formattedAddress,
      rating: result.rating,
      reviewCount: result.reviewCount,
      fitScore: score.fitScore,
      fitReason: score.fitReason,
      confidenceScore: score.confidenceScore,
      confidenceReason: score.confidenceReason,
    },
    update: {
      name: result.name,
      category: result.category,
      website: result.website,
      phone: result.phone,
      formattedAddress: result.formattedAddress,
      rating: result.rating,
      reviewCount: result.reviewCount,
      fitScore: score.fitScore,
      fitReason: score.fitReason,
      confidenceScore: score.confidenceScore,
      confidenceReason: score.confidenceReason,
    },
  });
}
