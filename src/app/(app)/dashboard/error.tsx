"use client";

import { useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    fetch("/api/observability/client-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: error.message,
        stack: error.stack,
        digest: error.digest,
        url: typeof window !== "undefined" ? window.location.href : undefined,
      }),
    }).catch(() => {});
  }, [error]);

  return (
    <Card className="mx-auto max-w-lg text-center">
      <h2 className="text-lg font-medium text-[var(--color-text-primary)]">
        Dashboard couldn&apos;t load
      </h2>
      <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
        Something went wrong pulling your dashboard together. It&apos;s been logged
        — try again in a moment.
      </p>
      <Button onClick={reset} className="mt-5">
        Try again
      </Button>
    </Card>
  );
}
