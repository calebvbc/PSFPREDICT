import { describe, expect, it } from 'vitest';
import { normalizePlaceholderName, parseEspnScoreboard } from './parser';

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
    const [match] = parseEspnScoreboard({
      events: [{
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
      }],
    });

    expect(match.homeTeam).toMatchObject({ name: 'Vencedor — Jogo 1', isPlaceholder: true });
    expect(match.awayTeam).toMatchObject({ name: 'Brazil', isPlaceholder: false });
  });
});
