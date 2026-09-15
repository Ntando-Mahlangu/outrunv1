"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Opportunity } from "@prisma/client";
import { Card } from "@/components/ui/card";
import { ImpactBadge, Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormError } from "@/components/ui/form-error";
import { OpportunityExplain } from "./opportunity-explain";
import { ACTION_LABEL, type OpportunityActionType } from "@/lib/opportunities/types";
import type { ImpactLevel } from "@/components/ui/badge";

type LaunchResult = { deepLink?: string; leadListId?: string; companyCount?: number };

export function OpportunityCard({
  opportunity,
  onResolved,
}: {
  opportunity: Opportunity;
  onResolved: (opportunityId: string) => void;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);
  const [isDismissing, setIsDismissing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const actionType = opportunity.actionType as OpportunityActionType;
  const actionLabel = ACTION_LABEL[actionType] ?? "Review & Launch";

  async function launch() {
    setIsLaunching(true);
    setError(null);
    try {
      const res = await fetch(`/api/opportunities/${opportunity.id}/launch`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "That couldn't be launched right now.");
        return;
      }
      const result = data.opportunity.executionResult as LaunchResult;
      onResolved(opportunity.id);
      if (result.deepLink) {
        router.push(result.deepLink);
      } else if (result.leadListId) {
        router.push(`/prospects/lists/${result.leadListId}`);
      } else {
        router.refresh();
      }
    } catch {
      setError("That couldn't be launched right now. Please try again.");
    } finally {
      setIsLaunching(false);
    }
  }

  async function dismiss() {
    setIsDismissing(true);
    setError(null);
    try {
      const res = await fetch(`/api/opportunities/${opportunity.id}/dismiss`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "That couldn't be dismissed right now.");
        return;
      }
      onResolved(opportunity.id);
    } catch {
      setError("That couldn't be dismissed right now. Please try again.");
    } finally {
      setIsDismissing(false);
    }
  }

  return (
    <Card interactive>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-medium text-[var(--color-text-primary)]">{opportunity.title}</p>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{opportunity.summary}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ImpactBadge level={opportunity.estimatedImpact as ImpactLevel} />
          <Badge tone="accent">{opportunity.confidence}% confidence</Badge>
        </div>
      </div>

      {expanded && (
        <div className="mt-4 border-t border-[var(--color-border)] pt-4">
          <OpportunityExplain
            summary={opportunity.summary}
            whyItMatters={opportunity.whyItMatters}
            evidence={opportunity.evidence as string[]}
            confidence={opportunity.confidence}
            estimatedImpact={opportunity.estimatedImpact as ImpactLevel}
            estimatedValue={opportunity.estimatedValue}
            recommendedAction={opportunity.recommendedAction}
          />
        </div>
      )}

      {error && (
        <div className="mt-3">
          <FormError message={error} />
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => setExpanded((v) => !v)}>
          {expanded ? "Hide details" : "Review"}
        </Button>
        {expanded && (
          <>
            <Button size="sm" onClick={launch} disabled={isLaunching || isDismissing}>
              {isLaunching ? "Launching…" : actionLabel}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={dismiss}
              disabled={isLaunching || isDismissing}
            >
              {isDismissing ? "Dismissing…" : "Dismiss"}
            </Button>
          </>
        )}
      </div>
    </Card>
  );
}
