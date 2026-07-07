import { describe, expect, it } from 'vitest';
import { parseEspnScoreboard, parseRound } from './parser';

function eventWithRound(id: string, roundName: string) {
  return {
    id,
    name: roundName,
    shortName: roundName,
    date: '2026-07-01T20:00Z',
    status: { type: { name: 'STATUS_SCHEDULED', state: 'pre' } },
    competitions: [
      {
        competitors: [
          { homeAway: 'home', score: '0', team: { id: '1', displayName: 'Home' } },
          { homeAway: 'away', score: '0', team: { id: '2', displayName: 'Away' } },
        ],
      },
    ],
  };
}

describe('parseRound', () => {
  it('recognizes expected ESPN knockout round names in English and Portuguese', () => {
    expect(parseRound('Round of 16')).toBe('round_of_16');
    expect(parseRound('Oitavas de final')).toBe('round_of_16');
    expect(parseRound('Quarterfinal')).toBe('quarterfinal');
    expect(parseRound('Quartas de final')).toBe('quarterfinal');
    expect(parseRound('Semifinal')).toBe('semifinal');
    expect(parseRound('Semifinais')).toBe('semifinal');
    expect(parseRound('Third Place')).toBe('third_place');
    expect(parseRound('Terceiro lugar')).toBe('third_place');
    expect(parseRound('Final')).toBe('final');
  });

  it('returns null for unknown rounds', () => {
    expect(parseRound('Group Stage')).toBeNull();
  });
});

describe('parseEspnScoreboard', () => {
  it('discards events with unknown rounds and reports the discard count', () => {
    const result = parseEspnScoreboard({
      events: [
        eventWithRound('known', 'Final'),
        eventWithRound('unknown', 'Group Stage'),
      ],
    });

    expect(result.matches).toHaveLength(1);
    expect(result.matches[0].externalId).toBe('known');
    expect(result.matches[0].round).toBe('final');
    expect(result.discardedUnknownRoundCount).toBe(1);
  });
});
