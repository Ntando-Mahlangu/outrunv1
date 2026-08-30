import { Card } from "@/components/ui/card";
import { ImpactBadge } from "@/components/ui/badge";
import type { Signal } from "@/lib/growth-partner/risks";

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
      <ul className="space-y-3">
        {signals.map((signal) => (
          <li key={signal.title} className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-[var(--color-text-primary)]">
                {signal.title}
              </p>
              <p className="text-sm text-[var(--color-text-secondary)]">{signal.reason}</p>
            </div>
            <ImpactBadge level={signal.severity} label={signal.severity} />
          </li>
        ))}
      </ul>
    </Card>
  );
}
