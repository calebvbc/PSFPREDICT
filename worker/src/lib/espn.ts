import { parseEspnScoreboard, parseEspnScoreboardEvent } from '../../../shared/espn/parser';
import type { MatchSnapshot } from '../../../shared/types/domain';
import type { Env } from './env';

const ESPN_DATE_PATTERN = /^\d{8}$/;
const ESPN_DATE_RANGE_PATTERN = /^(\d{8})-(\d{8})$/;
const EXPECTED_KNOCKOUT_MATCH_COUNT = 32;
const FIRST_2026_KNOCKOUT_EVENT_ID = 760486;

export async function fetchKnockoutMatches(env: Env) {
  const dateQueries = getEspnDateQueries(env.ESPN_KNOCKOUT_DATES);
  const matchGroups = await Promise.all(dateQueries.map((dates) => fetchKnockoutMatchesForDates(env, dates)));
  const scoreboardMatches = dedupeMatches(matchGroups.flat());
  if (scoreboardMatches.length >= EXPECTED_KNOCKOUT_MATCH_COUNT) return scoreboardMatches;

  const summaryMatches = await fetchKnockoutMatchesByEventId(env);
  return dedupeMatches([...scoreboardMatches, ...summaryMatches]);
}

export function getEspnDateQueries(dates: string): string[] {
  return [dates.trim()];
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

async function fetchKnockoutMatchesByEventId(env: Env) {
  const eventIds = Array.from({ length: EXPECTED_KNOCKOUT_MATCH_COUNT }, (_, index) => String(FIRST_2026_KNOCKOUT_EVENT_ID + index));
  const matches = await Promise.all(eventIds.map((eventId) => fetchKnockoutMatchSummary(env, eventId)));

  return matches.filter((match): match is MatchSnapshot => match !== null);
}

async function fetchKnockoutMatchSummary(env: Env, eventId: string) {
  const url = new URL('/apis/site/v2/sports/soccer/fifa.world/summary', getEspnSummaryBaseUrl(env));
  url.searchParams.set('event', eventId);
  url.searchParams.set('lang', 'pt');
  url.searchParams.set('region', 'br');

  const response = await fetch(url, { headers: { accept: 'application/json' } });
  if (!response.ok) return null;

  return parseEspnScoreboardEvent(asRecord(await response.json()).header).match;
}

async function fetchKnockoutMatchesForDates(env: Env, dates: string) {
  const url = new URL(env.ESPN_SCOREBOARD_URL);
  url.searchParams.set('dates', dates);
  url.searchParams.set('limit', '950');
  url.searchParams.set('lang', 'pt');
  url.searchParams.set('region', 'br');

  const response = await fetch(url, { headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error(`ESPN sync failed with status ${response.status}`);

  return parseEspnScoreboard(await response.json());
}

function getEspnSummaryBaseUrl(env: Env) {
  const scoreboardUrl = new URL(env.ESPN_SCOREBOARD_URL);
  scoreboardUrl.hostname = scoreboardUrl.hostname.replace(/^site\.api\./, 'site.web.api.');

  return scoreboardUrl;
}

function dedupeMatches(matches: MatchSnapshot[]) {
  return [...new Map(matches.map((match) => [match.externalId, match])).values()]
    .sort((a, b) => new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime());
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? value as Record<string, unknown> : {};
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
