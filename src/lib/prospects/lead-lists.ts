import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { UserFacingError } from "@/lib/errors";
import { logEvent, EventType } from "@/lib/memory/log-event";
import * as companyRepository from "@/lib/repositories/company-repository";

const MAX_NAME_LENGTH = 60;

function validateName(name: string) {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new UserFacingError("Give the list a name.");
  }
  if (trimmed.length > MAX_NAME_LENGTH) {
    throw new UserFacingError(`List names must be ${MAX_NAME_LENGTH} characters or fewer.`);
  }
  return trimmed;
}

/**
 * docs/outrun/07 STEP 2 "SELECT AUDIENCE" — Saved Lists tab. Only
 * companies with a research profile are included, since campaign
 * creation requires research; a list that mixes researched and
 * unresearched companies just shows a smaller usable count than its
 * total, rather than blocking on it.
 */
export async function getLeadListsWithResearchedCompaniesForOrg(organizationId: string) {
  const lists = await prisma.leadList.findMany({
    where: { organizationId },
    orderBy: { createdAt: "asc" },
    include: {
      companies: {
        where: { company: { research: { not: Prisma.DbNull } } },
        include: { company: { include: { outreachMessages: { select: { id: true }, take: 1 } } } },
        orderBy: { addedAt: "desc" },
      },
    },
  });
  return lists.map((list) => ({
    id: list.id,
    name: list.name,
    companies: list.companies.map(({ company }) => ({
      id: company.id,
      name: company.name,
      category: company.category,
      fitScore: company.fitScore,
      fitReason: company.fitReason,
      isSaved: company.isSaved,
      rating: company.rating,
      reviewCount: company.reviewCount,
      website: company.website,
      hasOutreach: company.outreachMessages.length > 0,
    })),
  }));
}

export async function getLeadListsForOrg(organizationId: string) {
  const lists = await prisma.leadList.findMany({
    where: { organizationId },
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { companies: true } } },
  });
  return lists.map((list) => ({
    id: list.id,
    name: list.name,
    companyCount: list._count.companies,
    createdAt: list.createdAt,
  }));
}

export async function createLeadList(organizationId: string, name: string) {
  const trimmed = validateName(name);
  const existing = await prisma.leadList.findUnique({
    where: { organizationId_name: { organizationId, name: trimmed } },
  });
  if (existing) {
    throw new UserFacingError(`A list named "${trimmed}" already exists.`);
  }

  const list = await prisma.leadList.create({
    data: { organizationId, name: trimmed },
  });

  await logEvent(organizationId, EventType.LEAD_LIST_CREATED, `Created lead list "${trimmed}".`);

  return list;
}

export async function renameLeadList(organizationId: string, leadListId: string, name: string) {
  const trimmed = validateName(name);
  const list = await prisma.leadList.findFirst({ where: { id: leadListId, organizationId } });
  if (!list) {
    throw new UserFacingError("That list could not be found.");
  }

  const existing = await prisma.leadList.findUnique({
    where: { organizationId_name: { organizationId, name: trimmed } },
  });
  if (existing && existing.id !== leadListId) {
    throw new UserFacingError(`A list named "${trimmed}" already exists.`);
  }

  return prisma.leadList.update({ where: { id: leadListId }, data: { name: trimmed } });
}

export async function deleteLeadList(organizationId: string, leadListId: string) {
  const list = await prisma.leadList.findFirst({ where: { id: leadListId, organizationId } });
  if (!list) {
    throw new UserFacingError("That list could not be found.");
  }
  await prisma.leadList.delete({ where: { id: leadListId } });
}

export async function getLeadListWithCompanies(organizationId: string, leadListId: string) {
  const list = await prisma.leadList.findFirst({
    where: { id: leadListId, organizationId },
    include: {
      companies: {
        include: {
          company: { include: { _count: { select: { callLogs: true } } } },
        },
        orderBy: { addedAt: "desc" },
      },
    },
  });
  if (!list) {
    throw new UserFacingError("That list could not be found.");
  }
  return list;
}

/** Returns the ids of every list this company currently belongs to. */
export async function getLeadListIdsForCompany(organizationId: string, companyId: string) {
  const entries = await prisma.leadListCompany.findMany({
    where: { companyId, leadList: { organizationId } },
    select: { leadListId: true },
  });
  return entries.map((e) => e.leadListId);
}

export async function addCompanyToLeadList(
  organizationId: string,
  leadListId: string,
  companyId: string,
) {
  const [list, company] = await Promise.all([
    prisma.leadList.findFirst({ where: { id: leadListId, organizationId } }),
    companyRepository.findByIdForOrg(organizationId, companyId),
  ]);
  if (!list) throw new UserFacingError("That list could not be found.");
  if (!company) throw new UserFacingError("That prospect could not be found.");

  await prisma.leadListCompany.upsert({
    where: { leadListId_companyId: { leadListId, companyId } },
    create: { leadListId, companyId },
    update: {},
  });
}

export async function removeCompanyFromLeadList(
  organizationId: string,
  leadListId: string,
  companyId: string,
) {
  const list = await prisma.leadList.findFirst({ where: { id: leadListId, organizationId } });
  if (!list) throw new UserFacingError("That list could not be found.");

  await prisma.leadListCompany.deleteMany({ where: { leadListId, companyId } });
}
