import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getCurrentSession } from "@/lib/session";
import { getCurrentOrganization } from "@/lib/org";
import { isEmailSendingConfigured } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import * as companyRepository from "@/lib/repositories/company-repository";
import { Card } from "@/components/ui/card";
import { ScoreBadge } from "@/components/prospects/score-badge";
import { ResearchPanel } from "@/components/prospects/research-panel";
import { OutreachPanel } from "@/components/prospects/outreach-panel";
import { CallScriptPanel } from "@/components/prospects/call-script-panel";
import { AddToListMenu } from "@/components/prospects/add-to-list-menu";
import { ContactsPanel } from "@/components/prospects/contacts-panel";
import type { CompanyResearchData } from "@/lib/prospects/research-schema";
import type { CallScriptData } from "@/lib/prospects/call-script-schema";
import { SplitHeading } from "@/components/motion/split-heading";

export default async function ProspectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getCurrentSession();
  if (!session) redirect("/sign-in");

  const organization = await getCurrentOrganization(session.user.id);
  if (!organization) redirect("/sign-in");

  const { id } = await params;
  const company = await companyRepository.findByIdForOrgWithMessages(organization.id, id);
  if (!company) notFound();

  const contacts = await prisma.contact.findMany({
    where: { companyId: id },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="animate-fade-in space-y-6">
      <Link href="/prospects" className="text-sm text-[var(--color-accent-text)] hover:underline">
        ← Back to search
      </Link>

      <div>
        <div className="flex items-start justify-between gap-4">
          <SplitHeading
            as="h1"
            text={company.name}
            className="text-2xl font-light tracking-tight text-[var(--color-text-primary)]"
          />
          <AddToListMenu companyId={company.id} />
        </div>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          {company.category ?? "Uncategorized"}
          {company.formattedAddress ? ` · ${company.formattedAddress}` : ""}
        </p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {company.website && (
            <a
              href={company.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-[var(--color-accent-text)] hover:underline"
            >
              {company.website}
            </a>
          )}
          {company.phone && (
            <a href={`tel:${company.phone}`} className="text-sm text-[var(--color-accent-text)] hover:underline">
              {company.phone}
            </a>
          )}
        </div>
        <div className="mt-3 flex gap-2">
          <ScoreBadge label="Fit" score={company.fitScore ?? 0} reason={company.fitReason} />
          <ScoreBadge
            label="Confidence"
            score={company.confidenceScore ?? 0}
            reason={company.confidenceReason}
          />
        </div>
      </div>

      <Card>
        <h2 className="mb-4 text-lg font-medium text-[var(--color-text-primary)]">Contacts</h2>
        <ContactsPanel companyId={company.id} initialContacts={contacts} />
      </Card>

      <Card>
        <h2 className="mb-4 text-lg font-medium text-[var(--color-text-primary)]">
          AI Research
        </h2>
        <ResearchPanel
          companyId={company.id}
          initialResearch={company.research as CompanyResearchData | null}
        />
      </Card>

      <Card>
        <h2 className="mb-4 text-lg font-medium text-[var(--color-text-primary)]">
          Outreach
        </h2>
        <OutreachPanel
          companyId={company.id}
          hasResearch={Boolean(company.research)}
          initialMessages={company.outreachMessages}
          initialContactEmail={company.contactEmail}
          emailConfigured={isEmailSendingConfigured()}
        />
      </Card>

      <Card>
        <h2 className="mb-4 text-lg font-medium text-[var(--color-text-primary)]">
          Cold Call Script
        </h2>
        <CallScriptPanel
          companyId={company.id}
          companyPhone={company.phone}
          hasResearch={Boolean(company.research)}
          initialCallScript={company.callScript as CallScriptData | null}
        />
      </Card>
    </div>
  );
}
