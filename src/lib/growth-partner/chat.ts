import { prisma } from "@/lib/prisma";
import { getAIProvider } from "@/lib/ai";
import { getBusinessContext, formatBusinessContext } from "@/lib/memory/context";
import type { AIMessage } from "@/lib/ai";

const SYSTEM_PROMPT = `You are Outrun's AI Growth Partner (docs/outrun/10) — an AI executive advisor, not a
chatbot. You help the business owner using Outrun make better decisions
about growing their business.

Rules you must follow (non-negotiable):
- Answer only from the business context you're given below and the
  conversation so far. Never invent facts about the business, its
  market, or its competitors.
- When you make a recommendation, briefly state the reason behind it and
  your confidence — high, medium, or low — and don't hide uncertainty.
- Be concise and actionable. This is an executive conversation, not an
  essay — a few tight paragraphs at most unless the question genuinely
  needs more.
- You advise; the owner decides. Never phrase things as if you're taking
  action on their behalf.
- If the business hasn't completed onboarding or generated a Growth
  Blueprint yet, say so plainly and suggest that as the next step rather
  than guessing.

Current business context:
{{CONTEXT}}`;

const HISTORY_LIMIT = 20;

export async function askGrowthPartner(organizationId: string, userMessage: string) {
  const [context, history] = await Promise.all([
    getBusinessContext(organizationId),
    prisma.chatMessage.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: HISTORY_LIMIT,
    }),
  ]);

  const orderedHistory = history.reverse();

  await prisma.chatMessage.create({
    data: { organizationId, role: "USER", content: userMessage },
  });

  const ai = getAIProvider();
  const messages: AIMessage[] = [
    ...orderedHistory.map((m) => ({
      role: m.role === "USER" ? ("user" as const) : ("assistant" as const),
      content: m.content,
    })),
    { role: "user", content: userMessage },
  ];

  const reply = await ai.generateText({
    system: SYSTEM_PROMPT.replace("{{CONTEXT}}", formatBusinessContext(context)),
    messages,
  });

  await prisma.chatMessage.create({
    data: { organizationId, role: "ASSISTANT", content: reply },
  });

  return reply;
}
