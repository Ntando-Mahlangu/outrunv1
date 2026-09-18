"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";
import { Badge, ImpactBadge } from "@/components/ui/badge";
import type { DecisionData } from "@/lib/growth-partner/decision-schema";

const CONFIDENCE_TONE = {
  High: "high",
  Medium: "medium",
  Low: "low",
} as const;

type HistoryEntry = { id: string; question: string; result: DecisionData; createdAt: string };

function DecisionResultView({ result }: { result: DecisionData }) {
  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm font-medium text-[var(--color-text-primary)]">{result.recommendation}</p>
        <Badge tone={CONFIDENCE_TONE[result.confidence]}>{result.confidence} confidence</Badge>
      </div>
      <p className="text-xs text-[var(--color-text-muted)]">{result.confidenceReason}</p>

      <div>
        <h3 className="mb-2 text-sm font-medium text-[var(--color-text-primary)]">Reason</h3>
        <p className="text-sm text-[var(--color-text-secondary)]">{result.reason}</p>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-medium text-[var(--color-text-primary)]">Supporting Evidence</h3>
        <p className="text-sm text-[var(--color-text-secondary)]">{result.supportingEvidence}</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <ImpactBadge level={result.estimatedBusinessImpact} label={`${result.estimatedBusinessImpact} business impact`} />
        <ImpactBadge level={result.estimatedEffort} label={`${result.estimatedEffort} effort`} />
      </div>

      <div>
        <h3 className="mb-2 text-sm font-medium text-[var(--color-text-primary)]">Potential Risks</h3>
        <ul className="list-inside list-disc space-y-1 text-sm text-[var(--color-text-secondary)]">
          {result.potentialRisks.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-medium text-[var(--color-text-primary)]">Alternative Options</h3>
        <div className="space-y-2">
          {result.alternativeOptions.map((alt) => (
            <div key={alt.option}>
              <p className="text-sm font-medium text-[var(--color-text-primary)]">{alt.option}</p>
              <p className="text-sm text-[var(--color-text-secondary)]">{alt.tradeoff}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-[var(--radius-md)] bg-[var(--color-accent)]/10 p-4">
        <p className="text-xs uppercase tracking-wide text-[var(--color-accent-text)]">Recommended next step</p>
        <p className="mt-1 text-sm text-[var(--color-text-primary)]">{result.recommendedNextStep}</p>
      </div>
    </div>
  );
}

export function DecisionPanel({ initialHistory }: { initialHistory: HistoryEntry[] }) {
  const [question, setQuestion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [history, setHistory] = useState(initialHistory);
  const [expandedId, setExpandedId] = useState<string | null>(initialHistory[0]?.id ?? null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (!q) return;

    setError(null);
    setIsRunning(true);
    try {
      const res = await fetch("/api/growth-partner/decision", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Something went wrong.");
      const entry: HistoryEntry = {
        id: crypto.randomUUID(),
        question: q,
        result: body.result,
        createdAt: new Date().toISOString(),
      };
      setHistory((prev) => [entry, ...prev]);
      setExpandedId(entry.id);
      setQuestion("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <Card>
      <h2 className="text-lg font-medium text-[var(--color-text-primary)]">Decision Engine</h2>
      <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
        Ask about a real decision — e.g. &quot;Should I increase my prices?&quot; or &quot;Should I
        hire someone?&quot; — and get a structured recommendation with the reasoning behind it,
        not just an answer.
      </p>

      <form onSubmit={handleSubmit} className="mt-4 flex gap-3">
        <Input
          aria-label="Decision question"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Should I target a different market?"
          disabled={isRunning}
        />
        <Button type="submit" disabled={isRunning || !question.trim()}>
          {isRunning ? "Thinking…" : "Get Recommendation"}
        </Button>
      </form>

      <div className="mt-4">
        <FormError message={error} />
      </div>

      {history.length > 0 && (
        <div className="mt-6 space-y-3 border-t border-[var(--color-border)] pt-5">
          {history.map((entry) => {
            const isOpen = expandedId === entry.id;
            return (
              <div
                key={entry.id}
                className="overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-border)]"
              >
                <button
                  type="button"
                  onClick={() => setExpandedId(isOpen ? null : entry.id)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[var(--color-text-primary)]">
                      {entry.question}
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      {new Date(entry.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <Badge tone={CONFIDENCE_TONE[entry.result.confidence]}>{entry.result.confidence}</Badge>
                </button>
                {isOpen && (
                  <div className="border-t border-[var(--color-border)] px-4 pb-5 pt-4">
                    <DecisionResultView result={entry.result} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
