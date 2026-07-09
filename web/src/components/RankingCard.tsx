import type { RankingEntrySnapshot } from '../../../shared/types/domain';
import { trendLabel } from '../lib/presentation';

export function RankingCard({ entry, highlight }: { entry: RankingEntrySnapshot; highlight?: boolean }) {
  return <article className={`flex flex-wrap items-center gap-3 rounded-[1.5rem] p-4 shadow-card sm:flex-nowrap sm:gap-4 sm:rounded-[1.75rem] sm:p-5 ${highlight ? 'bg-psf-gold' : 'bg-psf-surface'}`}><strong className="text-xl font-black sm:text-2xl">#{entry.position}</strong><div className="grid h-11 w-11 place-items-center rounded-full bg-psf-background font-black sm:h-12 sm:w-12">{entry.initials}</div><div className="min-w-0 flex-1 basis-40"><h2 className="truncate text-base font-black sm:text-lg">{entry.displayName}</h2><p className="text-sm font-bold text-psf-secondary">{entry.accuracy}% de aproveitamento · {trendLabel(entry.positionDelta)}</p></div><strong className="ml-auto text-xl font-black sm:text-2xl">{entry.points}</strong></article>;
}

export function RankingMini({ entry }: { entry: RankingEntrySnapshot }) {
  return <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-psf-background p-3"><span className="font-black">#{entry.position} {entry.displayName}</span><span className="font-black text-psf-blue">{entry.points} pts</span></div>;
}

export function ChampionBanner({ leaders }: { leaders: RankingEntrySnapshot[] }) {
  return <div className="rounded-[1.5rem] bg-psf-gold p-5 shadow-card sm:rounded-[2rem] sm:p-6"><p className="text-xs font-black uppercase tracking-[0.24em] sm:text-sm">Campeão do Bolão PSF</p><h2 className="mt-2 text-2xl font-black sm:text-3xl">{leaders.map((leader) => leader.displayName).join(', ')}</h2><p className="mt-2 font-bold">Final encerrada. O topo do ranking virou o hall da fama desta Copa.</p></div>;
}
