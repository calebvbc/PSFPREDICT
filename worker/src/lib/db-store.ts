import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { matches, participants, predictions, feedEvents } from '../../../drizzle/schema';
import { scoreExactPrediction } from '../../../shared/scoring/exact-score';
import type { FeedEventSnapshot, MatchSnapshot, ParticipantPredictionsSnapshot, PredictionSnapshot, PublicPredictionSnapshot, RankingEntrySnapshot } from '../../../shared/types/domain';
import type { Env } from './env';
import { createDb } from './db';

const lastSaveByIp = new Map<string, number>();

type MatchRow = typeof matches.$inferSelect;
type ParticipantRow = typeof participants.$inferSelect;
type PredictionRow = typeof predictions.$inferSelect;

type PredictionInput = Omit<PredictionSnapshot, 'savedAt' | 'points'>;

export async function getParticipantByUsername(env: Env, username: string) {
  const db = createDb(env);
  const normalized = normalizeUsername(username);
  const participant = await db.query.participants.findFirst({ where: eq(participants.usernameNormalized, normalized) });
  if (!participant) return null;

  const rows = await db
    .select({ prediction: predictions, match: matches })
    .from(predictions)
    .innerJoin(matches, eq(predictions.matchId, matches.id))
    .where(eq(predictions.participantId, participant.id))
    .orderBy(asc(matches.kickoffAt));

  return participantSnapshot(participant, rows.map(({ prediction, match }) => predictionSnapshot(prediction, match.externalId)));
}

export async function listMatches(env: Env) {
  const db = createDb(env);
  return (await db.select().from(matches).orderBy(asc(matches.kickoffAt))).map(matchSnapshot);
}

export async function getRanking(env: Env) {
  const db = createDb(env);
  const participantRows = await db.select().from(participants).orderBy(asc(participants.createdAt));
  if (participantRows.length === 0) return [];

  const predictionRows = await db.select().from(predictions);
  return calculateRanking(participantRows, predictionRows);
}

export async function getFeedEvents(env: Env, limit = 30) {
  const db = createDb(env);
  const rows = await db.select().from(feedEvents).orderBy(desc(feedEvents.createdAt)).limit(limit);
  return rows.map((row) => ({
    id: String(row.id),
    type: isFeedEventType(row.type) ? row.type : 'sync',
    message: row.message,
    createdAt: row.createdAt.toISOString(),
  } satisfies FeedEventSnapshot));
}

export async function upsertParticipantPredictions(env: Env, args: {
  displayName: string;
  username: string;
  predictions: PredictionInput[];
}) {
  const db = createDb(env);
  const normalized = normalizeUsername(args.username);

  const [participant] = await db
    .insert(participants)
    .values({
      displayName: args.displayName,
      username: args.username.trim(),
      usernameNormalized: normalized,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: participants.usernameNormalized,
      set: {
        displayName: args.displayName,
        username: args.username.trim(),
        updatedAt: new Date(),
      },
    })
    .returning();

  for (const prediction of args.predictions) {
    const match = await getMatchByExternalId(env, prediction.matchExternalId);
    if (!match) throw new Error(`Partida não encontrada: ${prediction.matchExternalId}`);

    const points = calculatePredictionPoints(prediction, matchSnapshot(match));
    await db
      .insert(predictions)
      .values({
        participantId: participant.id,
        matchId: match.id,
        homeScore: prediction.homeScore,
        awayScore: prediction.awayScore,
        points,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [predictions.participantId, predictions.matchId],
        set: {
          homeScore: prediction.homeScore,
          awayScore: prediction.awayScore,
          points,
          updatedAt: new Date(),
        },
      });
  }

  return getParticipantByUsername(env, normalized);
}

export async function upsertMatches(env: Env, nextMatches: MatchSnapshot[]) {
  const db = createDb(env);
  if (nextMatches.length === 0) {
    return { matchCount: (await listMatches(env)).length, finalizedMatchCount: 0 };
  }

  const externalIds = nextMatches.map((match) => match.externalId);
  const previousMatches = await db.select().from(matches).where(inArray(matches.externalId, externalIds));
  const previousByExternalId = new Map(previousMatches.map((match) => [match.externalId, match]));
  const now = new Date();
  const values = nextMatches.map((match) => matchValues(match, now));
  const upsertedMatches = await db
    .insert(matches)
    .values(values)
    .onConflictDoUpdate({
      target: matches.externalId,
      set: {
        round: sql`excluded.round`,
        kickoffAt: sql`excluded.kickoff_at`,
        status: sql`excluded.status`,
        homeTeamId: sql`excluded.home_team_id`,
        homeTeamName: sql`excluded.home_team_name`,
        homeTeamLogoUrl: sql`excluded.home_team_logo_url`,
        homeTeamColor: sql`excluded.home_team_color`,
        homeTeamPlaceholder: sql`excluded.home_team_placeholder`,
        awayTeamId: sql`excluded.away_team_id`,
        awayTeamName: sql`excluded.away_team_name`,
        awayTeamLogoUrl: sql`excluded.away_team_logo_url`,
        awayTeamColor: sql`excluded.away_team_color`,
        awayTeamPlaceholder: sql`excluded.away_team_placeholder`,
        homeScore: sql`excluded.home_score`,
        awayScore: sql`excluded.away_score`,
        winnerTeamId: sql`excluded.winner_team_id`,
        updatedAt: now,
      },
    })
    .returning();

  const finalizedMatches = upsertedMatches.filter((upserted) => {
    const previous = previousByExternalId.get(upserted.externalId);
    if (!previous || upserted.status !== 'final') return false;
    return previous.status !== 'final' || previous.homeScore !== upserted.homeScore || previous.awayScore !== upserted.awayScore;
  });

  for (const finalizedMatch of finalizedMatches) {
    await rescorePredictionsForMatch(env, finalizedMatch);
    await generateFeedForFinalizedMatch(env, finalizedMatch);
  }

  return {
    matchCount: (await listMatches(env)).length,
    finalizedMatchCount: finalizedMatches.length,
  };
}

export async function validatePredictionWindow(env: Env, matchExternalId: string, now = Date.now()) {
  const match = await getMatchByExternalId(env, matchExternalId);
  if (!match) return { ok: false, error: 'Partida não encontrada.' } as const;
  if (match.homeTeamPlaceholder || match.awayTeamPlaceholder) return { ok: false, error: 'Partida ainda não tem os times definidos.' } as const;
  if (match.status !== 'scheduled') return { ok: false, error: 'Partida já começou ou foi encerrada.' } as const;
  if (match.kickoffAt.getTime() <= now) return { ok: false, error: 'Palpites encerrados para esta partida.' } as const;
  return { ok: true } as const;
}

export async function getPublicPredictionsForMatch(env: Env, matchExternalId: string, now = Date.now()) {
  const db = createDb(env);
  const match = await getMatchByExternalId(env, matchExternalId);
  if (!match) return { ok: false, error: 'Partida não encontrada.', predictions: [] as PublicPredictionSnapshot[] } as const;

  const isAfterKickoff = match.status !== 'scheduled' || match.kickoffAt.getTime() <= now;
  if (!isAfterKickoff) return { ok: false, error: 'Palpites serão revelados após o kickoff.', predictions: [] as PublicPredictionSnapshot[] } as const;

  const rows = await db
    .select({ prediction: predictions, participant: participants })
    .from(predictions)
    .innerJoin(participants, eq(predictions.participantId, participants.id))
    .where(eq(predictions.matchId, match.id))
    .orderBy(asc(participants.createdAt));

  return {
    ok: true,
    predictions: rows.map(({ prediction, participant }) => ({
      displayName: participant.displayName,
      initials: getInitials(participant.displayName),
      matchExternalId,
      homeScore: prediction.homeScore,
      awayScore: prediction.awayScore,
      points: prediction.points === 1 ? 1 : 0,
      savedAt: prediction.updatedAt.toISOString(),
    } satisfies PublicPredictionSnapshot)),
  } as const;
}

export function assertSaveRateLimit(ip: string, now = Date.now()) {
  const previous = lastSaveByIp.get(ip) ?? 0;
  const waitMs = 5_000 - (now - previous);
  if (waitMs > 0) {
    return { limited: true, retryAfterSeconds: Math.ceil(waitMs / 1_000) } as const;
  }

  lastSaveByIp.set(ip, now);
  return { limited: false } as const;
}

export async function forceRecalculateRanking(env: Env) {
  const db = createDb(env);
  const finalMatches = await db.select().from(matches).where(eq(matches.status, 'final'));
  for (const match of finalMatches) {
    await rescorePredictionsForMatch(env, match);
  }
  return getRanking(env);
}

async function getMatchByExternalId(env: Env, externalId: string) {
  const db = createDb(env);
  return db.query.matches.findFirst({ where: eq(matches.externalId, externalId) });
}

async function rescorePredictionsForMatch(env: Env, match: MatchRow) {
  const db = createDb(env);
  const rows = await db.select().from(predictions).where(eq(predictions.matchId, match.id));
  const snapshot = matchSnapshot(match);

  for (const prediction of rows) {
    await db
      .update(predictions)
      .set({
        points: calculatePredictionPoints(prediction, snapshot),
        updatedAt: new Date(),
      })
      .where(eq(predictions.id, prediction.id));
  }
}

async function generateFeedForFinalizedMatch(env: Env, match: MatchRow) {
  const db = createDb(env);
  const exactRows = await db
    .select({ prediction: predictions, participant: participants })
    .from(predictions)
    .innerJoin(participants, eq(predictions.participantId, participants.id))
    .where(and(eq(predictions.matchId, match.id), eq(predictions.points, 1)));

  const snapshot = matchSnapshot(match);
  const message = exactRows.length === 1
    ? `${exactRows[0].participant.displayName} acertou sozinho o placar de ${snapshot.homeTeam.name} × ${snapshot.awayTeam.name}.`
    : `Ranking recalculado após ${snapshot.homeTeam.name} × ${snapshot.awayTeam.name}.`;

  await db.insert(feedEvents).values({
    type: exactRows.length === 1 ? 'exact_score' : 'sync',
    message,
  });
}

function calculateRanking(participantRows: ParticipantRow[], predictionRows: PredictionRow[]): RankingEntrySnapshot[] {
  const predictionsByParticipant = new Map<number, PredictionRow[]>();
  for (const prediction of predictionRows) {
    const current = predictionsByParticipant.get(prediction.participantId) ?? [];
    current.push(prediction);
    predictionsByParticipant.set(prediction.participantId, current);
  }

  return participantRows
    .map((participant) => {
      const participantPredictions = predictionsByParticipant.get(participant.id) ?? [];
      const points = participantPredictions.reduce((sum, prediction) => sum + prediction.points, 0);
      const predictionsCount = participantPredictions.length;
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
    })
    .sort((a, b) => b.points - a.points || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .map((entry, index) => ({ ...entry, position: index + 1 }));
}

function participantSnapshot(participant: ParticipantRow, participantPredictions: PredictionSnapshot[]): ParticipantPredictionsSnapshot {
  return {
    displayName: participant.displayName,
    username: participant.usernameNormalized,
    createdAt: participant.createdAt.toISOString(),
    predictions: participantPredictions,
  };
}

function predictionSnapshot(prediction: PredictionRow, matchExternalId: string): PredictionSnapshot {
  return {
    matchExternalId,
    homeScore: prediction.homeScore,
    awayScore: prediction.awayScore,
    points: prediction.points === 1 ? 1 : 0,
    savedAt: prediction.updatedAt.toISOString(),
  };
}

function matchSnapshot(match: MatchRow): MatchSnapshot {
  return {
    externalId: match.externalId,
    round: match.round,
    kickoffAt: match.kickoffAt.toISOString(),
    status: match.status,
    homeTeam: {
      id: match.homeTeamId,
      name: match.homeTeamName,
      abbreviation: null,
      logoUrl: match.homeTeamLogoUrl,
      color: match.homeTeamColor,
      isPlaceholder: match.homeTeamPlaceholder,
    },
    awayTeam: {
      id: match.awayTeamId,
      name: match.awayTeamName,
      abbreviation: null,
      logoUrl: match.awayTeamLogoUrl,
      color: match.awayTeamColor,
      isPlaceholder: match.awayTeamPlaceholder,
    },
    homeScore: match.homeScore,
    awayScore: match.awayScore,
    winnerTeamId: match.winnerTeamId,
  };
}

function matchValues(match: MatchSnapshot, updatedAt = new Date()): typeof matches.$inferInsert {
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
    updatedAt,
  };
}

function calculatePredictionPoints(prediction: Pick<PredictionSnapshot, 'homeScore' | 'awayScore'>, match?: MatchSnapshot): 0 | 1 {
  if (!match || match.status !== 'final') return 0;
  return scoreExactPrediction({
    predictedHomeScore: prediction.homeScore,
    predictedAwayScore: prediction.awayScore,
    officialHomeScore: match.homeScore,
    officialAwayScore: match.awayScore,
  });
}

function getInitials(displayName: string) {
  return displayName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('') || '?';
}

function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}

function isFeedEventType(value: string): value is FeedEventSnapshot['type'] {
  return value === 'exact_score' || value === 'leader_change' || value === 'position_change' || value === 'sync';
}
