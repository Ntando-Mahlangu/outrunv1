import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The "CEO Agent" persona was renamed to "AI Growth Partner" — keep old
  // bookmarks/links to its page routes alive by redirecting to the new
  // ones. Permanent (308) since the rename is final, not a temporary move.
  async redirects() {
    return [
      {
        source: "/ceo-agent",
        destination: "/growth-partner",
        permanent: true,
      },
      {
        source: "/ceo-agent/reviews",
        destination: "/growth-partner/reviews",
        permanent: true,
      },
      {
        source: "/ceo-agent/reviews/:id",
        destination: "/growth-partner/reviews/:id",
        permanent: true,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
