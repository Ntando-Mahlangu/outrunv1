import { z } from "zod";

const confidenceLevel = z.enum(["Low", "Medium", "High"]);
const magnitude = z.enum(["Low", "Medium", "High"]);
const direction = z.enum(["Increase", "Decrease", "Uncertain"]);

const impactSchema = z.object({
  area: z.string(),
  direction,
  magnitude,
  reasoning: z.string(),
});

export const whatIfSchema = z.object({
  scenario: z.string(),
  assumptions: z.array(z.string()).min(2).max(6),
  estimatedImpacts: z.array(impactSchema).min(1).max(5),
  risks: z.array(z.string()).min(1).max(5),
  confidence: confidenceLevel,
  confidenceReason: z.string(),
  recommendedNextStep: z.string(),
});

export type WhatIfData = z.infer<typeof whatIfSchema>;

export const whatIfJsonSchema = {
  type: "object",
  properties: {
    scenario: { type: "string" },
    assumptions: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 6 },
    estimatedImpacts: {
      type: "array",
      minItems: 1,
      maxItems: 5,
      items: {
        type: "object",
        properties: {
          area: { type: "string" },
          direction: { type: "string", enum: ["Increase", "Decrease", "Uncertain"] },
          magnitude: { type: "string", enum: ["Low", "Medium", "High"] },
          reasoning: { type: "string" },
        },
        required: ["area", "direction", "magnitude", "reasoning"],
      },
    },
    risks: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 5 },
    confidence: { type: "string", enum: ["Low", "Medium", "High"] },
    confidenceReason: { type: "string" },
    recommendedNextStep: { type: "string" },
  },
  required: [
    "scenario",
    "assumptions",
    "estimatedImpacts",
    "risks",
    "confidence",
    "confidenceReason",
    "recommendedNextStep",
  ],
} as const;
