"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Opportunity, OpportunityStatus } from "@prisma/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { OpportunityCard } from "./opportunity-card";

const HISTORY_LABEL: Record<Exclude<OpportunityStatus, "DETECTED">, { label: string; tone: "high" | "low" }> = {
  LAUNCHED: { label: "Launched", tone: "high" },
  DISMISSED: { label: "Dismissed", tone: "low" },
  EXPIRED: { label: "Resolved on its own", tone: "low" },
};

/** The Opportunity Engine's main surface — open opportunities to review,
 * an on-demand Rescan, and a collapsed history of what's already been
 * launched or dismissed (docs/outrun/10 "Track" step). */
export function OpportunityBoard({
  initialOpen,
  history,
}: {
  initialOpen: Opportunity[];
  history: Opportunity[];
}) {
  const router = useRouter();
  // Derived, not synced-via-effect: an id only ever needs to be excluded
  // locally until the next server refetch (a Rescan) already drops it
  // from initialOpen for real, at which point this set is just harmlessly
  // stale — never a second source of truth to keep in sync.
  const [resolvedIds, setResolvedIds] = useState<Set<string>>(new Set());
  const [isRescanning, setIsRescanning] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const open = initialOpen.filter((o) => !resolvedIds.has(o.id));

  function handleResolved(id: string) {
    setResolvedIds((prev) => new Set(prev).add(id));
  }

  async function rescan() {
    setIsRescanning(true);
    try {
      await fetch("/api/opportunities/detect", { method: "POST" });
      router.refresh();
    } finally {
      setIsRescanning(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--color-text-secondary)]">
          {open.length === 0
            ? "Nothing open right now — Outrun is still watching."
            : `${open.length} open opportunit${open.length === 1 ? "y" : "ies"}.`}
        </p>
        <Button variant="secondary" size="sm" onClick={rescan} disabled={isRescanning}>
          {isRescanning ? "Scanning…" : "Rescan"}
        </Button>
      </div>

      {open.length === 0 ? (
        <Card>
          <p className="text-sm text-[var(--color-text-secondary)]">
            No open opportunities detected yet. Outrun checks your leads, calls, and campaigns
            automatically — or hit Rescan to check right now.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {open.map((o) => (
            <OpportunityCard key={o.id} opportunity={o} onResolved={handleResolved} />
          ))}
        </div>
      )}

      {history.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setHistoryOpen((v) => !v)}
            className="text-sm text-[var(--color-accent-text)] hover:underline"
          >
            {historyOpen ? "Hide history" : `Show history (${history.length})`}
          </button>
          {historyOpen && (
            <ul className="mt-3 space-y-3">
              {history.map((o) => {
                const status = HISTORY_LABEL[o.status as Exclude<OpportunityStatus, "DETECTED">];
                return (
                  <li
                    key={o.id}
                    className="rounded-[var(--radius-md)] border border-[var(--color-border)] p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-medium text-[var(--color-text-primary)]">{o.title}</p>
                      <Badge tone={status.tone}>{status.label}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{o.summary}</p>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
