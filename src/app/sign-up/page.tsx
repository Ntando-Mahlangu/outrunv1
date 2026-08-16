"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { FormError } from "@/components/ui/form-error";
import { GoogleIcon } from "@/components/icons/google-icon";
import { MicrosoftIcon } from "@/components/icons/microsoft-icon";
import { MagicLinkPanel } from "@/components/auth/magic-link-panel";

export default function SignUpPage() {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [microsoftEnabled, setMicrosoftEnabled] = useState(false);
  const [useMagicLink, setUseMagicLink] = useState(false);

  useEffect(() => {
    fetch("/api/auth/config")
      .then((res) => res.json())
      .then((data) => {
        setGoogleEnabled(Boolean(data.googleEnabled));
        setMicrosoftEnabled(Boolean(data.microsoftEnabled));
      })
      .catch(() => {
        setGoogleEnabled(false);
        setMicrosoftEnabled(false);
      });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const { error: signUpError } = await authClient.signUp.email({
      name: `${firstName.trim()} ${lastName.trim()}`.trim(),
      email,
      password,
      callbackURL: "/welcome",
    });

    setIsSubmitting(false);

    if (signUpError) {
      setError(
        signUpError.message ??
          "We couldn't create your account. Please check your details and try again.",
      );
      return;
    }

    // requireEmailVerification means sign-up doesn't create a session —
    // the user lands here after clicking the emailed link instead (see
    // src/lib/auth.ts's autoSignInAfterVerification).
    router.push(`/verify-email?email=${encodeURIComponent(email)}`);
  }

  async function handleGoogle() {
    await authClient.signIn.social({ provider: "google", callbackURL: "/welcome" });
  }

  async function handleMicrosoft() {
    await authClient.signIn.oauth2({ providerId: "microsoft", callbackURL: "/welcome" });
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--color-bg-primary)] px-4 py-16">
      <Card className="w-full max-w-md animate-fade-in">
        <CardHeader>
          <CardTitle>Let&apos;s Build Your Growth Engine.</CardTitle>
          <CardDescription>It only takes a few minutes.</CardDescription>
        </CardHeader>

        {useMagicLink ? (
          <MagicLinkPanel initialEmail={email} />
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormError message={error} />

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First name</Label>
                <Input
                  id="firstName"
                  autoComplete="given-name"
                  required
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last name</Label>
                <Input
                  id="lastName"
                  autoComplete="family-name"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Business email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <PasswordInput
                id="password"
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? "Creating your account…" : "Continue"}
            </Button>
          </form>
        )}

        <button
          type="button"
          onClick={() => setUseMagicLink((v) => !v)}
          className="mt-4 w-full text-center text-xs text-[var(--color-text-muted)] hover:text-[var(--color-accent-text)]"
        >
          {useMagicLink ? "Use a password instead" : "Sign up with an email link instead"}
        </button>

        {(googleEnabled || microsoftEnabled) && (
          <>
            <div className="my-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-[var(--color-border)]" />
              <span className="text-xs text-[var(--color-text-muted)]">OR</span>
              <div className="h-px flex-1 bg-[var(--color-border)]" />
            </div>

            <div className="space-y-3">
              {googleEnabled && (
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full"
                  onClick={handleGoogle}
                >
                  <GoogleIcon className="size-4" />
                  Continue with Google
                </Button>
              )}
              {microsoftEnabled && (
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full"
                  onClick={handleMicrosoft}
                >
                  <MicrosoftIcon className="size-4" />
                  Continue with Microsoft
                </Button>
              )}
            </div>
          </>
        )}

        <p className="mt-8 text-center text-sm text-[var(--color-text-secondary)]">
          Already have an account?{" "}
          <Link href="/sign-in" className="text-[var(--color-accent-text)] underline">
            Sign In
          </Link>
        </p>
      </Card>
    </main>
  );
}
