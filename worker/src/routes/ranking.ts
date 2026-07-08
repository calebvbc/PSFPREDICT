import { Hono } from 'hono';
import type { Env } from '../lib/env';
import { createDb } from '../lib/db';
import { createRepository } from '../lib/repository';

export const rankingRoute = new Hono<{ Bindings: Env }>()
  .get('/ranking', async (c) => {
    const db = createDb(c.env);
    const repo = createRepository(db);
    return c.json({ ranking: await repo.getRanking() });
  })
  .post('/ranking/recalculate', async (c) => {
    const db = createDb(c.env);
    const repo = createRepository(db);
    return c.json({ ranking: await repo.forceRecalculateRanking() });
  })
  .get('/feed', async (c) => {
    const db = createDb(c.env);
    const repo = createRepository(db);
    const limit = Number(c.req.query('limit') ?? 30);
    return c.json({ events: await repo.getFeedEvents(Number.isFinite(limit) ? limit : 30) });
  });
