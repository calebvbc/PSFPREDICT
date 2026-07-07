import { Hono } from 'hono';
import { syncKnockoutMatches } from '../jobs/sync';
import { createDb } from '../lib/db';
import type { Env } from '../lib/env';
import { createRepository } from '../lib/repository';

export const matchesRoute = new Hono<{ Bindings: Env }>()
  .get('/matches', async (c) => {
    const cached = await createRepository(createDb(c.env)).listMatches();
    if (cached.length > 0) return c.json({ matches: cached, source: 'cache' });

    const synced = await syncKnockoutMatches(c.env);
    return c.json({ matches: synced.matches, source: 'espn' });
  });
