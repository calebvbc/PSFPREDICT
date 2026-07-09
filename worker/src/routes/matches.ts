import { Hono } from 'hono';
import type { Env } from '../lib/env';
import { syncKnockoutMatches } from '../jobs/sync';
import { listMatches } from '../lib/db-store';

export const matchesRoute = new Hono<{ Bindings: Env }>()
  .get('/matches', async (c) => {
    const cached = await listMatches(c.env);
    if (cached.length > 0) return c.json({ matches: cached, source: 'database' });

    const synced = await syncKnockoutMatches(c.env);
    return c.json({ matches: synced.matches, source: 'espn' });
  });
