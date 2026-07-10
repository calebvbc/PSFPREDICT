import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { MatchSnapshot } from '../../../shared/types/domain';
import { matchesRoute, hasCompleteKnockoutCache, selectMostCompleteMatches } from './matches';
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

  it('requires every knockout round and the expected 32 matches before treating cache as complete', () => {
    const completeCache = [
      ...Array.from({ length: 16 }, (_, index) => match('round_of_32', `round-of-32-${index}`)),
      ...Array.from({ length: 8 }, (_, index) => match('round_of_16', `round-of-16-${index}`)),
      ...Array.from({ length: 4 }, (_, index) => match('quarterfinal', `quarterfinal-${index}`)),
      ...Array.from({ length: 2 }, (_, index) => match('semifinal', `semifinal-${index}`)),
      match('third_place'),
      match('final'),
    ];

    expect(hasCompleteKnockoutCache(completeCache)).toBe(true);
    expect(hasCompleteKnockoutCache(completeCache.filter((cachedMatch) => cachedMatch.round !== 'round_of_32'))).toBe(false);
  });

  it('treats cache with incomplete quarterfinals as incomplete even when every round exists', () => {
    const incompleteQuarterfinalCache = [
      ...Array.from({ length: 16 }, (_, index) => match('round_of_32', `round-of-32-${index}`)),
      ...Array.from({ length: 8 }, (_, index) => match('round_of_16', `round-of-16-${index}`)),
      ...Array.from({ length: 3 }, (_, index) => match('quarterfinal', `quarterfinal-${index}`)),
      ...Array.from({ length: 2 }, (_, index) => match('semifinal', `semifinal-${index}`)),
      match('third_place'),
      match('final'),
    ];

    expect(hasCompleteKnockoutCache(incompleteQuarterfinalCache)).toBe(false);
  });

  it('merges synced complete quarterfinals over incomplete cached quarterfinals even when total synced count is lower', () => {
    const cached = [
      ...Array.from({ length: 16 }, (_, index) => match('round_of_32', `cached-round-of-32-${index}`)),
      ...Array.from({ length: 8 }, (_, index) => match('round_of_16', `cached-round-of-16-${index}`)),
      ...Array.from({ length: 3 }, (_, index) => match('quarterfinal', `cached-quarterfinal-${index}`)),
      ...Array.from({ length: 2 }, (_, index) => match('semifinal', `cached-semifinal-${index}`)),
      match('third_place', 'cached-third-place'),
      match('final', 'cached-final'),
    ];
    const synced = Array.from({ length: 4 }, (_, index) => match('quarterfinal', `synced-quarterfinal-${index}`));

    const selected = selectMostCompleteMatches(cached, synced);

    expect(selected.source).toBe('espn');
    expect(selected.matches).toHaveLength(32);
    expect(selected.matches.filter((selectedMatch) => selectedMatch.round === 'quarterfinal').map((selectedMatch) => selectedMatch.externalId)).toEqual([
      'synced-quarterfinal-0',
      'synced-quarterfinal-1',
      'synced-quarterfinal-2',
      'synced-quarterfinal-3',
    ]);
  });

  it('syncs when cached database only contains quarterfinal matches', async () => {
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
