"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";
import { SelectablePill } from "@/components/ui/selectable-pill";
import { Badge } from "@/components/ui/badge";
import { AudienceSourceTabs, type CompanyOption, type LeadListOption } from "./audience-source-tabs";
import { pollJob } from "@/lib/jobs/poll-job";
import type { BrandVoice } from "@/lib/org/brand-voice";

const OBJECTIVES = [
  "Book meetings",
  "Generate leads",
  "Promote a service",
  "Request referrals",
  "Reconnect with past prospects",
  "Launch a new offer",
  "Free consultation",
  "Other",
];

type StrategyPreview = {
  rationale: string;
  confidence: "Low" | "Medium" | "High";
  recommendedChannel: "Cold Email" | "LinkedIn";
  expectedStrengths: string[];
  potentialWeaknesses: string[];
};

type SmartWarning = { id: string; title: string; detail: string; suggestion: string };

const STEPS = ["Goal", "Audience", "Strategy Review", "Launch"] as const;
type Step = (typeof STEPS)[number];

const CONFIDENCE_TONE = { Low: "low", Medium: "medium", High: "high" } as const;

export function NewCampaignForm({
  companies,
  leadLists,
  brandVoice,
  initialValues,
}: {
  companies: CompanyOption[];
  leadLists: LeadListOption[];
  brandVoice: BrandVoice | null;
  initialValues?: { name: string; objective: string; abTest: boolean };
}) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("Goal");

  const [name, setName] = useState(initialValues?.name ?? "");
  const isKnownObjective = initialValues && OBJECTIVES.includes(initialValues.objective);
  const [objective, setObjective] = useState(
    initialValues ? (isKnownObjective ? initialValues.objective : "Other") : "",
  );
  const [objectiveOther, setObjectiveOther] = useState(
    initialValues && !isKnownObjective ? initialValues.objective : "",
  );

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [audienceSource, setAudienceSource] = useState("AI Recommended Prospects");

  const [strategy, setStrategy] = useState<StrategyPreview | null>(null);
  const [audienceWarnings, setAudienceWarnings] = useState<SmartWarning[]>([]);
  const [isLoadingStrategy, setIsLoadingStrategy] = useState(false);
  const [strategyError, setStrategyError] = useState<string | null>(null);

  const [abTest, setAbTest] = useState(initialValues?.abTest ?? false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const finalObjective = objective === "Other" ? objectiveOther : objective;
  const selectedCompanies = companies.filter((c) => selected.has(c.id));

  const canLeaveGoal =
    name.trim().length > 0 && Boolean(objective && (objective !== "Other" || objectiveOther.trim()));
  const canLeaveAudience = selected.size > 0;

  async function fetchStrategy() {
    setIsLoadingStrategy(true);
    setStrategyError(null);
    try {
      const res = await fetch("/api/campaigns/strategy-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ objective: finalObjective, companyIds: Array.from(selected) }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Something went wrong.");
      setStrategy(body.strategy);
      setAudienceWarnings(body.warnings);
    } catch (err) {
      setStrategyError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsLoadingStrategy(false);
    }
  }

  function goToStrategy() {
    setStep("Strategy Review");
    void fetchStrategy();
  }

  async function handleSubmit() {
    setError(null);
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          objective: finalObjective,
          companyIds: Array.from(selected),
          abTest,
          strategy,
          audienceSource,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Something went wrong.");

      const job = await pollJob(body.jobId, { timeoutMs: 300_000 });
      if (job.status === "FAILED") {
        throw new Error(job.errorMessage ?? "Something went wrong.");
      }
      router.push(`/campaigns/${job.resultId}`);
    } catch (err) {
      setIsSubmitting(false);
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  if (isSubmitting) {
    return (
      <Card interactive className="text-center">
        <div className="mx-auto mb-4 size-8 animate-pulse rounded-full bg-[var(--color-accent)]" />
        <p className="text-[var(--color-text-primary)]">
          Writing outreach for {selected.size} prospect{selected.size === 1 ? "" : "s"}…
        </p>
        <p className="mt-2 text-sm text-[var(--color-text-muted)]">This can take a minute.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
        {STEPS.map((s, i) => (
          <span key={s} className="flex items-center gap-2">
            <span
              className={
                s === step
                  ? "font-medium text-[var(--color-text-primary)]"
                  : STEPS.indexOf(step) > i
                    ? "text-[var(--color-accent-text)]"
                    : ""
              }
            >
              {i + 1}. {s}
            </span>
            {i < STEPS.length - 1 && <span>→</span>}
          </span>
        ))}
      </div>

      {initialValues && step === "Goal" && (
        <p className="text-sm text-[var(--color-accent-text)]">
          Prefilled from your saved template — choose a fresh audience below.
        </p>
      )}

      {step === "Goal" && (
        <>
          <Card>
            <Label htmlFor="name">Campaign name</Label>
            <Input
              id="name"
              className="mt-2"
              placeholder="e.g. Q3 Accounting Firms Outreach"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Card>

          <Card>
            <Label>Objective</Label>
            <div className="mt-3 flex flex-wrap gap-3">
              {OBJECTIVES.map((o) => (
                <SelectablePill
                  key={o}
                  label={o}
                  selected={objective === o}
                  onClick={() => setObjective(o)}
                />
              ))}
            </div>
            {objective === "Other" && (
              <Input
                className="mt-3"
                placeholder="Describe your objective…"
                value={objectiveOther}
                onChange={(e) => setObjectiveOther(e.target.value)}
              />
            )}
          </Card>

          <Button type="button" disabled={!canLeaveGoal} onClick={() => setStep("Audience")}>
            Continue to Audience
          </Button>
        </>
      )}

      {step === "Audience" && (
        <>
          <Card>
            <div className="flex items-center justify-between">
              <Label>Select Audience</Label>
              <span className="text-xs text-[var(--color-text-muted)]">
                {selected.size} selected — estimated audience size
              </span>
            </div>
            <div className="mt-3">
              <AudienceSourceTabs
                companies={companies}
                leadLists={leadLists}
                selected={selected}
                onChange={setSelected}
                onSourceLabelChange={setAudienceSource}
              />
            </div>
          </Card>

          <div className="flex items-center justify-between">
            <Button type="button" variant="ghost" onClick={() => setStep("Goal")}>
              Back
            </Button>
            <Button type="button" disabled={!canLeaveAudience} onClick={goToStrategy}>
              Review AI Strategy
            </Button>
          </div>
        </>
      )}

      {step === "Strategy Review" && (
        <>
          <Card interactive>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium text-[var(--color-text-primary)]">
                AI Campaign Strategy
              </h2>
              {strategy && (
                <Badge tone={CONFIDENCE_TONE[strategy.confidence]}>
                  {strategy.confidence} confidence
                </Badge>
              )}
            </div>

            {isLoadingStrategy && (
              <p className="mt-3 text-sm text-[var(--color-text-muted)]">
                Analyzing your audience and objective…
              </p>
            )}
            <FormError message={strategyError} />

            {strategy && (
              <div className="mt-3 space-y-4">
                <p className="text-sm text-[var(--color-text-secondary)]">{strategy.rationale}</p>
                <p className="text-sm text-[var(--color-text-primary)]">
                  <span className="text-[var(--color-text-muted)]">Recommended channel: </span>
                  {strategy.recommendedChannel}
                </p>
                <div>
                  <p className="text-xs font-medium text-[var(--color-text-muted)]">
                    Expected strengths
                  </p>
                  <ul className="mt-1 list-inside list-disc text-sm text-[var(--color-text-secondary)]">
                    {strategy.expectedStrengths.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-medium text-[var(--color-text-muted)]">
                    Potential weaknesses
                  </p>
                  <ul className="mt-1 list-inside list-disc text-sm text-[var(--color-text-secondary)]">
                    {strategy.potentialWeaknesses.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </Card>

          {audienceWarnings.length > 0 && (
            <Card interactive>
              <h2 className="text-lg font-medium text-[var(--color-text-primary)]">Smart Warnings</h2>
              <div className="mt-3 space-y-3">
                {audienceWarnings.map((w) => (
                  <div key={w.id}>
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">{w.title}</p>
                    <p className="text-sm text-[var(--color-text-secondary)]">{w.detail}</p>
                    <p className="text-xs text-[var(--color-accent-text)]">{w.suggestion}</p>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <div className="flex items-center justify-between">
            <Button type="button" variant="ghost" onClick={() => setStep("Audience")}>
              Back
            </Button>
            <div className="flex gap-3">
              <Button type="button" variant="secondary" onClick={fetchStrategy} disabled={isLoadingStrategy}>
                Regenerate
              </Button>
              <Button
                type="button"
                disabled={!strategy || isLoadingStrategy}
                onClick={() => setStep("Launch")}
              >
                Continue
              </Button>
            </div>
          </div>
        </>
      )}

      {step === "Launch" && (
        <>
          <Card interactive>
            <h2 className="text-lg font-medium text-[var(--color-text-primary)]">Campaign Preview</h2>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-[var(--color-text-muted)]">Audience</dt>
                <dd className="text-[var(--color-text-primary)]">{audienceSource}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[var(--color-text-muted)]">Estimated size</dt>
                <dd className="text-[var(--color-text-primary)]">{selectedCompanies.length}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[var(--color-text-muted)]">Goal</dt>
                <dd className="text-[var(--color-text-primary)]">{finalObjective}</dd>
              </div>
              {strategy && (
                <div className="flex justify-between">
                  <dt className="text-[var(--color-text-muted)]">Channel</dt>
                  <dd className="text-[var(--color-text-primary)]">{strategy.recommendedChannel}</dd>
                </div>
              )}
            </dl>
          </Card>

          <Card interactive>
            <p className="text-sm font-medium text-[var(--color-text-primary)]">Brand voice</p>
            <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
              {brandVoice
                ? `Using your "${brandVoice}" brand voice.`
                : "No brand voice set — outreach will default to a professional and direct tone."}{" "}
              <a href="/settings/brand-voice" className="text-[var(--color-accent-text)] hover:underline">
                Change in Settings
              </a>
            </p>
          </Card>

          <Card>
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={abTest}
                onChange={(e) => setAbTest(e.target.checked)}
                className="mt-1 size-4 accent-[var(--color-accent)]"
              />
              <div>
                <p className="text-sm font-medium text-[var(--color-text-primary)]">
                  Test two message angles (A/B)
                </p>
                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                  Splits the audience roughly in half between a pain-point-first opening and an
                  opportunity-first opening, so you can compare which lands better. There&apos;s no
                  inbox integration yet, so replies are tracked by marking them yourself on the
                  campaign page — not automatically detected.
                </p>
              </div>
            </label>
          </Card>

          <FormError message={error} />

          <div className="flex items-center justify-between">
            <Button type="button" variant="ghost" onClick={() => setStep("Strategy Review")}>
              Back
            </Button>
            <Button type="button" onClick={handleSubmit} disabled={isSubmitting}>
              Build Campaign
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
