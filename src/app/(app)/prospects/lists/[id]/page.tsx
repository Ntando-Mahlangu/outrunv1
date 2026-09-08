import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/session";
import { getCurrentOrganization } from "@/lib/org";
import { getLeadListWithCompanies } from "@/lib/prospects/lead-lists";
import { UserFacingError } from "@/lib/errors";
import { LeadListDetailClient } from "@/components/prospects/lead-list-detail-client";

export default async function LeadListDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getCurrentSession();
  if (!session) redirect("/sign-in");

  const organization = await getCurrentOrganization(session.user.id);
  if (!organization) redirect("/sign-in");

  const { id } = await params;

  let list;
  try {
    list = await getLeadListWithCompanies(organization.id, id);
  } catch (error) {
    if (error instanceof UserFacingError) redirect("/prospects/lists");
    throw error;
  }

  return (
    <LeadListDetailClient
      listId={list.id}
      initialName={list.name}
      initialCompanies={list.companies.map((entry) => entry.company)}
      calledCompanyIds={list.companies
        .filter((entry) => entry.company._count.callLogs > 0)
        .map((entry) => entry.companyId)}
    />
  );
}
