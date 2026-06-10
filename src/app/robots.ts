import type { MetadataRoute } from "next";

// Crawler directives for the landing site.
//
// Non-production deployments (Vercel preview/development) disallow all crawling.
// This is only a hint — the authoritative noindex protection for previews is the
// `X-Robots-Tag: noindex` header set in next.config.ts, which also covers URLs
// that crawlers already know about from other sources.
export default function robots(): MetadataRoute.Robots {
  if (process.env.VERCEL_ENV !== "production") {
    return {
      rules: {
        userAgent: "*",
        disallow: "/",
      },
    };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: "https://l2api.dev/sitemap.xml",
    host: "https://l2api.dev",
  };
}
