import { Hono } from 'hono';
import type { Env } from '../lib/env';
import { syncKnockoutMatches } from '../jobs/sync';
import { createDb } from '../lib/db';
import { createRepository } from '../lib/repository';

export const syncRoute = new Hono<{ Bindings: Env }>()
  .get('/sync/preview', async (c) => {
      // The frontend uses /api/sync/preview directly on sync calls currently.
      const result = await syncKnockoutMatches(c.env);
      return c.json(result);
  });
