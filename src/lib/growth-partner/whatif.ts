import { prisma } from "@/lib/prisma";
import { getAIProvider } from "@/lib/ai";
import { getBusinessContext, formatBusinessContext } from "@/lib/memory/context";
import { UserFacingError } from "@/lib/errors";
import { logEvent, EventType } from "@/lib/memory/log-event";
import { whatIfSchema, whatIfJsonSchema, type WhatIfData } from "./whatif-schema";

const SYSTEM_PROMPT = `You are Outrun's AI Growth Partner running a What-If Simulation (docs/outrun/10
"WHAT-IF SIMULATOR"). The owner is asking a hypothetical question about a
decision they haven't made yet — e.g. "what if I doubled outreach?" or
"what if I hired another salesperson?".

Rules you must follow (non-negotiable):
- This is an estimated scenario, never a prediction. Every impact you
  describe must come with an explicit assumption behind it — never state
  a number or outcome as certain.
- Ground everything in the business context you're given below. If you
  don't have enough information to reason about part of the question,
  say so in the assumptions rather than inventing detail.
- List genuine risks or downsides of the scenario, not just upside.
- confidence must reflect how much this is grounded in the business's
  actual data versus general reasoning — most scenarios should be Low or
  Medium confidence since you can't observe real-world outcomes.
- recommendedNextStep should be something small and testable, not the
  scenario itself (e.g. "run this for one week with 10 prospects before
  committing further").

Current business context:
{{CONTEXT}}`;

export async function runWhatIfSimulation(organizationId: string, question: string) {
  const organization = await prisma.organization.findUniqueOrThrow({
    where: { id: organizationId },
    include: { businessProfile: true },
  });
  if (!organization.businessProfile) {
    throw new UserFacingError(
      "Finish Business Discovery before running a what-if simulation.",
    );
  }

  const context = await getBusinessContext(organizationId);

  const ai = getAIProvider();
  const data = await ai.generateObject<WhatIfData>({
    system: SYSTEM_PROMPT.replace("{{CONTEXT}}", formatBusinessContext(context)),
    messages: [{ role: "user", content: question }],
    schema: whatIfSchema,
    jsonSchema: whatIfJsonSchema,
    toolName: "whatif_simulation",
  });

  await logEvent(
    organizationId,
    EventType.WHATIF_SIMULATED,
    `Ran a what-if simulation: "${question}"`,
  );

  return data;
}
