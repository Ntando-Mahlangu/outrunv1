import { describe, it, expect } from "vitest";
import { getTodaysMission, getMissionActionHref } from "./mission";
import type { GrowthBlueprint } from "@prisma/client";
import type { GrowthBlueprintData } from "@/lib/growth-blueprint/schema";

function blueprint(overrides: {
  roadmap?: GrowthBlueprintData["roadmap"];
  opportunities?: GrowthBlueprintData["opportunities"];
}): GrowthBlueprint {
  return {
    roadmap: overrides.roadmap ?? [],
    opportunities: overrides.opportunities ?? [],
  } as unknown as GrowthBlueprint;
}

describe("getTodaysMission", () => {
  it("prefers a roadmap item explicitly scheduled for today", () => {
    const mission = getTodaysMission(
      blueprint({
        roadmap: [
          { horizon: "Today", action: "Launch outbound campaign", reason: "Test the channel.", estimatedTime: "20 minutes", expectedImpact: "High" },
          { horizon: "This Week", action: "Add booking widget", reason: "Reduce friction.", estimatedTime: "3 hours", expectedImpact: "Medium" },
        ],
      }),
    );
    expect(mission?.action).toBe("Launch outbound campaign");
    expect(mission?.source).toBe("roadmap");
  });

  it("falls back to the highest-priority, highest-confidence opportunity when nothing is scheduled today", () => {
    const mission = getTodaysMission(
      blueprint({
        roadmap: [
          { horizon: "This Week", action: "Add booking widget", reason: "Reduce friction.", estimatedTime: "3 hours", expectedImpact: "Medium" },
        ],
        opportunities: [
          { title: "Low priority", description: "x", priority: "Low", estimatedImpact: "Low", estimatedEffort: "Low", confidence: 90, supportingEvidence: "x", recommendedAction: "Skip this" },
          { title: "High priority", description: "x", priority: "High", estimatedImpact: "High", estimatedEffort: "Low", confidence: 60, supportingEvidence: "x", recommendedAction: "Launch a campaign" },
        ],
      }),
    );
    expect(mission?.action).toBe("Launch a campaign");
    expect(mission?.source).toBe("opportunity");
  });

  it("returns null when there is nothing to recommend", () => {
    expect(getTodaysMission(blueprint({}))).toBeNull();
  });
});

describe("getMissionActionHref", () => {
  it("prefers the structured actionArea over any keyword match in the text", () => {
    const href = getMissionActionHref({
      action: "Review your pricing", // would keyword-match nothing / fall through to /blueprint
      reason: "x",
      estimatedTime: null,
      expectedImpact: "Medium",
      confidence: null,
      source: "roadmap",
      actionArea: "prospects",
    });
    expect(href).toBe("/prospects");
  });

  it("falls back to a keyword match on older missions with no actionArea", () => {
    const href = getMissionActionHref({
      action: "Launch your Manufacturing Campaign",
      reason: "x",
      estimatedTime: null,
      expectedImpact: "High",
      confidence: null,
      source: "roadmap",
      actionArea: undefined,
    });
    expect(href).toBe("/campaigns");
  });

  it("keyword fallback: routes SEO/website missions to /seo", () => {
    const href = getMissionActionHref({
      action: "Improve your website's SEO",
      reason: "x",
      estimatedTime: null,
      expectedImpact: "Medium",
      confidence: null,
      source: "roadmap",
      actionArea: undefined,
    });
    expect(href).toBe("/seo");
  });

  it("keyword fallback: routes to /blueprint for anything unrecognized", () => {
    const href = getMissionActionHref({
      action: "Review your pricing",
      reason: "x",
      estimatedTime: null,
      expectedImpact: "Medium",
      confidence: null,
      source: "roadmap",
      actionArea: undefined,
    });
    expect(href).toBe("/blueprint");
  });
});
