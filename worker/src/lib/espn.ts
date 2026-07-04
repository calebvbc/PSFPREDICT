import { parseEspnScoreboard } from '../../../shared/espn/parser';
import type { Env } from './env';

export async function fetchKnockoutMatches(env: Env) {
  const url = new URL(env.ESPN_SCOREBOARD_URL);
  url.searchParams.set('dates', env.ESPN_KNOCKOUT_DATES);
  url.searchParams.set('limit', '100');
  url.searchParams.set('lang', 'pt');
  url.searchParams.set('region', 'br');

  const response = await fetch(url, { headers: { accept: 'application/json' } });
  if (!response.ok) throw new Error(`ESPN sync failed with status ${response.status}`);

  return parseEspnScoreboard(await response.json());
}
