import { afterEach, describe, expect, it, vi } from 'vitest';
import { expandEspnDateQueries, fetchKnockoutMatches, getEspnDateQueries } from './espn';
import type { Env } from './env';

const env: Env = {
  DATABASE_URL: 'postgres://test',
  ESPN_SCOREBOARD_URL: 'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard',
  ESPN_KNOCKOUT_DATES: '20260705',
  ADMIN_EMAIL: 'admin@example.com',
};

describe('expandEspnDateQueries', () => {
  it('expands ESPN date ranges into individual daily scoreboard requests', () => {
    expect(expandEspnDateQueries('20260628-20260702')).toEqual([
      '20260628',
      '20260629',
      '20260630',
      '20260701',
      '20260702',
    ]);
  });

  it('keeps a single ESPN date unchanged', () => {
    expect(expandEspnDateQueries('20260709')).toEqual(['20260709']);
  });
});

describe('getEspnDateQueries', () => {
  it('keeps the original range before daily fallback queries', () => {
    expect(getEspnDateQueries('20260628-20260630')).toEqual([
      '20260628-20260630',
      '20260628',
      '20260629',
      '20260630',
    ]);
  });
});

describe('fetchKnockoutMatches', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fills missing scoreboard matches from ESPN summary event ids', async () => {
    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith('/scoreboard')) return jsonResponse({ events: [] });
      if (url.searchParams.get('event') !== '760504') return { ok: false } as Response;

      return jsonResponse({
        header: {
          id: '760504',
          name: 'Brazil vs Norway',
          date: '2026-07-05T21:00:00.000Z',
          status: { type: { name: 'STATUS_FINAL', state: 'post' } },
          competitions: [{
            competitors: [
              { homeAway: 'home', score: '1', team: { id: '205', displayName: 'Brasil', abbreviation: 'BRA' } },
              { homeAway: 'away', score: '2', winner: true, team: { id: '143', displayName: 'Noruega', abbreviation: 'NOR' } },
            ],
          }],
        },
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchKnockoutMatches(env)).resolves.toMatchObject([
      {
        externalId: '760504',
        round: 'round_of_16',
        status: 'final',
        homeScore: 1,
        awayScore: 2,
        winnerTeamId: '143',
        homeTeam: { name: 'Brasil' },
        awayTeam: { name: 'Noruega' },
      },
    ]);
    expect(fetchMock).toHaveBeenCalledWith(expect.objectContaining({ href: expect.stringContaining('event=760504') }), expect.anything());
  });
});

function jsonResponse(payload: unknown) {
  return {
    ok: true,
    json: async () => payload,
  } as Response;
}
