import type { ImpactLevel } from "@/components/ui/badge";

// docs/outrun/10 "GROWTH OPPORTUNITY ENGINE". `Opportunity.type` and
// `.actionType` are free strings in the schema (matching
// WebhookDelivery.eventType's precedent), validated against these const
// unions in application code instead — so a new detector or action type
// never needs a migration, just a new entry here plus a case in
// detect.ts/execute.ts.
export const OPPORTUNITY_TYPES = [
  "DORMANT_LEADS",
  "HIGH_FIT_UNCONTACTED",
  "STALLED_CALLBACKS",
  "SEGMENT_EXPANSION",
  "REPLY_RATE_DECLINE",
] as const;
export type OpportunityType = (typeof OPPORTUNITY_TYPES)[number];

export const OPPORTUNITY_ACTION_TYPES = [
  "CREATE_LEAD_LIST_AND_CALL",
  "SUGGEST_SEARCH",
  "REVIEW_ONLY",
] as const;
export type OpportunityActionType = (typeof OPPORTUNITY_ACTION_TYPES)[number];

/** What a detector proposes, before it's persisted. */
export type DetectedCandidate = {
  type: OpportunityType;
  dedupeKey: string;
  title: string;
  summary: string;
  whyItMatters: string;
  evidence: string[];
  confidence: number; // 0-100
  estimatedImpact: ImpactLevel;
  estimatedValue: number | null;
  recommendedAction: string;
  actionType: OpportunityActionType;
  actionPayload?: Record<string, unknown>;
  relatedCompanyIds?: string[];
};

// CTA copy per action type — the "Review & Launch" button reads
// differently depending on what launching actually does, so the user
// never clicks a generic button into an unclear consequence.
export const ACTION_LABEL: Record<OpportunityActionType, string> = {
  CREATE_LEAD_LIST_AND_CALL: "Create List & Start Calling",
  SUGGEST_SEARCH: "Search This Segment",
  REVIEW_ONLY: "Acknowledge",
};
