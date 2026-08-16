import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/session";
import { getCurrentOrganization, getUserMemberships } from "@/lib/org";
import { prisma } from "@/lib/prisma";
import { SidebarNav } from "@/components/dashboard/sidebar-nav";
import { SignOutButton } from "@/components/sign-out-button";
import { WorkspaceSwitcher } from "@/components/team/workspace-switcher";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { GlobalSearch } from "@/components/dashboard/global-search";
import { GlobalChatWidget } from "@/components/growth-partner/global-chat-widget";
import { Logo } from "@/components/brand/logo";
import { GenerativeLattice } from "@/components/motion/backgrounds";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getCurrentSession();
  if (!session) redirect("/sign-in");
  if (!session.user.emailVerified) redirect("/verify-email");

  const [organization, memberships] = await Promise.all([
    getCurrentOrganization(session.user.id),
    getUserMemberships(session.user.id),
  ]);

  const chatHistory = organization
    ? await prisma.chatMessage.findMany({
        where: { organizationId: organization.id },
        orderBy: { createdAt: "asc" },
        select: { role: true, content: true },
      })
    : [];

  return (
    <div className="relative min-h-screen bg-[var(--color-bg-primary)]">
      <div className="pointer-events-none fixed inset-0 z-0 opacity-40">
        <GenerativeLattice />
      </div>
      <header className="relative z-10 flex h-16 items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-bg-primary)] px-6">
        <Logo />
        <div className="flex items-center gap-4">
          {organization && <GlobalSearch />}
          {organization && memberships.length > 1 && (
            <WorkspaceSwitcher
              workspaces={memberships.map((m) => m.organization)}
              activeOrgId={organization.id}
            />
          )}
          {organization && <NotificationBell />}
          {organization && <GlobalChatWidget initialMessages={chatHistory} />}
          <span className="text-sm text-[var(--color-text-secondary)]">
            {session.user.name}
          </span>
        </div>
      </header>

      <div className="relative z-10 mx-auto flex max-w-6xl gap-8 px-6 py-8">
        <aside className="hidden w-56 shrink-0 space-y-6 sm:block">
          <SidebarNav />
          <div className="border-t border-[var(--color-border)] pt-4">
            <SignOutButton />
          </div>
        </aside>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
