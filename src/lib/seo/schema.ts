import { z } from "zod";
import { SEO_CONTENT_TYPES } from "./content-schema";

const impact = z.enum(["Low", "Medium", "High"]);

const categorySchema = z.object({
  category: z.enum([
    "Technical SEO",
    "Content",
    "Keywords",
    "User Experience",
    "Trust",
    "Local SEO",
    "Conversion Readiness",
  ]),
  score: z.number().min(0).max(100),
  reason: z.string(),
  suggestedFix: z.string(),
  estimatedEffort: impact,
  estimatedImpact: impact,
});

const keywordSchema = z.object({
  keyword: z.string(),
  type: z.enum([
    "Primary",
    "Secondary",
    "Long-tail",
    "Location",
    "Question",
    "Commercial Intent",
  ]),
  searchIntent: z.string(),
  reason: z.string(),
});

const contentIdeaSchema = z.object({
  headline: z.string(),
  targetKeyword: z.string(),
  searchIntent: z.string(),
  businessGoal: z.string(),
  estimatedDifficulty: impact,
  // docs/outrun/09 "AI CONTENT GENERATOR" — which of the eight content
  // types this idea actually calls for, so generating a draft from it
  // produces the right shape (a Blog Post, not a generic template
  // forced onto an FAQ Page or a Meta Title).
  contentType: z.enum(SEO_CONTENT_TYPES),
});

// docs/outrun/09 "LOCAL SEO" — only these four are in scope; "Local
// citations" and "Map visibility improvements" are explicitly marked
// "(future)" in that doc section. Suggestions only, never asserted as
// fact — verified findings are computed separately in
// src/lib/seo/local-seo.ts, not by the model.
const localSeoSchema = z.object({
  locationPageRecommendations: z.array(z.string()).min(1).max(4),
  localKeywordRecommendations: z.array(z.string()).min(1).max(6),
  googleBusinessProfileTips: z.array(z.string()).min(1).max(4),
  reviewStrategyTips: z.array(z.string()).min(1).max(4),
});

export const seoAnalysisSchema = z.object({
  healthScore: z.number().min(0).max(100),
  executiveSummary: z.string(),
  categories: z.array(categorySchema).length(7),
  quickWins: z.array(z.string()).min(1).max(6),
  keywordSuggestions: z.array(keywordSchema).min(3).max(10),
  contentIdeas: z.array(contentIdeaSchema).min(2).max(6),
  // null when the business doesn't serve a specific local area.
  localSeo: localSeoSchema.nullable(),
});

export type SEOAnalysisData = z.infer<typeof seoAnalysisSchema>;

// The shape actually persisted on SeoAnalysis.localSeo — the AI's
// suggestions plus src/lib/seo/local-seo.ts's procedurally-computed
// verifiedFindings, merged at generation time (see src/lib/seo/analyze.ts).
export type LocalSeoPersisted = z.infer<typeof localSeoSchema> & {
  verifiedFindings: string[];
};

export const seoAnalysisJsonSchema = {
  type: "object",
  properties: {
    healthScore: { type: "integer", minimum: 0, maximum: 100 },
    executiveSummary: { type: "string" },
    categories: {
      type: "array",
      minItems: 7,
      maxItems: 7,
      items: {
        type: "object",
        properties: {
          category: {
            type: "string",
            enum: [
              "Technical SEO",
              "Content",
              "Keywords",
              "User Experience",
              "Trust",
              "Local SEO",
              "Conversion Readiness",
            ],
          },
          score: { type: "integer", minimum: 0, maximum: 100 },
          reason: { type: "string" },
          suggestedFix: { type: "string" },
          estimatedEffort: { type: "string", enum: ["Low", "Medium", "High"] },
          estimatedImpact: { type: "string", enum: ["Low", "Medium", "High"] },
        },
        required: ["category", "score", "reason", "suggestedFix", "estimatedEffort", "estimatedImpact"],
      },
    },
    quickWins: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 6 },
    keywordSuggestions: {
      type: "array",
      minItems: 3,
      maxItems: 10,
      items: {
        type: "object",
        properties: {
          keyword: { type: "string" },
          type: {
            type: "string",
            enum: ["Primary", "Secondary", "Long-tail", "Location", "Question", "Commercial Intent"],
          },
          searchIntent: { type: "string" },
          reason: { type: "string" },
        },
        required: ["keyword", "type", "searchIntent", "reason"],
      },
    },
    contentIdeas: {
      type: "array",
      minItems: 2,
      maxItems: 6,
      items: {
        type: "object",
        properties: {
          headline: { type: "string" },
          targetKeyword: { type: "string" },
          searchIntent: { type: "string" },
          businessGoal: { type: "string" },
          estimatedDifficulty: { type: "string", enum: ["Low", "Medium", "High"] },
          contentType: { type: "string", enum: SEO_CONTENT_TYPES },
        },
        required: [
          "headline",
          "targetKeyword",
          "searchIntent",
          "businessGoal",
          "estimatedDifficulty",
          "contentType",
        ],
      },
    },
    localSeo: {
      type: ["object", "null"],
      description:
        "Only fill this in when told the business serves a specific local area — set it to null otherwise.",
      properties: {
        locationPageRecommendations: {
          type: "array",
          minItems: 1,
          maxItems: 4,
          items: { type: "string" },
        },
        localKeywordRecommendations: {
          type: "array",
          minItems: 1,
          maxItems: 6,
          items: { type: "string" },
        },
        googleBusinessProfileTips: {
          type: "array",
          minItems: 1,
          maxItems: 4,
          items: { type: "string" },
        },
        reviewStrategyTips: {
          type: "array",
          minItems: 1,
          maxItems: 4,
          items: { type: "string" },
        },
      },
      required: [
        "locationPageRecommendations",
        "localKeywordRecommendations",
        "googleBusinessProfileTips",
        "reviewStrategyTips",
      ],
    },
  },
  required: [
    "healthScore",
    "executiveSummary",
    "categories",
    "quickWins",
    "keywordSuggestions",
    "contentIdeas",
    "localSeo",
  ],
} as const;
