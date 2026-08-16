import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/session";
import { getCurrentOrganization, getMembershipFor } from "@/lib/org";
import { canManageWebhooks } from "@/lib/teams/permissions";
import { listWebhookEndpoints } from "@/lib/webhooks/service";
import { WebhooksSection } from "@/components/team/webhooks-section";
import { SplitHeading } from "@/components/motion/split-heading";

export default async function WebhooksSettingsPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/sign-in");

  const organization = await getCurrentOrganization(session.user.id);
  if (!organization) redirect("/sign-in");

  const membership = await getMembershipFor(session.user.id, organization.id);
  if (!membership) redirect("/sign-in");

  const endpoints = await listWebhookEndpoints(organization.id);

  return (
    <div className="animate-fade-in space-y-8">
      <div>
        <SplitHeading
          as="h1"
          text="Webhooks"
          className="text-2xl font-light tracking-tight text-[var(--color-text-primary)]"
        />
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Let your own tools react to what happens in Outrun.
        </p>
      </div>

      <WebhooksSection
        canManage={canManageWebhooks(membership.role)}
        initialEndpoints={endpoints.map((e) => ({
          id: e.id,
          url: e.url,
          enabled: e.enabled,
          createdAt: e.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
