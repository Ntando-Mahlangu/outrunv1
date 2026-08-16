import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/session";
import { Card } from "@/components/ui/card";
import { SessionsPanel } from "@/components/settings/sessions-panel";
import { MfaPanel } from "@/components/settings/mfa-panel";
import { SplitHeading } from "@/components/motion/split-heading";

export default async function SecuritySettingsPage() {
  const session = await getCurrentSession();
  if (!session) redirect("/sign-in");

  return (
    <div className="animate-fade-in space-y-8">
      <div>
        <SplitHeading
          as="h1"
          text="Security"
          className="text-2xl font-light tracking-tight text-[var(--color-text-primary)]"
        />
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Manage how you sign in and where you&apos;re signed in.
        </p>
      </div>

      <Card>
        <h2 className="mb-4 text-lg font-medium text-[var(--color-text-primary)]">
          Two-Factor Authentication
        </h2>
        <MfaPanel
          initiallyEnabled={Boolean(
            (session.user as { twoFactorEnabled?: boolean }).twoFactorEnabled,
          )}
        />
      </Card>

      <Card>
        <h2 className="mb-4 text-lg font-medium text-[var(--color-text-primary)]">
          Active Sessions
        </h2>
        <SessionsPanel currentToken={session.session.token} />
      </Card>
    </div>
  );
}
