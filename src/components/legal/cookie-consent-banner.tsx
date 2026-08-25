"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  COOKIE_CONSENT_COOKIE,
  COOKIE_CONSENT_MAX_AGE_SECONDS,
  type CookieConsent,
} from "@/lib/cookie-consent";

// docs/outrun/15 "LEGAL — cookie consent." The server (src/app/layout.tsx)
// reads the same cookie to decide whether to render AnalyticsScripts at
// all, so "Decline" is a real block, not a cosmetic one — Google Analytics
// never loads until this cookie says "accepted". initialConsent is passed
// from that same server read so the banner never flashes on a repeat visit
// before hydration catches up.
export function CookieConsentBanner({ initialConsent }: { initialConsent: CookieConsent | null }) {
  const router = useRouter();
  const [consent, setConsent] = useState(initialConsent);

  // A "Manage cookie preferences" link elsewhere on the site (the legal
  // pages) dispatches this to reopen the banner without a page reload.
  useEffect(() => {
    function reopen() {
      setConsent(null);
    }
    window.addEventListener("outrun:reopen-cookie-banner", reopen);
    return () => window.removeEventListener("outrun:reopen-cookie-banner", reopen);
  }, []);

  function choose(value: CookieConsent) {
    document.cookie = `${COOKIE_CONSENT_COOKIE}=${value}; path=/; max-age=${COOKIE_CONSENT_MAX_AGE_SECONDS}; SameSite=Lax`;
    setConsent(value);
    // Server components (AnalyticsScripts' gate in layout.tsx) need to
    // re-read the cookie to actually start or stay stopped.
    router.refresh();
  }

  if (consent) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie preferences"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-4 py-4 shadow-[0_-8px_30px_-10px_rgba(0,0,0,0.5)]"
    >
      <div className="mx-auto flex max-w-4xl flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-[var(--color-text-secondary)]">
          We use essential cookies to run Outrun, and — only if you accept — analytics cookies to
          understand how the product is used.{" "}
          <Link href="/privacy#cookies" className="text-[var(--color-accent-text)] underline">
            Learn more
          </Link>
          .
        </p>
        <div className="flex shrink-0 gap-2">
          <Button variant="secondary" className="h-9 px-4 text-sm" onClick={() => choose("declined")}>
            Decline
          </Button>
          <Button className="h-9 px-4 text-sm" onClick={() => choose("accepted")}>
            Accept
          </Button>
        </div>
      </div>
    </div>
  );
}
