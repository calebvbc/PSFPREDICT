import type { MatchSnapshot } from '../../../shared/types/domain';

export function isPlaceholderTeam(team: MatchSnapshot['homeTeam']) {
  return team.isPlaceholder || /^(a definir|vencedor|perdedor)/i.test(team.name.trim());
}

export const TEAM_FLAG_EMOJIS: Record<string, string> = {
  africadosul: '🇿🇦', alemanha: '🇩🇪', arabiasaudita: '🇸🇦', argentina: '🇦🇷', australia: '🇦🇺', belgica: '🇧🇪', brasil: '🇧🇷', camaroes: '🇨🇲', canada: '🇨🇦', catar: '🇶🇦', chile: '🇨🇱', china: '🇨🇳', colombia: '🇨🇴', coreiadosul: '🇰🇷', costarica: '🇨🇷', croacia: '🇭🇷', dinamarca: '🇩🇰', egito: '🇪🇬', equador: '🇪🇨', escocia: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', espanha: '🇪🇸', estadosunidos: '🇺🇸', eua: '🇺🇸', franca: '🇫🇷', gana: '🇬🇭', holanda: '🇳🇱', inglaterra: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', ira: '🇮🇷', irlanda: '🇮🇪', italia: '🇮🇹', jamaica: '🇯🇲', japao: '🇯🇵', marrocos: '🇲🇦', mexico: '🇲🇽', nigeria: '🇳🇬', noruega: '🇳🇴', novazelandia: '🇳🇿', paisesbaixos: '🇳🇱', panama: '🇵🇦', paraguai: '🇵🇾', peru: '🇵🇪', polonia: '🇵🇱', portugal: '🇵🇹', senegal: '🇸🇳', servia: '🇷🇸', suecia: '🇸🇪', suica: '🇨🇭', uruguai: '🇺🇾'
};

const TEAM_CODES: Record<string, string> = {
  africadosul: 'RSA', alemanha: 'GER', arabiasaudita: 'KSA', argentina: 'ARG', australia: 'AUS', belgica: 'BEL', brasil: 'BRA', camaroes: 'CMR', canada: 'CAN', catar: 'QAT', chile: 'CHI', china: 'CHN', colombia: 'COL', coreiadosul: 'KOR', costarica: 'CRC', croacia: 'CRO', dinamarca: 'DEN', equador: 'ECU', escocia: 'SCO', espanha: 'ESP', estadosunidos: 'USA', eua: 'USA', franca: 'FRA', gana: 'GHA', holanda: 'NED', inglaterra: 'ENG', ira: 'IRN', irlanda: 'IRL', italia: 'ITA', jamaica: 'JAM', japao: 'JPN', marrocos: 'MAR', mexico: 'MEX', nigeria: 'NGA', noruega: 'NOR', novazelandia: 'NZL', paisesbaixos: 'NED', panama: 'PAN', paraguai: 'PAR', peru: 'PER', polonia: 'POL', portugal: 'POR', senegal: 'SEN', servia: 'SRB', suecia: 'SWE', suica: 'SUI', uruguai: 'URU'
};

export function teamEmoji(team: MatchSnapshot['homeTeam']) {
  if (isPlaceholderTeam(team)) return undefined;
  return TEAM_FLAG_EMOJIS[normalizeTeamName(team.name)];
}

export function teamCode(team: MatchSnapshot['homeTeam']) {
  if (team.abbreviation) return team.abbreviation.toUpperCase();

  const normalizedName = normalizeTeamName(team.name);
  return TEAM_CODES[normalizedName] ?? normalizedName.slice(0, 3).toUpperCase();
}

function normalizeTeamName(name: string) {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z]/g, '');
}
