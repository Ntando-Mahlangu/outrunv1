import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentSession } from "@/lib/session";
import { getCurrentOrganization, getMembershipFor } from "@/lib/org";
import { canManageCampaigns } from "@/lib/teams/permissions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { analyzeOutreachPatterns } from "@/lib/campaigns/improvement-loop";
import * as campaignRepository from "@/lib/repositories/campaign-repository";
import { ImprovementLoopPanel } from "@/components/campaigns/improvement-loop-panel";
import { getOpportunityFeed } from "@/lib/growth-partner/opportunity-feed";
import { OpportunityFeedPanel } from "@/components/growth-partner/opportunity-feed-panel";
import { CampaignActions } from "@/components/campaigns/campaign-actions";
import { SplitHeading } from "@/components/motion/split-heading";
import { Magnetic } from "@/components/motion/magnetic";

const STATUS_TONE = {
  DRAFT: "low",
  READY: "high",
  PAUSED: "medium",
  COMPLETED: "accent",
} as const;

const PAGE_SIZE = 20;

export default async function CampaignsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const session = await getCurrentSession();
  if (!session) redirect("/sign-in");

  const organization = await getCurrentOrganization(session.user.id);
  if (!organization) redirect("/sign-in");

  const membership = await getMembershipFor(session.user.id, organization.id);
  if (!membership) redirect("/sign-in");
  const canManage = canManageCampaigns(membership.role);

  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number.parseInt(pageParam ?? "1", 10) || 1);

  const [campaigns, totalCount, improvementLoopResult, opportunities] = await Promise.all([
    campaignRepository.findManyByOrgPaginated(organization.id, {
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    campaignRepository.countForOrg(organization.id),
    analyzeOutreachPatterns(organization.id),
    getOpportunityFeed(organization.id),
  ]);
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <SplitHeading
            as="h1"
            text="Campaigns"
            className="text-2xl font-light tracking-tight text-[var(--color-text-primary)]"
          />
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Batch outreach across a chosen audience of researched prospects.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/campaigns/library"
            className="text-sm text-[var(--color-accent-text)] hover:underline"
          >
            Campaign Library
          </Link>
          <Magnetic strength={0.15}>
            <Link href="/campaigns/new" className={cn(buttonVariants())}>
              Create Campaign
            </Link>
          </Magnetic>
        </div>
      </div>

      {totalCount === 0 ? (
        <Card interactive className="text-center">
          <p className="text-[var(--color-text-secondary)]">
            You haven&apos;t created your first campaign yet. Research a few
            prospects, then build a campaign around them.
          </p>
          <Link href="/campaigns/new" className={cn(buttonVariants(), "mt-4 inline-flex")}>
            Create Campaign
          </Link>
        </Card>
      ) : (
        <div className="space-y-4">
          {campaigns.map((campaign) => (
            <Card key={campaign.id} interactive>
              <div className="flex items-center justify-between gap-4">
                <Link href={`/campaigns/${campaign.id}`} className="min-w-0">
                  <p className="font-medium text-[var(--color-text-primary)] hover:underline">
                    {campaign.name}
                  </p>
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    {campaign.objective}
                  </p>
                </Link>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-sm text-[var(--color-text-muted)]">
                    {campaign._count.messages} message
                    {campaign._count.messages === 1 ? "" : "s"}
                  </span>
                  <Badge tone={STATUS_TONE[campaign.status]}>{campaign.status}</Badge>
                  <CampaignActions
                    campaignId={campaign.id}
                    status={campaign.status}
                    canManage={canManage}
                  />
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <Link
            href={`/campaigns?page=${page - 1}`}
            aria-disabled={page <= 1}
            className={cn(
              "text-[var(--color-accent-text)] hover:underline",
              page <= 1 && "pointer-events-none opacity-40",
            )}
          >
            ← Previous
          </Link>
          <span className="text-[var(--color-text-muted)]">
            Page {page} of {totalPages}
          </span>
          <Link
            href={`/campaigns?page=${page + 1}`}
            aria-disabled={page >= totalPages}
            className={cn(
              "text-[var(--color-accent-text)] hover:underline",
              page >= totalPages && "pointer-events-none opacity-40",
            )}
          >
            Next →
          </Link>
        </div>
      )}

      <div>
        <div className="mb-4">
          <h2 className="text-lg font-medium text-[var(--color-text-primary)]">
            Autonomous Growth Mode
          </h2>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Outrun continuously looks for opportunities like these. Nothing is ever launched
            automatically — review and act on any of them yourself.
          </p>
        </div>
        <OpportunityFeedPanel items={opportunities} />
      </div>

      <ImprovementLoopPanel initialResult={improvementLoopResult} />
    </div>
  );
}
