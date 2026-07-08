import type { PublicPredictionSnapshot } from '../../shared/types/domain';

export type ScoreDraft = { homeScore: string; awayScore: string; saved?: boolean; error?: string };
export type ToastState = { type: 'success' | 'error'; message: string } | null;
export type MatchPredictionsState = Record<string, { loading?: boolean; predictions?: PublicPredictionSnapshot[]; error?: string }>;
export type PublicDataError = string;
