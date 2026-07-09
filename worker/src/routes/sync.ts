import { Hono } from 'hono';
import type { Env } from '../lib/env';
import { syncKnockoutMatches } from '../jobs/sync';
import { adminAuth } from '../middleware/admin-auth';

export const syncRoute = new Hono<{ Bindings: Env }>()
  .get('/sync/preview', adminAuth, async (c) => c.json(await syncKnockoutMatches(c.env)));
