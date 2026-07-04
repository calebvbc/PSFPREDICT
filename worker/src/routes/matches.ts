import { Hono } from 'hono';
import type { Env } from '../lib/env';
import { syncKnockoutMatches } from '../jobs/sync';
import { listMatches } from '../lib/memory-store';

export const matchesRoute = new Hono<{ Bindings: Env }>()
  .get('/matches', async (c) => {
    const cached = listMatches();
    if (cached.length > 0) return c.json({ matches: cached, source: 'cache' });

    const synced = await syncKnockoutMatches(c.env);
    return c.json({ matches: synced.matches, source: 'espn' });
  });
