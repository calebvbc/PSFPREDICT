import type { MatchRound, MatchSnapshot } from '../../../shared/types/domain';
import { EmptyCard } from '../components/InfoPanel';
import { MatchCard, type MatchCardProps } from '../components/MatchCard';
import { ROUND_LABELS } from '../lib/presentation';
import type { MatchPredictionsState, ScoreDraft } from '../types';

export function PredictionsPage(props: { groupedMatches: Array<{ round: MatchRound; matches: MatchSnapshot[] }>; drafts: Record<string, ScoreDraft>; displayName: string; username: string; lookupMessage: string; loadingMatches: boolean; matchPredictions: MatchPredictionsState; openPredictionMatchIds: string[]; now: number; saving: boolean; setDisplayName: (value: string) => void; setUsername: (value: string) => void; lookupParticipant: (username?: string) => void; updateDraft: (matchExternalId: string, side: 'homeScore' | 'awayScore', value: string) => void; loadMatchPredictions: (matchExternalId: string) => void; savePredictions: () => void }) {
  const allMatches = props.groupedMatches.flatMap((group) => group.matches);

  return (
    <>
      <header className="mx-auto max-w-5xl px-4 py-6 sm:px-5 sm:py-8">
        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Palpites do mata-mata</h1>
        <p className="mt-3 max-w-2xl text-psf-secondary">Preencha nome e username, marque seus placares das partidas abertas e salve tudo de uma vez.</p>
      </header>
      <section className="px-4 py-4 sm:px-5">
        <div className="mx-auto grid max-w-5xl gap-3 rounded-[1.5rem] bg-psf-surface p-4 shadow-card md:grid-cols-[1fr_0.8fr_auto]">
          <label className="grid gap-1 text-sm font-bold">Nome de exibição<input className="rounded-2xl bg-psf-background px-4 py-3 font-semibold outline-none focus:ring-2 focus:ring-psf-blue" maxLength={30} value={props.displayName} onChange={(event) => props.setDisplayName(event.target.value)} placeholder="Ex: Yago" /></label>
          <label className="grid gap-1 text-sm font-bold">Username<input className="rounded-2xl bg-psf-background px-4 py-3 font-semibold outline-none focus:ring-2 focus:ring-psf-blue" maxLength={20} value={props.username} onBlur={() => props.lookupParticipant()} onChange={(event) => props.setUsername(event.target.value.replace(/\s/g, ''))} placeholder="yago_psf" /></label>
          <button className="w-full self-end rounded-2xl bg-psf-text px-5 py-3 font-black text-white disabled:opacity-60 md:w-auto" type="button" onClick={() => props.lookupParticipant()} disabled={!props.username.trim()}>Buscar</button>
          {props.lookupMessage && <p className="text-sm font-semibold text-psf-secondary md:col-span-3">{props.lookupMessage}</p>}
        </div>
      </section>
      <section className="mx-auto grid max-w-5xl gap-6 px-4 py-6 sm:gap-8 sm:px-5 sm:py-8">
        {props.loadingMatches && <EmptyCard message="Carregando partidas da ESPN..." />}
        {!props.loadingMatches && props.groupedMatches.length === 0 && <EmptyCard message="Nenhuma partida encontrada agora." />}
        {props.groupedMatches.map((group) => <div className="grid gap-4" key={group.round}><h2 className="text-xl font-black tracking-tight sm:text-2xl">{ROUND_LABELS[group.round]}</h2><div className="grid gap-4">{group.matches.map((match) => {
          const matchCardProps = {
            match,
            draft: props.drafts[match.externalId],
            now: props.now,
            publicPredictions: props.matchPredictions[match.externalId],
            isOpen: props.openPredictionMatchIds.includes(match.externalId),
            allMatches,
            onChange: props.updateDraft,
            onToggleReveal: props.loadMatchPredictions,
          } satisfies MatchCardProps;

          return <MatchCard key={match.externalId} {...matchCardProps} />;
        })}</div></div>)}
      </section>
      <footer className="fixed inset-x-0 bottom-0 z-20 border-t border-black/5 bg-psf-surface/95 px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur sm:px-5"><div className="mx-auto flex max-w-5xl items-center justify-between gap-4"><p className="hidden text-sm font-semibold text-psf-secondary sm:block">Campos inválidos permanecem preenchidos para você corrigir sem perder nada.</p><button className="ml-auto w-full rounded-full bg-psf-blue px-6 py-4 text-base font-black text-white shadow-card disabled:opacity-60 sm:w-auto sm:px-8 sm:text-lg" type="button" onClick={props.savePredictions} disabled={props.saving}>{props.saving ? 'Salvando...' : 'Salvar Palpites'}</button></div></footer>
    </>
  );
}
