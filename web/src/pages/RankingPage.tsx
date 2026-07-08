import type { RankingEntrySnapshot } from '../../../shared/types/domain';
import { EmptyCard, ErrorCard } from '../components/InfoPanel';
import { ChampionBanner, RankingCard } from '../components/RankingCard';
import type { PublicDataError } from '../types';

export function RankingPage({ ranking, finalMatchClosed, leaders, loading, error }: { ranking: RankingEntrySnapshot[]; finalMatchClosed: boolean; leaders: RankingEntrySnapshot[]; loading: boolean; error?: PublicDataError }) {
  return <section className="mx-auto grid max-w-3xl gap-4 px-4 py-6 sm:px-5 sm:py-8">{finalMatchClosed && leaders.length > 0 && <ChampionBanner leaders={leaders} />}
    <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Ranking Geral</h1>
    {error && <ErrorCard message={error} />}
    {loading && <EmptyCard message="Carregando ranking..." />}
    {!loading && ranking.length === 0 && <EmptyCard message="Ranking ainda vazio." />}
    {ranking.map((entry) => <RankingCard entry={entry} key={entry.username} highlight={finalMatchClosed && entry.position === 1} />)}
  </section>;
}
