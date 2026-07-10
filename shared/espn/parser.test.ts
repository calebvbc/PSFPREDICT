import { describe, expect, it } from 'vitest';
import { normalizePlaceholderName, parseEspnScoreboardEvent } from './parser';

function createEvent(name: string, shortName?: string) {
  return {
    id: `match-${name}-${shortName ?? ''}`,
    name,
    shortName,
    date: '2026-07-10T20:00:00.000Z',
    status: { type: { name: 'STATUS_SCHEDULED', state: 'pre' } },
    competitions: [{
      competitors: [
        { homeAway: 'home', score: '', team: { id: 'home', displayName: 'Brazil', abbreviation: 'BRA' } },
        { homeAway: 'away', score: '', team: { id: 'away', displayName: 'Argentina', abbreviation: 'ARG' } },
      ],
    }],
  };
}

describe('normalizePlaceholderName', () => {
  it('marks placeholder teams parsed from ESPN labels', () => {
    expect(normalizePlaceholderName('Round of 16 3 Winner')).toEqual({
      name: 'Vencedor — Jogo 3',
      isPlaceholder: true,
    });
  });
});
describe('parseEspnScoreboard', () => {
  it('marks parsed placeholder competitors so predictions can be blocked', () => {
    const { match } = parseEspnScoreboardEvent({
      id: 'match-1',
      name: 'Quarterfinal',
      date: '2026-07-10T20:00:00.000Z',
      status: { type: { name: 'STATUS_SCHEDULED', state: 'pre' } },
      competitions: [{
        competitors: [
          { homeAway: 'home', score: '', team: { id: 'home', displayName: 'Round of 16 1 Winner' } },
          { homeAway: 'away', score: '', team: { id: 'away', displayName: 'Brazil', abbreviation: 'BRA' } },
        ],
      }],
    });
    expect(match).not.toBeNull();
    expect(match?.homeTeam).toMatchObject({ name: 'Vencedor — Jogo 1', isPlaceholder: true });
    expect(match?.awayTeam).toMatchObject({ name: 'Brazil', isPlaceholder: false });
  });

  it.each([
    ['Round of 16'],
    ['Oitavas'],
    ['Oitavos'],
    ['8ªs'],
    ['8as'],
    ['8vos'],
    ['Last 16'],
  ])('accepts ESPN round of 16 variation "%s"', (roundName) => {
    const { match, discardedUnknownRound } = parseEspnScoreboardEvent(createEvent(roundName));

    expect(discardedUnknownRound).toBe(false);
    expect(match).toMatchObject({ round: 'round_of_16' });
  });

  it('accepts round of 16 variations from shortName', () => {
    const { match, discardedUnknownRound } = parseEspnScoreboardEvent(createEvent('Brazil vs Argentina', '8vos'));

    expect(discardedUnknownRound).toBe(false);
    expect(match).toMatchObject({ round: 'round_of_16' });
  });

  it('uses the 2026 knockout kickoff date when ESPN placeholder names mention the previous round', () => {
    const { match, discardedUnknownRound } = parseEspnScoreboardEvent({
      id: 'semifinal-placeholder',
      name: 'Vencedor quartas de final (1) vs Vencedor quartas de final (2)',
      date: '2026-07-14T19:00Z',
      status: { type: { name: 'STATUS_SCHEDULED', state: 'pre' } },
      competitions: [{
        competitors: [
          { homeAway: 'home', score: '', team: { id: 'home', displayName: 'Vencedor quartas de final (1)' } },
          { homeAway: 'away', score: '', team: { id: 'away', displayName: 'Vencedor quartas de final (2)' } },
        ],
      }],
    });

    expect(discardedUnknownRound).toBe(false);
    expect(match).toMatchObject({
      round: 'semifinal',
      homeTeam: { name: 'A definir', isPlaceholder: true },
      awayTeam: { name: 'A definir', isPlaceholder: true },
    });
  });



  it('reads country flag URLs from ESPN logos arrays', () => {
    const { match } = parseEspnScoreboardEvent({
      ...createEvent('Round of 16'),
      competitions: [{
        competitors: [
          { homeAway: 'home', score: '', team: { id: 'home', displayName: 'Colômbia', abbreviation: 'COL', logos: [{ href: 'https://example.com/colombia.png' }] } },
          { homeAway: 'away', score: '', team: { id: 'away', displayName: 'Gana', abbreviation: 'GHA', logos: [{ href: 'https://example.com/ghana.png' }] } },
        ],
      }],
    });

    expect(match?.homeTeam.logoUrl).toBe('https://example.com/colombia.png');
    expect(match?.awayTeam.logoUrl).toBe('https://example.com/ghana.png');
  });

  it('continues discarding events with unknown rounds outside the known knockout dates', () => {
    const { match, discardedUnknownRound } = parseEspnScoreboardEvent({ ...createEvent('Group Stage'), date: '2026-06-20T20:00:00.000Z' });

    expect(match).toBeNull();
    expect(discardedUnknownRound).toBe(true);
  });
});
