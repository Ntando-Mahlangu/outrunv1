"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";
import { Badge, ImpactBadge } from "@/components/ui/badge";
import type { WhatIfData } from "@/lib/growth-partner/whatif-schema";

const CONFIDENCE_TONE = {
  High: "high",
  Medium: "medium",
  Low: "low",
} as const;

const DIRECTION_LABEL = {
  Increase: "↑ Increase",
  Decrease: "↓ Decrease",
  Uncertain: "? Uncertain",
} as const;

export function WhatIfPanel() {
  const [question, setQuestion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<WhatIfData | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (!q) return;

    setError(null);
    setIsRunning(true);
    try {
      const res = await fetch("/api/growth-partner/whatif", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Something went wrong.");
      setResult(body.result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <Card>
      <h2 className="text-lg font-medium text-[var(--color-text-primary)]">What-If Simulator</h2>
      <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
        Ask a hypothetical about a decision you haven&apos;t made yet — e.g. &quot;What if I
        doubled my outreach volume?&quot; These are estimated scenarios with explicit
        assumptions, never predictions.
      </p>

      <form onSubmit={handleSubmit} className="mt-4 flex gap-3">
        <Input
          aria-label="What-if question"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="What if I hired another salesperson?"
          disabled={isRunning}
        />
        <Button type="submit" disabled={isRunning || !question.trim()}>
          {isRunning ? "Simulating…" : "Run Simulation"}
        </Button>
      </form>

      <div className="mt-4">
        <FormError message={error} />
      </div>

      {result && (
        <div className="mt-6 space-y-5 border-t border-[var(--color-border)] pt-5">
          <div className="flex items-start justify-between gap-4">
            <p className="text-sm font-medium text-[var(--color-text-primary)]">
              {result.scenario}
            </p>
            <Badge tone={CONFIDENCE_TONE[result.confidence]}>{result.confidence} confidence</Badge>
          </div>
          <p className="text-xs text-[var(--color-text-muted)]">{result.confidenceReason}</p>

          <div>
            <h3 className="mb-2 text-sm font-medium text-[var(--color-text-primary)]">
              Assumptions this relies on
            </h3>
            <ul className="list-inside list-disc space-y-1 text-sm text-[var(--color-text-secondary)]">
              {result.assumptions.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-medium text-[var(--color-text-primary)]">
              Estimated impact
            </h3>
            <div className="space-y-3">
              {result.estimatedImpacts.map((impact) => (
                <div key={impact.area} className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">
                      {impact.area} <span className="text-[var(--color-text-muted)]">— {DIRECTION_LABEL[impact.direction]}</span>
                    </p>
                    <p className="text-sm text-[var(--color-text-secondary)]">{impact.reasoning}</p>
                  </div>
                  <ImpactBadge level={impact.magnitude} />
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="mb-2 text-sm font-medium text-[var(--color-text-primary)]">Risks</h3>
            <ul className="list-inside list-disc space-y-1 text-sm text-[var(--color-text-secondary)]">
              {result.risks.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>

          <div className="rounded-[var(--radius-md)] bg-[var(--color-accent)]/10 p-4">
            <p className="text-xs uppercase tracking-wide text-[var(--color-accent-text)]">
              Recommended next step
            </p>
            <p className="mt-1 text-sm text-[var(--color-text-primary)]">
              {result.recommendedNextStep}
            </p>
          </div>
        </div>
      )}
    </Card>
  );
}
