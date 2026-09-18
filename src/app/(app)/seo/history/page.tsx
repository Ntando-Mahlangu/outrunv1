import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentSession } from "@/lib/session";
import { getCurrentOrganization } from "@/lib/org";
import { getSeoHistory } from "@/lib/seo/history";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function SeoHistoryPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/sign-in");

  const organization = await getCurrentOrganization(session.user.id);
  if (!organization) redirect("/sign-in");
  if (!organization.businessProfile) redirect("/onboarding");

  const history = await getSeoHistory(organization.id);
  if (history.length === 0) redirect("/seo");

  return (
    <div className="py-16">
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <Link href="/seo" className="text-sm text-[var(--color-accent-text)] hover:underline">
            ← Back to SEO
          </Link>
          <h1 className="mt-3 text-2xl font-light tracking-tight text-[var(--color-text-primary)]">
            SEO Timeline
          </h1>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            {organization.name} — every SEO analysis, what changed, and what happened in between.
          </p>
        </div>

        {history.map((entry) => {
          const delta =
            entry.previousHealthScore != null ? entry.healthScore - entry.previousHealthScore : null;
          return (
            <Card key={entry.version} interactive>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-lg font-medium text-[var(--color-text-primary)]">
                    Analysis {entry.version}
                  </p>
                  <p className="text-xs text-[var(--color-text-muted)]">
                    {new Date(entry.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-light text-[var(--color-text-primary)]">
                    {entry.healthScore}
                    {delta != null && (
                      <span
                        className={
                          delta >= 0
                            ? "ml-2 text-sm text-[var(--color-success)]"
                            : "ml-2 text-sm text-[var(--color-warning)]"
                        }
                      >
                        {entry.previousHealthScore} → {entry.healthScore} ({delta >= 0 ? "+" : ""}
                        {delta})
                      </span>
                    )}
                  </p>
                </div>
              </div>

              <p className="mt-3 text-sm text-[var(--color-text-secondary)]">{entry.executiveSummary}</p>

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

              {entry.quickWins.length > 0 && (
                <div className="mt-4 space-y-1">
                  <p className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
                    Quick wins at the time
                  </p>
                  <ul className="list-inside list-disc space-y-1">
                    {entry.quickWins.map((w) => (
                      <li key={w} className="text-sm text-[var(--color-text-secondary)]">
                        {w}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {entry.eventsSince.length > 0 && (
                <div className="mt-4 space-y-1">
                  <p className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
                    What happened since the previous analysis
                  </p>
                  {entry.eventsSince.map((e) => (
                    <p key={e.id} className="text-sm text-[var(--color-text-secondary)]">
                      {e.summary}
                    </p>
                  ))}
                </div>
              )}

              {entry.version === history[0]?.version && (
                <div className="mt-4">
                  <Badge tone="accent">Current</Badge>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
