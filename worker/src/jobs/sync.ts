import type { Env } from '../lib/env';
import { fetchKnockoutMatches } from '../lib/espn';
import { upsertMatches } from '../lib/db-store';

export async function syncKnockoutMatches(env: Env) {
  const matches = await fetchKnockoutMatches(env);
  const result = await upsertMatches(env, matches);

  return {
    syncedAt: new Date().toISOString(),
    fetchedMatchCount: matches.length,
    ...result,
    matches,
  };
}
