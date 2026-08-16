"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FormError } from "@/components/ui/form-error";

function VerifyEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = authClient.useSession();
  const email = session?.user.email ?? searchParams.get("email") ?? "";

  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [resendStatus, setResendStatus] = useState<"idle" | "sending" | "sent">("idle");

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsVerifying(true);

    const { error: verifyError } = await authClient.emailOtp.verifyEmail({ email, otp: code });

    setIsVerifying(false);

    if (verifyError) {
      setError(
        verifyError.message ?? "That code didn't work. Check it and try again.",
      );
      return;
    }

    // autoSignInAfterVerification (src/lib/auth.ts) already set a session
    // cookie server-side — carry the user on the same as the old
    // link-callback flow did (see sign-up page's callbackURL).
    router.push("/welcome");
  }

  async function handleResend() {
    setError(null);
    setResendStatus("sending");

    const { error: resendError } = await authClient.emailOtp.sendVerificationOtp({
      email,
      type: "email-verification",
    });

    if (resendError) {
      setError(resendError.message ?? "We couldn't resend that code. Please try again.");
      setResendStatus("idle");
      return;
    }
    setResendStatus("sent");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--color-bg-primary)] px-4 py-16">
      <Card className="w-full max-w-md animate-fade-in text-center">
        <CardHeader>
          <CardTitle>Confirm your email.</CardTitle>
          <CardDescription>
            {email ? (
              <>
                We sent a 6-digit code to{" "}
                <span className="text-[var(--color-text-primary)]">{email}</span>. Enter it below
                to finish setting up Outrun.
              </>
            ) : (
              "Check your inbox for a 6-digit code to finish setting up Outrun."
            )}
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleVerify} className="space-y-4 text-left">
          <FormError message={error} />

          <div className="space-y-2">
            <Label htmlFor="otp-code">6-digit code</Label>
            <Input
              id="otp-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              required
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="123456"
            />
          </div>

          <Button type="submit" className="w-full" disabled={isVerifying || !email || !code}>
            {isVerifying ? "Verifying…" : "Verify"}
          </Button>
        </form>

        {resendStatus === "sent" ? (
          <p className="mt-4 text-sm text-[var(--color-text-secondary)]">
            Sent again — check your inbox.
          </p>
        ) : (
          <Button
            variant="secondary"
            className="mt-4 w-full"
            disabled={resendStatus === "sending" || !email}
            onClick={handleResend}
          >
            {resendStatus === "sending" ? "Sending…" : "Resend code"}
          </Button>
        )}

        <p className="mt-8 text-sm text-[var(--color-text-secondary)]">
          Wrong account?{" "}
          <Link href="/sign-in" className="text-[var(--color-accent-text)] hover:underline">
            Sign in
          </Link>
        </p>
      </Card>
    </main>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailContent />
    </Suspense>
  );
}
