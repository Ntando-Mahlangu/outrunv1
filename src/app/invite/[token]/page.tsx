import Link from "next/link";
import { getCurrentSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { InviteAcceptPanel } from "@/components/team/invite-accept-panel";

export default async function InviteAcceptPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const session = await getCurrentSession();

  const invitation = await prisma.invitation.findUnique({
    where: { token },
    include: { organization: { select: { name: true } } },
  });

  const isExpired = invitation
    ? invitation.status === "EXPIRED" ||
      (invitation.status === "PENDING" && invitation.expiresAt < new Date())
    : false;

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--color-bg-primary)] px-6">
      <Card className="w-full max-w-md">
        {!invitation ? (
          <CardHeader>
            <CardTitle>Invitation not found</CardTitle>
            <CardDescription>
              This invitation link isn&apos;t valid. Ask whoever invited you to send a new one.
            </CardDescription>
          </CardHeader>
        ) : invitation.status === "CANCELLED" ? (
          <CardHeader>
            <CardTitle>Invitation cancelled</CardTitle>
            <CardDescription>
              This invitation to {invitation.organization.name} was cancelled by the workspace
              owner.
            </CardDescription>
          </CardHeader>
        ) : isExpired ? (
          <CardHeader>
            <CardTitle>Invitation expired</CardTitle>
            <CardDescription>
              This invitation to {invitation.organization.name} has expired. Ask the workspace
              owner to resend it.
            </CardDescription>
          </CardHeader>
        ) : invitation.status === "ACCEPTED" ? (
          <CardHeader>
            <CardTitle>Already joined</CardTitle>
            <CardDescription>
              You&apos;ve already joined {invitation.organization.name}.
            </CardDescription>
            <Link href="/dashboard" className="inline-block text-sm text-[var(--color-accent-text)] hover:underline">
              Go to Dashboard
            </Link>
          </CardHeader>
        ) : (
          <>
            <CardHeader>
              <CardTitle>Join {invitation.organization.name}</CardTitle>
              <CardDescription>
                You&apos;ve been invited to join {invitation.organization.name} on Outrun as a{" "}
                {invitation.role.toLowerCase()}.
              </CardDescription>
            </CardHeader>

            {!session ? (
              <div className="space-y-3 text-sm text-[var(--color-text-secondary)]">
                <p>Sign in or create an account with {invitation.email}, then come back to this link to accept.</p>
                <div className="flex gap-3">
                  <Link href="/sign-in" className="text-[var(--color-accent-text)] hover:underline">
                    Sign in
                  </Link>
                  <Link href="/sign-up" className="text-[var(--color-accent-text)] hover:underline">
                    Create an account
                  </Link>
                </div>
              </div>
            ) : (
              <InviteAcceptPanel token={token} invitedEmail={invitation.email} sessionEmail={session.user.email} />
            )}
          </>
        )}
      </Card>
    </div>
  );
}
