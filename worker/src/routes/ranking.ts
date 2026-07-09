import { Hono } from 'hono';
import type { Env } from '../lib/env';
import { forceRecalculateRanking, getFeedEvents, getRanking } from '../lib/db-store';
import { adminAuth } from '../middleware/admin-auth';

export const rankingRoute = new Hono<{ Bindings: Env }>()
  .get('/ranking', async (c) => c.json({ ranking: await getRanking(c.env) }))
  .post('/ranking/recalculate', adminAuth, async (c) => c.json({ ranking: await forceRecalculateRanking(c.env) }))
  .get('/feed', async (c) => {
    const limit = Number(c.req.query('limit') ?? 30);
    return c.json({ events: await getFeedEvents(c.env, Number.isFinite(limit) ? limit : 30) });
  });
