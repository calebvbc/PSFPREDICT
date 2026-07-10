export function scoreExactPrediction(args: {
  predictedHomeScore: number | null;
  predictedAwayScore: number | null;
  officialHomeScore: number | null;
  officialAwayScore: number | null;
}): 0 | 1 | 3 {
  if (args.predictedHomeScore === null || args.predictedAwayScore === null) return 0;
  if (args.officialHomeScore === null || args.officialAwayScore === null) return 0;

  const homeScoreMatches = args.predictedHomeScore === args.officialHomeScore;
  const awayScoreMatches = args.predictedAwayScore === args.officialAwayScore;

  if (homeScoreMatches && awayScoreMatches) return 3;
  if (homeScoreMatches || awayScoreMatches) return 1;
  return 0;
}
