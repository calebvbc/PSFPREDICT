import { Hono } from 'hono';
import type { Env } from '../lib/env';
import { adminAuth } from '../middleware/admin-auth';
import { getFeedEvents, getRanking, getSyncOperationalState, listMatches } from '../lib/memory-store';

const service = {
  name: 'psfpredict-api',
  version: '0.1.0',
};

function getEnvironment(env: Env) {
  return env.APP_ENV ?? env.ENVIRONMENT ?? 'unknown';
}

function getPublicHealth(env: Env) {
  const sync = getSyncOperationalState();

  return {
    ok: sync.lastSyncStatus !== 'error' || sync.matchCount > 0,
    service: service.name,
    version: service.version,
    environment: getEnvironment(env),
    lastSync: {
      at: sync.lastSyncAt,
      status: sync.lastSyncStatus,
      error: sync.lastSyncError,
    },
    loadedMatchCount: sync.matchCount,
    lastFetchedMatchCount: sync.lastFetchedMatchCount,
  };
}

export const healthRoute = new Hono<{ Bindings: Env }>()
  .get('/health', (c) => c.json(getPublicHealth(c.env)))
  .use('/admin/status', adminAuth)
  .get('/admin/status', (c) => c.json({
    ...getPublicHealth(c.env),
    diagnostics: {
      rankingEntryCount: getRanking().length,
      feedEventCount: getFeedEvents(101).length,
      matches: listMatches().map((match) => ({
        externalId: match.externalId,
        kickoffAt: match.kickoffAt,
        status: match.status,
        homeTeam: match.homeTeam.name,
        awayTeam: match.awayTeam.name,
        score: match.homeScore === null || match.awayScore === null ? null : `${match.homeScore}-${match.awayScore}`,
      })),
    },
  }));
