import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { CampaignOverview } from "@/lib/dashboard/campaign-overview";

type CampaignOverviewItem = CampaignOverview["recent"][number];

const STATUS_LABEL: Record<CampaignOverviewItem["status"], string> = {
  DRAFT: "Draft",
  READY: "Running",
  PAUSED: "Paused",
  COMPLETED: "Completed",
};

const STATUS_TONE: Record<CampaignOverviewItem["status"], "high" | "medium" | "low" | "accent"> = {
  DRAFT: "low",
  READY: "high",
  PAUSED: "medium",
  COMPLETED: "accent",
};

export function CampaignOverviewWidget({ overview }: { overview: CampaignOverview }) {
  const hasCampaigns =
    overview.runningCount + overview.draftCount + overview.pausedCount + overview.completedCount > 0;

  return (
    <Card interactive>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-medium text-[var(--color-text-primary)]">Campaign Overview</h2>
        <Link href="/campaigns" className="text-sm text-[var(--color-accent-text)] hover:underline">
          View all
        </Link>
      </div>

      {!hasCampaigns ? (
        <p className="text-sm text-[var(--color-text-muted)]">
          No campaigns yet — find prospects and launch your first one.
        </p>
      ) : (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">Running</p>
              <p className="text-xl font-light text-[var(--color-text-primary)]">
                {overview.runningCount}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">Draft</p>
              <p className="text-xl font-light text-[var(--color-text-primary)]">
                {overview.draftCount}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">Paused</p>
              <p className="text-xl font-light text-[var(--color-text-primary)]">
                {overview.pausedCount}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
                Completed
              </p>
              <p className="text-xl font-light text-[var(--color-text-primary)]">
                {overview.completedCount}
              </p>
            </div>
          </div>

          <ul className="space-y-3">
            {overview.recent.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-3 border-t border-[var(--color-border)] pt-3 first:border-0 first:pt-0"
              >
                <div className="min-w-0">
                  <Link
                    href={`/campaigns/${c.id}`}
                    className="truncate text-sm text-[var(--color-text-primary)] hover:underline"
                  >
                    {c.name}
                  </Link>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {c.companiesCount} {c.companiesCount === 1 ? "company" : "companies"} ·{" "}
                    {c.sentCount} sent · {c.repliesCount} replied
                  </p>
                </div>
                <Badge tone={STATUS_TONE[c.status]}>{STATUS_LABEL[c.status]}</Badge>
              </li>
            ))}
          </ul>
        </>
      )}
    </Card>
  );
}
