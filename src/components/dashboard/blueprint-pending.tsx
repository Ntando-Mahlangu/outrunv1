"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";

// docs/outrun/04 "Mission Control" needs a Blueprint to render anything
// meaningful, but an org can genuinely have none yet — onboarding kicks off
// generation in the background rather than blocking on it (see
// src/app/onboarding/page.tsx), and a Free-tier org that's already used its
// one lifetime Blueprint will never get another. This replaces the old hard
// redirect to a dedicated /blueprint/generating page, which could dead-end
// a Free account with no way back into the app.
//
// Polls via router.refresh() (a plain RSC re-fetch) instead of a dedicated
// status endpoint — generateGrowthBlueprint() already revalidates the cache
// tag findLatestForOrg reads from the moment a Blueprint actually lands, so
// a refresh naturally picks it up.
const POLL_INTERVAL_MS = 5000;
const MAX_POLLS = 40; // ~3.3 minutes, matching the "1-3 minutes" copy below

export function BlueprintPending({ hasInFlightJob }: { hasInFlightJob: boolean }) {
  const router = useRouter();
  const [isGenerating, setIsGenerating] = useState(hasInFlightJob);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollCountRef = useRef(0);

  useEffect(() => {
    if (!isGenerating) return;

    pollCountRef.current = 0;
    const interval = setInterval(() => {
      pollCountRef.current += 1;
      if (pollCountRef.current > MAX_POLLS) {
        clearInterval(interval);
        return;
      }
      router.refresh();
    }, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [isGenerating, router]);

  async function start() {
    setError(null);
    setIsStarting(true);
    try {
      const res = await fetch("/api/blueprint/generate", { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Something went wrong.");
      setIsGenerating(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsStarting(false);
    }
  }

  if (isGenerating) {
    return (
      <Card className="animate-fade-in text-center">
        <div className="mx-auto mb-6 size-10 animate-pulse rounded-full bg-[var(--color-accent)]" />
        <p className="text-lg font-light text-[var(--color-text-primary)]">
          Building your Growth Blueprint…
        </p>
        <p className="mt-3 text-sm text-[var(--color-text-muted)]">
          This usually takes 1–3 minutes. Feel free to explore Outrun in the meantime — we&apos;ll
          notify you the moment it&apos;s ready.
        </p>
      </Card>
    );
  }

  return (
    <Card className="animate-fade-in space-y-4 text-center">
      <p className="text-lg font-light text-[var(--color-text-primary)]">
        Your Growth Blueprint isn&apos;t ready yet.
      </p>
      <p className="text-sm text-[var(--color-text-secondary)]">
        Generate it to unlock Mission Control, your Growth Score, and AI Opportunities.
      </p>
      <FormError message={error} />
      <Button onClick={start} disabled={isStarting}>
        {isStarting ? "Starting…" : "Generate Growth Blueprint"}
      </Button>
    </Card>
  );
}
