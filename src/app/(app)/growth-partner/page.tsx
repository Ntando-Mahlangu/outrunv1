import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentSession } from "@/lib/session";
import { getCurrentOrganization } from "@/lib/org";
import { prisma } from "@/lib/prisma";
import { ChatPanel } from "@/components/growth-partner/chat-panel";
import { RiskPanel } from "@/components/growth-partner/risk-panel";
import { WhatIfPanel } from "@/components/growth-partner/whatif-panel";
import { OpportunityFeedPanel } from "@/components/growth-partner/opportunity-feed-panel";
import { DecisionPanel } from "@/components/growth-partner/decision-panel";
import { getRisksAndOpportunities } from "@/lib/growth-partner/risks";
import { getOpportunityFeed } from "@/lib/growth-partner/opportunity-feed";
import { SplitHeading } from "@/components/motion/split-heading";

export default async function GrowthPartnerPage({
  searchParams,
}: {
  searchParams: Promise<{ ask?: string }>;
}) {
  const session = await getCurrentSession();
  if (!session) redirect("/sign-in");

  const organization = await getCurrentOrganization(session.user.id);
  if (!organization) redirect("/sign-in");

  const { ask } = await searchParams;

  const [history, signals, opportunities] = await Promise.all([
    prisma.chatMessage.findMany({
      where: { organizationId: organization.id },
      orderBy: { createdAt: "asc" },
    }),
    getRisksAndOpportunities(organization.id),
    getOpportunityFeed(organization.id),
  ]);

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <SplitHeading
            as="h1"
            text="Growth Partner"
            className="text-2xl font-light tracking-tight text-[var(--color-text-primary)]"
          />
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Grounded in everything Outrun knows about {organization.name}.
          </p>
        </div>
        <Link
          href="/growth-partner/reviews"
          className="mt-1 text-sm text-[var(--color-accent-text)] hover:underline"
        >
          Strategic Reviews →
        </Link>
      </div>

      <RiskPanel signals={signals} />

      <OpportunityFeedPanel items={opportunities} />

      <DecisionPanel />

      <WhatIfPanel />

      <ChatPanel
        initialMessages={history.map((m) => ({ role: m.role, content: m.content }))}
        autoAsk={ask}
      />
    </div>
  );
}
