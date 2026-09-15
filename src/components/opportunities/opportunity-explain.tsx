import { ImpactBadge, Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/i18n/format";
import type { ImpactLevel } from "@/components/ui/badge";

/**
 * docs/outrun/16 "OUTRUN CONSTITUTION" Article IV/VIII — every AI-surfaced
 * recommendation must separate what was observed from why it matters,
 * show its evidence, and state a confidence level rather than implying
 * certainty. This is the one reusable structured-explain layout for that
 * (src/components/dashboard/evidence-toggle.tsx's single-string collapse
 * remains as-is elsewhere for that lighter use case).
 */
export function OpportunityExplain({
  summary,
  whyItMatters,
  evidence,
  confidence,
  estimatedImpact,
  estimatedValue,
  recommendedAction,
}: {
  summary: string;
  whyItMatters: string;
  evidence: string[];
  confidence: number;
  estimatedImpact: ImpactLevel;
  estimatedValue: number | null;
  recommendedAction: string;
}) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-medium tracking-wide text-[var(--color-text-muted)] uppercase">
          What was detected
        </p>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{summary}</p>
      </div>

      <div>
        <p className="text-xs font-medium tracking-wide text-[var(--color-text-muted)] uppercase">
          Why it matters
        </p>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{whyItMatters}</p>
      </div>

      <div>
        <p className="text-xs font-medium tracking-wide text-[var(--color-text-muted)] uppercase">Evidence</p>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-[var(--color-text-secondary)]">
          {evidence.map((line, i) => (
            <li key={i}>{line}</li>
          ))}
        </ul>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <ImpactBadge level={estimatedImpact} />
        <Badge tone="accent">{confidence}% confidence</Badge>
        <Badge tone="medium">
          {estimatedValue != null
            ? `~${formatCurrency(estimatedValue)} potential value`
            : "No value estimate — set your average customer value in Business Profile"}
        </Badge>
      </div>

      <div>
        <p className="text-xs font-medium tracking-wide text-[var(--color-text-muted)] uppercase">
          Recommended action
        </p>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{recommendedAction}</p>
      </div>
    </div>
  );
}
