import { Hono } from 'hono';
import type { Env } from '../lib/env';
import { adminAuth } from '../middleware/admin-auth';
import { forceRecalculateRanking, getFeedEvents, getRanking } from '../lib/memory-store';

export const rankingRoute = new Hono<{ Bindings: Env }>()
  .get('/ranking', (c) => c.json({ ranking: getRanking() }))
  .post('/ranking/recalculate', adminAuth, (c) => c.json({ ranking: forceRecalculateRanking() }))
  .get('/feed', (c) => {
    const limit = Number(c.req.query('limit') ?? 30);
    return c.json({ events: getFeedEvents(Number.isFinite(limit) ? limit : 30) });
  });
