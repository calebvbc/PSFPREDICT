# Deploy Cloudflare

## Frontend

The frontend is a Vite static build deployed to Cloudflare Pages from `dist/`.

```bash
npm run deploy:web
```

`web/public/_redirects` keeps the SPA routes (`/`, `/palpites`, `/ranking`, `/feed`) working on direct navigation and forwards `/api/*` to the Worker.

## Worker API

The API, ESPN sync cron, ranking recalculation, feed generation, and prediction endpoints are deployed with Wrangler.

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
