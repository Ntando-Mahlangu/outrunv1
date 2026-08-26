"use client";

import { useEffect } from "react";

// Rendered once from /welcome (the one page every sign-up path lands on —
// see src/app/api/auth/accept-terms/route.ts for why /welcome is the right
// interception point). Fires once per browser session per user, same
// de-dupe pattern as SignupConversion, since a plain effect would otherwise
// re-POST on every visit to /welcome (e.g. someone who abandons onboarding
// and comes back).
export function TermsAcceptanceRecorder({ userId }: { userId: string }) {
  useEffect(() => {
    const key = `outrun_terms_recorded_${userId}`;
    if (window.localStorage.getItem(key)) return;
    window.localStorage.setItem(key, "1");
    fetch("/api/auth/accept-terms", { method: "POST" }).catch(() => {});
  }, [userId]);

  return null;
}
