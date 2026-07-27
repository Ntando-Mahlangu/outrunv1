"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { ImpactBadge, Badge } from "@/components/ui/badge";
import {
  sortOpportunities,
  type OpportunityFeedItem,
  type OpportunitySort,
} from "@/lib/growth-partner/opportunity-sort";

const SORT_OPTIONS: { value: OpportunitySort; label: string }[] = [
  { value: "roi", label: "Highest ROI" },
  { value: "fastest", label: "Fastest Win" },
  { value: "lowest-effort", label: "Lowest Effort" },
  { value: "confidence", label: "Highest Confidence" },
];

type Rating = "HELPFUL" | "NOT_HELPFUL" | "DISMISSED";

async function submitFeedback(itemId: string, itemTitle: string, rating: Rating) {
  await fetch("/api/opportunities/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ itemId, itemTitle, rating }),
  });
}

// docs/outrun/08 "FEEDBACK LOOP" — "Allow users to rate recommendations.
// Helpful / Not Helpful / Completed / Dismissed. Use feedback to refine
// future suggestions." Dismissing removes the item from this feed for
// good (enforced server-side too, in getOpportunityFeed); Helpful/Not
// Helpful just record a rating that future Blueprint regenerations read
// back (src/lib/memory/recommendation-outcomes.ts) — neither changes
// what's shown here.
export function OpportunityFeedPanel({ items: initialItems }: { items: OpportunityFeedItem[] }) {
  const [items, setItems] = useState(initialItems);
  const [sort, setSort] = useState<OpportunitySort>("roi");
  const [rated, setRated] = useState<Record<string, Rating>>({});
  const sorted = useMemo(() => sortOpportunities(items, sort), [items, sort]);

  function rate(item: OpportunityFeedItem, rating: Rating) {
    setRated((prev) => ({ ...prev, [item.id]: rating }));
    if (rating === "DISMISSED") {
      setItems((prev) => prev.filter((i) => i.id !== item.id));
    }
    void submitFeedback(item.id, item.title, rating);
  }

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-medium text-[var(--color-text-primary)]">Opportunity Feed</h2>
        <select
          aria-label="Sort opportunities by"
          value={sort}
          onChange={(e) => setSort(e.target.value as OpportunitySort)}
          className="h-9 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 text-sm text-[var(--color-text-primary)] outline-none focus:border-[var(--color-accent)]"
        >
          {SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              Sort by: {opt.label}
            </option>
          ))}
        </select>
      </div>

      {sorted.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--color-text-muted)]">
          Generate a Growth Blueprint or run an SEO analysis to populate your opportunity feed.
        </p>
      ) : (
        <ul className="mt-4 space-y-4">
          {sorted.map((item) => (
            <li
              key={item.id}
              className="border-b border-[var(--color-border)] pb-4 last:border-0 last:pb-0"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-[var(--color-text-primary)]">{item.title}</p>
                <div className="flex flex-wrap items-center gap-2">
                  {item.estimatedImpact && (
                    <ImpactBadge level={item.estimatedImpact} label={`${item.estimatedImpact} impact`} />
                  )}
                  {item.estimatedEffort && (
                    <Badge tone="accent">{item.estimatedEffort} effort</Badge>
                  )}
                  {item.confidence != null && <Badge tone="medium">{item.confidence}% confidence</Badge>}
                </div>
              </div>
              <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{item.description}</p>
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                {item.source} · {item.recommendedAction}
              </p>
              <div className="mt-2 flex items-center gap-3 text-xs">
                <button
                  type="button"
                  onClick={() => rate(item, "HELPFUL")}
                  className={
                    rated[item.id] === "HELPFUL"
                      ? "text-[var(--color-accent-text)]"
                      : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                  }
                >
                  Helpful
                </button>
                <button
                  type="button"
                  onClick={() => rate(item, "NOT_HELPFUL")}
                  className={
                    rated[item.id] === "NOT_HELPFUL"
                      ? "text-[var(--color-accent-text)]"
                      : "text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                  }
                >
                  Not Helpful
                </button>
                <button
                  type="button"
                  onClick={() => rate(item, "DISMISSED")}
                  className="text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)]"
                >
                  Dismiss
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
