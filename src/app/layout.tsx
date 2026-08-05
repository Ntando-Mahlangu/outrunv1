import type { Metadata } from "next";
import { headers } from "next/headers";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { AnalyticsScripts } from "@/components/analytics/analytics-scripts";
import "./globals.css";

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

  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>
        <AnalyticsScripts nonce={nonce} />
      </body>
    </html>
  );
}
