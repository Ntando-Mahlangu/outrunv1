"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";
import type { ImprovementLoopResult } from "@/lib/campaigns/improvement-loop";

export function ImprovementLoopPanel({ initialResult }: { initialResult: ImprovementLoopResult }) {
  const [result, setResult] = useState(initialResult);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function saveToMemory() {
    setError(null);
    setIsSaving(true);
    try {
      const res = await fetch("/api/campaigns/insights/save", { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Something went wrong.");
      setResult(body);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Card interactive>
      <h2 className="text-lg font-medium text-[var(--color-text-primary)]">
        AI Improvement Loop
      </h2>
      <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
        Patterns found across every message you&apos;ve sent — computed directly from your real
        send and reply data, never estimated.
      </p>

      <div className="mt-4">
        <FormError message={error} />
      </div>

      {result.insufficientData ? (
        <p className="mt-3 text-sm text-[var(--color-text-muted)]">
          You&apos;ve sent {result.totalSent} message{result.totalSent === 1 ? "" : "s"} so far —
          send at least {result.minRequired} before patterns are reliable enough to surface.
        </p>
      ) : result.patterns.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--color-text-muted)]">
          No clear winning pattern yet across your {result.totalSent} sent messages — keep sending
          and marking replies, and check back.
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
                  Based on {pattern.sampleSize} sent messages.
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
