import { describe, expect, it } from 'vitest';
import { scoreExactPrediction } from './exact-score';

describe('scoreExactPrediction', () => {
  it('returns 1 for an exact score prediction', () => {
    expect(scoreExactPrediction({
      predictedHomeScore: 2,
      predictedAwayScore: 1,
      officialHomeScore: 2,
      officialAwayScore: 1,
    })).toBe(1);
  });

  it('returns 0 for a non-exact score prediction', () => {
    expect(scoreExactPrediction({
      predictedHomeScore: 2,
      predictedAwayScore: 0,
      officialHomeScore: 2,
      officialAwayScore: 1,
    })).toBe(0);
  });
});
