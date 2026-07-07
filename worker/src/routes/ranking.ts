import { Hono } from 'hono';
import { createDb } from '../lib/db';
import type { Env } from '../lib/env';
import { createRepository } from '../lib/repository';
import { adminAuth } from '../middleware/admin-auth';

export const rankingRoute = new Hono<{ Bindings: Env }>()
  .get('/ranking', async (c) => c.json({ ranking: await createRepository(createDb(c.env)).getRanking() }))
  .post('/ranking/recalculate', adminAuth, async (c) => c.json({ ranking: await createRepository(createDb(c.env)).forceRecalculateRanking() }))
  .get('/feed', async (c) => {
    const limit = Number(c.req.query('limit') ?? 30);
    return c.json({ events: await createRepository(createDb(c.env)).getFeedEvents(Number.isFinite(limit) ? limit : 30) });
  });
