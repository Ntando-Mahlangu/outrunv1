"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormError } from "@/components/ui/form-error";

// docs/outrun/03 "AUTHENTICATION — Magic Link". A password-less
// alternative shown on both sign-in and sign-up — Better Auth creates a
// new account automatically the first time an unrecognized email uses
// this, so one form genuinely covers both flows.
export function MagicLinkPanel({
  initialEmail,
  disabled,
}: {
  initialEmail: string;
  disabled?: boolean;
}) {
  const [email, setEmail] = useState(initialEmail);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    // `name` is only used the first time this email signs in (a brand
    // new account) — Better Auth ignores it for an existing user, so
    // it's safe to always send even though we can't tell in advance
    // which case this is.
    const { error: linkError } = await authClient.signIn.magicLink({
      email,
      name: name.trim() || undefined,
      callbackURL: "/welcome",
    });

    setIsSubmitting(false);

    if (linkError) {
      setError(linkError.message ?? "We couldn't send that link. Please try again.");
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <p className="text-center text-sm text-[var(--color-text-secondary)]">
        Check <span className="text-[var(--color-text-primary)]">{email}</span> for a
        sign-in link. It expires in 5 minutes.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormError message={error} />
      <div className="space-y-2">
        <Label htmlFor="magic-link-name">Name (only needed if you&apos;re new)</Label>
        <Input
          id="magic-link-name"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="magic-link-email">Business email</Label>
        <Input
          id="magic-link-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <Button type="submit" variant="secondary" className="w-full" disabled={isSubmitting || disabled}>
        {isSubmitting ? "Sending…" : "Email me a sign-in link"}
      </Button>
    </form>
  );
}
