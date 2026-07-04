import { Hono } from 'hono';
import type { Env } from '../lib/env';
import { fetchKnockoutMatches } from '../lib/espn';

export const matchesRoute = new Hono<{ Bindings: Env }>()
  .get('/matches', async (c) => c.json({ matches: await fetchKnockoutMatches(c.env) }));
