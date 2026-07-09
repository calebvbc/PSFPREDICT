# PSFPREDICT v1 Architecture

A V1 is Cloudflare-first and keeps TypeScript as the only mandatory language across the frontend, Worker API, shared parsing, scoring, and database schema.

## Runtime split

- `web/`: Vite + React static frontend for Cloudflare Pages.
- `worker/`: Hono API for Cloudflare Workers, including public endpoints, admin endpoints, rate limiting, and Scheduled sync jobs.
- `shared/`: framework-agnostic TypeScript for ESPN parsing, scoring, validators, and domain types.
- `drizzle/`: PostgreSQL schema and migrations managed by Drizzle ORM.

## Data source

The ESPN Scoreboard endpoint is called with `dates=20260704-20260719`, `limit=100`, `lang=pt`, and `region=br` to cover the knockout V1 range in one request.

## V1 auth recommendation

The preferred admin protection for the fastest Cloudflare deploy is Cloudflare Access in front of `/admin`. If Cloudflare Access is not available in the deployment account, a signed-cookie admin session can be added inside the Worker without changing the public participant model.
