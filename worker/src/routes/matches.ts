import { Hono } from 'hono';
import type { Env } from '../lib/env';
import { syncKnockoutMatches } from '../jobs/sync';
import { listMatches } from '../lib/memory-store';

const MATCH_CACHE_TTL_MS = 5 * 60 * 1000;
let lastMatchesSyncAt = 0;

export const matchesRoute = new Hono<{ Bindings: Env }>()
  .get('/matches', async (c) => {
    const cached = listMatches();
    const cacheIsFresh = cached.length > 0 && Date.now() - lastMatchesSyncAt < MATCH_CACHE_TTL_MS;
    if (cacheIsFresh) return c.json({ matches: cached, source: 'cache' });

    try {
      const synced = await syncKnockoutMatches(c.env);
      lastMatchesSyncAt = Date.now();
      return c.json({ matches: synced.matches, source: 'espn' });
    } catch (error) {
      if (cached.length > 0) {
        return c.json({
          matches: cached,
          source: 'stale-cache',
          syncError: error instanceof Error ? error.message : 'Não foi possível sincronizar as partidas.',
        });
      }

      throw error;
    }
  });
