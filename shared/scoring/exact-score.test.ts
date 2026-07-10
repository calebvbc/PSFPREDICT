import { describe, expect, it } from 'vitest';
import { scoreExactPrediction } from './exact-score';

describe('scoreExactPrediction', () => {
  it('returns 3 for an exact score prediction', () => {
    expect(scoreExactPrediction({
      predictedHomeScore: 2,
      predictedAwayScore: 1,
      officialHomeScore: 2,
      officialAwayScore: 1,
    })).toBe(3);
  });

  it('returns 1 when one team score matches', () => {
    expect(scoreExactPrediction({
      predictedHomeScore: 0,
      predictedAwayScore: 1,
      officialHomeScore: 2,
      officialAwayScore: 1,
    })).toBe(1);
  });

  it('returns 0 when no team score matches', () => {
    expect(scoreExactPrediction({
      predictedHomeScore: 2,
      predictedAwayScore: 0,
      officialHomeScore: 1,
      officialAwayScore: 1,
    })).toBe(0);
  });
});
