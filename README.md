# PSFPREDICT

Cloudflare-first prediction app for the PSF community during the FIFA World Cup 2026 knockout stage.

## Runtime

- Frontend: Vite + React + TypeScript deployed to Cloudflare Pages.
- API: Hono + TypeScript deployed to Cloudflare Workers.
- Database: PostgreSQL accessed from the Worker with Drizzle ORM and Neon/serverless HTTP driver.
- Data source: ESPN Scoreboard hidden API.

## Environment variables

### Worker

Set these variables/secrets for the Cloudflare Worker:

```bash
wrangler secret put DATABASE_URL
wrangler secret put ADMIN_TOKEN
```

`DATABASE_URL` must be a PostgreSQL connection string compatible with Neon/serverless, for example:

```txt
postgresql://user:password@host/db?sslmode=require
```

`ADMIN_TOKEN` protects administrative endpoints such as `POST /api/ranking/recalculate`. Administrative calls must send it in the `x-admin-token` header.

The following non-secret vars are configured in `wrangler.toml`:

```txt
ESPN_SCOREBOARD_URL
ESPN_KNOCKOUT_DATES
ADMIN_EMAIL
```

### Frontend

Set this variable in Cloudflare Pages:

```txt
VITE_API_BASE_URL=https://api.psfes.space
```

The Vite frontend reads it at build time, so redeploy Pages after changing it.

## Database commands

Generate migrations from the Drizzle schema:

```bash
DATABASE_URL="postgresql://user:password@host/db?sslmode=require" npm run db:generate
```

Apply migrations:

```bash
DATABASE_URL="postgresql://user:password@host/db?sslmode=require" npm run db:migrate
```

The current schema lives in `drizzle/schema.ts` and includes participants, matches, predictions, and feed events.

## Local development

Install dependencies:

```bash
npm install
```

Run type checks:

```bash
npm run typecheck
```

Build the frontend:

```bash
npm run build
```

Run the Worker locally after creating `.dev.vars` with `DATABASE_URL`:

```bash
npm run dev:worker
```

Run the frontend locally:

```bash
npm run dev:web
```

Or run both together:

```bash
npm run dev
```

## Deploy

Deploy Worker:

```bash
npm run deploy:worker
```

Deploy frontend:

```bash
npm run deploy:web
```

Pre-deploy Worker dry run:

```bash
npx wrangler deploy --dry-run
```
