"use client";

// Thin client-side wrapper around the gtag.js global that
// src/components/analytics/analytics-scripts.tsx installs. Every call is a
// no-op when analytics isn't configured (no NEXT_PUBLIC_GA_MEASUREMENT_ID)
// or hasn't loaded yet, so feature code never needs to guard on whether
// tracking is present — same "fail closed, never break the product" pattern
// used for the other optional integrations in this codebase.

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

export function trackEvent(name: string, params?: Record<string, unknown>) {
  if (typeof window === "undefined" || typeof window.gtag !== "function") return;
  window.gtag("event", name, params);
}

// Fires the Google Ads conversion action for a completed sign-up, in
// addition to the GA4 `sign_up` event. Both env vars are optional — set
// only the Ads conversion ID/label if you want Google Ads (rather than
// GA4) to see the conversion directly; see docs/outrun/15.
export function trackSignUpConversion() {
  trackEvent("sign_up", { method: "email" });

  const adsId = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID;
  const label = process.env.NEXT_PUBLIC_GOOGLE_ADS_SIGNUP_LABEL;
  if (adsId && label) {
    trackEvent("conversion", { send_to: `${adsId}/${label}` });
  }
}
