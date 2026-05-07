# Deployment checklist

This project is not safe to expose publicly until the following checks are complete.

## API protection

Before attaching a public domain or sharing the deployment URL:

- Enable platform-level rate limiting for `/api/*`.
- Enable stricter platform-level rate limiting for `/api/*/raw/*`.
- Keep application-level Redis/Upstash rate limiting out of v1 unless platform limits are not enough.
- Confirm API error responses use `Cache-Control: no-store`.
- Confirm list endpoints clamp `limit` to the documented maximum.

Recommended starting Vercel WAF rules:

| Scope | Suggested limit | Action |
|---|---:|---|
| `/api/*` | 60 requests / minute / IP | Deny or challenge |
| `/api/*/raw/*` | 20 requests / minute / IP | Deny |
| `/api/openapi.json` | Exempt or generous limit | Cache heavily |

Tune these after real traffic.

## Billing / spend safety

Before public launch:

- Enable spend notifications / alerts in Vercel.
- Check project usage after first public share.
- Watch function invocations and bandwidth.
