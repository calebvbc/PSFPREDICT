# Deploy Cloudflare

## Frontend

The frontend is a Vite static build deployed to Cloudflare Pages from `dist/`.

```bash
npm run deploy:web
```

`web/public/_redirects` keeps the SPA routes (`/`, `/palpites`, `/ranking`, `/feed`) working on direct navigation and forwards `/api/*` to the production Worker at `https://api.psfes.space`.

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

## Production URLs

- Frontend: `https://app.psfes.space`
- API: `https://api.psfes.space`

The Pages redirect rule proxies `/api/*` to `https://api.psfes.space/api/:splat` so the React app can call same-origin `/api/...` paths in production.
