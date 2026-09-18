import { Card } from "@/components/ui/card";
import { Badge, ImpactBadge } from "@/components/ui/badge";
import type { RiskUrgency, Signal } from "@/lib/growth-partner/risks";

const URGENCY_TONE: Record<RiskUrgency, "high" | "medium" | "low"> = {
  Now: "high",
  "This Week": "medium",
  Monitor: "low",
};

export function RiskPanel({ signals }: { signals: Signal[] }) {
  if (signals.length === 0) {
    return (
      <Card interactive>
        <p className="text-sm text-[var(--color-text-secondary)]">
          Nothing needs your attention right now — no obvious risks detected.
        </p>
      </Card>
    );
  }

  return (
    <Card interactive>
      <h2 className="mb-4 text-lg font-medium text-[var(--color-text-primary)]">
        Risks &amp; Opportunities
      </h2>
      <ul className="space-y-4">
        {signals.map((signal) => (
          <li key={signal.title} className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-[var(--color-text-primary)]">
                {signal.title}
              </p>
              <p className="text-sm text-[var(--color-text-secondary)]">{signal.reason}</p>
              <p className="mt-1.5 text-sm text-[var(--color-accent-text)]">→ {signal.recommendation}</p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <ImpactBadge level={signal.severity} label={signal.severity} />
              <Badge tone={URGENCY_TONE[signal.urgency]}>{signal.urgency}</Badge>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
