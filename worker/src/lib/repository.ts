import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { feedEvents, matches, participants, predictions } from '../../../drizzle/schema';
import { scoreExactPrediction } from '../../../shared/scoring/exact-score';
import type { FeedEventSnapshot, MatchSnapshot, ParticipantPredictionsSnapshot, PredictionSnapshot, PublicPredictionSnapshot, RankingEntrySnapshot } from '../../../shared/types/domain';
import type { Database } from './db';
type SyncStatus = 'never' | 'success' | 'error';

interface SyncOperationalState {
  lastSyncAt: string | null;
  lastSyncStatus: SyncStatus;
  lastSyncError: string | null;
  lastFetchedMatchCount: number;
  matchCount: number;
}

const syncOperationalState: SyncOperationalState = {
  lastSyncAt: null,
  lastSyncStatus: 'never',
  lastSyncError: null,
  lastFetchedMatchCount: 0,
  matchCount: 0,
};

type DbMatch = typeof matches.$inferSelect;
type DbParticipant = typeof participants.$inferSelect;
type DbPrediction = typeof predictions.$inferSelect;

export function createRepository(db: Database) {
  return {
    getParticipantByUsername: (username: string) => getParticipantByUsername(db, username),
    listMatches: () => listMatches(db),
    upsertParticipantPredictions: (args: { displayName: string; username: string; predictions: Array<Omit<PredictionSnapshot, 'savedAt' | 'points'>> }) => upsertParticipantPredictions(db, args),
    upsertMatches: (nextMatches: MatchSnapshot[]) => upsertMatches(db, nextMatches),
    validatePredictionWindow: (matchExternalId: string, now?: number) => validatePredictionWindow(db, matchExternalId, now),
    getRanking: () => getRanking(db),
    getFeedEvents: (limit?: number) => getFeedEvents(db, limit),
    getPublicPredictionsForMatch: (matchExternalId: string, now?: number) => getPublicPredictionsForMatch(db, matchExternalId, now),
    forceRecalculateRanking: () => forceRecalculateRanking(db),
    getSyncOperationalState: () => getSyncOperationalState(db),
    recordSyncSuccess: (args: { syncedAt: string; fetchedMatchCount: number }) => recordSyncSuccess(db, args),
    recordSyncFailure: (args: { syncedAt: string; error: string }) => recordSyncFailure(db, args),
  };
}

export async function getParticipantByUsername(db: Database, username: string) {
  const normalized = username.toLowerCase();
  const [participant] = await db.select().from(participants).where(eq(participants.usernameNormalized, normalized)).limit(1);
  if (!participant) return null;

  const rows = await db.select({ prediction: predictions, match: matches })
    .from(predictions)
    .innerJoin(matches, eq(predictions.matchId, matches.id))
    .where(eq(predictions.participantId, participant.id))
    .orderBy(asc(matches.kickoffAt));

  return toParticipantSnapshot(participant, rows.map((row) => toPredictionSnapshot(row.prediction, row.match)));
}

export async function listMatches(db: Database) {
  const rows = await db.select().from(matches).orderBy(asc(matches.kickoffAt));
  return rows.map(toMatchSnapshot);
}

export async function upsertParticipantPredictions(db: Database, args: { displayName: string; username: string; predictions: Array<Omit<PredictionSnapshot, 'savedAt' | 'points'>> }) {
  const normalizedUsername = args.username.toLowerCase();
  const now = new Date();

  const [participant] = await db.insert(participants).values({
    displayName: args.displayName,
    username: normalizedUsername,
    usernameNormalized: normalizedUsername,
    updatedAt: now,
  }).onConflictDoUpdate({
    target: participants.usernameNormalized,
    set: { displayName: args.displayName, username: normalizedUsername, updatedAt: now },
  }).returning();

  for (const prediction of args.predictions) {
    const [match] = await db.select().from(matches).where(eq(matches.externalId, prediction.matchExternalId)).limit(1);
    if (!match) continue;

    await db.insert(predictions).values({
      participantId: participant.id,
      matchId: match.id,
      homeScore: prediction.homeScore,
      awayScore: prediction.awayScore,
      points: calculatePredictionPoints(prediction, toMatchSnapshot(match)),
      updatedAt: now,
    }).onConflictDoUpdate({
      target: [predictions.participantId, predictions.matchId],
      set: {
        homeScore: prediction.homeScore,
        awayScore: prediction.awayScore,
        points: calculatePredictionPoints(prediction, toMatchSnapshot(match)),
        updatedAt: now,
      },
    });
  }

  return (await getParticipantByUsername(db, normalizedUsername))!;
}

export async function upsertMatches(db: Database, nextMatches: MatchSnapshot[]) {
  const finalizedMatches: MatchSnapshot[] = [];

  for (const nextMatch of nextMatches) {
    const [previous] = await db.select().from(matches).where(eq(matches.externalId, nextMatch.externalId)).limit(1);
    const becameFinal = nextMatch.status === 'final' && previous?.status !== 'final';
    const finalScoreChanged = nextMatch.status === 'final' && previous?.status === 'final' && (previous.homeScore !== nextMatch.homeScore || previous.awayScore !== nextMatch.awayScore);

    await db.insert(matches).values(toMatchInsert(nextMatch)).onConflictDoUpdate({
      target: matches.externalId,
      set: { ...toMatchInsert(nextMatch), updatedAt: new Date() },
    });

    if (becameFinal || finalScoreChanged) {
      finalizedMatches.push(nextMatch);
      await rescorePredictionsForMatch(db, nextMatch);
    }
  }

  if (finalizedMatches.length > 0) await addFeedEvents(db, finalizedMatches);
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(matches);
  return { matchCount: count, finalizedMatchCount: finalizedMatches.length };
}

export async function validatePredictionWindow(db: Database, matchExternalId: string, now = Date.now()) {
  const [matchRow] = await db.select().from(matches).where(eq(matches.externalId, matchExternalId)).limit(1);
  if (!matchRow) return { ok: false, error: 'Partida não encontrada.' } as const;
  const match = toMatchSnapshot(matchRow);
  if (match.homeTeam.isPlaceholder || match.awayTeam.isPlaceholder) return { ok: false, error: 'Partida ainda não tem os times definidos.' } as const;
  if (match.status !== 'scheduled') return { ok: false, error: 'Partida já começou ou foi encerrada.' } as const;
  if (new Date(match.kickoffAt).getTime() <= now) return { ok: false, error: 'Palpites encerrados para esta partida.' } as const;
  return { ok: true } as const;
}

export async function getRanking(db: Database) {
  const participantRows = await db.select().from(participants);
  const predictionRows = await db.select().from(predictions);
  return participantRows.map((participant) => {
    const ownPredictions = predictionRows.filter((prediction) => prediction.participantId === participant.id);
    const points = ownPredictions.reduce((sum, prediction) => sum + prediction.points, 0);
    const predictionsCount = ownPredictions.length;
    return {
      position: 0,
      previousPosition: null,
      positionDelta: 0,
      displayName: participant.displayName,
      username: participant.usernameNormalized,
      initials: getInitials(participant.displayName),
      points,
      predictionsCount,
      accuracy: predictionsCount === 0 ? 0 : Math.round((points / predictionsCount) * 100),
      createdAt: participant.createdAt.toISOString(),
    } satisfies RankingEntrySnapshot;
  }).sort((a, b) => b.points - a.points || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()).map((entry, index) => ({ ...entry, position: index + 1 }));
}

export async function getFeedEvents(db: Database, limit = 30) {
  const rows = await db.select().from(feedEvents).orderBy(desc(feedEvents.createdAt)).limit(limit);
  return rows.map((row) => ({ id: String(row.id), type: row.type as FeedEventSnapshot['type'], message: row.message, createdAt: row.createdAt.toISOString() }));
}

export async function getPublicPredictionsForMatch(db: Database, matchExternalId: string, now = Date.now()) {
  const [matchRow] = await db.select().from(matches).where(eq(matches.externalId, matchExternalId)).limit(1);
  if (!matchRow) return { ok: false, error: 'Partida não encontrada.', predictions: [] as PublicPredictionSnapshot[] } as const;
  const match = toMatchSnapshot(matchRow);
  const isAfterKickoff = match.status !== 'scheduled' || new Date(match.kickoffAt).getTime() <= now;
  if (!isAfterKickoff) return { ok: false, error: 'Palpites serão revelados após o kickoff.', predictions: [] as PublicPredictionSnapshot[] } as const;

  const rows = await db.select({ participant: participants, prediction: predictions })
    .from(predictions)
    .innerJoin(participants, eq(predictions.participantId, participants.id))
    .where(eq(predictions.matchId, matchRow.id));

  return { ok: true, predictions: rows.map(({ participant, prediction }) => ({
    participantKey: getParticipantKey(participant.usernameNormalized),
    displayName: participant.displayName,
    initials: getInitials(participant.displayName),
    matchExternalId,
    homeScore: prediction.homeScore,
    awayScore: prediction.awayScore,
    points: prediction.points as 0 | 1,
    savedAt: prediction.updatedAt.toISOString(),
  })) } as const;
}

export async function forceRecalculateRanking(db: Database) {
  const finalMatches = (await db.select().from(matches).where(eq(matches.status, 'final'))).map(toMatchSnapshot);
  for (const match of finalMatches) await rescorePredictionsForMatch(db, match);
  return getRanking(db);
}

async function getSyncOperationalState(db: Database): Promise<SyncOperationalState> {
  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(matches);
  return { ...syncOperationalState, matchCount: count };
}

async function recordSyncSuccess(db: Database, args: { syncedAt: string; fetchedMatchCount: number }) {
  syncOperationalState.lastSyncAt = args.syncedAt;
  syncOperationalState.lastSyncStatus = 'success';
  syncOperationalState.lastSyncError = null;
  syncOperationalState.lastFetchedMatchCount = args.fetchedMatchCount;
  return getSyncOperationalState(db);
}

async function recordSyncFailure(db: Database, args: { syncedAt: string; error: string }) {
  syncOperationalState.lastSyncAt = args.syncedAt;
  syncOperationalState.lastSyncStatus = 'error';
  syncOperationalState.lastSyncError = args.error;
  return getSyncOperationalState(db);
}

async function rescorePredictionsForMatch(db: Database, match: MatchSnapshot) {
  const [matchRow] = await db.select().from(matches).where(eq(matches.externalId, match.externalId)).limit(1);
  if (!matchRow) return;
  const predictionRows = await db.select().from(predictions).where(eq(predictions.matchId, matchRow.id));
  for (const prediction of predictionRows) {
    await db.update(predictions).set({ points: calculatePredictionPoints(prediction, match), updatedAt: new Date() }).where(eq(predictions.id, prediction.id));
  }
}

async function addFeedEvents(db: Database, finalizedMatches: MatchSnapshot[]) {
  const ranking = await getRanking(db);
  for (const match of finalizedMatches) {
    const [matchRow] = await db.select().from(matches).where(eq(matches.externalId, match.externalId)).limit(1);
    if (!matchRow) continue;
    const exact = await db.select({ participant: participants }).from(predictions).innerJoin(participants, eq(predictions.participantId, participants.id)).where(and(eq(predictions.matchId, matchRow.id), eq(predictions.points, 1)));
    if (exact.length === 1) await db.insert(feedEvents).values({ type: 'exact_score', message: `${exact[0].participant.displayName} acertou sozinho o placar de ${match.homeTeam.name} × ${match.awayTeam.name}.` });
  }
  const leader = ranking[0];
  if (leader) await db.insert(feedEvents).values({ type: 'leader_change', message: `${leader.displayName} lidera com ${leader.points} ponto${leader.points === 1 ? '' : 's'}.` });
}

function toParticipantSnapshot(participant: DbParticipant, participantPredictions: PredictionSnapshot[]): ParticipantPredictionsSnapshot {
  return { displayName: participant.displayName, username: participant.usernameNormalized, createdAt: participant.createdAt.toISOString(), predictions: participantPredictions };
}

function toPredictionSnapshot(prediction: DbPrediction, match: DbMatch): PredictionSnapshot {
  return { matchExternalId: match.externalId, homeScore: prediction.homeScore, awayScore: prediction.awayScore, points: prediction.points as 0 | 1, savedAt: prediction.updatedAt.toISOString() };
}

function toMatchSnapshot(match: DbMatch): MatchSnapshot {
  return {
    externalId: match.externalId,
    round: match.round,
    kickoffAt: match.kickoffAt.toISOString(),
    status: match.status,
    homeTeam: { id: match.homeTeamId, name: match.homeTeamName, abbreviation: null, logoUrl: match.homeTeamLogoUrl, color: match.homeTeamColor, isPlaceholder: match.homeTeamPlaceholder },
    awayTeam: { id: match.awayTeamId, name: match.awayTeamName, abbreviation: null, logoUrl: match.awayTeamLogoUrl, color: match.awayTeamColor, isPlaceholder: match.awayTeamPlaceholder },
    homeScore: match.homeScore,
    awayScore: match.awayScore,
    winnerTeamId: match.winnerTeamId,
  };
}

function toMatchInsert(match: MatchSnapshot) {
  return {
    externalId: match.externalId,
    round: match.round,
    kickoffAt: new Date(match.kickoffAt),
    status: match.status,
    homeTeamId: match.homeTeam.id,
    homeTeamName: match.homeTeam.name,
    homeTeamLogoUrl: match.homeTeam.logoUrl,
    homeTeamColor: match.homeTeam.color,
    homeTeamPlaceholder: match.homeTeam.isPlaceholder,
    awayTeamId: match.awayTeam.id,
    awayTeamName: match.awayTeam.name,
    awayTeamLogoUrl: match.awayTeam.logoUrl,
    awayTeamColor: match.awayTeam.color,
    awayTeamPlaceholder: match.awayTeam.isPlaceholder,
    homeScore: match.homeScore,
    awayScore: match.awayScore,
    winnerTeamId: match.winnerTeamId,
  };
}

function calculatePredictionPoints(prediction: Pick<PredictionSnapshot, 'homeScore' | 'awayScore'>, match?: MatchSnapshot): 0 | 1 {
  if (!match || match.status !== 'final') return 0;
  return scoreExactPrediction({ predictedHomeScore: prediction.homeScore, predictedAwayScore: prediction.awayScore, officialHomeScore: match.homeScore, officialAwayScore: match.awayScore });
}

function getInitials(displayName: string) {
  return displayName.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('') || '?';
}

function getParticipantKey(username: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < username.length; index += 1) {
    hash ^= username.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `participant:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}
