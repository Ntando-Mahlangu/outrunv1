import type { Opportunity } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { UserFacingError } from "@/lib/errors";
import { createLeadList } from "@/lib/prospects/lead-lists";
import { resolveCurrentCompanyIds } from "./detect";
import type { OpportunityActionType, OpportunityType } from "./types";

/**
 * Runs the actual side effect behind "Review & Launch" (docs/outrun/10
 * "GROWTH OPPORTUNITY ENGINE" Execute step). Every branch here either
 * writes something the user can see and undo (a Lead List they can
 * delete) or writes nothing at all — never a campaign send, never an
 * email, never anything the Constitution's "no consequential action
 * without approval" rule would consider irreversible.
 */
export async function executeOpportunity(
  opportunity: Opportunity,
): Promise<Record<string, unknown>> {
  const actionType = opportunity.actionType as OpportunityActionType;

  switch (actionType) {
    case "CREATE_LEAD_LIST_AND_CALL": {
      // Re-derive the current, real company set rather than trusting the
      // snapshot taken at detection time — time may have passed, and
      // some of those companies may already have been called or removed.
      const companyIds = await resolveCurrentCompanyIds(
        opportunity.organizationId,
        opportunity.type as OpportunityType,
      );
      if (companyIds.length === 0) {
        throw new UserFacingError(
          "These leads have already been handled since this was detected — there's nothing left to add to a call list.",
        );
      }

      const baseName = `${opportunity.title} — ${new Date().toLocaleDateString()}`;
      let list;
      try {
        list = await createLeadList(opportunity.organizationId, baseName);
      } catch (error) {
        if (!(error instanceof UserFacingError)) throw error;
        list = await createLeadList(opportunity.organizationId, `${baseName} (${opportunity.id.slice(0, 6)})`);
      }

      await prisma.leadListCompany.createMany({
        data: companyIds.map((companyId) => ({ leadListId: list.id, companyId })),
        skipDuplicates: true,
      });

      return { leadListId: list.id, leadListName: list.name, companyCount: companyIds.length };
    }

    case "SUGGEST_SEARCH": {
      const query = (opportunity.actionPayload as { query?: string } | null)?.query ?? "";
      return { deepLink: `/prospects?q=${encodeURIComponent(query)}` };
    }

    case "REVIEW_ONLY":
      return { acknowledged: true };
  }
}
