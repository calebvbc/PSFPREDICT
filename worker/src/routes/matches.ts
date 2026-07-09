import { Hono } from 'hono';
import type { MatchSnapshot } from '../../../shared/types/domain';
import type { Env } from '../lib/env';
import { syncKnockoutMatches } from '../jobs/sync';
import { listMatches } from '../lib/db-store';

const EXPECTED_KNOCKOUT_MATCH_COUNT = 32;
const REQUIRED_KNOCKOUT_CACHE_ROUNDS = ['round_of_32', 'round_of_16', 'quarterfinal', 'semifinal', 'third_place', 'final'] satisfies MatchSnapshot['round'][];

export function hasCompleteKnockoutCache(matches: Pick<MatchSnapshot, 'round'>[]) {
  const cachedRounds = new Set(matches.map((match) => match.round));
  return matches.length >= EXPECTED_KNOCKOUT_MATCH_COUNT && REQUIRED_KNOCKOUT_CACHE_ROUNDS.every((round) => cachedRounds.has(round));
}

export const matchesRoute = new Hono<{ Bindings: Env }>()
  .get('/matches', async (c) => {
    const cached = await listMatches(c.env);

    try {
      const synced = await syncKnockoutMatches(c.env);
      const shouldUseSynced = !hasCompleteKnockoutCache(cached) || synced.matches.length >= cached.length;
      return c.json({ matches: shouldUseSynced ? synced.matches : cached, source: shouldUseSynced ? 'espn' : 'database' });
    } catch (error) {
      if (cached.length > 0) return c.json({ matches: cached, source: 'database', syncError: error instanceof Error ? error.message : 'ESPN sync failed' });
      throw error;
    }
  });
