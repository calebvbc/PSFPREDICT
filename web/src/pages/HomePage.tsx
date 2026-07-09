import type { FeedEventSnapshot, MatchSnapshot, RankingEntrySnapshot } from '../../../shared/types/domain';
import { EmptySmall, ErrorCard, InfoPanel } from '../components/InfoPanel';
import { ChampionBanner, RankingMini } from '../components/RankingCard';
import { formatKickoff, ROUND_LABELS } from '../lib/presentation';
import type { PublicDataError } from '../types';

export function HomePage({ nextMatch, ranking, feed, finalMatchClosed, leaders, navigate, loading, error }: { nextMatch?: MatchSnapshot; ranking: RankingEntrySnapshot[]; feed: FeedEventSnapshot[]; finalMatchClosed: boolean; leaders: RankingEntrySnapshot[]; navigate: (path: string) => void; loading: boolean; error?: PublicDataError }) {
  return (
    <section className="mx-auto grid max-w-5xl gap-5 px-4 py-6 sm:gap-6 sm:px-5 sm:py-8">
      {error && <ErrorCard message={error} />}
      {finalMatchClosed && leaders.length > 0 && <ChampionBanner leaders={leaders} />}
      <div className="rounded-[1.5rem] bg-psf-surface p-6 shadow-card sm:rounded-[2rem] sm:p-8">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-psf-blue sm:text-sm">Copa do Mundo 2026</p>
        <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">O bolão oficial da PSF no mata-mata.</h1>
        <p className="mt-4 max-w-2xl text-base text-psf-secondary sm:text-lg">Palpite rápido, ranking automático e suspense até o kickoff. Tudo em uma experiência clara, mobile first e feita para a comunidade.</p>
        <button className="mt-7 w-full rounded-full bg-psf-blue px-6 py-4 text-base font-black text-white shadow-card sm:w-auto sm:px-8 sm:text-lg" onClick={() => navigate('/palpites')} type="button">Fazer meus palpites</button>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <InfoPanel title="Próximo jogo">{loading ? <EmptySmall text="Carregando dados..." /> : nextMatch ? <MiniMatch match={nextMatch} /> : <EmptySmall text="Nenhum jogo aberto agora." />}</InfoPanel>
        <InfoPanel title="Liderança">{loading ? <EmptySmall text="Carregando ranking..." /> : ranking.length > 0 ? ranking.map((entry) => <RankingMini entry={entry} key={entry.username} />) : <EmptySmall text="Ranking ainda vazio." />}</InfoPanel>
        <InfoPanel title="Últimos eventos">{loading ? <EmptySmall text="Carregando feed..." /> : feed.length > 0 ? feed.map((event) => <p className="rounded-2xl bg-psf-background p-3 text-sm font-bold" key={event.id}>{event.message}</p>) : <EmptySmall text="Feed será gerado após os jogos." />}</InfoPanel>
      </div>
    </section>
  );
}

function MiniMatch({ match }: { match: MatchSnapshot }) {
  return <div className="rounded-2xl bg-psf-background p-4"><p className="text-sm font-bold text-psf-secondary">{ROUND_LABELS[match.round]} · {formatKickoff(match.kickoffAt)}</p><p className="mt-2 text-lg font-black">{match.homeTeam.name} × {match.awayTeam.name}</p></div>;
}
