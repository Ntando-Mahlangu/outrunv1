import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/session";
import { getCurrentOrganization } from "@/lib/org";
import { getOpenOpportunities, getOpportunityHistory } from "@/lib/opportunities/queries";
import { OpportunityBoard } from "@/components/opportunities/opportunity-board";
import { SplitHeading } from "@/components/motion/split-heading";

export default async function OpportunitiesPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/sign-in");

  const organization = await getCurrentOrganization(session.user.id);
  if (!organization) redirect("/sign-in");

  const [open, history] = await Promise.all([
    getOpenOpportunities(organization.id),
    getOpportunityHistory(organization.id),
  ]);

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <SplitHeading
          as="h1"
          text="Opportunity Engine"
          className="text-2xl font-light tracking-tight text-[var(--color-text-primary)]"
        />
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Outrun is actively looking for ways to grow {organization.name} — every item below is a real,
          detected condition in your own data, not a suggestion pulled from thin air.
        </p>
      </div>

      <OpportunityBoard initialOpen={open} history={history} />
    </div>
  );
}
