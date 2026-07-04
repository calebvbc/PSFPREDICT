export type MatchRound = 'round_of_16' | 'quarterfinal' | 'semifinal' | 'third_place' | 'final';

export type MatchStatus = 'scheduled' | 'in_progress' | 'final';

export interface TeamSnapshot {
  id: string;
  name: string;
  abbreviation: string | null;
  logoUrl: string | null;
  color: string | null;
  isPlaceholder: boolean;
}

export interface MatchSnapshot {
  externalId: string;
  round: MatchRound;
  kickoffAt: string;
  status: MatchStatus;
  homeTeam: TeamSnapshot;
  awayTeam: TeamSnapshot;
  homeScore: number | null;
  awayScore: number | null;
  winnerTeamId: string | null;
}
