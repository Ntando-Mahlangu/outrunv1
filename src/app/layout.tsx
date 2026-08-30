import type { Metadata } from "next";
import { headers, cookies } from "next/headers";
import { Manrope, Bricolage_Grotesque, JetBrains_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { AnalyticsScripts } from "@/components/analytics/analytics-scripts";
import { CookieConsentBanner } from "@/components/legal/cookie-consent-banner";
import { COOKIE_CONSENT_COOKIE, isCookieConsent } from "@/lib/cookie-consent";
import "./globals.css";

// Real, self-hosted typefaces (docs/outrun/01) — replaces the previous
// "Outrun Sans" alias, which had no actual font file behind it and fell
// straight through to the browser's default UI font everywhere. Exposed as
// CSS variables and consumed by globals.css's --font-sans/--font-display/
// --font-mono tokens, so every page picks these up with no per-component
// changes needed.
const bodyFont = Manrope({
  subsets: ["latin"],
  variable: "--next-font-sans",
  display: "swap",
});
const displayFont = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--next-font-display",
  display: "swap",
});
const monoFont = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--next-font-mono",
  display: "swap",
});

const SITE_URL = "https://outrunv1.online";
const TITLE = "Outrun — Your AI Growth Partner";
const DESCRIPTION =
  "Outrun understands your business, finds your best opportunities, builds your growth strategy and prepares campaigns before you even start working.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
    siteName: "Outrun",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // docs/outrun/15 "SECURITY BY DEFAULT" — CSP. Reading the per-request
  // nonce src/proxy.ts generated (rather than statically rendering this
  // layout) is what lets Next.js apply that same nonce to the script tags
  // it injects itself; the nonce would otherwise go stale under caching.
  const requestHeaders = await headers();
  const nonce = requestHeaders.get("x-nonce") ?? "";
  const locale = await getLocale();
  const messages = await getMessages();

  // docs/outrun/15 "LEGAL — cookie consent." AnalyticsScripts (Google
  // Analytics + Ads) only ever renders once this cookie says "accepted" —
  // "Decline" in the banner below is an actual block on the request that
  // would set tracking cookies, not just a UI preference nobody enforces.
  const consentValue = (await cookies()).get(COOKIE_CONSENT_COOKIE)?.value;
  const consent = isCookieConsent(consentValue) ? consentValue : null;

  return (
    <html
      lang={locale}
      className={`${bodyFont.variable} ${displayFont.variable} ${monoFont.variable}`}
    >
      <body>
        <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>
        {consent === "accepted" && <AnalyticsScripts nonce={nonce} />}
        <CookieConsentBanner initialConsent={consent} />
      </body>
    </html>
  );
}
