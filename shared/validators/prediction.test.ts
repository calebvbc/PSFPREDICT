import { describe, expect, it } from 'vitest';
import { savePredictionsSchema } from './prediction';

describe('savePredictionsSchema', () => {
  it('accepts a valid prediction payload and normalizes username', () => {
    expect(savePredictionsSchema.parse({
      displayName: 'Jane Doe',
      username: 'JaneDoe',
      predictions: [{ matchExternalId: 'match-1', homeScore: 1, awayScore: 0 }],
    })).toMatchObject({ username: 'janedoe' });
  });

  it('rejects invalid score values', () => {
    expect(() => savePredictionsSchema.parse({
      displayName: 'Jane Doe',
      username: 'JaneDoe',
      predictions: [{ matchExternalId: 'match-1', homeScore: -1, awayScore: 0 }],
    })).toThrow();
  });
});
