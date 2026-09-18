import { getBusinessContext } from "@/lib/memory/context";
import type { GrowthBlueprintData } from "@/lib/growth-blueprint/schema";

export type RiskUrgency = "Now" | "This Week" | "Monitor";

export type Signal = {
  severity: "High" | "Medium" | "Low";
  title: string;
  // What's true, and why it's a risk — an observed fact, never the fix.
  reason: string;
  // The concrete next step, separate from the fact above (Article IV/VIII
  // — never blur an observation and a recommendation into one field).
  recommendation: string;
  urgency: RiskUrgency;
};

const STALE_BLUEPRINT_DAYS = 30;

/**
 * Cheap, deterministic signals computed from data already on hand — no AI
 * call needed for "is anything obviously wrong". Kept separate from the
 * Growth Partner chat so it's instant and always available, even before
 * asking a question (docs/outrun/10 "RISK DETECTION").
 */
export async function getRisksAndOpportunities(organizationId: string): Promise<Signal[]> {
  const context = await getBusinessContext(organizationId);
  const signals: Signal[] = [];

  if (!context.blueprint) {
    signals.push({
      severity: "High",
      title: "No Growth Blueprint yet",
      reason: "There's no scored, evidence-based growth strategy guiding what to do next.",
      recommendation: "Generate your Growth Blueprint.",
      urgency: "Now",
    });
    return signals;
  }

  const daysSinceBlueprint = Math.floor(
    (Date.now() - context.blueprint.createdAt.getTime()) / (1000 * 60 * 60 * 24),
  );
  if (daysSinceBlueprint > STALE_BLUEPRINT_DAYS) {
    signals.push({
      severity: "Medium",
      title: "Growth Blueprint is out of date",
      reason: `Last generated ${daysSinceBlueprint} days ago — your business has likely changed since then.`,
      recommendation: "Regenerate your Growth Blueprint to get an up-to-date strategy.",
      urgency: "This Week",
    });
  }

  if (context.campaigns.length === 0) {
    signals.push({
      severity: "Medium",
      title: "No campaigns running",
      reason: "You have prospects researched but no campaign built around them yet.",
      recommendation: "Build a campaign from your researched prospects.",
      urgency: "This Week",
    });
  }

  if (context.businessProfile && context.businessProfile.acquisitionChannels.length === 1) {
    signals.push({
      severity: "Medium",
      title: "Single acquisition channel",
      reason: `You currently rely only on "${context.businessProfile.acquisitionChannels[0]}" — a single channel is a concentration risk.`,
      recommendation: "Test a second acquisition channel to reduce that dependency.",
      urgency: "Monitor",
    });
  }

  const scoreCategories = context.blueprint.scoreCategories as GrowthBlueprintData["scoreCategories"];
  for (const category of scoreCategories) {
    if (category.score < 40) {
      signals.push({
        severity: "Low",
        title: `${category.category} is scoring low (${category.score}/100)`,
        reason: category.reason,
        recommendation: category.recommendation,
        urgency: "Monitor",
      });
    }
  }

  return signals;
}
