import { prisma } from "@/lib/prisma";
import { getAIProvider } from "@/lib/ai";
import { UserFacingError } from "@/lib/errors";
import { logEvent, EventType } from "@/lib/memory/log-event";
import * as companyRepository from "@/lib/repositories/company-repository";
import * as outreachMessageRepository from "@/lib/repositories/outreach-message-repository";
import type { CompanyResearchData } from "./research-schema";
import { outreachSchema, outreachJsonSchema, type OutreachData } from "./outreach-schema";

const LINKEDIN_MESSAGE_MAX_CHARS = 500;

// The model is instructed to stay under docs/outrun/07's 500-character
// LinkedIn limit, but nothing enforces that at generation time — this is
// a formatting safeguard (never send an over-length draft), not a
// content change.
function enforceLinkedinLength(data: OutreachData): OutreachData {
  if (data.linkedinMessage.length <= LINKEDIN_MESSAGE_MAX_CHARS) return data;
  return {
    ...data,
    linkedinMessage: `${data.linkedinMessage.slice(0, LINKEDIN_MESSAGE_MAX_CHARS - 1).trimEnd()}…`,
  };
}

const SYSTEM_PROMPT = `You are Outrun's AI Outreach engine (docs/outrun/07). Write ONE cold email
from the requesting business to one specific prospect, using only their
existing research profile.

Rules you must follow (non-negotiable):
- 150-200 words for the body.
- Subject line: concise, no clickbait, no spam trigger words.
- Never claim to have observed something that wasn't in the research
  (e.g. never say "I noticed your website..." if no website was found).
- Never fabricate facts, credentials, or shared connections.
- No exaggerated claims or hard selling — this should read like a
  thoughtful note a real person would send, not a mass blast.
- End with a single, low-friction call to action.
- Explain, in openingRationale, why you chose that specific opening line
  — referencing the concrete research fact it is based on.
- linkedinMessage: a separate, shorter draft for LinkedIn (docs/outrun/07
  "LINKEDIN MESSAGE") — under 500 characters, natural, conversation-first,
  no hard selling. Not a shortened copy of the email; write it as its own
  opening message.`;

// docs/outrun/07 "A/B TESTING" — distinct angles a campaign can split its
// audience across, so results are genuinely comparable rather than just
// random rewrites of the same idea. Three, not two, so a test isn't
// forced into a single either/or framing.
export const VARIANT_LABELS = ["A", "B", "C"] as const;
export type VariantLabel = (typeof VARIANT_LABELS)[number];

const VARIANT_INSTRUCTIONS: Record<VariantLabel, string> = {
  A: "For this version, open by directly naming their most likely pain point from the research — matter-of-fact and empathetic — before introducing the sender.",
  B: "For this version, open by naming a specific growth opportunity or possibility for their business from the research — framed positively — before introducing the sender.",
  C: "For this version, open with a sharp, specific observation from the research stated as a plain fact with no editorializing, then pivot straight to the sender's angle — terse and direct, no warm-up.",
};

function buildUserMessage(input: {
  companyName: string;
  research: CompanyResearchData;
  requestingBusinessDescription: string;
  brandVoice: string | null;
}) {
  return [
    `Prospect: ${input.companyName}`,
    `Company summary: ${input.research.companySummary}`,
    `Why they match: ${input.research.whyTheyMatch.join(" ")}`,
    `Likely pain points: ${input.research.likelyPainPoints
      .map((p) => `${p.point} (${p.basis})`)
      .join(" ")}`,
    `Recommended contact angle: ${input.research.recommendedContactAngle}`,
    `Suggested decision maker title: ${input.research.suggestedDecisionMakerTitle}`,
    "",
    `The sender's business does this: ${input.requestingBusinessDescription}`,
    `Preferred tone: ${input.brandVoice ?? "professional and direct"}`,
    "",
    "Write the email now.",
  ].join("\n");
}

export async function generateOutreach(
  companyId: string,
  organizationId: string,
  campaignId?: string,
  variant?: VariantLabel,
) {
  const company = await companyRepository.findByIdForOrg(organizationId, companyId);
  if (!company) {
    throw new UserFacingError("That prospect could not be found.");
  }
  if (!company.research) {
    throw new UserFacingError("Research this prospect before generating outreach.");
  }

  const organization = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
    include: { businessProfile: true },
  });
  if (!organization.businessProfile) {
    throw new UserFacingError("Finish Business Discovery before generating outreach.");
  }

  const ai = getAIProvider();
  const rawData = await ai.generateObject<OutreachData>({
    system: variant ? `${SYSTEM_PROMPT}\n\n${VARIANT_INSTRUCTIONS[variant]}` : SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: buildUserMessage({
          companyName: company.name,
          research: company.research as CompanyResearchData,
          requestingBusinessDescription: organization.businessProfile.description,
          brandVoice: organization.brandVoice,
        }),
      },
    ],
    schema: outreachSchema,
    jsonSchema: outreachJsonSchema,
    toolName: "outreach_message",
  });
  const data = enforceLinkedinLength(rawData);

  const message = await outreachMessageRepository.create({
    companyId: company.id,
    campaignId,
    data,
    variant,
  });

  await logEvent(
    organizationId,
    EventType.OUTREACH_GENERATED,
    `Generated outreach for ${company.name}.`,
  );

  return message;
}
