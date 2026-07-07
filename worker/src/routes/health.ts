import { Hono } from 'hono';
import { createDb } from '../lib/db';
import type { Env } from '../lib/env';
import { createRepository } from '../lib/repository';
import { adminAuth } from '../middleware/admin-auth';

const service = {
  name: 'psfpredict-api',
  version: '0.1.0',
};

function getEnvironment(env: Env) {
  return env.APP_ENV ?? env.ENVIRONMENT ?? 'unknown';
}

async function getPublicHealth(env: Env) {
  const sync = await createRepository(createDb(env)).getSyncOperationalState();

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
  .get('/health', async (c) => c.json(await getPublicHealth(c.env)))
  .use('/admin/status', adminAuth)
  .get('/admin/status', async (c) => {
    const repository = createRepository(createDb(c.env));
    const matches = await repository.listMatches();
    return c.json({
      ...await getPublicHealth(c.env),
      diagnostics: {
        rankingEntryCount: (await repository.getRanking()).length,
        feedEventCount: (await repository.getFeedEvents(101)).length,
        matches: matches.map((match) => ({
          externalId: match.externalId,
          kickoffAt: match.kickoffAt,
          status: match.status,
          homeTeam: match.homeTeam.name,
          awayTeam: match.awayTeam.name,
          score: match.homeScore === null || match.awayScore === null ? null : `${match.homeScore}-${match.awayScore}`,
        })),
      },
    });
  });
