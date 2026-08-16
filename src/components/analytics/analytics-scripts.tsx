import Script from "next/script";

// Google Analytics 4 + (optionally) Google Ads conversion linking, loaded
// site-wide so the funnel from landing page through paywall is actually
// visible — see docs/outrun/15 "OBSERVABILITY". Renders nothing when
// NEXT_PUBLIC_GA_MEASUREMENT_ID isn't set, so local/staging environments
// stay silent by default; src/proxy.ts only loosens the CSP for these
// Google domains when this same env var is present.
export function AnalyticsScripts({ nonce }: { nonce: string }) {
  const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  if (!measurementId) return null;

  const adsId = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
        strategy="afterInteractive"
        nonce={nonce}
      />
      <Script id="ga4-init" strategy="afterInteractive" nonce={nonce}>
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){ window.dataLayer.push(arguments); }
          window.gtag = gtag;
          gtag('js', new Date());
          gtag('config', '${measurementId}');
          ${adsId ? `gtag('config', '${adsId}');` : ""}
        `}
      </Script>
    </>
  );
}
