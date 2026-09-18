import { prisma } from "@/lib/prisma";
import { getAIProvider } from "@/lib/ai";
import { UserFacingError } from "@/lib/errors";
import { logEvent, EventType } from "@/lib/memory/log-event";
import {
  CONTENT_TYPE_SCHEMA,
  CONTENT_TYPE_LABEL,
  type SEOContentType,
  type LongFormContentData,
  type FaqPageContentData,
  type ShortFormContentData,
  type OptionsContentData,
} from "./content-schema";

const BASE_SYSTEM_PROMPT = `You are Outrun's AI Content Generator (docs/outrun/09). Write one piece of
original content for a business's website, based on their own business
description and a target keyword.

Rules you must follow (non-negotiable):
- Be original and genuinely helpful — never keyword-stuff or repeat the
  target keyword unnaturally.
- Match the business's own voice implied by its description.
- Never fabricate expertise, credentials, statistics, or customer
  stories the business hasn't told you about.`;

// Each content type gets its own, specific instruction on top of the
// shared rules above — a Meta Title generator asking for "400-700 words"
// makes no sense, and an FAQ generator needs to know it's writing real
// Q&A pairs, not a single flowing body.
const TYPE_INSTRUCTIONS: Record<SEOContentType, string> = {
  BLOG_POST: "Write a blog post. body should be 400-700 words of well-structured content (use paragraph breaks), ready to paste into a CMS.",
  LANDING_PAGE: "Write landing page copy. body should be 300-600 words structured for scanning (short paragraphs, a clear value proposition up front, a closing call to action).",
  SERVICE_PAGE: "Write a service page. body should be 300-600 words describing the specific service, who it's for, and what's included, ending with a call to action.",
  FAQ_PAGE: "Write 3-8 genuinely useful question-and-answer pairs a real prospect would ask about this topic — never generic filler questions.",
  META_TITLE: "Write 3-6 distinct meta title options, each under 60 characters, each a genuinely different angle (not minor rewordings of the same one).",
  META_DESCRIPTION: "Write 3-6 distinct meta description options, each under 160 characters, each a genuinely different angle.",
  CALL_TO_ACTION: "Write 3-6 distinct call-to-action phrases (a few words each, e.g. button or headline copy) — genuinely different framings, not synonyms of the same phrase.",
  FEATURE_DESCRIPTION: "Write a short feature/service description. title is the feature's name; body is 40-100 words explaining what it does and why it matters, ready to paste into a CMS.",
};

function systemPromptFor(contentType: SEOContentType): string {
  return `${BASE_SYSTEM_PROMPT}\n\n${TYPE_INSTRUCTIONS[contentType]}`;
}

/** What actually gets stored on SeoContentPiece for a given content
 * type's AI output — the long-form types map straight onto the three
 * plain columns; everything else goes into the flexible `content` JSON
 * column instead, leaving title/metaDescription/body null (or, for
 * FEATURE_DESCRIPTION, using title/body but not metaDescription). */
export function toStoredFields(
  contentType: SEOContentType,
  data: LongFormContentData | FaqPageContentData | ShortFormContentData | OptionsContentData,
): { title: string | null; metaDescription: string | null; body: string | null; content: object | null } {
  switch (contentType) {
    case "BLOG_POST":
    case "LANDING_PAGE":
    case "SERVICE_PAGE": {
      const d = data as LongFormContentData;
      return { title: d.title, metaDescription: d.metaDescription, body: d.body, content: null };
    }
    case "FAQ_PAGE": {
      const d = data as FaqPageContentData;
      return { title: d.title, metaDescription: d.metaDescription, body: null, content: { faqs: d.faqs } };
    }
    case "FEATURE_DESCRIPTION": {
      const d = data as ShortFormContentData;
      return { title: d.title, metaDescription: null, body: d.body, content: null };
    }
    case "META_TITLE":
    case "META_DESCRIPTION":
    case "CALL_TO_ACTION": {
      const d = data as OptionsContentData;
      return { title: null, metaDescription: null, body: null, content: { options: d.options } };
    }
  }
}

/** A short, human label for the event log / notification — options-only
 * types have no single "title" to quote. */
function pieceLabel(
  contentType: SEOContentType,
  fields: { title: string | null },
  targetKeyword: string,
): string {
  return fields.title
    ? `"${fields.title}"`
    : `${CONTENT_TYPE_LABEL[contentType]} for "${targetKeyword}"`;
}

export async function generateSEOContent(
  organizationId: string,
  input: { headline: string; targetKeyword: string; businessGoal: string; contentType: SEOContentType },
) {
  const organization = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
    include: { businessProfile: true },
  });
  if (!organization.businessProfile) {
    throw new UserFacingError("Finish Business Discovery before generating content.");
  }

  const { schema, jsonSchema } = CONTENT_TYPE_SCHEMA[input.contentType];

  const ai = getAIProvider();
  const data = await ai.generateObject<
    LongFormContentData | FaqPageContentData | ShortFormContentData | OptionsContentData
  >({
    system: systemPromptFor(input.contentType),
    messages: [
      {
        role: "user",
        content: [
          `Business: ${organization.businessProfile.description}`,
          `Headline/topic to write from: ${input.headline}`,
          `Target keyword: ${input.targetKeyword}`,
          `Business goal for this content: ${input.businessGoal}`,
        ].join("\n"),
      },
    ],
    schema,
    jsonSchema,
    toolName: "seo_content",
  });

  const fields = toStoredFields(input.contentType, data);

  const piece = await prisma.seoContentPiece.create({
    data: {
      organizationId,
      targetKeyword: input.targetKeyword,
      contentType: input.contentType,
      title: fields.title,
      metaDescription: fields.metaDescription,
      body: fields.body,
      content: fields.content ?? undefined,
    },
  });

  await logEvent(
    organizationId,
    EventType.SEO_CONTENT_GENERATED,
    `Drafted ${pieceLabel(input.contentType, fields, input.targetKeyword)}.`,
  );

  return piece;
}
