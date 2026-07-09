import { Hono } from 'hono';
import type { Env } from '../lib/env';
import { syncKnockoutMatches } from '../jobs/sync';

export const syncRoute = new Hono<{ Bindings: Env }>()
  .get('/sync/preview', async (c) => c.json(await syncKnockoutMatches(c.env)));
