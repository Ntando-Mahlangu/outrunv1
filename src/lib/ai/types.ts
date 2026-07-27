import type { ZodType } from "zod";

export type AIMessage = {
  role: "user" | "assistant";
  content: string;
};

export type GenerateObjectInput<T> = {
  system: string;
  messages: AIMessage[];
  schema: ZodType<T>;
  /** JSON Schema mirroring `schema`, used to force structured output. */
  jsonSchema: Record<string, unknown>;
  toolName: string;
};

export type GenerateTextInput = {
  system: string;
  messages: AIMessage[];
};

/**
 * Every AI-backed feature in Outrun talks to this interface, never to a
 * provider SDK directly (docs/outrun/11, docs/outrun/13 "AI SERVICE").
 * Swapping Anthropic for another provider means writing one new class,
 * not touching call sites.
 */
export interface AIProvider {
  generateObject<T>(input: GenerateObjectInput<T>): Promise<T>;
  /** Free-form conversational response — used where forcing a structured
   * tool call would make the reply feel robotic (e.g. Growth Partner chat). */
  generateText(input: GenerateTextInput): Promise<string>;
}
