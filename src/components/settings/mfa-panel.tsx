"use client";

import { useState } from "react";
import QRCode from "qrcode";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { FormError } from "@/components/ui/form-error";
import { Badge } from "@/components/ui/badge";

type Stage =
  | "overview"
  | "enable-password"
  | "verify-setup"
  | "disable-password"
  | "regenerate-password"
  | "regenerate-result";

// docs/outrun/15 "AUTHENTICATION SECURITY — Optional MFA". Enrollment is a
// three-step dance against Better Auth's twoFactor plugin: enable() (needs
// the password, returns a fresh secret + backup codes but leaves the account
// unprotected) → scan the QR / save the codes → verifyTotp() (no password;
// proves the app was actually set up correctly before twoFactorEnabled
// flips true). Disabling and regenerating codes both re-require the
// password since they're destructive to the current factor.
export function MfaPanel({ initiallyEnabled }: { initiallyEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initiallyEnabled);
  const [stage, setStage] = useState<Stage>("overview");
  const [password, setPassword] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [manualKey, setManualKey] = useState<string | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function resetToOverview() {
    setStage("overview");
    setPassword("");
    setQrDataUrl(null);
    setManualKey(null);
    setBackupCodes(null);
    setCode("");
    setError(null);
  }

  async function handleEnable(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const { data, error: enableError } = await authClient.twoFactor.enable({
      password,
      issuer: "Outrun",
    });

    setIsSubmitting(false);

    if (enableError || !data) {
      setError(
        enableError?.message ?? "We couldn't start setup. Check your password and try again.",
      );
      return;
    }

    setPassword("");
    setBackupCodes(data.backupCodes);
    const secret = /[?&]secret=([^&]+)/.exec(data.totpURI)?.[1];
    setManualKey(secret ? decodeURIComponent(secret) : null);
    setQrDataUrl(await QRCode.toDataURL(data.totpURI));
    setStage("verify-setup");
  }

  async function handleVerifySetup(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const { error: verifyError } = await authClient.twoFactor.verifyTotp({ code });

    setIsSubmitting(false);

    if (verifyError) {
      setError(verifyError.message ?? "That code didn't match. Check the time on your device and try again.");
      return;
    }

    setEnabled(true);
    setStage("overview");
    setQrDataUrl(null);
    setManualKey(null);
    setCode("");
  }

  async function handleDisable(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const { error: disableError } = await authClient.twoFactor.disable({ password });

    setIsSubmitting(false);

    if (disableError) {
      setError(
        disableError.message ?? "We couldn't turn this off. Check your password and try again.",
      );
      return;
    }

    setEnabled(false);
    resetToOverview();
  }

  async function handleRegenerateBackupCodes(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const { data, error: regenError } = await authClient.twoFactor.generateBackupCodes({
      password,
    });

    setIsSubmitting(false);

    if (regenError || !data) {
      setError(
        regenError?.message ?? "We couldn't generate new codes. Check your password and try again.",
      );
      return;
    }

    setPassword("");
    setBackupCodes(data.backupCodes);
    setStage("regenerate-result");
  }

  if (stage === "enable-password") {
    return (
      <form onSubmit={handleEnable} className="space-y-4">
        <FormError message={error} />
        <div className="space-y-2">
          <Label htmlFor="mfa-enable-password">Confirm your password</Label>
          <PasswordInput
            id="mfa-enable-password"
            autoComplete="current-password"
            autoFocus
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div className="flex gap-3">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Starting…" : "Continue"}
          </Button>
          <Button type="button" variant="ghost" onClick={resetToOverview}>
            Cancel
          </Button>
        </div>
      </form>
    );
  }

  if (stage === "verify-setup") {
    return (
      <form onSubmit={handleVerifySetup} className="space-y-4">
        <FormError message={error} />

        <div className="space-y-3">
          <p className="text-sm text-[var(--color-text-secondary)]">
            Scan this QR code with your authenticator app (Google Authenticator, 1Password,
            Authy…), or enter the key manually.
          </p>
          {qrDataUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qrDataUrl}
              alt="QR code to scan with your authenticator app"
              className="size-40 rounded-[var(--radius-md)] bg-white p-2"
            />
          )}
          {manualKey && (
            <p className="break-all rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-2 font-mono text-xs text-[var(--color-text-primary)]">
              {manualKey}
            </p>
          )}
        </div>

        {backupCodes && (
          <div className="space-y-2">
            <p className="text-sm text-[var(--color-text-secondary)]">
              Save these backup codes somewhere safe. Each one can be used once if you lose
              access to your authenticator app.
            </p>
            <ul className="grid grid-cols-2 gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-3 font-mono text-xs text-[var(--color-text-primary)]">
              {backupCodes.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="mfa-verify-code">Enter the 6-digit code to confirm setup</Label>
          <Input
            id="mfa-verify-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="123456"
          />
        </div>

        <div className="flex gap-3">
          <Button type="submit" disabled={isSubmitting || !code}>
            {isSubmitting ? "Verifying…" : "Turn on two-factor authentication"}
          </Button>
          <Button type="button" variant="ghost" onClick={resetToOverview}>
            Cancel
          </Button>
        </div>
      </form>
    );
  }

  if (stage === "disable-password") {
    return (
      <form onSubmit={handleDisable} className="space-y-4">
        <FormError message={error} />
        <div className="space-y-2">
          <Label htmlFor="mfa-disable-password">Confirm your password</Label>
          <PasswordInput
            id="mfa-disable-password"
            autoComplete="current-password"
            autoFocus
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div className="flex gap-3">
          <Button type="submit" variant="secondary" disabled={isSubmitting}>
            {isSubmitting ? "Turning off…" : "Turn off two-factor authentication"}
          </Button>
          <Button type="button" variant="ghost" onClick={resetToOverview}>
            Cancel
          </Button>
        </div>
      </form>
    );
  }

  if (stage === "regenerate-password") {
    return (
      <form onSubmit={handleRegenerateBackupCodes} className="space-y-4">
        <FormError message={error} />
        <p className="text-sm text-[var(--color-text-secondary)]">
          This replaces your existing backup codes — old ones will stop working.
        </p>
        <div className="space-y-2">
          <Label htmlFor="mfa-regen-password">Confirm your password</Label>
          <PasswordInput
            id="mfa-regen-password"
            autoComplete="current-password"
            autoFocus
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div className="flex gap-3">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Generating…" : "Generate new codes"}
          </Button>
          <Button type="button" variant="ghost" onClick={resetToOverview}>
            Cancel
          </Button>
        </div>
      </form>
    );
  }

  if (stage === "regenerate-result") {
    return (
      <div className="space-y-4">
        <p className="text-sm text-[var(--color-text-secondary)]">
          Save these new backup codes somewhere safe — your old codes no longer work.
        </p>
        <ul className="grid grid-cols-2 gap-2 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-secondary)] p-3 font-mono text-xs text-[var(--color-text-primary)]">
          {backupCodes?.map((c) => <li key={c}>{c}</li>)}
        </ul>
        <Button type="button" onClick={resetToOverview}>
          Done
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <FormError message={error} />
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-[var(--color-text-primary)]">
            {enabled
              ? "Two-factor authentication is on."
              : "Add an authenticator app for an extra layer of security when you sign in."}
          </p>
          {enabled && <Badge tone="high">Enabled</Badge>}
        </div>
        {enabled ? (
          <div className="flex shrink-0 gap-3">
            <Button variant="secondary" onClick={() => setStage("regenerate-password")}>
              New backup codes
            </Button>
            <Button variant="ghost" onClick={() => setStage("disable-password")}>
              Turn off
            </Button>
          </div>
        ) : (
          <Button className="shrink-0" onClick={() => setStage("enable-password")}>
            Enable
          </Button>
        )}
      </div>
    </div>
  );
}
