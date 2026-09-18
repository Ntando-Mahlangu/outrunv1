"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";

function toneForScore(score: number): "high" | "medium" | "low" {
  if (score >= 70) return "high";
  if (score >= 40) return "medium";
  return "low";
}

export function ScoreBadge({
  label,
  score,
  reason,
}: {
  label: string;
  score: number;
  reason?: string | null;
}) {
  const [open, setOpen] = useState(false);

  if (!reason) {
    return (
      <Badge tone={toneForScore(score)}>
        {label}: {score}
      </Badge>
    );
  }

  // The native `title` attribute still gives a hover tooltip on desktop,
  // but a tap on a touch device fires no hover state at all — the score's
  // "why" was otherwise unreachable on mobile. A button wrapper makes the
  // badge itself tappable/focusable, closing on blur so it never gets
  // stuck open after a tap elsewhere.
  return (
    <span className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setOpen(false)}
        title={reason}
        aria-expanded={open}
        className="cursor-help rounded-full"
      >
        <Badge tone={toneForScore(score)} className="underline decoration-dotted">
          {label}: {score}
        </Badge>
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute left-0 top-full z-10 mt-1.5 w-56 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-card)] p-2.5 text-left text-xs font-normal text-[var(--color-text-secondary)] shadow-lg"
        >
          {reason}
        </span>
      )}
    </span>
  );
}
