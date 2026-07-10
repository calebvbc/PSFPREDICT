import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from './lib/env';
import { healthRoute } from './routes/health';
import { syncRoute } from './routes/sync';
import { matchesRoute } from './routes/matches';
import { predictionsRoute } from './routes/predictions';
import { rankingRoute } from './routes/ranking';
import { syncKnockoutMatches } from './jobs/sync';

const app = new Hono<{ Bindings: Env }>();

const allowedCorsOrigins = [
  'https://app.psfes.space',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
];

const publicReadCors = cors({
  origin: allowedCorsOrigins,
  allowMethods: ['GET', 'HEAD', 'OPTIONS'],
  maxAge: 600,
});

const restrictedCors = cors({
  origin: allowedCorsOrigins,
  allowMethods: ['GET', 'HEAD', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type'],
  maxAge: 600,
});

app.use('/api/health', publicReadCors);
app.use('/api/matches', publicReadCors);
app.use('/api/matches/*/predictions', publicReadCors);
app.use('/api/participants/*', publicReadCors);
app.use('/api/ranking', publicReadCors);
app.use('/api/feed', publicReadCors);
app.use('/api/*', restrictedCors);
app.route('/api', healthRoute);
app.route('/api', syncRoute);
app.route('/api', matchesRoute);
app.route('/api', predictionsRoute);
app.route('/api', rankingRoute);

app.notFound((c) => c.json({ error: 'Not found' }, 404));

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(syncKnockoutMatches(env));
  },
};
