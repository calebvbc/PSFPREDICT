import { describe, expect, it, vi, beforeEach } from 'vitest';
import { syncRoute } from './sync';
import { syncKnockoutMatches } from '../jobs/sync';
import type { Env } from '../lib/env';

vi.mock('../jobs/sync', () => ({
  syncKnockoutMatches: vi.fn(),
}));

const env: Env = {
  DATABASE_URL: 'postgres://test',
  ESPN_SCOREBOARD_URL: 'https://example.com/scoreboard',
  ESPN_KNOCKOUT_DATES: '20260628-20260719',
  ADMIN_EMAIL: 'admin@example.com',
  ADMIN_TOKEN: 'valid-admin-token',
};

describe('sync preview route admin auth', () => {
  beforeEach(() => {
    vi.mocked(syncKnockoutMatches).mockReset();
  });

  it('rejects access without an admin token', async () => {
    const response = await syncRoute.request('/sync/preview', {}, env);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: 'Unauthorized.' });
    expect(syncKnockoutMatches).not.toHaveBeenCalled();
  });

  it('allows access with a valid admin token', async () => {
    const syncResult = {
      syncedAt: '2026-07-09T00:00:00.000Z',
      fetchedMatchCount: 0,
      matchCount: 0,
      finalizedMatchCount: 0,
      matches: [],
    };
    vi.mocked(syncKnockoutMatches).mockResolvedValue(syncResult);

    const response = await syncRoute.request(
      '/sync/preview',
      { headers: { 'x-admin-token': env.ADMIN_TOKEN } },
      env,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual(syncResult);
    expect(syncKnockoutMatches).toHaveBeenCalledWith(env);
  });
});
