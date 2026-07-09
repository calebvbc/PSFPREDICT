import { Hono } from 'hono';
import type { MatchSnapshot } from '../../../shared/types/domain';
import type { Env } from '../lib/env';
import { syncKnockoutMatches } from '../jobs/sync';
import { listMatches } from '../lib/db-store';

const REQUIRED_KNOCKOUT_CACHE_ROUNDS = ['round_of_16', 'quarterfinal', 'semifinal', 'final'] satisfies MatchSnapshot['round'][];

export function hasCompleteKnockoutCache(matches: Pick<MatchSnapshot, 'round'>[]) {
  const cachedRounds = new Set(matches.map((match) => match.round));
  return REQUIRED_KNOCKOUT_CACHE_ROUNDS.every((round) => cachedRounds.has(round));
}

export const matchesRoute = new Hono<{ Bindings: Env }>()
  .get('/matches', async (c) => {
    const cached = await listMatches(c.env);
    if (hasCompleteKnockoutCache(cached)) return c.json({ matches: cached, source: 'database' });

    const synced = await syncKnockoutMatches(c.env);
    return c.json({ matches: synced.matches, source: 'espn' });
  });
