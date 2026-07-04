export function scoreExactPrediction(args: {
  predictedHomeScore: number | null;
  predictedAwayScore: number | null;
  officialHomeScore: number | null;
  officialAwayScore: number | null;
}): 0 | 1 {
  if (args.predictedHomeScore === null || args.predictedAwayScore === null) return 0;
  if (args.officialHomeScore === null || args.officialAwayScore === null) return 0;

  return args.predictedHomeScore === args.officialHomeScore && args.predictedAwayScore === args.officialAwayScore ? 1 : 0;
}
