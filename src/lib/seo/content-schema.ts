import { z } from "zod";

// docs/outrun/09 "AI CONTENT GENERATOR" — the eight content types it's
// meant to generate. Each has a genuinely different shape (a blog post
// isn't a meta title with extra fields), so — unlike Opportunity/
// WebhookDelivery's free-string-plus-app-validation pattern — this one
// stays a real Zod enum: the shape and prompt selection both switch on
// it exhaustively in content.ts, and a TS union gives that a compile-time
// guarantee a free string wouldn't.
export const SEO_CONTENT_TYPES = [
  "BLOG_POST",
  "LANDING_PAGE",
  "SERVICE_PAGE",
  "FAQ_PAGE",
  "META_TITLE",
  "META_DESCRIPTION",
  "CALL_TO_ACTION",
  "FEATURE_DESCRIPTION",
] as const;
export type SEOContentType = (typeof SEO_CONTENT_TYPES)[number];

export const CONTENT_TYPE_LABEL: Record<SEOContentType, string> = {
  BLOG_POST: "Blog Post",
  LANDING_PAGE: "Landing Page",
  SERVICE_PAGE: "Service Page",
  FAQ_PAGE: "FAQ Page",
  META_TITLE: "Meta Title",
  META_DESCRIPTION: "Meta Description",
  CALL_TO_ACTION: "Call-to-Action",
  FEATURE_DESCRIPTION: "Feature Description",
};

const longFormSchema = z.object({
  title: z.string(),
  metaDescription: z.string(),
  body: z.string(),
});
const longFormJsonSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    metaDescription: { type: "string" },
    body: { type: "string" },
  },
  required: ["title", "metaDescription", "body"],
} as const;

const faqPageSchema = z.object({
  title: z.string(),
  metaDescription: z.string(),
  faqs: z.array(z.object({ question: z.string(), answer: z.string() })).min(3).max(8),
});
const faqPageJsonSchema = {
  type: "object",
  properties: {
    title: { type: "string" },
    metaDescription: { type: "string" },
    faqs: {
      type: "array",
      minItems: 3,
      maxItems: 8,
      items: {
        type: "object",
        properties: { question: { type: "string" }, answer: { type: "string" } },
        required: ["question", "answer"],
      },
    },
  },
  required: ["title", "metaDescription", "faqs"],
} as const;

const shortFormSchema = z.object({
  title: z.string(),
  body: z.string(),
});
const shortFormJsonSchema = {
  type: "object",
  properties: { title: { type: "string" }, body: { type: "string" } },
  required: ["title", "body"],
} as const;

// Meta titles, meta descriptions, and CTAs are never "one right answer"
// — the whole point is picking between a few real options.
const optionsSchema = z.object({
  options: z.array(z.string()).min(3).max(6),
});
const optionsJsonSchema = {
  type: "object",
  properties: { options: { type: "array", minItems: 3, maxItems: 6, items: { type: "string" } } },
  required: ["options"],
} as const;

export const CONTENT_TYPE_SCHEMA: Record<
  SEOContentType,
  { schema: z.ZodType; jsonSchema: Record<string, unknown> }
> = {
  BLOG_POST: { schema: longFormSchema, jsonSchema: longFormJsonSchema },
  LANDING_PAGE: { schema: longFormSchema, jsonSchema: longFormJsonSchema },
  SERVICE_PAGE: { schema: longFormSchema, jsonSchema: longFormJsonSchema },
  FAQ_PAGE: { schema: faqPageSchema, jsonSchema: faqPageJsonSchema },
  META_TITLE: { schema: optionsSchema, jsonSchema: optionsJsonSchema },
  META_DESCRIPTION: { schema: optionsSchema, jsonSchema: optionsJsonSchema },
  CALL_TO_ACTION: { schema: optionsSchema, jsonSchema: optionsJsonSchema },
  FEATURE_DESCRIPTION: { schema: shortFormSchema, jsonSchema: shortFormJsonSchema },
};

export type LongFormContentData = z.infer<typeof longFormSchema>;
export type FaqPageContentData = z.infer<typeof faqPageSchema>;
export type ShortFormContentData = z.infer<typeof shortFormSchema>;
export type OptionsContentData = z.infer<typeof optionsSchema>;

/** The union of every shape a generated piece's `content` JSON can be —
 * discriminate on the piece's own `contentType` to narrow it. */
export type SEOContentData = LongFormContentData | FaqPageContentData | ShortFormContentData | OptionsContentData;
