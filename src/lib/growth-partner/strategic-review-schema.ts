import { z } from "zod";

// docs/outrun/10 "STRATEGIC REVIEWS" — the six required sections. Arrays
// are allowed to be empty (e.g. no risks worth flagging this period)
// rather than forced to a minimum, since fabricating a risk or missed
// opportunity that didn't happen would violate the anti-fabrication rule.
export const strategicReviewSchema = z.object({
  achievements: z.array(z.string()).max(8),
  missedOpportunities: z.array(z.string()).max(6),
  risks: z.array(z.string()).max(6),
  keyLearnings: z.array(z.string()).max(6),
  recommendedPriorities: z.array(z.string()).min(1).max(6),
  nextGrowthStrategy: z.string(),
});

export type StrategicReviewData = z.infer<typeof strategicReviewSchema>;

export const strategicReviewJsonSchema = {
  type: "object",
  properties: {
    achievements: { type: "array", items: { type: "string" }, maxItems: 8 },
    missedOpportunities: { type: "array", items: { type: "string" }, maxItems: 6 },
    risks: { type: "array", items: { type: "string" }, maxItems: 6 },
    keyLearnings: { type: "array", items: { type: "string" }, maxItems: 6 },
    recommendedPriorities: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 6 },
    nextGrowthStrategy: { type: "string" },
  },
  required: [
    "achievements",
    "missedOpportunities",
    "risks",
    "keyLearnings",
    "recommendedPriorities",
    "nextGrowthStrategy",
  ],
} as const;
