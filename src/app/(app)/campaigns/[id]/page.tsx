import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentSession } from "@/lib/session";
import { getCurrentOrganization, getMembershipFor } from "@/lib/org";
import { prisma } from "@/lib/prisma";
import { isEmailSendingConfigured } from "@/lib/email";
import { canManageCampaigns } from "@/lib/teams/permissions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CampaignSendPanel } from "@/components/campaigns/campaign-send-panel";
import { AutonomousSendPanel } from "@/components/campaigns/autonomous-send-panel";
import { CampaignExportPanel } from "@/components/campaigns/campaign-export-panel";
import { SaveAsTemplateButton } from "@/components/campaigns/save-as-template-button";
import { CampaignWarningsPanel } from "@/components/campaigns/campaign-warnings-panel";
import { CampaignActions } from "@/components/campaigns/campaign-actions";
import { SplitHeading } from "@/components/motion/split-heading";

const STATUS_TONE = {
  DRAFT: "low",
  READY: "high",
  PAUSED: "medium",
  COMPLETED: "accent",
} as const;

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getCurrentSession();
  if (!session) redirect("/sign-in");

  const organization = await getCurrentOrganization(session.user.id);
  if (!organization) redirect("/sign-in");

  const membership = await getMembershipFor(session.user.id, organization.id);
  if (!membership) redirect("/sign-in");

  const { id } = await params;
  const campaign = await prisma.campaign.findFirst({
    where: { id, organizationId: organization.id },
    include: { messages: { include: { company: true }, orderBy: { createdAt: "asc" } } },
  });
  if (!campaign) notFound();

  const uniqueCompanies = new Map(campaign.messages.map((m) => [m.company.id, m.company]));
  const companiesWithoutScriptCount = Array.from(uniqueCompanies.values()).filter(
    (c) => c.research && !c.callScript,
  ).length;

  return (
    <div className="animate-fade-in space-y-6">
      <Link href="/campaigns" className="text-sm text-[var(--color-accent-text)] hover:underline">
        ← Campaigns
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div>
          <SplitHeading
            as="h1"
            text={campaign.name}
            className="text-2xl font-light tracking-tight text-[var(--color-text-primary)]"
          />
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{campaign.objective}</p>
        </div>
        <div className="flex items-center gap-3">
          <SaveAsTemplateButton
            defaultName={campaign.name}
            objective={campaign.objective}
            abTest={campaign.messages.some((m) => m.variantLabel !== null)}
          />
          <Badge tone={STATUS_TONE[campaign.status]}>{campaign.status}</Badge>
          <CampaignActions
            campaignId={campaign.id}
            status={campaign.status}
            canManage={canManageCampaigns(membership.role)}
          />
        </div>
      </div>

      {campaign.strategyRationale && (
        <Card>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-medium text-[var(--color-text-primary)]">
              AI Campaign Strategy
            </h2>
            {campaign.strategyConfidence && (
              <Badge
                tone={
                  campaign.strategyConfidence === "High"
                    ? "high"
                    : campaign.strategyConfidence === "Medium"
                      ? "medium"
                      : "low"
                }
              >
                {campaign.strategyConfidence} confidence
              </Badge>
            )}
          </div>
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            {campaign.strategyRationale}
          </p>
          <dl className="mt-3 space-y-1 text-sm">
            {campaign.strategyChannel && (
              <div className="flex gap-2">
                <dt className="text-[var(--color-text-muted)]">Channel:</dt>
                <dd className="text-[var(--color-text-primary)]">{campaign.strategyChannel}</dd>
              </div>
            )}
            {campaign.audienceSource && (
              <div className="flex gap-2">
                <dt className="text-[var(--color-text-muted)]">Audience source:</dt>
                <dd className="text-[var(--color-text-primary)]">{campaign.audienceSource}</dd>
              </div>
            )}
          </dl>
          {Array.isArray(campaign.strategyStrengths) && campaign.strategyStrengths.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-medium text-[var(--color-text-muted)]">Expected strengths</p>
              <ul className="mt-1 list-inside list-disc text-sm text-[var(--color-text-secondary)]">
                {(campaign.strategyStrengths as string[]).map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
          )}
          {Array.isArray(campaign.strategyWeaknesses) && campaign.strategyWeaknesses.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-medium text-[var(--color-text-muted)]">Potential weaknesses</p>
              <ul className="mt-1 list-inside list-disc text-sm text-[var(--color-text-secondary)]">
                {(campaign.strategyWeaknesses as string[]).map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </div>
          )}
        </Card>
      )}

      <CampaignWarningsPanel messages={campaign.messages} />

      {campaign.status === "READY" && (
        <AutonomousSendPanel
          campaignId={campaign.id}
          enabled={campaign.autonomousSendEnabled}
          dailyLimit={campaign.autonomousDailyLimit}
          lastRunAt={campaign.lastAutonomousSendAt}
          canManage={canManageCampaigns(membership.role)}
          emailConfigured={isEmailSendingConfigured()}
        />
      )}

      <CampaignSendPanel
        campaignId={campaign.id}
        initialMessages={campaign.messages}
        emailConfigured={isEmailSendingConfigured()}
      />

      <CampaignExportPanel
        campaignId={campaign.id}
        companiesWithoutScriptCount={companiesWithoutScriptCount}
      />
    </div>
  );
}
