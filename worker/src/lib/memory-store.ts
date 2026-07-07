import { scoreExactPrediction } from '../../../shared/scoring/exact-score';
import type { FeedEventSnapshot, MatchSnapshot, ParticipantPredictionsSnapshot, PredictionSnapshot, PublicPredictionSnapshot, RankingEntrySnapshot } from '../../../shared/types/domain';

const participants = new Map<string, ParticipantPredictionsSnapshot>();
const matches = new Map<string, MatchSnapshot>();
let ranking: RankingEntrySnapshot[] = [];
let previousPositions = new Map<string, number>();
const feedEvents: FeedEventSnapshot[] = [];

export function getParticipantByUsername(username: string) {
  return participants.get(username.toLowerCase()) ?? null;
}

export function listMatches() {
  return Array.from(matches.values()).sort((a, b) => new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime());
}

export function getRanking() {
  return ranking;
}

export function getFeedEvents(limit = 30) {
  return feedEvents.slice(0, limit);
}

export function upsertParticipantPredictions(args: {
  displayName: string;
  username: string;
  predictions: Array<Omit<PredictionSnapshot, 'savedAt' | 'points'>>;
}) {
  const normalizedUsername = args.username.toLowerCase();
  const existing = participants.get(normalizedUsername);
  const byMatch = new Map<string, PredictionSnapshot>();

  for (const prediction of existing?.predictions ?? []) {
    byMatch.set(prediction.matchExternalId, prediction);
  }

  const savedAt = new Date().toISOString();
  for (const prediction of args.predictions) {
    const match = matches.get(prediction.matchExternalId);
    byMatch.set(prediction.matchExternalId, {
      ...prediction,
      points: calculatePredictionPoints(prediction, match),
      savedAt,
    });
  }

  const participant: ParticipantPredictionsSnapshot = {
    displayName: args.displayName,
    username: normalizedUsername,
    createdAt: existing?.createdAt ?? savedAt,
    predictions: Array.from(byMatch.values()),
  };

  participants.set(normalizedUsername, participant);
  recalculateRanking();
  return participant;
}

export function upsertMatches(nextMatches: MatchSnapshot[]) {
  const finalizedMatches: MatchSnapshot[] = [];

  for (const nextMatch of nextMatches) {
    const previous = matches.get(nextMatch.externalId);
    matches.set(nextMatch.externalId, nextMatch);

    const becameFinal = nextMatch.status === 'final' && previous?.status !== 'final';
    const finalScoreChanged = nextMatch.status === 'final'
      && previous?.status === 'final'
      && (previous.homeScore !== nextMatch.homeScore || previous.awayScore !== nextMatch.awayScore);

    if (becameFinal || finalScoreChanged) {
      finalizedMatches.push(nextMatch);
      rescorePredictionsForMatch(nextMatch);
    }
  }

  if (finalizedMatches.length > 0) {
    recalculateRanking(finalizedMatches);
  }

  return {
    matchCount: matches.size,
    finalizedMatchCount: finalizedMatches.length,
  };
}


export function getPublicPredictionsForMatch(matchExternalId: string, now = Date.now()) {
  const match = matches.get(matchExternalId);
  if (!match) return { ok: false, error: 'Partida não encontrada.', predictions: [] as PublicPredictionSnapshot[] } as const;

  const isAfterKickoff = match.status !== 'scheduled' || new Date(match.kickoffAt).getTime() <= now;
  if (!isAfterKickoff) return { ok: false, error: 'Palpites serão revelados após o kickoff.', predictions: [] as PublicPredictionSnapshot[] } as const;

  const predictions = Array.from(participants.values()).flatMap((participant) => {
    const prediction = participant.predictions.find((item) => item.matchExternalId === matchExternalId);
    if (!prediction) return [];

    return [{
      participantKey: getParticipantKey(participant.username),
      displayName: participant.displayName,
      initials: getInitials(participant.displayName),
      matchExternalId,
      homeScore: prediction.homeScore,
      awayScore: prediction.awayScore,
      points: prediction.points,
      savedAt: prediction.savedAt,
    } satisfies PublicPredictionSnapshot];
  });

  return { ok: true, predictions } as const;
}

export function validatePredictionWindow(matchExternalId: string, now = Date.now()) {
  const match = matches.get(matchExternalId);
  if (!match) return { ok: false, error: 'Partida não encontrada.' } as const;
  if (match.homeTeam.isPlaceholder || match.awayTeam.isPlaceholder) return { ok: false, error: 'Partida ainda não tem os times definidos.' } as const;
  if (match.status !== 'scheduled') return { ok: false, error: 'Partida já começou ou foi encerrada.' } as const;
  if (new Date(match.kickoffAt).getTime() <= now) return { ok: false, error: 'Palpites encerrados para esta partida.' } as const;
  return { ok: true } as const;
}

export function forceRecalculateRanking() {
  for (const match of matches.values()) {
    if (match.status === 'final') rescorePredictionsForMatch(match);
  }
  return recalculateRanking();
}

function rescorePredictionsForMatch(match: MatchSnapshot) {
  for (const participant of participants.values()) {
    let changed = false;
    const predictions = participant.predictions.map((prediction) => {
      if (prediction.matchExternalId !== match.externalId) return prediction;
      changed = true;
      return { ...prediction, points: calculatePredictionPoints(prediction, match) };
    });

    if (changed) {
      participants.set(participant.username, { ...participant, predictions });
    }
  }
}

function recalculateRanking(finalizedMatches: MatchSnapshot[] = []) {
  const nextRanking = Array.from(participants.values())
    .map((participant) => {
      const points = participant.predictions.reduce((sum, prediction) => sum + prediction.points, 0);
      const predictionsCount = participant.predictions.length;
      return {
        position: 0,
        previousPosition: previousPositions.get(participant.username) ?? null,
        positionDelta: 0,
        displayName: participant.displayName,
        username: participant.username,
        initials: getInitials(participant.displayName),
        points,
        predictionsCount,
        accuracy: predictionsCount === 0 ? 0 : Math.round((points / predictionsCount) * 100),
        createdAt: participant.createdAt,
      } satisfies RankingEntrySnapshot;
    })
    .sort((a, b) => b.points - a.points || new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  nextRanking.forEach((entry, index) => {
    entry.position = index + 1;
    entry.positionDelta = entry.previousPosition === null ? 0 : entry.previousPosition - entry.position;
  });

  const oldLeader = ranking[0]?.username ?? null;
  ranking = nextRanking;
  previousPositions = new Map(ranking.map((entry) => [entry.username, entry.position]));

  addFeedEvents(finalizedMatches, oldLeader, ranking);
  return ranking;
}

function addFeedEvents(finalizedMatches: MatchSnapshot[], oldLeader: string | null, nextRanking: RankingEntrySnapshot[]) {
  for (const match of finalizedMatches) {
    const exactPredictions = Array.from(participants.values()).filter((participant) =>
      participant.predictions.some((prediction) => prediction.matchExternalId === match.externalId && prediction.points === 1),
    );

    if (exactPredictions.length === 1) {
      const participant = exactPredictions[0];
      prependFeedEvent({
        type: 'exact_score',
        username: participant.username,
        matchExternalId: match.externalId,
        message: `${participant.displayName} acertou sozinho o placar de ${match.homeTeam.name} × ${match.awayTeam.name}.`,
      });
    }
  }

  const newLeader = nextRanking[0];
  if (newLeader && oldLeader && newLeader.username !== oldLeader) {
    prependFeedEvent({
      type: 'leader_change',
      username: newLeader.username,
      message: `${newLeader.displayName} assumiu a liderança com ${newLeader.points} ponto${newLeader.points === 1 ? '' : 's'}.`,
    });
  }

  for (const entry of nextRanking) {
    if (Math.abs(entry.positionDelta) >= 4) {
      prependFeedEvent({
        type: 'position_change',
        username: entry.username,
        message: entry.positionDelta > 0
          ? `${entry.displayName} subiu ${entry.positionDelta} posições no ranking.`
          : `${entry.displayName} caiu ${Math.abs(entry.positionDelta)} posições no ranking.`,
      });
    }
  }
}

function prependFeedEvent(event: Omit<FeedEventSnapshot, 'id' | 'createdAt'>) {
  feedEvents.unshift({
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    ...event,
  });

  if (feedEvents.length > 100) feedEvents.length = 100;
}

function getParticipantKey(username: string) {
  return `participant:${hashString(username)}`;
}

function hashString(value: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
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
