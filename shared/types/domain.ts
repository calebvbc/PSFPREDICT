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

export interface PredictionSnapshot {
  matchExternalId: string;
  homeScore: number;
  awayScore: number;
  points: 0 | 1;
  savedAt: string;
}

export interface ParticipantPredictionsSnapshot {
  displayName: string;
  username: string;
  createdAt: string;
  predictions: PredictionSnapshot[];
}

export interface RankingEntrySnapshot {
  position: number;
  previousPosition: number | null;
  positionDelta: number;
  displayName: string;
  username: string;
  initials: string;
  points: number;
  predictionsCount: number;
  accuracy: number;
  createdAt: string;
}

export interface FeedEventSnapshot {
  id: string;
  type: 'exact_score' | 'leader_change' | 'position_change' | 'sync';
  message: string;
  createdAt: string;
  matchExternalId?: string;
  username?: string;
}

export interface PublicPredictionSnapshot {
  participantKey: string;
  displayName: string;
  initials: string;
  matchExternalId: string;
  homeScore: number;
  awayScore: number;
  points: 0 | 1;
  savedAt: string;
}
