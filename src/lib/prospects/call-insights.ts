import { prisma } from "@/lib/prisma";
import type { CallOutcome } from "@prisma/client";
import { logEvent, EventType } from "@/lib/memory/log-event";

// A call that actually led to a real conversation or a next step — the
// same two outcomes the Start Calling mode's "Lead Captured" (ANSWERED)
// and "Meeting Booked" (CALLBACK_REQUESTED) buttons log
// (src/components/prospects/cold-calling-mode.tsx). Everything else
// (voicemail, no answer, not interested, wrong number, do not call)
// counts as not-positive for this analysis.
const POSITIVE_OUTCOMES: CallOutcome[] = ["ANSWERED", "CALLBACK_REQUESTED"];

type CallForAnalysis = {
  outcome: CallOutcome;
  createdAt: Date;
  company: { category: string | null; website: string | null; fitScore: number | null };
};

export type CallPatternInsight = {
  dimension: string;
  insight: string;
  winningBucket: string;
  winningRate: number;
  comparisonBucket: string;
  comparisonRate: number;
  sampleSize: number;
};

export type CallInsightsResult = {
  totalCalls: number;
  minRequired: number;
  insufficientData: boolean;
  patterns: CallPatternInsight[];
};

// Same honesty bar as the outreach Improvement Loop
// (src/lib/campaigns/improvement-loop.ts) — a pattern only surfaces once
// it clears a minimum sample size and a minimum gap between buckets, so
// "no-website leads convert better" is never asserted off three calls.
const MIN_TOTAL_CALLS = 10;
const MIN_BUCKET_CALLS = 3;
const MIN_RATE_DELTA = 0.1;

function positiveRate(calls: CallForAnalysis[]): number | null {
  if (calls.length === 0) return null;
  return calls.filter((c) => POSITIVE_OUTCOMES.includes(c.outcome)).length / calls.length;
}

function fitScoreBucket(fitScore: number | null): string {
  if (fitScore == null) return "No Fit Score";
  if (fitScore >= 70) return "High Fit Score (70+)";
  if (fitScore >= 40) return "Medium Fit Score (40-69)";
  return "Low Fit Score (<40)";
}

function websiteBucket(website: string | null): string {
  return website ? "Has a website" : "No website";
}

function dayOfWeekBucket(date: Date): string {
  return date.toLocaleDateString("en-US", { weekday: "long" });
}

function analyzeDimension(
  calls: CallForAnalysis[],
  bucketFn: (c: CallForAnalysis) => string,
  dimension: string,
): CallPatternInsight | null {
  const buckets = new Map<string, CallForAnalysis[]>();
  for (const c of calls) {
    const key = bucketFn(c);
    const bucket = buckets.get(key);
    if (bucket) bucket.push(c);
    else buckets.set(key, [c]);
  }

  const stats = Array.from(buckets.entries())
    .map(([key, group]) => ({ key, rate: positiveRate(group), count: group.length }))
    .filter(
      (b): b is { key: string; rate: number; count: number } =>
        b.rate !== null && b.count >= MIN_BUCKET_CALLS,
    )
    .sort((a, b) => b.rate - a.rate);

  if (stats.length < 2) return null;

  const winner = stats[0]!;
  const runnerUp = stats[1]!;
  if (winner.rate - runnerUp.rate < MIN_RATE_DELTA) return null;

  const winningRate = Math.round(winner.rate * 100);
  const comparisonRate = Math.round(runnerUp.rate * 100);

  return {
    dimension,
    winningBucket: winner.key,
    winningRate,
    comparisonBucket: runnerUp.key,
    comparisonRate,
    sampleSize: winner.count + runnerUp.count,
    insight: `${winner.key} had a ${winningRate}% positive-outcome rate vs ${comparisonRate}% for ${runnerUp.key}.`,
  };
}

export async function analyzeCallOutcomePatterns(organizationId: string): Promise<CallInsightsResult> {
  const calls = await prisma.callLog.findMany({
    where: { company: { organizationId } },
    select: {
      outcome: true,
      createdAt: true,
      company: { select: { category: true, website: true, fitScore: true } },
    },
  });

  if (calls.length < MIN_TOTAL_CALLS) {
    return { totalCalls: calls.length, minRequired: MIN_TOTAL_CALLS, insufficientData: true, patterns: [] };
  }

  const withCategory = calls.filter((c) => c.company.category);

  const patterns = [
    analyzeDimension(calls, (c) => fitScoreBucket(c.company.fitScore), "Fit Score"),
    analyzeDimension(calls, (c) => websiteBucket(c.company.website), "Website Presence"),
    analyzeDimension(withCategory, (c) => c.company.category!, "Industry"),
    analyzeDimension(calls, (c) => dayOfWeekBucket(c.createdAt), "Call Day"),
  ].filter((p): p is CallPatternInsight => p !== null);

  return { totalCalls: calls.length, minRequired: MIN_TOTAL_CALLS, insufficientData: false, patterns };
}

/** Re-runs the analysis fresh and logs each currently-detected pattern to the Business Brain. */
export async function saveCallOutcomePatternsToMemory(organizationId: string) {
  const result = await analyzeCallOutcomePatterns(organizationId);
  for (const pattern of result.patterns) {
    await logEvent(
      organizationId,
      EventType.PATTERN_IDENTIFIED,
      `${pattern.dimension} calling pattern: ${pattern.insight}`,
    );
  }
  return result;
}

export type CallActivitySummary = {
  total: number;
  positive: number;
  positiveRate: number | null;
};

/** Plain factual call-activity counts for a window — no AI, no inference.
 * Used by the Strategic Review's factual period summary
 * (src/lib/growth-partner/strategic-review.ts) and reusable anywhere else
 * that needs "what actually happened with calling" for a date range. */
export async function getCallActivitySummary(
  organizationId: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<CallActivitySummary> {
  const calls = await prisma.callLog.findMany({
    where: { company: { organizationId }, createdAt: { gte: periodStart, lt: periodEnd } },
    select: { outcome: true },
  });
  const positive = calls.filter((c) => POSITIVE_OUTCOMES.includes(c.outcome)).length;
  return {
    total: calls.length,
    positive,
    positiveRate: calls.length > 0 ? positive / calls.length : null,
  };
}
