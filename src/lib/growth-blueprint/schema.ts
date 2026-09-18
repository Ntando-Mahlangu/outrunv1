import { z } from "zod";

// Mirrors docs/outrun/05-growth-blueprint-engine.md section by section.
// Every recommendation-bearing object carries its own reasoning field —
// Article IV: never present a score or recommendation unexplained.

const impact = z.enum(["Low", "Medium", "High"]);
const confidenceLevel = z.enum(["Low", "Medium", "High"]);

const scoreCategorySchema = z.object({
  category: z.enum([
    "Lead Generation",
    "Outbound",
    "Website",
    "SEO Readiness",
    "Positioning",
    "Offer Clarity",
    "Conversion Potential",
    "Operational Readiness",
  ]),
  score: z.number().min(0).max(100),
  reason: z.string(),
  recommendation: z.string(),
  estimatedImpact: impact,
  estimatedDifficulty: impact,
});

const strengthSchema = z.object({
  title: z.string(),
  reason: z.string(),
});

const weaknessSchema = z.object({
  title: z.string(),
  whyItMatters: z.string(),
  suggestedImprovement: z.string(),
  estimatedImpact: impact,
});

const bottleneckSchema = z.object({
  title: z.string(),
  description: z.string(),
  whyItIsLimitingGrowth: z.string(),
  howFixingItChangesTheBusiness: z.string(),
});

// Which in-app area this action belongs to — read directly by
// getMissionActionHref() so "Start Today's Mission" routes somewhere
// actually relevant, instead of guessing from the free-text action/reason
// with a keyword match. Optional in the inferred TS type (not in the
// JSON schema the model must satisfy) since older, already-persisted
// Blueprints were generated before this field existed.
const actionArea = z.enum(["campaigns", "seo", "prospects", "blueprint", "other"]);

const opportunitySchema = z.object({
  title: z.string(),
  description: z.string(),
  priority: impact,
  estimatedImpact: impact,
  estimatedEffort: impact,
  confidence: z.number().min(0).max(100),
  supportingEvidence: z.string(),
  recommendedAction: z.string(),
  actionArea: actionArea.optional(),
});

const growthStrategySchema = z.object({
  channel: z.string(),
  whyItFits: z.string(),
  expectedAdvantages: z.string(),
  potentialChallenges: z.string(),
  impact,
});

// docs/outrun/16 Article IV/VIII, CLAUDE.md non-negotiable — every AI output
// must separate observed facts from inference. The ICP is this Blueprint's
// most speculative section (it's predicting who a customer WILL be, not
// analyzing something that already exists), so each claim carries its own
// basis rather than leaving the whole profile's epistemic status to the
// single top-level confidenceNotes/overallConfidence fields. "stated"
// mirrors something the business owner actually said in onboarding;
// "inferred" is the AI extrapolating beyond that — matching the same
// stated-vs-derived split used for prospect research
// (src/lib/prospects/research-schema.ts's "observed"/"assumption").
const icpClaimBasis = z.enum(["stated", "inferred"]);
const icpClaimSchema = z.object({
  text: z.string(),
  basis: icpClaimBasis,
});

const idealCustomerProfileSchema = z.object({
  industry: z.string(),
  companySize: z.string(),
  decisionMaker: z.string(),
  location: z.string(),
  revenueRange: z.string().nullable(),
  painPoints: z.array(icpClaimSchema),
  likelyGoals: z.array(icpClaimSchema),
  buyingTriggers: z.array(icpClaimSchema),
  whyTheyWouldChooseThisBusiness: z.string(),
});

const roadmapItemSchema = z.object({
  horizon: z.enum(["Today", "This Week", "This Month", "This Quarter"]),
  action: z.string(),
  reason: z.string(),
  estimatedTime: z.string(),
  expectedImpact: impact,
  actionArea: actionArea.optional(),
});

// docs/outrun/05 "BUSINESS SNAPSHOT" — most of its fields (target market,
// ideal customer, primary goal/channel, growth stage, customer value,
// website/campaign status) are already known facts sitting in
// BusinessProfile/Organization/Campaign, so they're computed procedurally
// in generate.ts rather than asked of the model (Article IV: never let an
// AI restate a stored number and risk it drifting). Only industry and
// businessModel genuinely require reading the business description, so
// those two are the only AI-authored fields here.
const businessSnapshotAiSchema = z.object({
  industry: z.string(),
  businessModel: z.string(),
});

export type BusinessSnapshot = z.infer<typeof businessSnapshotAiSchema> & {
  targetMarket: string;
  idealCustomer: string;
  primaryGoal: string;
  primaryAcquisitionChannel: string;
  growthStage: string;
  estimatedCustomerValue: number | null;
  websiteStatus: "Not provided" | "Provided, analyzed" | "Provided, could not be analyzed";
  campaignStatus: string;
};

// docs/outrun/05 "WEBSITE ANALYSIS (IF AVAILABLE)" — headline/offer
// clarity, CTAs, trust signals, and messaging genuinely require judgment,
// so those stay AI-authored, but only ever from the real crawled signals
// (src/lib/seo/crawl.ts) passed into the prompt — "never guess unavailable
// metrics" per the doc, e.g. Speed is explicitly out (future integration,
// same exclusion already applied to Local SEO's citations/map-pack).
// Contact info and SEO fundamentals are plain procedural facts from the
// crawl, not AI-authored, matching src/lib/seo/local-seo.ts's split
// between verified findings and AI suggestions.
const websiteAnalysisAiSchema = z.object({
  headlineClarity: z.string(),
  offerClarity: z.string(),
  callsToAction: z.string(),
  trustSignals: z.string(),
  messaging: z.string(),
});

export type WebsiteAnalysis = z.infer<typeof websiteAnalysisAiSchema> & {
  hasContactInfo: boolean;
  hasTitle: boolean;
  hasMetaDescription: boolean;
  wordCount: number;
  imagesMissingAlt: number;
};

export const growthBlueprintSchema = z.object({
  growthScore: z.number().min(0).max(100),
  executiveSummary: z.string(),
  scoreCategories: z.array(scoreCategorySchema).length(8),
  businessSnapshot: businessSnapshotAiSchema,
  strengths: z.array(strengthSchema).min(2).max(4),
  weaknesses: z.array(weaknessSchema).min(2).max(4),
  biggestBottleneck: bottleneckSchema,
  opportunities: z.array(opportunitySchema).min(3).max(6),
  growthStrategy: z.array(growthStrategySchema).min(1).max(3),
  idealCustomerProfile: idealCustomerProfileSchema,
  roadmap: z.array(roadmapItemSchema).min(4),
  websiteAnalysis: websiteAnalysisAiSchema.nullable(),
  confidenceNotes: z.string(),
  overallConfidence: confidenceLevel,
});

export type GrowthBlueprintData = z.infer<typeof growthBlueprintSchema>;

// Anthropic tool input_schema (JSON Schema) mirroring the Zod shape above —
// forces the model to return exactly this structure via tool use.
export const growthBlueprintJsonSchema = {
  type: "object",
  properties: {
    growthScore: { type: "integer", minimum: 0, maximum: 100 },
    executiveSummary: { type: "string" },
    businessSnapshot: {
      type: "object",
      description:
        "Only industry and businessModel — everything else in the Business Snapshot section is a known fact filled in separately, not asked of you.",
      properties: {
        industry: { type: "string" },
        businessModel: { type: "string" },
      },
      required: ["industry", "businessModel"],
    },
    scoreCategories: {
      type: "array",
      minItems: 8,
      maxItems: 8,
      items: {
        type: "object",
        properties: {
          category: {
            type: "string",
            enum: [
              "Lead Generation",
              "Outbound",
              "Website",
              "SEO Readiness",
              "Positioning",
              "Offer Clarity",
              "Conversion Potential",
              "Operational Readiness",
            ],
          },
          score: { type: "integer", minimum: 0, maximum: 100 },
          reason: { type: "string" },
          recommendation: { type: "string" },
          estimatedImpact: { type: "string", enum: ["Low", "Medium", "High"] },
          estimatedDifficulty: { type: "string", enum: ["Low", "Medium", "High"] },
        },
        required: [
          "category",
          "score",
          "reason",
          "recommendation",
          "estimatedImpact",
          "estimatedDifficulty",
        ],
      },
    },
    strengths: {
      type: "array",
      minItems: 2,
      maxItems: 4,
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          reason: { type: "string" },
        },
        required: ["title", "reason"],
      },
    },
    weaknesses: {
      type: "array",
      minItems: 2,
      maxItems: 4,
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          whyItMatters: { type: "string" },
          suggestedImprovement: { type: "string" },
          estimatedImpact: { type: "string", enum: ["Low", "Medium", "High"] },
        },
        required: ["title", "whyItMatters", "suggestedImprovement", "estimatedImpact"],
      },
    },
    biggestBottleneck: {
      type: "object",
      properties: {
        title: { type: "string" },
        description: { type: "string" },
        whyItIsLimitingGrowth: { type: "string" },
        howFixingItChangesTheBusiness: { type: "string" },
      },
      required: [
        "title",
        "description",
        "whyItIsLimitingGrowth",
        "howFixingItChangesTheBusiness",
      ],
    },
    opportunities: {
      type: "array",
      minItems: 3,
      maxItems: 6,
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          priority: { type: "string", enum: ["Low", "Medium", "High"] },
          estimatedImpact: { type: "string", enum: ["Low", "Medium", "High"] },
          estimatedEffort: { type: "string", enum: ["Low", "Medium", "High"] },
          confidence: { type: "integer", minimum: 0, maximum: 100 },
          supportingEvidence: { type: "string" },
          recommendedAction: { type: "string" },
          actionArea: {
            type: "string",
            enum: ["campaigns", "seo", "prospects", "blueprint", "other"],
            description:
              "Which part of the app this opportunity is best acted on in. 'other' only if none of the specific areas fit.",
          },
        },
        required: [
          "title",
          "description",
          "priority",
          "estimatedImpact",
          "estimatedEffort",
          "confidence",
          "supportingEvidence",
          "recommendedAction",
          "actionArea",
        ],
      },
    },
    growthStrategy: {
      type: "array",
      minItems: 1,
      maxItems: 3,
      items: {
        type: "object",
        properties: {
          channel: { type: "string" },
          whyItFits: { type: "string" },
          expectedAdvantages: { type: "string" },
          potentialChallenges: { type: "string" },
          impact: { type: "string", enum: ["Low", "Medium", "High"] },
        },
        required: [
          "channel",
          "whyItFits",
          "expectedAdvantages",
          "potentialChallenges",
          "impact",
        ],
      },
    },
    idealCustomerProfile: {
      type: "object",
      properties: {
        industry: { type: "string" },
        companySize: { type: "string" },
        decisionMaker: { type: "string" },
        location: { type: "string" },
        revenueRange: { type: ["string", "null"] },
        painPoints: {
          type: "array",
          items: {
            type: "object",
            properties: {
              text: { type: "string" },
              basis: {
                type: "string",
                enum: ["stated", "inferred"],
                description:
                  "'stated' if the business owner said this directly in onboarding, 'inferred' if the AI derived it beyond what was actually said",
              },
            },
            required: ["text", "basis"],
          },
        },
        likelyGoals: {
          type: "array",
          items: {
            type: "object",
            properties: {
              text: { type: "string" },
              basis: { type: "string", enum: ["stated", "inferred"] },
            },
            required: ["text", "basis"],
          },
        },
        buyingTriggers: {
          type: "array",
          items: {
            type: "object",
            properties: {
              text: { type: "string" },
              basis: { type: "string", enum: ["stated", "inferred"] },
            },
            required: ["text", "basis"],
          },
        },
        whyTheyWouldChooseThisBusiness: { type: "string" },
      },
      required: [
        "industry",
        "companySize",
        "decisionMaker",
        "location",
        "revenueRange",
        "painPoints",
        "likelyGoals",
        "buyingTriggers",
        "whyTheyWouldChooseThisBusiness",
      ],
    },
    roadmap: {
      type: "array",
      minItems: 4,
      items: {
        type: "object",
        properties: {
          horizon: {
            type: "string",
            enum: ["Today", "This Week", "This Month", "This Quarter"],
          },
          action: { type: "string" },
          reason: { type: "string" },
          estimatedTime: { type: "string" },
          expectedImpact: { type: "string", enum: ["Low", "Medium", "High"] },
          actionArea: {
            type: "string",
            enum: ["campaigns", "seo", "prospects", "blueprint", "other"],
            description:
              "Which part of the app this action is best carried out in. 'other' only if none of the specific areas fit.",
          },
        },
        required: ["horizon", "action", "reason", "estimatedTime", "expectedImpact", "actionArea"],
      },
    },
    websiteAnalysis: {
      type: ["object", "null"],
      description:
        "Fill this in only when website signals were given to you below (title, h1s, meta description, word count, form/contact-info presence). Set to null if no website was provided or it couldn't be crawled — never guess at a website you weren't shown.",
      properties: {
        headlineClarity: { type: "string" },
        offerClarity: { type: "string" },
        callsToAction: { type: "string" },
        trustSignals: { type: "string" },
        messaging: { type: "string" },
      },
      required: ["headlineClarity", "offerClarity", "callsToAction", "trustSignals", "messaging"],
    },
    confidenceNotes: { type: "string" },
    overallConfidence: { type: "string", enum: ["Low", "Medium", "High"] },
  },
  required: [
    "growthScore",
    "executiveSummary",
    "businessSnapshot",
    "scoreCategories",
    "strengths",
    "weaknesses",
    "biggestBottleneck",
    "opportunities",
    "growthStrategy",
    "idealCustomerProfile",
    "roadmap",
    "websiteAnalysis",
    "confidenceNotes",
    "overallConfidence",
  ],
} as const;
