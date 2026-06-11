# Deployment record

The API, landing page, and docs site are live in production on
Vercel. This file is the written record of the platform-level
protections and the operational invariants every deploy must keep.

## API protection

### Live WAF configuration (verified 2026-06-10)

Rate limiting is enforced at the platform layer (Vercel Firewall),
not in application code:

| Scope | Limit | Action |
|---|---:|---|
| `/api/*` | 60 requests / 10 seconds / IP | `429 Too Many Requests` |

This is the rule the public docs promise
(`apps/docs/src/content/docs/limitations.mdx`, "Rate limits"). If
the dashboard rule ever changes, update that page and this table in
the same commit — this file is the written record that keeps docs
and platform from drifting.

**Single-rule constraint:** the Vercel free plan allows exactly one
custom WAF rule; additional rules require a paid plan. A stricter
dedicated rule for `/api/*/raw/*` is therefore **deferred** — raw
endpoints share the global `/api/*` budget. Revisit only if the
project moves to a paid plan for other reasons, or a documented
abuse signal shows raw routes need their own ceiling. `/api/openapi.json`
also shares the global rule; its long CDN TTL keeps origin traffic
negligible.

### Standing invariants

These hold in production today and must survive every deploy:

- Platform-level rate limiting for `/api/*` stays enabled (see above).
- Application-level Redis/Upstash rate limiting stays out of v1 unless platform limits prove insufficient.
- API error responses use `Cache-Control: no-store` (covered by `tests/responses.test.ts`).
- List endpoints clamp `limit` to the documented maximum of 200.

Tune limits from real traffic, not from imagined traffic.

## Billing / spend safety

Ongoing monitoring:

- Keep spend notifications / alerts enabled in Vercel.
- Check project usage after any distribution push (forum posts, blog mentions, creator coverage).
- Watch function invocations and bandwidth.
