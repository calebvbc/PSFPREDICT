import { parseEspnScoreboard } from '../../../shared/espn/parser';
import type { MatchSnapshot } from '../../../shared/types/domain';
import type { Env } from './env';

const ESPN_DATE_PATTERN = /^\d{8}$/;
const ESPN_DATE_RANGE_PATTERN = /^(\d{8})-(\d{8})$/;

export async function fetchKnockoutMatches(env: Env) {
  const dateQueries = expandEspnDateQueries(env.ESPN_KNOCKOUT_DATES);
  const matchGroups = await Promise.all(dateQueries.map((dates) => fetchKnockoutMatchesForDates(env, dates)));

  return dedupeMatches(matchGroups.flat());
}

export function expandEspnDateQueries(dates: string): string[] {
  const trimmed = dates.trim();
  const range = trimmed.match(ESPN_DATE_RANGE_PATTERN);
  if (!range) return [trimmed];

  const [, start, end] = range;
  const startDate = parseEspnDate(start);
  const endDate = parseEspnDate(end);
  if (endDate.getTime() < startDate.getTime()) return [trimmed];

  const dateQueries: string[] = [];
  for (const current = startDate; current.getTime() <= endDate.getTime(); current.setUTCDate(current.getUTCDate() + 1)) {
    dateQueries.push(formatEspnDate(current));
  }

  return dateQueries;
}

async function fetchKnockoutMatchesForDates(env: Env, dates: string) {
  const url = new URL(env.ESPN_SCOREBOARD_URL);
  url.searchParams.set('dates', dates);
  url.searchParams.set('limit', '100');
  url.searchParams.set('lang', 'pt');
  url.searchParams.set('region', 'br');

  const response = await fetch(url, { headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error(`ESPN sync failed with status ${response.status}`);

  return parseEspnScoreboard(await response.json());
}

function dedupeMatches(matches: MatchSnapshot[]) {
  return [...new Map(matches.map((match) => [match.externalId, match])).values()]
    .sort((a, b) => new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime());
}

function parseEspnDate(value: string) {
  if (!ESPN_DATE_PATTERN.test(value)) throw new Error(`Invalid ESPN date: ${value}`);
  const year = Number(value.slice(0, 4));
  const monthIndex = Number(value.slice(4, 6)) - 1;
  const day = Number(value.slice(6, 8));

  return new Date(Date.UTC(year, monthIndex, day));
}

function formatEspnDate(value: Date) {
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, '0');
  const day = String(value.getUTCDate()).padStart(2, '0');

  return `${year}${month}${day}`;
}
