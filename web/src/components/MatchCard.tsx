import type { MatchSnapshot, PublicPredictionSnapshot } from '../../../shared/types/domain';
import type { ScoreDraft } from '../types';
import { formatKickoff, statusText } from '../lib/presentation';

export function MatchCard({ match, draft, now, publicPredictions, onChange, onReveal }: { match: MatchSnapshot; draft?: ScoreDraft; now: number; publicPredictions?: { loading?: boolean; predictions?: PublicPredictionSnapshot[]; error?: string }; onChange: (matchExternalId: string, side: 'homeScore' | 'awayScore', value: string) => void; onReveal: (matchExternalId: string) => void }) {
  const locked = match.status !== 'scheduled' || new Date(match.kickoffAt).getTime() <= now;
  const hasPlaceholder = match.homeTeam.isPlaceholder || match.awayTeam.isPlaceholder;
  const disabled = locked || hasPlaceholder;
  const statusLabel = hasPlaceholder ? 'Aguardando definição dos times' : locked ? statusText(match.status) : 'Aberto para palpite';

  return (
    <article className={`rounded-[1.5rem] bg-psf-surface p-4 shadow-card sm:rounded-[2rem] sm:p-5 ${draft?.saved ? 'ring-2 ring-psf-success' : ''} ${disabled ? 'opacity-90' : ''}`}>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3"><time className="text-sm font-bold text-psf-secondary">{formatKickoff(match.kickoffAt)}</time><span className={`w-fit rounded-full px-3 py-1 text-xs font-black ${disabled ? 'bg-psf-background text-psf-secondary' : 'bg-blue-50 text-psf-blue'}`}>{statusLabel}</span></div>
      <div className="grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-center sm:gap-3"><TeamBlock name={match.homeTeam.name} logoUrl={match.homeTeam.logoUrl} align="right" /><div className="mx-auto grid grid-cols-[3.5rem_auto_3.5rem] items-center gap-2 sm:grid-cols-[4rem_auto_4rem]"><ScoreInput value={locked ? match.homeScore : draft?.homeScore} disabled={disabled} onChange={(value) => onChange(match.externalId, 'homeScore', value)} /><span className="text-xl font-black text-psf-muted">×</span><ScoreInput value={locked ? match.awayScore : draft?.awayScore} disabled={disabled} onChange={(value) => onChange(match.externalId, 'awayScore', value)} /></div><TeamBlock name={match.awayTeam.name} logoUrl={match.awayTeam.logoUrl} align="left" /></div>
      {draft?.error && <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-psf-danger">{draft.error}</p>}
      {draft?.saved && !draft.error && <p className="mt-4 text-sm font-black text-psf-success">✓ Salvo</p>}
      {locked && <section className="mt-4 rounded-[1.5rem] bg-psf-background p-4"><button className="text-sm font-black text-psf-blue" type="button" onClick={() => onReveal(match.externalId)}>{publicPredictions?.loading ? 'Carregando...' : 'Ver palpites revelados'}</button>{publicPredictions?.error && <p className="mt-2 text-sm font-bold text-psf-danger">{publicPredictions.error}</p>}{publicPredictions?.predictions && <div className="mt-3 grid gap-2">{publicPredictions.predictions.length === 0 ? <p className="text-sm font-bold text-psf-secondary">Nenhum palpite registrado.</p> : publicPredictions.predictions.map((prediction) => <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-psf-surface p-3 text-sm font-bold" key={`${prediction.displayName}-${prediction.savedAt}`}><span>{prediction.displayName}</span><span className={prediction.points === 1 ? 'text-psf-success' : 'text-psf-secondary'}>{prediction.homeScore} × {prediction.awayScore}</span></div>)}</div>}</section>}
    </article>
  );
}

function TeamBlock({ name, logoUrl, align }: { name: string; logoUrl: string | null; align: 'left' | 'right' }) {
  return <div className={`flex items-center gap-3 ${align === 'right' ? 'justify-start text-left sm:justify-end sm:text-right' : ''}`}>{align === 'right' && <strong className="order-2 text-base font-black sm:order-none sm:text-lg">{name}</strong>}<div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-psf-background text-sm font-black sm:h-11 sm:w-11">{logoUrl ? <img alt="" className="h-full w-full object-cover" src={logoUrl} /> : name.slice(0, 2).toUpperCase()}</div>{align === 'left' && <strong className="text-base font-black sm:text-lg">{name}</strong>}</div>;
}

function ScoreInput({ value, disabled, onChange }: { value?: string | number | null; disabled: boolean; onChange: (value: string) => void }) {
  return <input className="h-12 rounded-2xl bg-psf-background text-center text-xl font-black outline-none focus:ring-2 focus:ring-psf-blue disabled:text-psf-secondary sm:h-14 sm:text-2xl" disabled={disabled} inputMode="numeric" max={20} min={0} value={value ?? ''} onChange={(event) => onChange(event.target.value)} placeholder="-" />;
}
