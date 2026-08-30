import Link from "next/link";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export function SecondWowSection({
  companiesFound,
  companiesResearched,
  outreachCount,
  campaignId,
}: {
  companiesFound: number;
  companiesResearched: number;
  outreachCount: number;
  campaignId: string;
}) {
  return (
    <Card interactive className="animate-fade-in border-[var(--color-accent)]/40 print:hidden">
      <p className="text-xs uppercase tracking-wide text-[var(--color-accent-text)]">
        While you were reading this
      </p>
      <h2 className="mt-2 text-xl font-light text-[var(--color-text-primary)]">
        Outrun has already worked.
      </h2>

      <div className="mt-6 grid grid-cols-2 gap-6 sm:grid-cols-4">
        <div>
          <p className="text-2xl font-light text-[var(--color-text-primary)]">{companiesFound}</p>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">Qualified Businesses Found</p>
        </div>
        <div>
          <p className="text-2xl font-light text-[var(--color-text-primary)]">{companiesResearched}</p>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">Companies Researched</p>
        </div>
        <div>
          <p className="text-2xl font-light text-[var(--color-text-primary)]">{outreachCount}</p>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">Prepared Outreach</p>
        </div>
        <div>
          <p className="text-2xl font-light text-[var(--color-text-primary)]">Ready</p>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">Campaign Status</p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link href={`/campaigns/${campaignId}`} className={cn(buttonVariants({ size: "lg" }))}>
          Review Campaign
        </Link>
        <Link href="/dashboard" className={cn(buttonVariants({ variant: "secondary", size: "lg" }))}>
          Continue to Dashboard
        </Link>
      </div>
    </Card>
  );
}
