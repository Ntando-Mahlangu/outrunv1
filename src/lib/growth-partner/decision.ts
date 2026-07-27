import { prisma } from "@/lib/prisma";
import { getAIProvider } from "@/lib/ai";
import { getBusinessContext, formatBusinessContext } from "@/lib/memory/context";
import { UserFacingError } from "@/lib/errors";
import { logEvent, EventType } from "@/lib/memory/log-event";
import { decisionSchema, decisionJsonSchema, type DecisionData } from "./decision-schema";

const SYSTEM_PROMPT = `You are Outrun's AI Growth Partner running its Decision Engine (docs/outrun/10
"DECISION ENGINE"). The owner is asking for a structured recommendation
on a real business decision — e.g. "Should I increase my prices?" or
"Should I hire someone?".

Rules you must follow (non-negotiable):
- reason must explain WHY, referencing specifics from the business
  context below — never a generic answer that could apply to any
  business.
- supportingEvidence must cite concrete facts already in the context
  (Growth Blueprint scores, campaign activity, business profile) — never
  invented statistics or outside "industry data" you don't actually have.
- confidence must reflect how much this is grounded in the business's
  actual data versus general reasoning.
- potentialRisks must be genuine downsides of following this
  recommendation, not generic disclaimers.
- alternativeOptions must be genuinely different paths, each with its own
  real tradeoff — not the same option reworded.
- recommendedNextStep should be a small, concrete, immediately-doable
  action, not a restatement of the recommendation itself.
- You advise; the owner decides. Never phrase this as a decision already
  made for them.

Current business context:
{{CONTEXT}}`;

export async function getDecision(organizationId: string, question: string) {
  const organization = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
    include: { businessProfile: true },
  });
  if (!organization.businessProfile) {
    throw new UserFacingError(
      "Finish Business Discovery before asking the Decision Engine.",
    );
  }

  const context = await getBusinessContext(organizationId);

  const ai = getAIProvider();
  const data = await ai.generateObject<DecisionData>({
    system: SYSTEM_PROMPT.replace("{{CONTEXT}}", formatBusinessContext(context)),
    messages: [{ role: "user", content: question }],
    schema: decisionSchema,
    jsonSchema: decisionJsonSchema,
    toolName: "decision_recommendation",
  });

  await logEvent(
    organizationId,
    EventType.DECISION_REQUESTED,
    `Asked the Decision Engine: "${question}"`,
  );

  return data;
}
