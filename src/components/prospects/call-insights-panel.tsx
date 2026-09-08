"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";
import type { CallInsightsResult } from "@/lib/prospects/call-insights";

// docs/07 "AI IMPROVEMENT LOOP" extended to cold-calling: same pattern as
// ImprovementLoopPanel (src/components/campaigns/improvement-loop-panel.tsx)
// for outreach, but this page has no server-rendered parent to hand it
// initial data (prospects/page.tsx is entirely client-driven by search
// state), so this fetches its own data on mount instead of taking it as a
// prop.
export function CallInsightsPanel() {
  const [result, setResult] = useState<CallInsightsResult | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/prospects/insights")
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? "Something went wrong.");
        if (!cancelled) setResult(body);
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : "Something went wrong.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function saveToMemory() {
    setSaveError(null);
    setIsSaving(true);
    try {
      const res = await fetch("/api/prospects/insights/save", { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Something went wrong.");
      setResult(body);
      setSaved(true);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsSaving(false);
    }
  }

  if (loadError) {
    return (
      <Card interactive>
        <h2 className="text-lg font-medium text-[var(--color-text-primary)]">Calling Insights</h2>
        <div className="mt-3">
          <FormError message={loadError} />
        </div>
      </Card>
    );
  }

  if (!result) return null;

  return (
    <Card interactive>
      <h2 className="text-lg font-medium text-[var(--color-text-primary)]">Calling Insights</h2>
      <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
        Patterns found across every call you&apos;ve logged — computed directly from real outcomes,
        never estimated.
      </p>

      <div className="mt-4">
        <FormError message={saveError} />
      </div>

      {result.insufficientData ? (
        <p className="mt-3 text-sm text-[var(--color-text-muted)]">
          You&apos;ve logged {result.totalCalls} call{result.totalCalls === 1 ? "" : "s"} so far — log
          at least {result.minRequired} before patterns are reliable enough to surface.
        </p>
      ) : result.patterns.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--color-text-muted)]">
          No clear winning pattern yet across your {result.totalCalls} logged calls — keep calling
          and logging outcomes, and check back.
        </p>
      ) : (
        <>
          <ul className="mt-4 space-y-3">
            {result.patterns.map((pattern) => (
              <li
                key={pattern.dimension}
                className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-3"
              >
                <p className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
                  {pattern.dimension}
                </p>
                <p className="mt-1 text-sm text-[var(--color-text-primary)]">{pattern.insight}</p>
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                  Based on {pattern.sampleSize} logged calls.
                </p>
              </li>
            ))}
          </ul>
          <div className="mt-4">
            <Button size="sm" variant="secondary" onClick={saveToMemory} disabled={isSaving}>
              {isSaving ? "Saving…" : saved ? "Saved to AI Memory ✓" : "Save to AI Memory"}
            </Button>
          </div>
        </>
      )}
    </Card>
  );
}
