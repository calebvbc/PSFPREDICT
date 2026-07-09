import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { MatchSnapshot } from '../../../shared/types/domain';
import { matchesRoute, hasCompleteKnockoutCache } from './matches';
import { listMatches } from '../lib/db-store';
import { syncKnockoutMatches } from '../jobs/sync';
import type { Env } from '../lib/env';

vi.mock('../lib/db-store', () => ({
  listMatches: vi.fn(),
}));

vi.mock('../jobs/sync', () => ({
  syncKnockoutMatches: vi.fn(),
}));

const env: Env = {
  DATABASE_URL: 'postgres://test',
  ESPN_SCOREBOARD_URL: 'https://example.com/scoreboard',
  ESPN_KNOCKOUT_DATES: '20260628-20260719',
  ADMIN_EMAIL: 'admin@example.com',
};

const team = {
  id: 'team-1',
  name: 'Team',
  abbreviation: 'T',
  logoUrl: null,
  color: null,
  isPlaceholder: false,
};

function match(round: MatchSnapshot['round'], externalId = round): MatchSnapshot {
  return {
    externalId,
    round,
    kickoffAt: '2026-07-10T20:00:00.000Z',
    status: 'scheduled',
    homeTeam: team,
    awayTeam: { ...team, id: 'team-2' },
    homeScore: null,
    awayScore: null,
    winnerTeamId: null,
  };
}

describe('matches route cache validation', () => {
  beforeEach(() => {
    vi.mocked(listMatches).mockReset();
    vi.mocked(syncKnockoutMatches).mockReset();
  });

  it('treats cache with round of 16 and expected later knockout rounds as complete', () => {
    expect(hasCompleteKnockoutCache([
      match('round_of_16'),
      match('quarterfinal'),
      match('semifinal'),
      match('final'),
    ])).toBe(true);
  });

  it('syncs again when cached database only contains quarterfinal matches', async () => {
    const cached = [match('quarterfinal', 'quarterfinal-1')];
    const synced = [match('round_of_16', 'round-of-16-1'), ...cached];

    vi.mocked(listMatches).mockResolvedValue(cached);
    vi.mocked(syncKnockoutMatches).mockResolvedValue({
      syncedAt: '2026-07-09T00:00:00.000Z',
      fetchedMatchCount: synced.length,
      matchCount: synced.length,
      finalizedMatchCount: 0,
      matches: synced,
    });

    const response = await matchesRoute.request('/matches', {}, env);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(syncKnockoutMatches).toHaveBeenCalledWith(env);
    expect(body).toEqual({ matches: synced, source: 'espn' });
  });
});
