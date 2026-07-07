import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MatchSnapshot } from '../../../shared/types/domain';

const kickoffAt = '2026-07-10T20:00:00.000Z';
const beforeKickoff = new Date('2026-07-10T19:59:59.000Z').getTime();
const atKickoff = new Date(kickoffAt).getTime();
const afterKickoff = new Date('2026-07-10T20:00:01.000Z').getTime();

function makeMatch(overrides: Partial<MatchSnapshot> = {}): MatchSnapshot {
  return {
    externalId: 'match-1',
    round: 'round_of_16',
    kickoffAt,
    status: 'scheduled',
    homeTeam: {
      id: 'home',
      name: 'Home',
      abbreviation: 'HOM',
      logoUrl: null,
      color: null,
      isPlaceholder: false,
    },
    awayTeam: {
      id: 'away',
      name: 'Away',
      abbreviation: 'AWY',
      logoUrl: null,
      color: null,
      isPlaceholder: false,
    },
    homeScore: null,
    awayScore: null,
    winnerTeamId: null,
    ...overrides,
  };
}

async function freshStore() {
  await import('node:crypto').then(({ webcrypto }) => {
    Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
  });
  vi.resetModules();
  return import('./memory-store');
}

describe('memory-store prediction windows and reveal rules', () => {
  let store: Awaited<ReturnType<typeof freshStore>>;

  beforeEach(async () => {
    store = await freshStore();
  });

  it('allows predictions before kickoff', () => {
    store.upsertMatches([makeMatch()]);

    expect(store.validatePredictionWindow('match-1', beforeKickoff)).toEqual({ ok: true });
  });

  it('blocks predictions at or after kickoff', () => {
    store.upsertMatches([makeMatch()]);

    expect(store.validatePredictionWindow('match-1', atKickoff)).toMatchObject({ ok: false });
  });

  it('blocks predictions when either team is a placeholder', () => {
    store.upsertMatches([makeMatch({
      homeTeam: { ...makeMatch().homeTeam, name: 'A definir', isPlaceholder: true },
    })]);

    expect(store.validatePredictionWindow('match-1', beforeKickoff)).toMatchObject({
      ok: false,
      error: 'Partida ainda não tem os times definidos.',
    });
  });

  it('blocks public prediction reveal before kickoff', () => {
    store.upsertMatches([makeMatch()]);

    expect(store.getPublicPredictionsForMatch('match-1', beforeKickoff)).toMatchObject({
      ok: false,
      error: 'Palpites serão revelados após o kickoff.',
      predictions: [],
    });
  });

  it('allows public prediction reveal after kickoff', () => {
    store.upsertMatches([makeMatch()]);
    store.upsertParticipantPredictions({
      displayName: 'Jane Doe',
      username: 'jane',
      predictions: [{ matchExternalId: 'match-1', homeScore: 1, awayScore: 0 }],
    });

    expect(store.getPublicPredictionsForMatch('match-1', afterKickoff)).toMatchObject({
      ok: true,
      predictions: [{ displayName: 'Jane Doe', homeScore: 1, awayScore: 0 }],
    });
  });
});

describe('memory-store ranking', () => {
  it('breaks ties by oldest participant registration', async () => {
    const store = await freshStore();
    store.upsertMatches([makeMatch({ status: 'final', homeScore: 2, awayScore: 1 })]);

    store.upsertParticipantPredictions({
      displayName: 'Older User',
      username: 'older',
      predictions: [{ matchExternalId: 'match-1', homeScore: 0, awayScore: 0 }],
    });
    await new Promise((resolve) => setTimeout(resolve, 5));
    store.upsertParticipantPredictions({
      displayName: 'Newer User',
      username: 'newer',
      predictions: [{ matchExternalId: 'match-1', homeScore: 1, awayScore: 1 }],
    });

    expect(store.getRanking().map((entry) => entry.username)).toEqual(['older', 'newer']);
  });
});
