import { Card } from "@/components/ui/card";
import { getContentWarnings } from "@/lib/campaigns/smart-warnings";

// docs/outrun/07 "SMART WARNINGS" for already-generated content —
// recomputed at render time from the campaign's own messages rather
// than stored, since it's a pure function of data that's already there.
export function CampaignWarningsPanel({
  messages,
}: {
  messages: { id: string; subject: string; body: string }[];
}) {
  const warnings = getContentWarnings(messages);
  if (warnings.length === 0) return null;

  return (
    <Card interactive>
      <h2 className="text-lg font-medium text-[var(--color-text-primary)]">Smart Warnings</h2>
      <div className="mt-3 space-y-3">
        {warnings.map((w) => (
          <div key={w.id}>
            <p className="text-sm font-medium text-[var(--color-text-primary)]">{w.title}</p>
            <p className="text-sm text-[var(--color-text-secondary)]">{w.detail}</p>
            <p className="text-xs text-[var(--color-accent-text)]">{w.suggestion}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}
