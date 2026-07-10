import { Hono } from 'hono';
import type { MatchSnapshot } from '../../../shared/types/domain';
import type { Env } from '../lib/env';
import { syncKnockoutMatches } from '../jobs/sync';
import { listMatches } from '../lib/db-store';

const EXPECTED_KNOCKOUT_MATCH_COUNT = 32;
const EXPECTED_MATCH_COUNT_BY_ROUND = {
  round_of_32: 16,
  round_of_16: 8,
  quarterfinal: 4,
  semifinal: 2,
  third_place: 1,
  final: 1,
} satisfies Record<MatchSnapshot['round'], number>;
const REQUIRED_KNOCKOUT_CACHE_ROUNDS = Object.keys(EXPECTED_MATCH_COUNT_BY_ROUND) as MatchSnapshot['round'][];

export function hasCompleteKnockoutCache(matches: Pick<MatchSnapshot, 'round'>[]) {
  const counts = countMatchesByRound(matches);
  return matches.length >= EXPECTED_KNOCKOUT_MATCH_COUNT
    && REQUIRED_KNOCKOUT_CACHE_ROUNDS.every((round) => (counts[round] ?? 0) >= EXPECTED_MATCH_COUNT_BY_ROUND[round]);
}

export function countMatchesByRound(matches: Pick<MatchSnapshot, 'round'>[]) {
  return matches.reduce<Partial<Record<MatchSnapshot['round'], number>>>((counts, match) => {
    counts[match.round] = (counts[match.round] ?? 0) + 1;
    return counts;
  }, {});
}

export function selectMostCompleteMatches(cached: MatchSnapshot[], synced: MatchSnapshot[]) {
  const cachedByRound = groupMatchesByRound(cached);
  const syncedByRound = groupMatchesByRound(synced);
  const merged: MatchSnapshot[] = [];
  let usedSynced = false;

  for (const round of REQUIRED_KNOCKOUT_CACHE_ROUNDS) {
    const cachedRoundMatches = cachedByRound.get(round) ?? [];
    const syncedRoundMatches = syncedByRound.get(round) ?? [];
    const selected = syncedRoundMatches.length > cachedRoundMatches.length ? syncedRoundMatches : cachedRoundMatches;
    if (selected === syncedRoundMatches && syncedRoundMatches.length > 0) usedSynced = true;
    merged.push(...selected);
  }

  const knownRounds = new Set<MatchSnapshot['round']>(REQUIRED_KNOCKOUT_CACHE_ROUNDS);
  const extras = [...cached, ...synced].filter((match) => !knownRounds.has(match.round));
  if (extras.some((match) => synced.includes(match))) usedSynced = true;

  const matches = dedupeMatches([...merged, ...extras]);
  if (matches.length === cached.length && matches.every((match, index) => match.externalId === cached[index]?.externalId)) usedSynced = false;

  return { matches, source: usedSynced ? 'espn' as const : 'database' as const };
}

export const matchesRoute = new Hono<{ Bindings: Env }>()
  .get('/matches', async (c) => {
    const cached = await listMatches(c.env);

    try {
      const synced = await syncKnockoutMatches(c.env);
      const selected = selectMostCompleteMatches(cached, synced.matches);
      return c.json(selected);
    } catch (error) {
      if (cached.length > 0) return c.json({ matches: cached, source: 'database', syncError: error instanceof Error ? error.message : 'ESPN sync failed' });
      throw error;
    }
  });

function groupMatchesByRound(matches: MatchSnapshot[]) {
  return matches.reduce<Map<MatchSnapshot['round'], MatchSnapshot[]>>((groups, match) => {
    const group = groups.get(match.round) ?? [];
    group.push(match);
    groups.set(match.round, group);
    return groups;
  }, new Map());
}

function dedupeMatches(matches: MatchSnapshot[]) {
  return [...new Map(matches.map((match) => [match.externalId, match])).values()]
    .sort((a, b) => new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime());
}
