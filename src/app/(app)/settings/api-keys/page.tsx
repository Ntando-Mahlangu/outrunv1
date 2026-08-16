import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/session";
import { getCurrentOrganization, getMembershipFor } from "@/lib/org";
import { canManageApiKeys } from "@/lib/teams/permissions";
import { isFeatureEnabled, FEATURE_FLAGS } from "@/lib/billing/feature-flags";
import { listApiKeys } from "@/lib/api-keys/service";
import { ApiKeysSection } from "@/components/team/api-keys-section";
import { SplitHeading } from "@/components/motion/split-heading";

export default async function ApiKeysSettingsPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/sign-in");

  const organization = await getCurrentOrganization(session.user.id);
  if (!organization) redirect("/sign-in");

  const membership = await getMembershipFor(session.user.id, organization.id);
  if (!membership) redirect("/sign-in");

  const isEnabled = isFeatureEnabled(organization.planTier, FEATURE_FLAGS.API_ACCESS, organization.id);
  const keys = isEnabled ? await listApiKeys(organization.id) : [];

  return (
    <div className="animate-fade-in space-y-8">
      <div>
        <SplitHeading
          as="h1"
          text="API Keys"
          className="text-2xl font-light tracking-tight text-[var(--color-text-primary)]"
        />
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Programmatic, read-only access to your Outrun data.
        </p>
      </div>

      <ApiKeysSection
        canManage={canManageApiKeys(membership.role)}
        isEnabled={isEnabled}
        initialKeys={keys.map((k) => ({
          id: k.id,
          name: k.name,
          keyPrefix: k.keyPrefix,
          createdAt: k.createdAt.toISOString(),
          lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
          revokedAt: k.revokedAt?.toISOString() ?? null,
        }))}
      />
    </div>
  );
}
