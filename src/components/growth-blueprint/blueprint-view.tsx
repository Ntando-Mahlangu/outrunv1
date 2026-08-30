import { Card } from "@/components/ui/card";
import { ImpactBadge, Badge } from "@/components/ui/badge";
import { ScoreGauge } from "@/components/growth-blueprint/score-gauge";
import type { BusinessSnapshot, GrowthBlueprintData, WebsiteAnalysis } from "@/lib/growth-blueprint/schema";

type BlueprintFields = {
  version: number;
  growthScore: number;
  executiveSummary: string;
  confidenceNotes: string;
  businessSnapshot: BusinessSnapshot;
  strengths: GrowthBlueprintData["strengths"];
  weaknesses: GrowthBlueprintData["weaknesses"];
  biggestBottleneck: GrowthBlueprintData["biggestBottleneck"];
  opportunities: GrowthBlueprintData["opportunities"];
  growthStrategy: GrowthBlueprintData["growthStrategy"];
  idealCustomerProfile: GrowthBlueprintData["idealCustomerProfile"];
  roadmap: GrowthBlueprintData["roadmap"];
  websiteAnalysis: WebsiteAnalysis | null;
  scoreCategories: GrowthBlueprintData["scoreCategories"];
};

const HORIZONS: GrowthBlueprintData["roadmap"][number]["horizon"][] = [
  "Today",
  "This Week",
  "This Month",
  "This Quarter",
];

/**
 * The full read-only presentation of one Blueprint version — shared by
 * the owner's /blueprint page, the public share page, and the version
 * history detail view, so all three render identically from the same
 * data shape (docs/outrun/05).
 */
export function BlueprintView({
  organizationName,
  blueprint,
}: {
  organizationName: string;
  blueprint: BlueprintFields;
}) {
  const {
    businessSnapshot: snapshot,
    strengths,
    weaknesses,
    biggestBottleneck: bottleneck,
    opportunities,
    growthStrategy,
    idealCustomerProfile: icp,
    roadmap,
    websiteAnalysis,
    scoreCategories,
  } = blueprint;

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <div className="animate-fade-in text-center">
        <h1 className="text-3xl font-light tracking-tight text-[var(--color-text-primary)]">
          Growth Blueprint
        </h1>
        <p className="mt-2 text-sm text-[var(--color-text-muted)]">
          {organizationName} · Version {blueprint.version}
        </p>
      </div>

      <Card interactive className="animate-fade-in flex flex-col items-center gap-6 sm:flex-row sm:items-start">
        <ScoreGauge score={blueprint.growthScore} label="Growth Score" />
        <div className="flex-1 space-y-2">
          <h2 className="text-lg font-medium text-[var(--color-text-primary)]">
            Business Summary
          </h2>
          <p className="text-sm leading-relaxed text-[var(--color-text-secondary)]">
            {blueprint.executiveSummary}
          </p>
        </div>
      </Card>

      <Card interactive className="animate-fade-in">
        <h2 className="mb-4 text-lg font-medium text-[var(--color-text-primary)]">
          Business Snapshot
        </h2>
        <div className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <p>
            <span className="text-[var(--color-text-muted)]">Industry: </span>
            <span className="text-[var(--color-text-primary)]">{snapshot.industry}</span>
          </p>
          <p>
            <span className="text-[var(--color-text-muted)]">Target market: </span>
            <span className="text-[var(--color-text-primary)]">{snapshot.targetMarket}</span>
          </p>
          <p>
            <span className="text-[var(--color-text-muted)]">Ideal customer: </span>
            <span className="text-[var(--color-text-primary)]">{snapshot.idealCustomer}</span>
          </p>
          <p>
            <span className="text-[var(--color-text-muted)]">Business model: </span>
            <span className="text-[var(--color-text-primary)]">{snapshot.businessModel}</span>
          </p>
          <p>
            <span className="text-[var(--color-text-muted)]">Primary goal: </span>
            <span className="text-[var(--color-text-primary)]">{snapshot.primaryGoal}</span>
          </p>
          <p>
            <span className="text-[var(--color-text-muted)]">Primary acquisition channel: </span>
            <span className="text-[var(--color-text-primary)]">
              {snapshot.primaryAcquisitionChannel}
            </span>
          </p>
          <p>
            <span className="text-[var(--color-text-muted)]">Growth stage: </span>
            <span className="text-[var(--color-text-primary)]">{snapshot.growthStage}</span>
          </p>
          <p>
            <span className="text-[var(--color-text-muted)]">Estimated customer value: </span>
            <span className="text-[var(--color-text-primary)]">
              {snapshot.estimatedCustomerValue != null
                ? `$${snapshot.estimatedCustomerValue.toLocaleString()}`
                : "Not known"}
            </span>
          </p>
          <p>
            <span className="text-[var(--color-text-muted)]">Website status: </span>
            <span className="text-[var(--color-text-primary)]">{snapshot.websiteStatus}</span>
          </p>
          <p>
            <span className="text-[var(--color-text-muted)]">Campaign status: </span>
            <span className="text-[var(--color-text-primary)]">{snapshot.campaignStatus}</span>
          </p>
        </div>
      </Card>

      <div className="grid gap-6 sm:grid-cols-2">
        <Card interactive className="animate-fade-in">
          <h2 className="mb-4 text-lg font-medium text-[var(--color-text-primary)]">
            Strengths
          </h2>
          <ul className="space-y-4">
            {strengths.map((s) => (
              <li key={s.title}>
                <p className="font-medium text-[var(--color-text-primary)]">{s.title}</p>
                <p className="text-sm text-[var(--color-text-secondary)]">{s.reason}</p>
              </li>
            ))}
          </ul>
        </Card>

        <Card interactive className="animate-fade-in">
          <h2 className="mb-4 text-lg font-medium text-[var(--color-text-primary)]">
            Weaknesses
          </h2>
          <ul className="space-y-4">
            {weaknesses.map((w) => (
              <li key={w.title}>
                <div className="flex items-center justify-between gap-2">
                  <p className="font-medium text-[var(--color-text-primary)]">{w.title}</p>
                  <ImpactBadge level={w.estimatedImpact} />
                </div>
                <p className="text-sm text-[var(--color-text-secondary)]">{w.whyItMatters}</p>
                <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                  Fix: {w.suggestedImprovement}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card interactive className="animate-fade-in border-[var(--color-accent)]/40">
        <p className="text-xs uppercase tracking-wide text-[var(--color-accent-text)]">
          Biggest Opportunity
        </p>
        <h2 className="mt-2 text-xl font-light text-[var(--color-text-primary)]">
          {bottleneck.title}
        </h2>
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
          {bottleneck.description}
        </p>
        <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
          <span className="font-medium text-[var(--color-text-primary)]">Why it matters: </span>
          {bottleneck.whyItIsLimitingGrowth}
        </p>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          <span className="font-medium text-[var(--color-text-primary)]">
            Fixing it changes the business by:{" "}
          </span>
          {bottleneck.howFixingItChangesTheBusiness}
        </p>
      </Card>

      <Card interactive className="animate-fade-in">
        <h2 className="mb-4 text-lg font-medium text-[var(--color-text-primary)]">
          Highest ROI Opportunities
        </h2>
        <ul className="space-y-5">
          {opportunities.map((o) => (
            <li
              key={o.title}
              className="border-b border-[var(--color-border)] pb-5 last:border-0 last:pb-0"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-[var(--color-text-primary)]">{o.title}</p>
                <div className="flex gap-2">
                  <ImpactBadge level={o.estimatedImpact} />
                  <Badge tone="accent">{o.confidence}% confidence</Badge>
                </div>
              </div>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{o.description}</p>
              <p className="mt-2 text-sm text-[var(--color-text-muted)]">
                Evidence: {o.supportingEvidence}
              </p>
              <p className="mt-1 text-sm font-medium text-[var(--color-accent-text)]">
                Next step: {o.recommendedAction}
              </p>
            </li>
          ))}
        </ul>
      </Card>

      <Card interactive className="animate-fade-in">
        <h2 className="mb-4 text-lg font-medium text-[var(--color-text-primary)]">
          Recommended Growth Strategy
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {growthStrategy.map((strategy) => (
            <div
              key={strategy.channel}
              className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4"
            >
              <div className="flex items-center justify-between">
                <p className="font-medium text-[var(--color-text-primary)]">{strategy.channel}</p>
                <ImpactBadge level={strategy.impact} label={strategy.impact} />
              </div>
              <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
                {strategy.whyItFits}
              </p>
            </div>
          ))}
        </div>
      </Card>

      <Card interactive className="animate-fade-in">
        <h2 className="mb-4 text-lg font-medium text-[var(--color-text-primary)]">
          Ideal Customer Profile
        </h2>
        <div className="grid gap-4 text-sm sm:grid-cols-2">
          <p>
            <span className="text-[var(--color-text-muted)]">Industry: </span>
            <span className="text-[var(--color-text-primary)]">{icp.industry}</span>
          </p>
          <p>
            <span className="text-[var(--color-text-muted)]">Company size: </span>
            <span className="text-[var(--color-text-primary)]">{icp.companySize}</span>
          </p>
          <p>
            <span className="text-[var(--color-text-muted)]">Decision maker: </span>
            <span className="text-[var(--color-text-primary)]">{icp.decisionMaker}</span>
          </p>
          <p>
            <span className="text-[var(--color-text-muted)]">Location: </span>
            <span className="text-[var(--color-text-primary)]">{icp.location}</span>
          </p>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
              Pain points
            </p>
            <ul className="mt-1 space-y-1.5">
              {icp.painPoints.map((p) => (
                <li key={p.text} className="flex items-start gap-2 text-sm">
                  <Badge tone={p.basis === "stated" ? "high" : "low"} className="mt-0.5 shrink-0">
                    {p.basis}
                  </Badge>
                  <span className="text-[var(--color-text-secondary)]">{p.text}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
              Likely goals
            </p>
            <ul className="mt-1 space-y-1.5">
              {icp.likelyGoals.map((g) => (
                <li key={g.text} className="flex items-start gap-2 text-sm">
                  <Badge tone={g.basis === "stated" ? "high" : "low"} className="mt-0.5 shrink-0">
                    {g.basis}
                  </Badge>
                  <span className="text-[var(--color-text-secondary)]">{g.text}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
              Buying triggers
            </p>
            <ul className="mt-1 space-y-1.5">
              {icp.buyingTriggers.map((t) => (
                <li key={t.text} className="flex items-start gap-2 text-sm">
                  <Badge tone={t.basis === "stated" ? "high" : "low"} className="mt-0.5 shrink-0">
                    {t.basis}
                  </Badge>
                  <span className="text-[var(--color-text-secondary)]">{t.text}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Card>

      <Card interactive className="animate-fade-in">
        <h2 className="mb-4 text-lg font-medium text-[var(--color-text-primary)]">
          Growth Roadmap
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {HORIZONS.map((horizon) => (
            <div key={horizon}>
              <p className="mb-2 text-xs uppercase tracking-wide text-[var(--color-accent-text)]">
                {horizon}
              </p>
              <ul className="space-y-3">
                {roadmap
                  .filter((item) => item.horizon === horizon)
                  .map((item) => (
                    <li
                      key={item.action}
                      className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-3"
                    >
                      <p className="text-sm font-medium text-[var(--color-text-primary)]">
                        {item.action}
                      </p>
                      <p className="mt-1 text-xs text-[var(--color-text-muted)]">{item.reason}</p>
                    </li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
      </Card>

      <Card interactive className="animate-fade-in">
        <h2 className="mb-4 text-lg font-medium text-[var(--color-text-primary)]">
          Score Breakdown
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {scoreCategories.map((c) => (
            <div key={c.category} className="flex items-start justify-between gap-4">
              <div>
                <p className="font-medium text-[var(--color-text-primary)]">{c.category}</p>
                <p className="text-sm text-[var(--color-text-secondary)]">{c.reason}</p>
              </div>
              <p className="shrink-0 text-2xl font-light text-[var(--color-text-primary)]">
                {c.score}
              </p>
            </div>
          ))}
        </div>
      </Card>

      {websiteAnalysis && (
        <Card interactive className="animate-fade-in">
          <h2 className="mb-4 text-lg font-medium text-[var(--color-text-primary)]">
            Website Analysis
          </h2>
          <div className="grid gap-4 text-sm sm:grid-cols-2">
            <p>
              <span className="font-medium text-[var(--color-text-primary)]">
                Headline clarity:{" "}
              </span>
              <span className="text-[var(--color-text-secondary)]">
                {websiteAnalysis.headlineClarity}
              </span>
            </p>
            <p>
              <span className="font-medium text-[var(--color-text-primary)]">
                Offer clarity:{" "}
              </span>
              <span className="text-[var(--color-text-secondary)]">
                {websiteAnalysis.offerClarity}
              </span>
            </p>
            <p>
              <span className="font-medium text-[var(--color-text-primary)]">
                Calls-to-action:{" "}
              </span>
              <span className="text-[var(--color-text-secondary)]">
                {websiteAnalysis.callsToAction}
              </span>
            </p>
            <p>
              <span className="font-medium text-[var(--color-text-primary)]">
                Trust signals:{" "}
              </span>
              <span className="text-[var(--color-text-secondary)]">
                {websiteAnalysis.trustSignals}
              </span>
            </p>
            <p className="sm:col-span-2">
              <span className="font-medium text-[var(--color-text-primary)]">Messaging: </span>
              <span className="text-[var(--color-text-secondary)]">
                {websiteAnalysis.messaging}
              </span>
            </p>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge tone={websiteAnalysis.hasContactInfo ? "high" : "low"}>
              {websiteAnalysis.hasContactInfo ? "Contact info found" : "No contact info found"}
            </Badge>
            <Badge tone={websiteAnalysis.hasTitle ? "high" : "low"}>
              {websiteAnalysis.hasTitle ? "Page title present" : "No page title"}
            </Badge>
            <Badge tone={websiteAnalysis.hasMetaDescription ? "high" : "low"}>
              {websiteAnalysis.hasMetaDescription ? "Meta description present" : "No meta description"}
            </Badge>
            <Badge tone="accent">{websiteAnalysis.wordCount} words</Badge>
            {websiteAnalysis.imagesMissingAlt > 0 && (
              <Badge tone="medium">{websiteAnalysis.imagesMissingAlt} images missing alt text</Badge>
            )}
          </div>
        </Card>
      )}

      <Card interactive className="animate-fade-in bg-[var(--color-bg-secondary)]">
        <p className="text-sm text-[var(--color-text-muted)]">
          <span className="font-medium text-[var(--color-text-secondary)]">
            AI confidence notes:{" "}
          </span>
          {blueprint.confidenceNotes}
        </p>
      </Card>
    </div>
  );
}
