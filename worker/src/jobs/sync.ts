import type { Env } from '../lib/env';
import { fetchKnockoutMatches } from '../lib/espn';
import { recordSyncFailure, recordSyncSuccess, upsertMatches } from '../lib/memory-store';

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Unknown sync error';
}

export async function syncKnockoutMatches(env: Env) {
  const startedAt = new Date().toISOString();

  try {
    const matches = await fetchKnockoutMatches(env);
    const result = upsertMatches(matches);
    const syncState = recordSyncSuccess({
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
    const syncState = recordSyncFailure({
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
