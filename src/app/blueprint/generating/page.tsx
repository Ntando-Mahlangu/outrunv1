"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { FormError } from "@/components/ui/form-error";
import { Button } from "@/components/ui/button";
import { pollJob } from "@/lib/jobs/poll-job";

// docs/outrun/03 "AI ANALYSIS" — never a spinner, always a sense of
// progress. The later messages describe the Second Wow Moment
// (src/lib/onboarding/second-wow.ts), which only runs after the very
// first Blueprint and is chained into this same wait — by the time the
// user reaches /blueprint, that work is already done too.
const MESSAGES = [
  "Understanding your business…",
  "Analysing your market…",
  "Finding opportunities…",
  "Comparing growth strategies…",
  "Building your Growth Blueprint…",
  "Preparing recommendations…",
  "Finding your best-fit prospects…",
  "Researching qualified companies…",
  "Preparing your first campaign…",
];

export default function GeneratingBlueprintPage() {
  const router = useRouter();
  const [messageIndex, setMessageIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  // Guards against React's dev-mode double-invocation of this effect
  // (mount → cleanup → mount), which would otherwise fire two concurrent
  // POSTs to /api/blueprint/generate on a single page load. The route
  // itself is idempotent now (see src/app/api/blueprint/generate/route.ts),
  // but skipping the duplicate call here avoids two request/poll cycles
  // for one page load regardless.
  const hasStartedRef = useRef(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((i) => Math.min(i + 1, MESSAGES.length - 1));
    }, 3500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/blueprint/generate", { method: "POST" });
        const body = await res.json();
        if (!res.ok) {
          // Free plans get exactly one Blueprint, ever — reaching this page
          // again (onboarding sends every re-submission here to refresh it)
          // means this org already has one. Take the user back to it and
          // into the rest of the app instead of dead-ending on an upgrade
          // wall with no way forward.
          if (body.hasExistingBlueprint) {
            router.replace("/blueprint?blueprintLimitReached=1");
            return;
          }
          throw new Error(body.error ?? "Something went wrong.");
        }

        const job = await pollJob(body.jobId, { timeoutMs: 280_000 });
        if (cancelled) return;
        if (job.status === "FAILED") {
          throw new Error(job.errorMessage ?? "We couldn't build your Growth Blueprint. Please try again.");
        }
        router.push("/blueprint");
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "We couldn't build your Growth Blueprint. Please try again.",
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--color-bg-primary)] px-4 py-16">
      <Card className="w-full max-w-md animate-fade-in text-center">
        {error ? (
          <div className="space-y-4">
            <FormError message={error} />
            <Button className="w-full" onClick={() => router.push("/onboarding")}>
              Back to Business Discovery
            </Button>
          </div>
        ) : (
          <>
            <div className="mx-auto mb-6 size-10 animate-pulse rounded-full bg-[var(--color-accent)]" />
            <p
              key={messageIndex}
              className="animate-fade-in text-lg font-light text-[var(--color-text-primary)]"
            >
              {MESSAGES[messageIndex]}
            </p>
            <p className="mt-3 text-sm text-[var(--color-text-muted)]">
              This usually takes 1–3 minutes.
            </p>
          </>
        )}
      </Card>
    </main>
  );
}
