import { Hono } from 'hono';
import type { Env } from '../lib/env';
import { createDb } from '../lib/db';
import { createRepository } from '../lib/repository';

export const matchesRoute = new Hono<{ Bindings: Env }>()
  .get('/matches', async (c) => {
    const db = createDb(c.env);
    const repo = createRepository(db);

    try {
      const matches = await repo.listMatches();
      return c.json({ matches, source: 'db' });
    } catch (error) {
      return c.json({
        error: error instanceof Error ? error.message : 'Não foi possível buscar as partidas.',
      }, 500);
    }
  });
