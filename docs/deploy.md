# Deploy Cloudflare

## Frontend

The frontend is a Vite static build deployed to Cloudflare Pages from `dist/`.

```bash
npm run deploy:web
```

`web/public/_redirects` keeps the SPA routes (`/`, `/palpites`, `/ranking`, `/feed`, `/health`) working on direct navigation and forwards `/api/*` to the production Worker at `https://api.psfes.space`.


### Build version

The frontend exposes a discreet build identifier in the footer and on `/health`. Vite resolves the value in this order:

1. `VITE_APP_VERSION`
2. `VITE_COMMIT_SHA`
3. `CF_PAGES_COMMIT_SHA`
4. `local`

Cloudflare Pages provides `CF_PAGES_COMMIT_SHA` during Git-based builds. If the project uses direct uploads or another CI flow, set `VITE_COMMIT_SHA` (or `VITE_APP_VERSION`) in the Pages build environment before running `npm run build`.

## Worker API

The API, ESPN sync cron, ranking recalculation, feed generation, and prediction endpoints are deployed with Wrangler.

### Worker custom domain

`wrangler.toml` declares `api.psfes.space` as the Worker custom domain. Deploying the Worker with Wrangler should attach the API to that hostname as long as the Cloudflare zone is available in the account.

```bash
npm run deploy:worker
```


### Prediction save rate limit

`POST /api/predictions` uses a Cloudflare KV namespace bound as `RATE_LIMIT_KV` to allow one save every 5 seconds per client IP. The Worker stores only a hashed IP key and a short reset timestamp; non-save endpoints such as `GET /api/matches`, `GET /api/ranking`, and `GET /api/feed` do not call this limiter.

Create the namespace once, then add the generated IDs to `wrangler.toml` before deploying:

```bash
wrangler kv namespace create RATE_LIMIT_KV
wrangler kv namespace create RATE_LIMIT_KV --preview
```

```toml
[[kv_namespaces]]
binding = "RATE_LIMIT_KV"
id = "<production namespace id>"
preview_id = "<preview namespace id>"
```

### Worker secrets

Administrative endpoints require `ADMIN_TOKEN` in the `x-admin-token` request header. Configure it as a Cloudflare Worker secret before deploying or rotating admin access:

```bash
wrangler secret put ADMIN_TOKEN
```

## Pre-deploy check

```bash
npm run typecheck
npm run build
npm run lint
npx wrangler deploy --dry-run
```

## Post-deploy check

1. Open `https://app.psfes.space/health`.
2. Confirm the displayed `Build` value matches the commit SHA deployed by Cloudflare Pages or the expected `VITE_APP_VERSION`.
3. If the footer is used instead of `/health`, confirm only the shortened build appears discreetly and the main UI remains unchanged.
4. Smoke test `/`, `/palpites`, `/ranking`, and `/feed` after confirming the build identifier.

## Production URLs

- Frontend: `https://app.psfes.space`
- API: `https://api.psfes.space`

The Pages redirect rule proxies `/api/*` to `https://api.psfes.space/api/:splat` so the React app can call same-origin `/api/...` paths in production.
