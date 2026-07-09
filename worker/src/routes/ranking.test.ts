import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Env } from '../lib/env';
import { forceRecalculateRanking, getFeedEvents, getRanking } from '../lib/db-store';
import { rankingRoute } from './ranking';

vi.mock('../lib/db-store', () => ({
  forceRecalculateRanking: vi.fn(),
  getFeedEvents: vi.fn(),
  getRanking: vi.fn(),
}));

const env: Env = {
  DATABASE_URL: 'postgres://test',
  ESPN_SCOREBOARD_URL: 'https://example.com/scoreboard',
  ESPN_KNOCKOUT_DATES: '20260628-20260719',
  ADMIN_EMAIL: 'admin@example.com',
  ADMIN_TOKEN: 'valid-admin-token',
};

const app = new Hono<{ Bindings: Env }>().route('/api', rankingRoute);

describe('ranking route admin actions', () => {
  beforeEach(() => {
    vi.mocked(forceRecalculateRanking).mockReset();
    vi.mocked(getFeedEvents).mockReset();
    vi.mocked(getRanking).mockReset();
  });

  it('returns 401 for POST /api/ranking/recalculate without an admin token', async () => {
    const response = await app.request('/api/ranking/recalculate', { method: 'POST' }, env);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: 'Unauthorized.' });
    expect(forceRecalculateRanking).not.toHaveBeenCalled();
  });

  it('runs forceRecalculateRanking for POST /api/ranking/recalculate with a valid admin token', async () => {
    const ranking = [{ participant: { id: 'p1', name: 'Admin' }, totalPoints: 10 }];
    vi.mocked(forceRecalculateRanking).mockResolvedValue(ranking as Awaited<ReturnType<typeof forceRecalculateRanking>>);

    const response = await app.request(
      '/api/ranking/recalculate',
      { method: 'POST', headers: { 'x-admin-token': 'valid-admin-token' } },
      env,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(forceRecalculateRanking).toHaveBeenCalledWith(env);
    expect(body).toEqual({ ranking });
  });
});
