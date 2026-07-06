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
