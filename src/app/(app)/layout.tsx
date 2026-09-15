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
    <div className="relative min-h-screen bg-[var(--color-bg-primary)] print:bg-white">
      <div className="pointer-events-none fixed inset-0 z-0 opacity-40 print:hidden">
        <GenerativeLattice />
      </div>
      {/* "Liquid glass" pass — soft, fixed ambient colour behind the
          persistent app shell, so the translucent/blurred header, sidebar,
          and cards throughout the app have real colour to tint from
          rather than blurring a flat, nearly-black backdrop into more
          flat near-black. Plain radial gradients rather than
          LiquidMesh's blend-mode blobs, which read as barely-there
          against a background this dark. */}
      <div
        className="pointer-events-none fixed inset-0 z-0 print:hidden"
        style={{
          background:
            "radial-gradient(1100px circle at 12% -10%, color-mix(in srgb, var(--color-accent) 32%, transparent), transparent 60%)," +
            "radial-gradient(900px circle at 100% 15%, color-mix(in srgb, var(--color-accent-2) 26%, transparent), transparent 55%)," +
            "radial-gradient(1000px circle at 25% 105%, color-mix(in srgb, var(--color-accent) 20%, transparent), transparent 60%)",
        }}
      />
      {/* z-20, not z-10 like the content row below — a pre-existing stacking
          bug this glass pass surfaced: with equal z-index, DOM order alone
          decided paint order, so the page content (painted after the
          header) actually rendered on top of anything from the header
          (the notification/search/chat dropdowns) that overflowed past
          the header's own 64px height into the content area below. Those
          dropdowns need to reliably win regardless of how far they extend. */}
      <header className="glass-sheen relative z-20 flex h-16 items-center justify-between border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-6 backdrop-blur-2xl print:hidden">
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

      {/* docs/outrun/05 Growth Blueprint export prints/PDFs this main
          column — print:block/max-w-none/p-0 drop the sidebar's layout
          constraints so the exported document isn't squeezed into the
          in-app content width. */}
      <div className="relative z-10 mx-auto flex max-w-6xl gap-8 px-6 py-8 print:block print:max-w-none print:gap-0 print:p-0">
        <aside className="hidden w-56 shrink-0 self-start sm:block print:hidden">
          <div className="glass-sheen space-y-6 rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-card)] p-4 shadow-[var(--shadow-glass)] backdrop-blur-2xl">
            <SidebarNav />
            <div className="border-t border-[var(--color-border)] pt-4">
              <SignOutButton />
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1 print:w-full">{children}</main>
      </div>
    </div>
  );
}
