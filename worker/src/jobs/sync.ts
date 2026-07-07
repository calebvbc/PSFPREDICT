import { createDb } from '../lib/db';
import type { Env } from '../lib/env';
import { fetchKnockoutMatches } from '../lib/espn';
import { createRepository } from '../lib/repository';

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unknown sync error';
}

export async function syncKnockoutMatches(env: Env) {
  const startedAt = new Date().toISOString();
  const repository = createRepository(createDb(env));

  try {
    const scoreboard = await fetchKnockoutMatches(env);
    const matches = scoreboard.matches;
    const result = await repository.upsertMatches(matches);
    const syncState = await repository.recordSyncSuccess({
      syncedAt: new Date().toISOString(),
      fetchedMatchCount: matches.length,
    });

    return {
      syncedAt: syncState.lastSyncAt,
      fetchedMatchCount: syncState.lastFetchedMatchCount,
      ...result,
      matches,
    };
  } catch (error) {
    const syncState = await repository.recordSyncFailure({
      syncedAt: new Date().toISOString(),
      error: getErrorMessage(error),
    });

    return {
      syncedAt: syncState.lastSyncAt,
      startedAt,
      fetchedMatchCount: syncState.lastFetchedMatchCount,
      matchCount: syncState.matchCount,
      finalizedMatchCount: 0,
      error: syncState.lastSyncError,
      matches: [],
    };
  }
}
