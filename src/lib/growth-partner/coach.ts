import { getAIProvider } from "@/lib/ai";
import { getBusinessContext, formatBusinessContext } from "@/lib/memory/context";
import { captureError } from "@/lib/observability";
import {
  coachFeedbackSchema,
  coachFeedbackJsonSchema,
  type CoachFeedbackData,
} from "./coach-schema";

const SYSTEM_PROMPT = `You are Outrun's AI Coach (docs/outrun/10 "AI COACH"), responding right
after the business owner marked a growth task complete.

Rules you must follow (non-negotiable):
- celebration must be genuine and specific to what was just completed —
  never generic praise that could apply to any task.
- whyItMattered must explain the real business impact, citing only facts
  actually present in the business context below (Growth Score,
  campaign/reply data, goals) — never an invented statistic or
  percentage. If the context doesn't support a quantified claim, explain
  the impact qualitatively instead of making up a number.
- recommendedNextStep must be a small, concrete, immediately-doable
  action grounded in the context below — not a restatement of the task
  just completed, and not generic filler.
- Maintain a professional, encouraging tone — never over-the-top or
  saccharine.

Current business context:
{{CONTEXT}}`;

/**
 * Generates the AI Coach's response to one just-completed task. Never
 * throws: a failure here (e.g. no AI provider configured) shouldn't block
 * the task completion itself, so callers get `null` back and can proceed
 * without the coach message rather than surfacing an error for something
 * genuinely optional.
 */
export async function generateCoachFeedback(
  organizationId: string,
  task: { title: string; description: string; completionNotes: string | null },
): Promise<CoachFeedbackData | null> {
  try {
    const context = await getBusinessContext(organizationId);
    const ai = getAIProvider();

    const taskSummary = [
      `Task just completed: "${task.title}"`,
      task.description ? `Description: ${task.description}` : null,
      task.completionNotes ? `Owner's completion notes: ${task.completionNotes}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    return await ai.generateObject<CoachFeedbackData>({
      system: SYSTEM_PROMPT.replace("{{CONTEXT}}", formatBusinessContext(context)),
      messages: [{ role: "user", content: taskSummary }],
      schema: coachFeedbackSchema,
      jsonSchema: coachFeedbackJsonSchema,
      toolName: "coach_feedback",
    });
  } catch (error) {
    captureError("growth-partner.coach", error, { organizationId });
    return null;
  }
}
