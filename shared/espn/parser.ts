import type { MatchRound, MatchSnapshot, MatchStatus, TeamSnapshot } from '../types/domain';

export interface EspnScoreboardParseResult {
  matches: MatchSnapshot[];
  discardedUnknownRoundCount: number;
}

const ROUND_BY_NAME: Array<[RegExp, MatchRound]> = [
  [/\b(round of 16|oitavas(?: de final)?)\b/i, 'round_of_16'],
  [/\b(quarterfinal|quarter-final|quarter final|quartas(?: de final)?)\b/i, 'quarterfinal'],
  [/\b(semifinal|semi-final|semi final|semifinais?)\b/i, 'semifinal'],
  [/\b(third place|3rd place|terceiro lugar|disputa (?:do )?3[ºo] lugar)\b/i, 'third_place'],
  [/\b(final|grande final)\b/i, 'final'],
];

export function normalizePlaceholderName(rawName: string): { name: string; isPlaceholder: boolean } {
  const normalized = rawName.replace(/[–—]/g, '-').trim();
  const roundOfMatch = normalized.match(/Round of (?:32|16)\s+(\d+)\s+Winner/i);
  if (roundOfMatch) return { name: `Vencedor — Jogo ${roundOfMatch[1]}`, isPlaceholder: true };

  const winnerSemi = normalized.match(/Winner\s*-?\s*Semifinal\s+(\d+)/i);
  if (winnerSemi) return { name: `Vencedor — Semifinal ${winnerSemi[1]}`, isPlaceholder: true };

  const loserSemi = normalized.match(/Loser\s*-?\s*Semifinal\s+(\d+)/i);
  if (loserSemi) return { name: `Perdedor — Semifinal ${loserSemi[1]}`, isPlaceholder: true };

  const tbd = /\bTBD\b|to be decided|winner|loser/i.test(normalized);
  return { name: tbd ? 'A definir' : rawName, isPlaceholder: tbd };
}

export function parseEspnScoreboard(payload: unknown): EspnScoreboardParseResult {
  const events = asRecord(payload).events;
  if (!Array.isArray(events)) return { matches: [], discardedUnknownRoundCount: 0 };

  return events.reduce<EspnScoreboardParseResult>((result, event) => {
    const parsed = parseEvent(event);
    if (parsed.discardedUnknownRound) result.discardedUnknownRoundCount += 1;
    if (parsed.match) result.matches.push(parsed.match);
    return result;
  }, { matches: [], discardedUnknownRoundCount: 0 });
}

function parseEvent(event: unknown): { match: MatchSnapshot | null; discardedUnknownRound: boolean } {
  const record = asRecord(event);
  const competition = Array.isArray(record.competitions) ? asRecord(record.competitions[0]) : {};
  const competitors = Array.isArray(competition.competitors) ? competition.competitors.map(asRecord) : [];
  if (competitors.length < 2 || typeof record.id !== 'string') return { match: null, discardedUnknownRound: false };

  const round = parseRound(record.name, record.shortName);
  if (round === null) return { match: null, discardedUnknownRound: true };

  const home = competitors.find((competitor) => competitor.homeAway === 'home') ?? competitors[0];
  const away = competitors.find((competitor) => competitor.homeAway === 'away') ?? competitors[1];

  return {
    discardedUnknownRound: false,
    match: {
      externalId: record.id,
      round,
      kickoffAt: String(record.date ?? competition.date ?? ''),
      status: parseStatus(asRecord(asRecord(record.status).type).name, asRecord(asRecord(record.status).type).state),
      homeTeam: parseTeam(home),
      awayTeam: parseTeam(away),
      homeScore: parseNullableInt(home.score),
      awayScore: parseNullableInt(away.score),
      winnerTeamId: findWinnerTeamId(competitors),
    },
  };
}

function parseTeam(competitor: Record<string, unknown>): TeamSnapshot {
  const team = asRecord(competitor.team);
  const rawName = String(team.displayName ?? team.name ?? competitor.displayName ?? 'A definir');
  const placeholder = normalizePlaceholderName(rawName);

  return {
    id: String(team.id ?? competitor.id ?? placeholder.name),
    name: placeholder.name,
    abbreviation: typeof team.abbreviation === 'string' ? team.abbreviation : null,
    logoUrl: typeof team.logo === 'string' ? team.logo : null,
    color: typeof team.color === 'string' ? `#${team.color.replace(/^#/, '')}` : null,
    isPlaceholder: placeholder.isPlaceholder,
  };
}

export function parseRound(...names: unknown[]): MatchRound | null {
  const joined = names.filter(Boolean).join(' ');
  return ROUND_BY_NAME.find(([pattern]) => pattern.test(joined))?.[1] ?? null;
}

function parseStatus(name: unknown, state: unknown): MatchStatus {
  const text = `${String(name ?? '')} ${String(state ?? '')}`.toLowerCase();
  if (/final|post/.test(text)) return 'final';
  if (/in|live|progress|halftime/.test(text)) return 'in_progress';
  return 'scheduled';
}

function findWinnerTeamId(competitors: Record<string, unknown>[]): string | null {
  const winner = competitors.find((competitor) => competitor.winner === true);
  if (!winner) return null;
  const team = asRecord(winner.team);
  return String(team.id ?? winner.id ?? '') || null;
}

function parseNullableInt(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
}
