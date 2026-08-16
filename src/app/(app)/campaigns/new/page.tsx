import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentSession } from "@/lib/session";
import { getCurrentOrganization } from "@/lib/org";
import { prisma } from "@/lib/prisma";
import { Card } from "@/components/ui/card";
import { NewCampaignForm } from "@/components/campaigns/new-campaign-form";
import * as companyRepository from "@/lib/repositories/company-repository";
import { getLeadListsWithResearchedCompaniesForOrg } from "@/lib/prospects/lead-lists";
import { isBrandVoice } from "@/lib/org/brand-voice";
import { SplitHeading } from "@/components/motion/split-heading";

export default async function NewCampaignPage({
  searchParams,
}: {
  searchParams: Promise<{ templateId?: string }>;
}) {
  const session = await getCurrentSession();
  if (!session) redirect("/sign-in");

  const organization = await getCurrentOrganization(session.user.id);
  if (!organization) redirect("/sign-in");

  const { templateId } = await searchParams;
  const COMPANY_LIMIT = 200;

  const [companies, researchedCount, leadLists, template] = await Promise.all([
    companyRepository.findResearchedForOrg(organization.id, { take: COMPANY_LIMIT }),
    companyRepository.countResearchedForOrg(organization.id),
    getLeadListsWithResearchedCompaniesForOrg(organization.id),
    templateId
      ? prisma.campaignTemplate.findFirst({
          where: { id: templateId, organizationId: organization.id },
        })
      : Promise.resolve(null),
  ]);

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <Link href="/campaigns" className="text-sm text-[var(--color-accent-text)] hover:underline">
          ← Campaigns
        </Link>
        <SplitHeading
          as="h1"
          text="Create Campaign"
          className="mt-2 text-2xl font-light tracking-tight text-[var(--color-text-primary)]"
        />
      </div>

      {companies.length === 0 ? (
        <Card>
          <p className="text-[var(--color-text-secondary)]">
            You need at least one researched prospect before building a
            campaign.{" "}
            <Link href="/prospects" className="text-[var(--color-accent-text)] hover:underline">
              Find and research some prospects first.
            </Link>
          </p>
        </Card>
      ) : (
        <>
          {researchedCount > COMPANY_LIMIT && (
            <p className="text-sm text-[var(--color-text-muted)]">
              Your Manual Selection and Custom Filters tabs show your top {COMPANY_LIMIT} researched
              prospects by Fit Score, out of {researchedCount} total. Use a Saved List to target a
              specific subset beyond that.
            </p>
          )}
          <NewCampaignForm
            companies={companies}
            leadLists={leadLists}
            brandVoice={isBrandVoice(organization.brandVoice) ? organization.brandVoice : null}
            initialValues={
              template
                ? { name: template.name, objective: template.objective, abTest: template.abTest }
                : undefined
            }
          />
        </>
      )}
    </div>
  );
}
