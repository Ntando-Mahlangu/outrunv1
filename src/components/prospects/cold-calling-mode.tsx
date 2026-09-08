"use client";

import { useEffect, useState } from "react";
import type { Company } from "@prisma/client";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScoreBadge } from "@/components/prospects/score-badge";
import { cn } from "@/lib/cn";

// docs/outrun/06/07 — a rapid-fire, one-at-a-time triage view for working
// through a call list, instead of switching between the results grid and
// each company's own page. Every outcome here writes to the same real
// records a manual call log or Save would (POST /api/prospects/[id]/calls,
// POST /api/prospects/[id]/save) — this is a faster front end onto existing
// data, not a separate/parallel tracking system.
type Outcome = "MEETING_BOOKED" | "LEAD_CAPTURED" | "IGNORED" | "SAVE_FOR_LATER";

const OUTCOME_CONFIG: Record<
  Outcome,
  { label: string; className: string }
> = {
  MEETING_BOOKED: {
    label: "Meeting Booked",
    className:
      "border-[var(--color-success)]/40 bg-[var(--color-success)]/10 text-[var(--color-success)] hover:bg-[var(--color-success)]/20",
  },
  LEAD_CAPTURED: {
    label: "Lead Captured",
    className:
      "border-[var(--color-accent)]/50 bg-[var(--color-accent)]/10 text-[var(--color-accent-text)] hover:bg-[var(--color-accent)]/20",
  },
  SAVE_FOR_LATER: {
    label: "Save for Later",
    className:
      "border-[var(--color-warning)]/40 bg-[var(--color-warning)]/10 text-[var(--color-warning)] hover:bg-[var(--color-warning)]/20",
  },
  IGNORED: {
    label: "Call Ignored",
    className:
      "border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-card)]",
  },
};

// A booked meeting or a captured lead are both a genuinely good call, just
// with different next steps — CALLBACK_REQUESTED/ANSWERED are the closest
// real CallOutcome values (docs/07 "COLD CALL SCRIPT"); the notes field
// carries the precise reality rather than stretching the enum to fit.
// This never touches Contact.relationshipStatus — that field is
// deliberately user-set only (see src/app/api/prospects/[id]/calls/route.ts).
const CALL_LOG_PAYLOAD: Partial<Record<Outcome, { outcome: string; notes: string }>> = {
  MEETING_BOOKED: { outcome: "CALLBACK_REQUESTED", notes: "Meeting booked" },
  LEAD_CAPTURED: { outcome: "ANSWERED", notes: "Lead captured" },
  IGNORED: { outcome: "NO_ANSWER", notes: "Call ignored" },
};

async function recordOutcome(company: Company, outcome: Outcome): Promise<void> {
  if (outcome === "SAVE_FOR_LATER") {
    // /api/prospects/[id]/save toggles isSaved — only call it if that
    // actually moves the company toward saved, so re-running this on an
    // already-saved company can't accidentally unsave it.
    if (company.isSaved) return;
    const res = await fetch(`/api/prospects/${company.id}/save`, { method: "POST" });
    if (!res.ok) throw new Error("Couldn't save this one for later.");
    return;
  }

  const payload = CALL_LOG_PAYLOAD[outcome];
  if (!payload) return;
  const res = await fetch(`/api/prospects/${company.id}/calls`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? "Couldn't log that call.");
  }
}

const SLIDE_VARIANTS = {
  enter: (direction: number) => ({ x: direction > 0 ? 60 : -60, opacity: 0, scale: 0.97 }),
  center: { x: 0, opacity: 1, scale: 1 },
  exit: (direction: number) => ({ x: direction > 0 ? -60 : 60, opacity: 0, scale: 0.97 }),
};

export function ColdCallingMode({
  companies,
  onClose,
}: {
  companies: Company[];
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<Record<Outcome, number>>({
    MEETING_BOOKED: 0,
    LEAD_CAPTURED: 0,
    IGNORED: 0,
    SAVE_FOR_LATER: 0,
  });
  const reduceMotion = useReducedMotion();

  const company = companies[index];
  const done = index >= companies.length;

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  function goTo(nextIndex: number, dir: number) {
    setDirection(dir);
    setError(null);
    setIndex(Math.max(0, nextIndex));
  }

  async function handleOutcome(outcome: Outcome) {
    if (!company || isSubmitting) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await recordOutcome(company, outcome);
      setStats((prev) => ({ ...prev, [outcome]: prev[outcome] + 1 }));
      goTo(index + 1, 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  }

  const totalActioned = stats.MEETING_BOOKED + stats.LEAD_CAPTURED + stats.IGNORED + stats.SAVE_FOR_LATER;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Cold calling mode"
      className="fixed inset-0 z-50 flex flex-col bg-[var(--color-bg-primary)]/97 backdrop-blur-sm"
    >
      <div className="flex items-center justify-between px-6 py-4">
        <span className="font-mono text-xs uppercase tracking-[0.15em] text-[var(--color-text-muted)]">
          {done ? "Session complete" : `${index + 1} of ${companies.length}`}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
        >
          Close ✕
        </button>
      </div>

      {!done && (
        <div className="h-1 w-full bg-[var(--color-border)]">
          <div
            className="h-full bg-[var(--color-accent)] transition-all duration-300"
            style={{ width: `${(index / companies.length) * 100}%` }}
          />
        </div>
      )}

      <div className="flex flex-1 items-center justify-center overflow-hidden px-4 py-6">
        {!company ? (
          <div className="w-full max-w-md text-center">
            <h2 className="text-2xl font-light text-[var(--color-text-primary)]">
              You called through {companies.length} lead{companies.length === 1 ? "" : "s"}.
            </h2>
            <div className="mt-6 grid grid-cols-2 gap-3 text-left">
              {(Object.keys(OUTCOME_CONFIG) as Outcome[]).map((outcome) => (
                <div
                  key={outcome}
                  className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-3"
                >
                  <p className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
                    {OUTCOME_CONFIG[outcome].label}
                  </p>
                  <p className="mt-1 text-xl font-light text-[var(--color-text-primary)]">
                    {stats[outcome]}
                  </p>
                </div>
              ))}
            </div>
            {totalActioned < companies.length && (
              <p className="mt-4 text-xs text-[var(--color-text-muted)]">
                {companies.length - totalActioned} skipped without an outcome.
              </p>
            )}
            <Button className="mt-8" onClick={onClose}>
              Done
            </Button>
          </div>
        ) : (
          <div className="flex w-full max-w-lg items-center gap-3">
            <button
              type="button"
              onClick={() => goTo(index - 1, -1)}
              disabled={index === 0}
              aria-label="Previous lead"
              className="shrink-0 rounded-full border border-[var(--color-border)] p-2 text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)] disabled:pointer-events-none disabled:opacity-30"
            >
              ←
            </button>

            <div className="relative min-w-0 flex-1">
              <AnimatePresence mode="wait" custom={direction}>
                <motion.div
                  key={company.id}
                  custom={direction}
                  variants={reduceMotion ? undefined : SLIDE_VARIANTS}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                >
                  <Card className="text-center">
                    <p className="text-xl font-medium text-[var(--color-text-primary)]">
                      {company.name}
                    </p>
                    <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
                      {company.category ?? "Uncategorized"}
                      {company.formattedAddress ? ` · ${company.formattedAddress}` : ""}
                    </p>

                    <div className="mt-4 flex flex-wrap justify-center gap-2">
                      <ScoreBadge label="Fit" score={company.fitScore ?? 0} reason={company.fitReason} />
                      <ScoreBadge
                        label="Confidence"
                        score={company.confidenceScore ?? 0}
                        reason={company.confidenceReason}
                      />
                    </div>

                    {company.rating != null && (
                      <p className="mt-2 text-xs text-[var(--color-text-muted)]">
                        {company.rating}★ · {company.reviewCount ?? 0} reviews
                      </p>
                    )}

                    <div className="mt-6 border-t border-[var(--color-border)] pt-6">
                      {company.phone ? (
                        <a
                          href={`tel:${company.phone}`}
                          className="text-2xl font-light text-[var(--color-accent-text)] hover:underline"
                        >
                          {company.phone}
                        </a>
                      ) : (
                        <p className="text-sm text-[var(--color-text-muted)]">
                          No phone number on file
                        </p>
                      )}
                    </div>
                  </Card>
                </motion.div>
              </AnimatePresence>
            </div>

            <button
              type="button"
              onClick={() => goTo(index + 1, 1)}
              aria-label="Skip to next lead"
              className="shrink-0 rounded-full border border-[var(--color-border)] p-2 text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]"
            >
              →
            </button>
          </div>
        )}
      </div>

      {!done && (
        <div className="pb-8">
          {error && (
            <p className="mb-3 text-center text-sm text-[var(--color-error-text)]">{error}</p>
          )}
          <div className="mx-auto flex max-w-lg flex-wrap justify-center gap-3 px-4">
            {(Object.keys(OUTCOME_CONFIG) as Outcome[]).map((outcome) => (
              <button
                key={outcome}
                type="button"
                disabled={isSubmitting}
                onClick={() => handleOutcome(outcome)}
                className={cn(
                  "rounded-[var(--radius-md)] border px-4 py-2.5 text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50",
                  OUTCOME_CONFIG[outcome].className,
                )}
              >
                {OUTCOME_CONFIG[outcome].label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
