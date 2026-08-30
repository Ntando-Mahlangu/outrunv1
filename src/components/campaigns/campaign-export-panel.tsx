"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";

export function CampaignExportPanel({
  campaignId,
  companiesWithoutScriptCount,
}: {
  campaignId: string;
  companiesWithoutScriptCount: number;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [summary, setSummary] = useState<{
    generatedCount: number;
    requestedCount: number;
    limitReached: boolean;
  } | null>(null);
  const [remaining, setRemaining] = useState(companiesWithoutScriptCount);

  async function generateCallScripts() {
    setError(null);
    setIsGenerating(true);
    setSummary(null);
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/call-scripts`, { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Something went wrong.");
      setSummary(body);
      setRemaining((prev) => Math.max(0, prev - body.generatedCount));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <Card interactive>
      <h2 className="text-lg font-medium text-[var(--color-text-primary)]">Exports</h2>
      <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
        Export this campaign&apos;s messages, performance, and call scripts.
      </p>

      <div className="mt-4">
        <FormError message={error} />
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-3">
        <a
          href={`/api/campaigns/${campaignId}/export?format=summary`}
          className="text-sm text-[var(--color-accent-text)] hover:underline"
        >
          Export Summary
        </a>
        <a
          href={`/api/campaigns/${campaignId}/export?format=call-scripts`}
          className="text-sm text-[var(--color-accent-text)] hover:underline"
        >
          Export Call Scripts
        </a>
      </div>

      {remaining > 0 && (
        <div className="mt-4 flex items-center gap-3">
          <Button size="sm" variant="secondary" onClick={generateCallScripts} disabled={isGenerating}>
            {isGenerating ? "Generating…" : `Generate Call Scripts (${remaining} left)`}
          </Button>
        </div>
      )}

      {summary && (
        <p className="mt-2 text-xs text-[var(--color-text-muted)]">
          Generated {summary.generatedCount} of {summary.requestedCount} call script
          {summary.requestedCount === 1 ? "" : "s"}.
          {summary.limitReached &&
            " Your plan's call-script allotment ran out — upgrade on the Billing page to generate the rest."}
        </p>
      )}
    </Card>
  );
}
