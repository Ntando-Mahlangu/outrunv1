import { z } from "zod";

// docs/outrun/10 "AI COACH" — "After every completed task: Celebrate
// progress. Explain why it mattered. Recommend the next action." Three
// required fields, one per instruction — never optional, since a coach
// response missing any one of these isn't the feature the doc describes.
export const coachFeedbackSchema = z.object({
  celebration: z.string(),
  whyItMattered: z.string(),
  recommendedNextStep: z.string(),
});

export type CoachFeedbackData = z.infer<typeof coachFeedbackSchema>;

export const coachFeedbackJsonSchema = {
  type: "object",
  properties: {
    celebration: { type: "string" },
    whyItMattered: { type: "string" },
    recommendedNextStep: { type: "string" },
  },
  required: ["celebration", "whyItMattered", "recommendedNextStep"],
} as const;
