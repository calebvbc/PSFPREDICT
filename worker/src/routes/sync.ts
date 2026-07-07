import { Hono } from 'hono';
import type { Env } from '../lib/env';
import { adminAuth } from '../middleware/admin-auth';
import { syncKnockoutMatches } from '../jobs/sync';

export const syncRoute = new Hono<{ Bindings: Env }>()
  .use('/sync/*', adminAuth)
  .use('/resync/*', adminAuth)
  .get('/sync/preview', async (c) => c.json(await syncKnockoutMatches(c.env)));
