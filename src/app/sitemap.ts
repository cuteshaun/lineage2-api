import type { MetadataRoute } from "next";

// Sitemap for the landing site only. Docs and explorer live on separate
// subdomains/builds with their own sitemaps; API routes are intentionally
// excluded. Static lastModified (no Date.now()) keeps output deterministic.
const LAST_MODIFIED = new Date("2026-06-10");

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://l2api.dev/",
      lastModified: LAST_MODIFIED,
      changeFrequency: "monthly",
      priority: 1.0,
    },
    {
      url: "https://l2api.dev/about",
      lastModified: LAST_MODIFIED,
      changeFrequency: "yearly",
      priority: 0.6,
    },
  ];
}
