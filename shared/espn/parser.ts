import type { MatchRound, MatchSnapshot, MatchStatus, TeamSnapshot } from '../types/domain';

const ROUND_BY_NAME: Array<[RegExp, MatchRound]> = [
  [/round of 16|oitavas/i, 'round_of_16'],
  [/quarter|quartas/i, 'quarterfinal'],
  [/semi/i, 'semifinal'],
  [/third|3rd|terceiro|3º/i, 'third_place'],
  [/final/i, 'final'],
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

export function parseEspnScoreboard(payload: unknown): MatchSnapshot[] {
  const events = asRecord(payload).events;
  if (!Array.isArray(events)) return [];

  return events.map(parseEvent).filter((match): match is MatchSnapshot => match !== null);
}

function parseEvent(event: unknown): MatchSnapshot | null {
  const record = asRecord(event);
  const competition = Array.isArray(record.competitions) ? asRecord(record.competitions[0]) : {};
  const competitors = Array.isArray(competition.competitors) ? competition.competitors.map(asRecord) : [];
  if (competitors.length < 2 || typeof record.id !== 'string') return null;

  const home = competitors.find((competitor) => competitor.homeAway === 'home') ?? competitors[0];
  const away = competitors.find((competitor) => competitor.homeAway === 'away') ?? competitors[1];

  return {
    externalId: record.id,
    round: parseRound(record.name, record.shortName),
    kickoffAt: String(record.date ?? competition.date ?? ''),
    status: parseStatus(asRecord(asRecord(competition.status).type), asRecord(asRecord(record.status).type)),
    homeTeam: parseTeam(home),
    awayTeam: parseTeam(away),
    homeScore: parseNullableInt(home.score),
    awayScore: parseNullableInt(away.score),
    winnerTeamId: findWinnerTeamId(competitors),
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

function parseRound(...names: unknown[]): MatchRound {
  const joined = names.filter(Boolean).join(' ');
  return ROUND_BY_NAME.find(([pattern]) => pattern.test(joined))?.[1] ?? 'round_of_16';
}

const STATUS_BY_STATE: Record<string, MatchStatus> = {
  pre: 'scheduled',
  in: 'in_progress',
  live: 'in_progress',
  post: 'final',
};

const STATUS_BY_NAME: Record<string, MatchStatus> = {
  STATUS_SCHEDULED: 'scheduled',
  STATUS_IN_PROGRESS: 'in_progress',
  STATUS_HALFTIME: 'in_progress',
  STATUS_FINAL: 'final',
  STATUS_FINAL_PEN: 'final',
};

const STATUS_BY_ID: Record<string, MatchStatus> = {
  '1': 'scheduled',
  '2': 'in_progress',
  '3': 'final',
};

function parseStatus(...statusTypes: Array<Record<string, unknown>>): MatchStatus {
  for (const statusType of statusTypes) {
    if (statusType.completed === true) return 'final';

    const state = normalizeStatusField(statusType.state);
    if (state && STATUS_BY_STATE[state]) return STATUS_BY_STATE[state];

    const name = normalizeStatusField(statusType.name);
    if (name && STATUS_BY_NAME[name]) return STATUS_BY_NAME[name];

    const id = normalizeStatusField(statusType.id);
    if (id && STATUS_BY_ID[id]) return STATUS_BY_ID[id];
  }

  return 'in_progress';
}

function normalizeStatusField(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
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
