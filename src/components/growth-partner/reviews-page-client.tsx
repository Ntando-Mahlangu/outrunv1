"use client";

import { useState } from "react";
import Link from "next/link";
import type { StrategicReview, ReviewPeriod } from "@prisma/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FormError } from "@/components/ui/form-error";
import { SplitHeading } from "@/components/motion/split-heading";

const PERIODS: { value: ReviewPeriod; label: string }[] = [
  { value: "WEEKLY", label: "Weekly" },
  { value: "MONTHLY", label: "Monthly" },
  { value: "QUARTERLY", label: "Quarterly" },
];

const PERIOD_TONE: Record<ReviewPeriod, "accent" | "medium" | "high"> = {
  WEEKLY: "accent",
  MONTHLY: "medium",
  QUARTERLY: "high",
};

export function ReviewsPageClient({ initialReviews }: { initialReviews: StrategicReview[] }) {
  const [reviews, setReviews] = useState(initialReviews);
  const [generatingPeriod, setGeneratingPeriod] = useState<ReviewPeriod | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function generate(period: ReviewPeriod) {
    setError(null);
    setGeneratingPeriod(period);
    try {
      const res = await fetch("/api/growth-partner/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Something went wrong.");
      setReviews((prev) => [body.review, ...prev]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setGeneratingPeriod(null);
    }
  }

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <SplitHeading
            as="h1"
            text="Strategic Reviews"
            className="text-2xl font-light tracking-tight text-[var(--color-text-primary)]"
          />
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Automatically generated weekly, monthly, and quarterly — achievements, missed
            opportunities, risks, key learnings, and what to prioritize next.
          </p>
        </div>
        <Link href="/growth-partner" className="mt-1 text-sm text-[var(--color-accent-text)] hover:underline">
          ← Growth Partner
        </Link>
      </div>

      <Card>
        <h2 className="mb-3 text-sm font-medium text-[var(--color-text-primary)]">
          Generate a review now
        </h2>
        <FormError message={error} />
        <div className="mt-2 flex flex-wrap gap-3">
          {PERIODS.map((p) => (
            <Button
              key={p.value}
              size="sm"
              variant="secondary"
              onClick={() => generate(p.value)}
              disabled={generatingPeriod !== null}
            >
              {generatingPeriod === p.value ? "Generating…" : `Generate ${p.label} Review`}
            </Button>
          ))}
        </div>
      </Card>

      {reviews.length === 0 ? (
        <p className="text-sm text-[var(--color-text-muted)]">
          No reviews yet — generate one above, or wait for the next automatic run.
        </p>
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => (
            <Link key={review.id} href={`/growth-partner/reviews/${review.id}`}>
              <Card className="transition-colors hover:border-[var(--color-accent)]/40">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge tone={PERIOD_TONE[review.period]}>{review.period}</Badge>
                      <p className="text-sm font-medium text-[var(--color-text-primary)]">
                        {new Date(review.periodStart).toLocaleDateString()} –{" "}
                        {new Date(review.periodEnd).toLocaleDateString()}
                      </p>
                    </div>
                    <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                      Generated {new Date(review.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <span className="text-sm text-[var(--color-accent-text)]">View →</span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
