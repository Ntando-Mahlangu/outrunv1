"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import { CountUp } from "@/components/motion/count-up";

// docs/outrun/02 "HERO VISUAL" — a realistic interactive dashboard
// animation, not a static screenshot: a small browser-chrome frame tours
// several real product surfaces (onboarding, Growth Blueprint, prospects,
// campaigns, Growth Partner, dashboard) instead of one static card, so the
// hero itself demonstrates the platform's breadth. Stylized placeholder
// data only — never a real business's numbers — so it never risks being
// read as a fabricated result; only the labeled Wow Demo section further
// down the page carries the anti-fabrication caveat text, because that
// one names a concrete estimate.

const PROSPECTS = [
  { name: "Acme Fittings Co.", fit: 92 },
  { name: "Northbridge Supply", fit: 85 },
  { name: "Harlow & Vance", fit: 78 },
];

const SCENE_MS = 2800;

function OnboardingScene() {
  const full = "We install commercial HVAC systems for offices.";
  const [typed, setTyped] = useState("");

  useEffect(() => {
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setTyped(full.slice(0, i));
      if (i >= full.length) clearInterval(id);
    }, 26);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="space-y-3">
      <p className="text-xs text-[var(--color-text-muted)]">What does your business do?</p>
      <div className="min-h-[2.25rem] rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2 text-sm text-[var(--color-text-primary)]">
        {typed}
        <span className="animate-pulse">|</span>
      </div>
    </div>
  );
}

function BlueprintScene() {
  return (
    <div className="flex items-center gap-4">
      <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-[var(--color-border)]">
        <motion.div
          className="absolute inset-0 rounded-full border-2 border-[var(--color-accent)]"
          initial={{ clipPath: "polygon(50% 50%, 50% 0%, 50% 0%)" }}
          animate={{
            clipPath:
              "polygon(50% 50%, 50% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%, 40% 0%)",
          }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
        />
        <CountUp value={82} className="text-sm font-light text-[var(--color-text-primary)]" />
      </div>
      <div>
        <p className="text-sm font-medium text-[var(--color-text-primary)]">
          Growth Blueprint ready
        </p>
        <p className="text-xs text-[var(--color-text-muted)]">
          Strong foundation, clear next move
        </p>
      </div>
    </div>
  );
}

function ProspectsScene() {
  return (
    <div className="space-y-2">
      <p className="text-xs text-[var(--color-text-muted)]">12 best-fit prospects found</p>
      {PROSPECTS.map((p, i) => (
        <motion.div
          key={p.name}
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.12, duration: 0.4 }}
          className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2 text-xs"
        >
          <span className="text-[var(--color-text-primary)]">{p.name}</span>
          <span className="text-[var(--color-success)]">{p.fit}% fit</span>
        </motion.div>
      ))}
    </div>
  );
}

function CampaignScene() {
  return (
    <div className="space-y-3">
      <p className="text-xs text-[var(--color-text-muted)]">Campaign prepared · 3 messages</p>
      <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2.5">
        <p className="text-xs font-medium text-[var(--color-text-primary)]">
          Quick question about your HVAC maintenance
        </p>
        <p className="mt-1 text-xs text-[var(--color-text-muted)]">
          Hi {"{{firstName}}"}, noticed {"{{company}}"} hasn&apos;t...
        </p>
      </div>
      <div className="flex gap-2">
        {["Email", "LinkedIn", "Follow-up"].map((channel) => (
          <Badge key={channel} tone="accent">
            {channel}
          </Badge>
        ))}
      </div>
    </div>
  );
}

function GrowthPartnerScene() {
  return (
    <div className="space-y-2">
      <p className="text-xs uppercase tracking-wide text-[var(--color-accent-text)]">
        Today&apos;s Priority
      </p>
      <p className="text-sm font-medium text-[var(--color-text-primary)]">
        Launch a campaign to your top 10 saved prospects
      </p>
      <p className="text-xs text-[var(--color-text-muted)]">
        Confidence: 88% · Estimated time: 10 min
      </p>
    </div>
  );
}

function LaunchScene() {
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-[var(--color-text-primary)]">Ready to grow</p>
        <p className="text-xs text-[var(--color-text-muted)]">Everything is prepared</p>
      </div>
      <span className="rounded-[var(--radius-md)] bg-[var(--color-accent)] px-4 py-1.5 text-xs font-medium text-white shadow-[0_0_24px_var(--color-accent)]">
        Launch
      </span>
    </div>
  );
}

const SCENES = [
  { path: "/onboarding", eyebrow: "Understanding your business", Scene: OnboardingScene },
  { path: "/blueprint", eyebrow: "Growth Blueprint generated", Scene: BlueprintScene },
  { path: "/prospects", eyebrow: "Best-fit prospects found", Scene: ProspectsScene },
  { path: "/campaigns/new", eyebrow: "Campaign prepared", Scene: CampaignScene },
  { path: "/growth-partner", eyebrow: "Daily briefing ready", Scene: GrowthPartnerScene },
  { path: "/dashboard", eyebrow: "Ready to launch", Scene: LaunchScene },
] as const;

export function HeroDemo() {
  const reduceMotion = useReducedMotion();
  const [stage, setStage] = useState(0);

  useEffect(() => {
    if (reduceMotion) return;
    const id = setInterval(() => setStage((s) => (s + 1) % SCENES.length), SCENE_MS);
    return () => clearInterval(id);
  }, [reduceMotion]);

  const activeIndex = reduceMotion ? 1 : stage;
  const active = SCENES[activeIndex]!;
  const ActiveScene = active.Scene;

  return (
    <div className="mx-auto w-full max-w-md overflow-hidden rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-card)] text-left shadow-[0_1px_2px_rgba(0,0,0,0.3)]">
      <div className="flex items-center gap-2 border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full bg-[var(--color-error)]/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-[var(--color-warning)]/70" />
        <span className="h-2.5 w-2.5 rounded-full bg-[var(--color-success)]/70" />
        <span className="ml-2 truncate rounded-[var(--radius-md)] bg-[var(--color-bg-primary)] px-2 py-0.5 font-mono text-[10px] text-[var(--color-text-muted)]">
          app.outrunv1.online{active.path}
        </span>
      </div>

      <div className="p-6">
        <p className="text-xs uppercase tracking-wide text-[var(--color-accent-text)]">
          {active.eyebrow}
        </p>
        <div className="mt-4 min-h-[7rem]">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeIndex}
              initial={reduceMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, y: -10 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            >
              <ActiveScene />
            </motion.div>
          </AnimatePresence>
        </div>

        {!reduceMotion && (
          <div className="mt-5 flex items-center justify-center gap-1.5 border-t border-[var(--color-border)] pt-4">
            {SCENES.map((s, i) => (
              <button
                key={s.path}
                type="button"
                aria-label={`Show ${s.eyebrow}`}
                onClick={() => setStage(i)}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300",
                  i === stage ? "w-5 bg-[var(--color-accent)]" : "w-1.5 bg-[var(--color-border)]",
                )}
              />
            ))}
          </div>
        )}
      </div>

      <p className="border-t border-[var(--color-border)] px-6 py-2.5 text-center text-[10px] text-[var(--color-text-muted)]">
        Illustrative preview
      </p>
    </div>
  );
}
