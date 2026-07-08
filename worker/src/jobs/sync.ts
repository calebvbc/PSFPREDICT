import type { Env } from '../lib/env';
import { fetchKnockoutMatches } from '../lib/espn';
import { createDb } from '../lib/db';
import { createRepository } from '../lib/repository';

export async function syncKnockoutMatches(env: Env) {
  const matches = await fetchKnockoutMatches(env);

  const db = createDb(env);
  const repo = createRepository(db);
  const result = await repo.upsertMatches(matches);

  return {
    syncedAt: new Date().toISOString(),
    fetchedMatchCount: matches.length,
    ...result,
    matches,
  };
}
