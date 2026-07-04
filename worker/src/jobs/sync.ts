import type { Env } from '../lib/env';
import { fetchKnockoutMatches } from '../lib/espn';

export async function syncKnockoutMatches(env: Env) {
  const matches = await fetchKnockoutMatches(env);

  // Persistence is wired in the next implementation slice after DATABASE_URL is configured.
  return {
    syncedAt: new Date().toISOString(),
    matchCount: matches.length,
    matches,
  };
}
