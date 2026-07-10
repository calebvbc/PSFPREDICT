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
  it('expands range queries into daily ESPN date queries', () => {
    expect(getEspnDateQueries('20260628-20260719')).toEqual([
      '20260628',
      '20260629',
      '20260630',
      '20260701',
      '20260702',
      '20260703',
      '20260704',
      '20260705',
      '20260706',
      '20260707',
      '20260708',
      '20260709',
      '20260710',
      '20260711',
      '20260712',
      '20260713',
      '20260714',
      '20260715',
      '20260716',
      '20260717',
      '20260718',
      '20260719',
    ]);
  });

  it('keeps a single ESPN date query unchanged', () => {
    expect(getEspnDateQueries('20260709')).toEqual(['20260709']);
  });
});

describe('fetchKnockoutMatches', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetches an expanded ESPN date range with one scoreboard request per day', async () => {
    const rangeEnv = { ...env, ESPN_KNOCKOUT_DATES: '20260628-20260719' };
    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = new URL(String(input));
      const date = url.searchParams.get('dates') ?? '20260628';
      const index = getEspnDateQueries(rangeEnv.ESPN_KNOCKOUT_DATES).indexOf(date);
      const events = index >= 0 && index < 16
        ? [scoreboardEvent(`${index}-a`, date), scoreboardEvent(`${index}-b`, date)]
        : [];

      return jsonResponse({ events });
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchKnockoutMatches(rangeEnv)).resolves.toHaveLength(32);
    expect(fetchMock).toHaveBeenCalledTimes(22);
    expect(fetchMock.mock.calls.map(([input]) => new URL(String(input)).searchParams.get('dates'))).toEqual(getEspnDateQueries('20260628-20260719'));
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

function scoreboardEvent(id: string, date: string) {
  return {
    id,
    name: 'Round of 32',
    date: `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}T20:00:00.000Z`,
    status: { type: { name: 'STATUS_SCHEDULED', state: 'pre' } },
    competitions: [{
      competitors: [
        { homeAway: 'home', team: { id: `${id}-home`, displayName: 'Home', abbreviation: 'HOM' } },
        { homeAway: 'away', team: { id: `${id}-away`, displayName: 'Away', abbreviation: 'AWY' } },
      ],
    }],
  };
}
