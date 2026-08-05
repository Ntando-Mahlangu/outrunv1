import type { MetadataRoute } from "next";

const SITE_URL = "https://outrunv1.online";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Authenticated app surfaces have nothing for a crawler to index and
      // every one of them already redirects an unauthenticated crawler to
      // /sign-in anyway (src/proxy.ts) — disallowing them keeps crawl budget
      // on the marketing/legal pages that actually matter for SEO.
      disallow: [
        "/api/",
        "/dashboard",
        "/onboarding",
        "/blueprint",
        "/prospects",
        "/campaigns",
        "/memory",
        "/growth-partner",
        "/seo",
        "/settings",
        "/billing",
        "/welcome",
        "/invite",
        "/share",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
