"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
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
import { TwoFactorChallenge } from "@/components/auth/two-factor-challenge";

export default function SignInPage() {
  const router = useRouter();
  const t = useTranslations("SignIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [googleEnabled, setGoogleEnabled] = useState(false);
  const [microsoftEnabled, setMicrosoftEnabled] = useState(false);
  const [useMagicLink, setUseMagicLink] = useState(false);
  const [needsTwoFactor, setNeedsTwoFactor] = useState(false);

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

    const { data, error: signInError } = await authClient.signIn.email({
      email,
      password,
      rememberMe,
    });

    setIsSubmitting(false);

    if (signInError) {
      setError(signInError.message ?? t("defaultError"));
      return;
    }

    // Better Auth's twoFactor plugin swaps the usual { token, user } sign-in
    // response for this shape when the account has 2FA enabled — its type
    // isn't threaded through signIn.email's generic result, so this reads
    // the field off the runtime response rather than the inferred type.
    if ((data as { twoFactorRedirect?: boolean } | null)?.twoFactorRedirect) {
      setNeedsTwoFactor(true);
      return;
    }

    router.push("/welcome");
  }

  async function handleGoogle() {
    await authClient.signIn.social({ provider: "google", callbackURL: "/welcome" });
  }

  async function handleMicrosoft() {
    await authClient.signIn.oauth2({ providerId: "microsoft", callbackURL: "/welcome" });
  }

  if (needsTwoFactor) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--color-bg-primary)] px-4 py-16">
        <Card className="w-full max-w-md animate-fade-in">
          <CardHeader>
            <CardTitle>{t("twoFactorTitle")}</CardTitle>
            <CardDescription>{t("twoFactorDescription")}</CardDescription>
          </CardHeader>
          <TwoFactorChallenge onVerified={() => router.push("/welcome")} />
        </Card>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--color-bg-primary)] px-4 py-16">
      <Card className="w-full max-w-md animate-fade-in">
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
          <CardDescription>{t("description")}</CardDescription>
        </CardHeader>

        {useMagicLink ? (
          <MagicLinkPanel initialEmail={email} />
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <FormError message={error} />

            <div className="space-y-2">
              <Label htmlFor="email">{t("emailLabel")}</Label>
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
              <div className="flex items-center justify-between">
                <Label htmlFor="password">{t("passwordLabel")}</Label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-accent-text)]"
                >
                  {t("forgotPassword")}
                </Link>
              </div>
              <PasswordInput
                id="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <label className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="size-4 rounded border-[var(--color-border)] bg-[var(--color-bg-secondary)]"
              />
              {t("rememberMe")}
            </label>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? t("submitting") : t("submit")}
            </Button>
          </form>
        )}

        <button
          type="button"
          onClick={() => setUseMagicLink((v) => !v)}
          className="mt-4 w-full text-center text-xs text-[var(--color-text-muted)] hover:text-[var(--color-accent-text)]"
        >
          {useMagicLink ? t("usePassword") : t("useMagicLink")}
        </button>

        {(googleEnabled || microsoftEnabled) && (
          <>
            <div className="my-6 flex items-center gap-3">
              <div className="h-px flex-1 bg-[var(--color-border)]" />
              <span className="text-xs text-[var(--color-text-muted)]">{t("or")}</span>
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
                  {t("continueWithGoogle")}
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
                  {t("continueWithMicrosoft")}
                </Button>
              )}
            </div>
          </>
        )}

        <p className="mt-8 text-center text-sm text-[var(--color-text-secondary)]">
          {t("newToOutrun")}{" "}
          <Link href="/sign-up" className="text-[var(--color-accent-text)] underline">
            {t("startFree")}
          </Link>
        </p>
      </Card>
    </main>
  );
}
