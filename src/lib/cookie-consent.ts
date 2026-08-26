export const COOKIE_CONSENT_COOKIE = "outrun_cookie_consent";
export const COOKIE_CONSENT_MAX_AGE_SECONDS = 180 * 24 * 60 * 60; // ~6 months

export type CookieConsent = "accepted" | "declined";

export function isCookieConsent(value: string | undefined): value is CookieConsent {
  return value === "accepted" || value === "declined";
}
