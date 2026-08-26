"use client";

// Reopens the cookie banner (mounted site-wide in src/app/layout.tsx)
// without a page reload, so a decision made once isn't permanent — GDPR
// and POPIA both expect an easy way to change a cookie choice later, not
// just a one-time prompt.
export function ManageCookiesLink() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event("outrun:reopen-cookie-banner"))}
      className="text-[var(--color-accent-text)] underline"
    >
      Manage cookie preferences
    </button>
  );
}
