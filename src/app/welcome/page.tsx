import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { SignOutButton } from "@/components/sign-out-button";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { SignupConversion } from "@/components/analytics/signup-conversion";

export default async function WelcomePage() {
  const session = await getCurrentSession();
  if (!session) redirect("/sign-in");

  const membership = await prisma.membership.findFirst({
    where: { userId: session.user.id },
    include: {
      organization: { include: { businessProfile: { select: { id: true } } } },
    },
    orderBy: { createdAt: "asc" },
  });

  // Whether onboarding is done, not whether it happened to produce a
  // Blueprint — those are separate outcomes since generation runs in the
  // background and can still be pending, or have failed, once the user is
  // already in the app (see src/app/onboarding/page.tsx and
  // src/components/dashboard/blueprint-pending.tsx). Checking for a
  // Blueprint here instead sent a user who'd already answered every
  // onboarding question straight back through all of them again on their
  // next login, any time generation hadn't succeeded yet.
  if (membership?.organization.businessProfile) {
    redirect("/dashboard");
  }

  const firstName = session.user.name.split(" ")[0];

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--color-bg-primary)] px-4 py-16">
      <SignupConversion userId={session.user.id} />
      <Card className="w-full max-w-lg animate-fade-in">
        <CardHeader>
          <CardTitle>Welcome, {firstName}.</CardTitle>
          <CardDescription>
            Today we&apos;re going to learn about your business and build your
            first AI Growth Blueprint. This usually takes less than five
            minutes.
          </CardDescription>
        </CardHeader>

        <div className="space-y-4">
          <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-[var(--color-text-muted)]">
              Workspace
            </p>
            <p className="text-sm text-[var(--color-text-primary)]">
              {membership?.organization.name ?? "Your workspace"}
            </p>
          </div>

          <Link href="/onboarding" className={cn(buttonVariants(), "w-full")}>
            Get Started
          </Link>

          <SignOutButton />
        </div>
      </Card>
    </main>
  );
}
