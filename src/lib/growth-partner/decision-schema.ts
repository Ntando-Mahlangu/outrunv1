import { z } from "zod";

const confidenceLevel = z.enum(["Low", "Medium", "High"]);
const impact = z.enum(["Low", "Medium", "High"]);

const alternativeSchema = z.object({
  option: z.string(),
  tradeoff: z.string(),
});

// docs/outrun/10 "DECISION ENGINE" — the nine fields every recommendation
// must contain. Never optional: a recommendation without reasoning is
// exactly what this schema exists to prevent.
export const decisionSchema = z.object({
  recommendation: z.string(),
  reason: z.string(),
  supportingEvidence: z.string(),
  estimatedBusinessImpact: impact,
  estimatedEffort: impact,
  confidence: confidenceLevel,
  confidenceReason: z.string(),
  potentialRisks: z.array(z.string()).min(1).max(5),
  alternativeOptions: z.array(alternativeSchema).min(1).max(4),
  recommendedNextStep: z.string(),
});

export type DecisionData = z.infer<typeof decisionSchema>;

export const decisionJsonSchema = {
  type: "object",
  properties: {
    recommendation: { type: "string" },
    reason: { type: "string" },
    supportingEvidence: { type: "string" },
    estimatedBusinessImpact: { type: "string", enum: ["Low", "Medium", "High"] },
    estimatedEffort: { type: "string", enum: ["Low", "Medium", "High"] },
    confidence: { type: "string", enum: ["Low", "Medium", "High"] },
    confidenceReason: { type: "string" },
    potentialRisks: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 5 },
    alternativeOptions: {
      type: "array",
      minItems: 1,
      maxItems: 4,
      items: {
        type: "object",
        properties: {
          option: { type: "string" },
          tradeoff: { type: "string" },
        },
        required: ["option", "tradeoff"],
      },
    },
    recommendedNextStep: { type: "string" },
  },
  required: [
    "recommendation",
    "reason",
    "supportingEvidence",
    "estimatedBusinessImpact",
    "estimatedEffort",
    "confidence",
    "confidenceReason",
    "potentialRisks",
    "alternativeOptions",
    "recommendedNextStep",
  ],
} as const;
