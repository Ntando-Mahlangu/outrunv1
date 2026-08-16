import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/session";
import { getCurrentOrganization, getMembershipFor } from "@/lib/org";
import { canManageCampaigns } from "@/lib/teams/permissions";
import { Card } from "@/components/ui/card";
import { BrandVoicePanel } from "@/components/settings/brand-voice-panel";
import { isBrandVoice } from "@/lib/org/brand-voice";
import { SplitHeading } from "@/components/motion/split-heading";

export default async function BrandVoiceSettingsPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/sign-in");

  const organization = await getCurrentOrganization(session.user.id);
  if (!organization) redirect("/sign-in");

  const membership = await getMembershipFor(session.user.id, organization.id);
  if (!membership) redirect("/sign-in");

  return (
    <div className="animate-fade-in space-y-8">
      <div>
        <SplitHeading
          as="h1"
          text="Brand Voice"
          className="text-2xl font-light tracking-tight text-[var(--color-text-primary)]"
        />
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Choose the communication style Outrun&apos;s AI should use for you.
        </p>
      </div>

      <Card>
        <BrandVoicePanel
          initialVoice={isBrandVoice(organization.brandVoice) ? organization.brandVoice : null}
          canManage={canManageCampaigns(membership.role)}
        />
      </Card>
    </div>
  );
}
