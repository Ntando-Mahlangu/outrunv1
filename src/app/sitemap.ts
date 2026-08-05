import type { MetadataRoute } from "next";

const SITE_URL = "https://outrunv1.online";

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ["", "/sign-up", "/sign-in", "/terms", "/privacy", "/security"];

  return routes.map((route) => ({
    url: `${SITE_URL}${route}`,
    lastModified: new Date(),
    changeFrequency: route === "" ? "weekly" : "monthly",
    priority: route === "" ? 1 : 0.5,
  }));
}
