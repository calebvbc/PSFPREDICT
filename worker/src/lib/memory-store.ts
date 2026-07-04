import type { ParticipantPredictionsSnapshot, PredictionSnapshot } from '../../../shared/types/domain';

const participants = new Map<string, ParticipantPredictionsSnapshot>();
const lastSaveByIp = new Map<string, number>();

export function getParticipantByUsername(username: string) {
  return participants.get(username.toLowerCase()) ?? null;
}

export function upsertParticipantPredictions(args: {
  displayName: string;
  username: string;
  predictions: Array<Omit<PredictionSnapshot, 'savedAt'>>;
}) {
  const normalizedUsername = args.username.toLowerCase();
  const existing = participants.get(normalizedUsername);
  const byMatch = new Map<string, PredictionSnapshot>();

  for (const prediction of existing?.predictions ?? []) {
    byMatch.set(prediction.matchExternalId, prediction);
  }

  const savedAt = new Date().toISOString();
  for (const prediction of args.predictions) {
    byMatch.set(prediction.matchExternalId, { ...prediction, savedAt });
  }

  const participant: ParticipantPredictionsSnapshot = {
    displayName: args.displayName,
    username: normalizedUsername,
    predictions: Array.from(byMatch.values()),
  };

  participants.set(normalizedUsername, participant);
  return participant;
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
