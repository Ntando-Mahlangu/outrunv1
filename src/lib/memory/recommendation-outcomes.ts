import { prisma } from "@/lib/prisma";

const MAX_TITLES_PER_GROUP = 5;

function listTitles(titles: string[]): string {
  const shown = titles.slice(0, MAX_TITLES_PER_GROUP);
  const remainder = titles.length - shown.length;
  return shown.map((t) => `"${t}"`).join(", ") + (remainder > 0 ? `, and ${remainder} more` : "");
}

/**
 * docs/outrun/08 "FEEDBACK LOOP" / "RECOMMENDATION HISTORY" — "Future
 * recommendations should avoid repeatedly suggesting actions that
 * consistently perform poorly." Built entirely from two real, already-
 * persisted sources — Task.status/completionNotes (roadmap-derived
 * recommendations) and RecommendationFeedback (Opportunity Feed items
 * rated Not Helpful or Dismissed) — never a fabricated "what worked"
 * narrative. Returns null when there's nothing to report yet (e.g. the
 * organization's first-ever Blueprint), which callers should render
 * honestly rather than inventing a placeholder.
 */
export async function getPriorRecommendationOutcomes(organizationId: string): Promise<string | null> {
  const [tasks, feedback, opportunities] = await Promise.all([
    prisma.task.findMany({
      where: { organizationId, sourceBlueprintVersion: { not: null } },
      select: { title: true, status: true, completionNotes: true },
    }),
    prisma.recommendationFeedback.findMany({
      where: { organizationId, rating: { in: ["NOT_HELPFUL", "DISMISSED"] } },
      select: { itemTitle: true, rating: true },
    }),
    prisma.opportunity.findMany({
      where: { organizationId, status: { in: ["LAUNCHED", "DISMISSED"] } },
      select: { title: true, status: true },
    }),
  ]);

  if (tasks.length === 0 && feedback.length === 0 && opportunities.length === 0) return null;

  const lines: string[] = [];

  if (tasks.length > 0) {
    const completed = tasks.filter((t) => t.status === "COMPLETED");
    const dismissed = tasks.filter((t) => t.status === "DISMISSED");
    const pending = tasks.filter((t) => t.status === "PENDING");

    lines.push(
      `Of ${tasks.length} recommendation${tasks.length === 1 ? "" : "s"} turned into tasks from previous Blueprints: ${completed.length} completed, ${dismissed.length} dismissed, ${pending.length} still pending.`,
    );
    if (completed.length > 0) {
      const withNotes = completed.filter((t) => t.completionNotes?.trim());
      lines.push(
        `Completed: ${listTitles(completed.map((t) => t.title))}.` +
          (withNotes.length > 0
            ? ` Notes from what was done: ${withNotes
                .slice(0, 3)
                .map((t) => `"${t.completionNotes}"`)
                .join("; ")}.`
            : ""),
      );
    }
    if (dismissed.length > 0) {
      lines.push(
        `Dismissed without acting on them (avoid repeating these): ${listTitles(dismissed.map((t) => t.title))}.`,
      );
    }
  }

  if (feedback.length > 0) {
    const notHelpful = feedback.filter((f) => f.rating === "NOT_HELPFUL");
    const dismissedItems = feedback.filter((f) => f.rating === "DISMISSED");
    if (notHelpful.length > 0) {
      lines.push(`Rated Not Helpful in the Opportunity Feed: ${listTitles(notHelpful.map((f) => f.itemTitle))}.`);
    }
    if (dismissedItems.length > 0) {
      lines.push(`Dismissed from the Opportunity Feed: ${listTitles(dismissedItems.map((f) => f.itemTitle))}.`);
    }
  }

  if (opportunities.length > 0) {
    const launched = opportunities.filter((o) => o.status === "LAUNCHED");
    const dismissed = opportunities.filter((o) => o.status === "DISMISSED");
    if (launched.length > 0) {
      lines.push(`Acted on from the Opportunity Engine: ${listTitles(launched.map((o) => o.title))}.`);
    }
    if (dismissed.length > 0) {
      lines.push(
        `Dismissed from the Opportunity Engine (avoid repeating these): ${listTitles(dismissed.map((o) => o.title))}.`,
      );
    }
  }

  return lines.join(" ");
}
