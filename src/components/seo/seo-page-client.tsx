"use client";

import { useState } from "react";
import type { SeoContentPiece } from "@prisma/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";
import { ImpactBadge, Badge } from "@/components/ui/badge";
import { ScoreGauge } from "@/components/growth-blueprint/score-gauge";
import { pollJob } from "@/lib/jobs/poll-job";
import { SplitHeading } from "@/components/motion/split-heading";
import { Magnetic } from "@/components/motion/magnetic";
import type { SEOAnalysisData, LocalSeoPersisted } from "@/lib/seo/schema";

type Analysis = {
  healthScore: number;
  executiveSummary: string;
  categories: SEOAnalysisData["categories"];
  quickWins: SEOAnalysisData["quickWins"];
  keywordSuggestions: SEOAnalysisData["keywordSuggestions"];
  contentIdeas: SEOAnalysisData["contentIdeas"];
  localSeo: LocalSeoPersisted | null;
  version: number;
};

export function SeoPageClient({
  website: initialWebsite,
  analysis: initialAnalysis,
  contentPieces: initialContentPieces,
}: {
  website: string | null;
  analysis: Analysis | null;
  contentPieces: SeoContentPiece[];
}) {
  const [website, setWebsite] = useState(initialWebsite);
  const [websiteInput, setWebsiteInput] = useState("");
  const [analysis, setAnalysis] = useState(initialAnalysis);
  const [contentPieces, setContentPieces] = useState(initialContentPieces);
  const [error, setError] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [generatingIdea, setGeneratingIdea] = useState<string | null>(null);

  async function handleSetWebsite(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const res = await fetch("/api/seo/website", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ website: websiteInput }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Something went wrong.");
      setWebsite(body.website);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  async function handleAnalyze() {
    setError(null);
    setIsAnalyzing(true);
    try {
      const res = await fetch("/api/seo/analyze", { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Something went wrong.");

      const job = await pollJob(body.jobId);
      if (job.status === "FAILED") {
        throw new Error(job.errorMessage ?? "Something went wrong.");
      }

      const latestRes = await fetch("/api/seo/analyze");
      const latestBody = await latestRes.json();
      if (!latestRes.ok || !latestBody.analysis) {
        throw new Error(latestBody.error ?? "Something went wrong.");
      }
      setAnalysis({ ...latestBody.analysis, version: latestBody.analysis.version });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function handleGenerateContent(idea: SEOAnalysisData["contentIdeas"][number]) {
    setError(null);
    setGeneratingIdea(idea.headline);
    try {
      const res = await fetch("/api/seo/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          headline: idea.headline,
          targetKeyword: idea.targetKeyword,
          businessGoal: idea.businessGoal,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Something went wrong.");
      setContentPieces((prev) => [body.piece, ...prev]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setGeneratingIdea(null);
    }
  }

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <SplitHeading
          as="h1"
          text="SEO"
          className="text-2xl font-light tracking-tight text-[var(--color-text-primary)]"
        />
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Understand your website&apos;s search visibility and generate content
          to improve it.
        </p>
      </div>

      <FormError message={error} />

      {!website && (
        <Card>
          <Label htmlFor="website">Your website</Label>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Add your website to run an SEO analysis.
          </p>
          <form onSubmit={handleSetWebsite} className="mt-3 flex gap-3">
            <Input
              id="website"
              type="url"
              placeholder="https://yourbusiness.com"
              value={websiteInput}
              onChange={(e) => setWebsiteInput(e.target.value)}
            />
            <Button type="submit">Save</Button>
          </form>
        </Card>
      )}

      {website && !analysis && (
        <Card className="text-center">
          <p className="text-sm text-[var(--color-text-secondary)]">
            Outrun will crawl {website} and generate a full SEO health report.
          </p>
          <Magnetic strength={0.15} className="mt-4 inline-block">
            <Button onClick={handleAnalyze} disabled={isAnalyzing}>
              {isAnalyzing ? "Analysing your website…" : "Analyse My Website"}
            </Button>
          </Magnetic>
        </Card>
      )}

      {analysis && (
        <>
          <Card className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
            <ScoreGauge score={analysis.healthScore} label="SEO Health Score" />
            <div className="flex-1 space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-medium text-[var(--color-text-primary)]">
                  Executive Summary
                </h2>
                <Button variant="ghost" size="sm" onClick={handleAnalyze} disabled={isAnalyzing}>
                  {isAnalyzing ? "Re-analysing…" : "Re-analyse"}
                </Button>
              </div>
              <p className="text-sm leading-relaxed text-[var(--color-text-secondary)]">
                {analysis.executiveSummary}
              </p>
            </div>
          </Card>

          <Card>
            <h2 className="mb-4 text-lg font-medium text-[var(--color-text-primary)]">
              Quick Wins
            </h2>
            <ul className="list-inside list-disc space-y-1.5 text-sm text-[var(--color-text-secondary)]">
              {analysis.quickWins.map((win) => (
                <li key={win}>{win}</li>
              ))}
            </ul>
          </Card>

          <Card>
            <h2 className="mb-4 text-lg font-medium text-[var(--color-text-primary)]">
              Score Breakdown
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {analysis.categories.map((c) => (
                <div key={c.category} className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium text-[var(--color-text-primary)]">{c.category}</p>
                    <p className="text-sm text-[var(--color-text-secondary)]">{c.reason}</p>
                    <p className="mt-1 text-xs text-[var(--color-accent-text)]">{c.suggestedFix}</p>
                  </div>
                  <p className="shrink-0 text-2xl font-light text-[var(--color-text-primary)]">
                    {c.score}
                  </p>
                </div>
              ))}
            </div>
          </Card>

          {analysis.localSeo && (
            <Card>
              <h2 className="mb-1 text-lg font-medium text-[var(--color-text-primary)]">
                Local SEO
              </h2>
              <p className="mb-4 text-sm text-[var(--color-text-secondary)]">
                Based on where you told us you sell.
              </p>

              <div className="mb-4">
                <p className="mb-2 text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
                  Verified findings
                </p>
                <ul className="space-y-1.5">
                  {analysis.localSeo.verifiedFindings.map((finding) => (
                    <li key={finding} className="flex items-start gap-2 text-sm">
                      <Badge tone="low" className="mt-0.5 shrink-0">
                        verified
                      </Badge>
                      <span className="text-[var(--color-text-secondary)]">{finding}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="mb-1 text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
                    Location pages
                  </p>
                  <ul className="list-inside list-disc space-y-1 text-sm text-[var(--color-text-secondary)]">
                    {analysis.localSeo.locationPageRecommendations.map((rec) => (
                      <li key={rec}>{rec}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="mb-1 text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
                    Local keywords
                  </p>
                  <ul className="list-inside list-disc space-y-1 text-sm text-[var(--color-text-secondary)]">
                    {analysis.localSeo.localKeywordRecommendations.map((rec) => (
                      <li key={rec}>{rec}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="mb-1 text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
                    Google Business Profile
                  </p>
                  <ul className="list-inside list-disc space-y-1 text-sm text-[var(--color-text-secondary)]">
                    {analysis.localSeo.googleBusinessProfileTips.map((tip) => (
                      <li key={tip}>{tip}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="mb-1 text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
                    Review strategy
                  </p>
                  <ul className="list-inside list-disc space-y-1 text-sm text-[var(--color-text-secondary)]">
                    {analysis.localSeo.reviewStrategyTips.map((tip) => (
                      <li key={tip}>{tip}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </Card>
          )}

          <Card>
            <h2 className="mb-4 text-lg font-medium text-[var(--color-text-primary)]">
              Keyword Suggestions
            </h2>
            <div className="space-y-3">
              {analysis.keywordSuggestions.map((k) => (
                <div key={k.keyword} className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">
                      {k.keyword}
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)]">{k.reason}</p>
                  </div>
                  <Badge tone="accent">{k.type}</Badge>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <h2 className="mb-4 text-lg font-medium text-[var(--color-text-primary)]">
              Content Ideas
            </h2>
            <div className="space-y-4">
              {analysis.contentIdeas.map((idea) => (
                <div
                  key={idea.headline}
                  className="flex items-center justify-between gap-4 border-b border-[var(--color-border)] pb-4 last:border-0 last:pb-0"
                >
                  <div>
                    <p className="text-sm font-medium text-[var(--color-text-primary)]">
                      {idea.headline}
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      {idea.targetKeyword} · {idea.searchIntent}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <ImpactBadge level={idea.estimatedDifficulty} label={idea.estimatedDifficulty} />
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleGenerateContent(idea)}
                      disabled={generatingIdea === idea.headline}
                    >
                      {generatingIdea === idea.headline ? "Writing…" : "Generate Draft"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}

      {contentPieces.length > 0 && (
        <Card>
          <h2 className="mb-4 text-lg font-medium text-[var(--color-text-primary)]">
            Generated Content
          </h2>
          <div className="space-y-4">
            {contentPieces.map((piece) => (
              <div
                key={piece.id}
                className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-4"
              >
                <p className="text-sm font-medium text-[var(--color-text-primary)]">
                  {piece.title}
                </p>
                <p className="mt-1 text-xs text-[var(--color-text-muted)]">
                  {piece.metaDescription}
                </p>
                <p className="mt-3 whitespace-pre-wrap text-sm text-[var(--color-text-secondary)]">
                  {piece.body}
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
