import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentSession } from "@/lib/session";
import { getCurrentOrganization } from "@/lib/org";
import { getBlueprintHistory } from "@/lib/growth-blueprint/history";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function BlueprintHistoryPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/sign-in");

  const organization = await getCurrentOrganization(session.user.id);
  if (!organization) redirect("/sign-in");
  if (!organization.businessProfile) redirect("/onboarding");

  const history = await getBlueprintHistory(organization.id);
  if (history.length === 0) redirect("/blueprint");

  return (
    <div className="py-16">
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <Link href="/blueprint" className="text-sm text-[var(--color-accent-text)] hover:underline">
            ← Back to Growth Blueprint
          </Link>
          <h1 className="mt-3 text-2xl font-light tracking-tight text-[var(--color-text-primary)]">
            Version History
          </h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            {organization.name} — every Growth Blueprint version, what changed, and what happened
            in between.
          </p>
        </div>

        {history.map((entry) => {
          const delta =
            entry.previousGrowthScore != null ? entry.growthScore - entry.previousGrowthScore : null;
          return (
            <Card key={entry.version}>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-lg font-medium text-[var(--color-text-primary)]">
                    Version {entry.version}
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {new Date(entry.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-light text-[var(--color-text-primary)]">
                    {entry.growthScore}
                    {delta != null && (
                      <span
                        className={
                          delta >= 0
                            ? "ml-2 text-sm text-[var(--color-success)]"
                            : "ml-2 text-sm text-[var(--color-warning)]"
                        }
                      >
                        {entry.previousGrowthScore} → {entry.growthScore} ({delta >= 0 ? "+" : ""}
                        {delta})
                      </span>
                    )}
                  </p>
                </div>
              </div>

              {entry.categoryDeltas.length > 0 && (
                <div className="mt-4 space-y-1">
                  <p className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
                    What changed
                  </p>
                  {entry.categoryDeltas.map((d) => (
                    <p key={d.category} className="text-sm text-[var(--color-text-secondary)]">
                      {d.category}: {d.from} → {d.to} ({d.delta >= 0 ? "+" : ""}
                      {d.delta})
                    </p>
                  ))}
                </div>
              )}

              {entry.eventsSince.length > 0 && (
                <div className="mt-4 space-y-1">
                  <p className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
                    What happened since the previous version
                  </p>
                  {entry.eventsSince.map((e) => (
                    <p key={e.id} className="text-sm text-[var(--color-text-secondary)]">
                      {e.summary}
                    </p>
                  ))}
                </div>
              )}

              <div className="mt-4 flex items-center gap-3">
                <Link
                  href={`/blueprint/history/${entry.version}`}
                  className="text-sm text-[var(--color-accent-text)] hover:underline"
                >
                  View full version
                </Link>
                {entry.version === history[0]?.version && <Badge tone="accent">Current</Badge>}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
