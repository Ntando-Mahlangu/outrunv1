"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import { Reveal } from "@/components/motion/reveal";
import { ConcentricRings } from "@/components/motion/backgrounds";
import { SplitHeading } from "@/components/motion/split-heading";
import { CountUp } from "@/components/motion/count-up";

// docs/outrun/02 "WOW SECTION" — a fixed, clearly-labeled example scenario
// (the same input/output the spec itself specifies), not a live AI call:
// that keeps this section deterministic and free of API cost or prompt
// injection risk on a public marketing page, while the Constitution's
// anti-fabrication rule is upheld through the explicit "estimate based on
// assumptions" caveat and the "example" labeling below. The sequence walks
// through the actual steps Outrun performs (search → score → draft) rather
// than jumping straight to a finished summary, so it reads as watching the
// product work rather than looking at a still result.
const PROMPT = "We help accounting firms automate client onboarding.";
const TYPE_MS = 35;
const THINK_MS = 1200;
const REVEAL_INTERVAL_MS = 380;
const SEARCH_PAUSE_MS = 600;
const SCORE_PAUSE_MS = 1400;
const DRAFT_PAUSE_MS = 500;

const COMPANIES = [
  { name: "Sterling & Co. Accounting", fit: 91 },
  { name: "Meridian Bookkeeping", fit: 84 },
  { name: "Harborview CPA Group", fit: 77 },
];

const DRAFT_SUBJECT = "Quick question about client onboarding";
const DRAFT_BODY = "Hi {{firstName}}, noticed {{company}} still onboards clients by hand...";

type Phase = "typing" | "thinking" | "searching" | "scoring" | "drafting" | "result";

export function WowDemo() {
  const [typed, setTyped] = useState("");
  const [phase, setPhase] = useState<Phase>("typing");
  const [revealedCount, setRevealedCount] = useState(0);
  const [draftTyped, setDraftTyped] = useState("");

  useEffect(() => {
    if (phase !== "typing") return;
    if (typed.length >= PROMPT.length) {
      const t = setTimeout(() => setPhase("thinking"), 400);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setTyped(PROMPT.slice(0, typed.length + 1)), TYPE_MS);
    return () => clearTimeout(t);
  }, [typed, phase]);

  useEffect(() => {
    if (phase !== "thinking") return;
    const t = setTimeout(() => setPhase("searching"), THINK_MS);
    return () => clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    if (phase !== "searching") return;
    if (revealedCount >= COMPANIES.length) {
      const t = setTimeout(() => setPhase("scoring"), SEARCH_PAUSE_MS);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setRevealedCount((c) => c + 1), REVEAL_INTERVAL_MS);
    return () => clearTimeout(t);
  }, [phase, revealedCount]);

  useEffect(() => {
    if (phase !== "scoring") return;
    const t = setTimeout(() => setPhase("drafting"), SCORE_PAUSE_MS);
    return () => clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    if (phase !== "drafting") return;
    if (draftTyped.length >= DRAFT_BODY.length) {
      const t = setTimeout(() => setPhase("result"), DRAFT_PAUSE_MS);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setDraftTyped(DRAFT_BODY.slice(0, draftTyped.length + 1)), 18);
    return () => clearTimeout(t);
  }, [phase, draftTyped]);

  function replay() {
    setTyped("");
    setRevealedCount(0);
    setDraftTyped("");
    setPhase("typing");
  }

  const workingLabel =
    phase === "thinking"
      ? "Outrun is thinking…"
      : phase === "searching"
        ? "Searching for accounting firms…"
        : phase === "scoring"
          ? "Scoring fit against your business…"
          : phase === "drafting"
            ? "Drafting your first outreach message…"
            : null;

  return (
    <section id="wow-demo" className="relative overflow-hidden py-20">
      <ConcentricRings />
      <div className="relative z-10 mx-auto max-w-3xl px-6">
        <Reveal>
          <p className="text-center text-xs uppercase tracking-wide text-[var(--color-accent-text)]">
            Example
          </p>
        </Reveal>
        <SplitHeading
          text="Watch Outrun work."
          className="mt-2 text-center text-3xl font-light tracking-tight text-[var(--color-text-primary)]"
        />
        <Reveal delay={0.1}>
          <p className="mx-auto mt-4 max-w-lg text-center text-[var(--color-text-secondary)]">
            A real business owner describes what they do. Watch Outrun search,
            score, and draft the first move, live.
          </p>
        </Reveal>

        <Card
          className={cn(
            "mt-10 transition-shadow duration-700",
            phase === "result" && "shadow-[var(--shadow-glow)]",
          )}
        >
          <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4 py-3 font-mono text-sm text-[var(--color-text-primary)]">
            {typed}
            {phase === "typing" && <span className="animate-pulse">|</span>}
          </div>

          {workingLabel && (
            <p className="mt-6 text-center text-sm text-[var(--color-text-muted)]">
              {workingLabel}
            </p>
          )}

          {(phase === "searching" || phase === "scoring") && (
            <div className="mt-4 space-y-2">
              {COMPANIES.slice(0, phase === "searching" ? revealedCount : COMPANIES.length).map(
                (company, i) => (
                  <motion.div
                    key={company.name}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.35, delay: phase === "scoring" ? i * 0.15 : 0 }}
                    className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2 text-sm"
                  >
                    <span className="text-[var(--color-text-primary)]">{company.name}</span>
                    {phase === "scoring" && (
                      <motion.span
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.15 + 0.2, duration: 0.3 }}
                        className="text-[var(--color-success)]"
                      >
                        {company.fit}% fit
                      </motion.span>
                    )}
                  </motion.div>
                ),
              )}
            </div>
          )}

          {phase === "drafting" && (
            <div className="mt-4 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4 py-3">
              <p className="text-xs font-medium text-[var(--color-text-primary)]">
                {DRAFT_SUBJECT}
              </p>
              <p className="mt-1.5 min-h-[2.5rem] font-mono text-xs text-[var(--color-text-secondary)]">
                {draftTyped}
                <span className="animate-pulse">|</span>
              </p>
            </div>
          )}

          {phase === "result" && (
            <div className="mt-6 animate-fade-in space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
                    Growth Score
                  </p>
                  <p className="text-2xl font-light text-[var(--color-text-primary)]">
                    <CountUp value={74} />
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
                    Best Customer
                  </p>
                  <p className="text-lg text-[var(--color-text-primary)]">Accounting firms</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
                    Biggest Opportunity
                  </p>
                  <p className="text-lg text-[var(--color-text-primary)]">Cold outbound</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
                    Estimated Opportunity
                  </p>
                  <p className="text-lg text-[var(--color-text-primary)]">
                    <CountUp value={240} prefix="$" suffix="k ARR" />
                    <span className="ml-1 text-xs text-[var(--color-text-muted)]">
                      (estimate based on assumptions)
                    </span>
                  </p>
                </div>
              </div>

              <div className="border-t border-[var(--color-border)] pt-5">
                <p className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
                  Top Strategy
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {["Email", "LinkedIn", "Referrals"].map((channel) => (
                    <span
                      key={channel}
                      className="rounded-[var(--radius-md)] border border-[var(--color-border)] px-3 py-1 text-xs text-[var(--color-text-secondary)]"
                    >
                      {channel}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-[var(--color-border)] pt-5 text-sm">
                <span className="text-[var(--color-text-secondary)]">
                  <CountUp value={148} suffix=" companies found" /> ·{" "}
                  <CountUp value={129} suffix=" verified emails" />
                </span>
                <span
                  className={cn(
                    "rounded-[var(--radius-md)] bg-[var(--color-accent)] px-4 py-1.5 text-xs font-medium text-white",
                    "shadow-[0_0_20px_var(--color-accent)]",
                  )}
                >
                  Launch Ready
                </span>
              </div>

              <button
                type="button"
                onClick={replay}
                className="mx-auto block text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
              >
                Replay
              </button>
            </div>
          )}
        </Card>
      </div>
    </section>
  );
}
