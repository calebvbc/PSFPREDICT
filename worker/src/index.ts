import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Env } from './lib/env';
import { healthRoute } from './routes/health';
import { syncRoute } from './routes/sync';
import { syncKnockoutMatches } from './jobs/sync';

const app = new Hono<{ Bindings: Env }>();

app.use('/api/*', cors());
app.route('/api', healthRoute);
app.route('/api', syncRoute);

app.notFound((c) => c.json({ error: 'Not found' }, 404));

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(syncKnockoutMatches(env));
  },
};
