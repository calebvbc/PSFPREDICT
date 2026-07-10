import type { MatchSnapshot, PublicPredictionSnapshot } from '../../../shared/types/domain';
import type { ScoreDraft } from '../types';
import { formatKickoff, statusText } from '../lib/presentation';

export function MatchCard({ match, draft, now, publicPredictions, allMatches = [match], onChange, onReveal }: { match: MatchSnapshot; draft?: ScoreDraft; now: number; publicPredictions?: { loading?: boolean; predictions?: PublicPredictionSnapshot[]; error?: string }; allMatches?: MatchSnapshot[]; onChange: (matchExternalId: string, side: 'homeScore' | 'awayScore', value: string) => void; onReveal: (matchExternalId: string) => void }) {
  const locked = match.status !== 'scheduled' || new Date(match.kickoffAt).getTime() <= now;
  const hasPlaceholder = isPlaceholderTeam(match.homeTeam) || isPlaceholderTeam(match.awayTeam);
  const disabled = locked || hasPlaceholder;
  const statusLabel = hasPlaceholder ? 'Aguardando definição dos times' : locked ? statusText(match.status) : 'Aberto para palpite';

  return (
    <article className={`rounded-[1.5rem] bg-psf-surface p-4 shadow-card sm:rounded-[2rem] sm:p-5 ${draft?.saved ? 'ring-2 ring-psf-success' : ''} ${disabled ? 'opacity-90' : ''}`}>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3"><time className="text-sm font-bold text-psf-secondary">{formatKickoff(match.kickoffAt)}</time><span className={`w-fit rounded-full px-3 py-1 text-xs font-black ${disabled ? 'bg-psf-background text-psf-secondary' : 'bg-blue-50 text-psf-blue'}`}>{statusLabel}</span></div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-3"><TeamBlock team={match.homeTeam} align="right" placeholderLabel={placeholderCandidateLabel(match, match.homeTeam, allMatches)} /><div className="mx-auto grid grid-cols-[2.75rem_auto_2.75rem] items-center gap-1 sm:grid-cols-[4rem_auto_4rem] sm:gap-2"><ScoreInput value={locked ? match.homeScore : draft?.homeScore} disabled={disabled} onChange={(value) => onChange(match.externalId, 'homeScore', value)} /><span className="text-xl font-black text-psf-muted">×</span><ScoreInput value={locked ? match.awayScore : draft?.awayScore} disabled={disabled} onChange={(value) => onChange(match.externalId, 'awayScore', value)} /></div><TeamBlock team={match.awayTeam} align="left" placeholderLabel={placeholderCandidateLabel(match, match.awayTeam, allMatches)} /></div>
      {draft?.error && <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-psf-danger">{draft.error}</p>}
      {draft?.saved && !draft.error && <p className="mt-4 text-sm font-black text-psf-success">✓ Salvo</p>}
      {locked && <section className="mt-4 rounded-[1.5rem] bg-psf-background p-4"><button className="text-sm font-black text-psf-blue" type="button" onClick={() => onReveal(match.externalId)}>{publicPredictions?.loading ? 'Carregando...' : 'Ver palpites revelados'}</button>{publicPredictions?.error && <p className="mt-2 text-sm font-bold text-psf-danger">{publicPredictions.error}</p>}{publicPredictions?.predictions && <div className="mt-3 grid gap-2">{publicPredictions.predictions.length === 0 ? <p className="text-sm font-bold text-psf-secondary">Nenhum palpite registrado.</p> : publicPredictions.predictions.map((prediction) => <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-psf-surface p-3 text-sm font-bold" key={`${prediction.displayName}-${prediction.savedAt}`}><span>{prediction.displayName}</span><span className={prediction.points > 0 ? 'text-psf-success' : 'text-psf-secondary'}>{prediction.homeScore} × {prediction.awayScore} · {prediction.points} pts</span></div>)}</div>}</section>}
    </article>
  );
}

function isPlaceholderTeam(team: MatchSnapshot['homeTeam']) {
  return team.isPlaceholder || /^(a definir|vencedor|perdedor)/i.test(team.name.trim());
}

function placeholderCandidateLabel(match: MatchSnapshot, team: MatchSnapshot['homeTeam'], allMatches: MatchSnapshot[]) {
  if (!isPlaceholderTeam(team)) return undefined;

  const sourceMatch = findSourceMatch(match, team.name, allMatches);
  if (!sourceMatch) return '🏆/🏆';

  return `${teamEmoji(sourceMatch.homeTeam)}/${teamEmoji(sourceMatch.awayTeam)}`;
}

function findSourceMatch(match: MatchSnapshot, placeholderName: string, allMatches: MatchSnapshot[]) {
  const sourceRound = previousRoundFor(match.round, placeholderName);
  const sourceIndex = Number(placeholderName.match(/(\d+)/)?.[1] ?? 0) - 1;
  if (!sourceRound || sourceIndex < 0) return undefined;

  return allMatches
    .filter((candidate) => candidate.round === sourceRound)
    .sort((a, b) => new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime())[sourceIndex];
}

function previousRoundFor(round: MatchSnapshot['round'], placeholderName: string): MatchSnapshot['round'] | undefined {
  if (/semifinal/i.test(placeholderName)) return 'semifinal';
  if (round === 'round_of_16') return 'round_of_32';
  if (round === 'quarterfinal') return 'round_of_16';
  if (round === 'semifinal') return 'quarterfinal';
  if (round === 'third_place' || round === 'final') return 'semifinal';
  return undefined;
}

const TEAM_FLAG_EMOJIS: Record<string, string> = {
  africadosul: '🇿🇦', alemanha: '🇩🇪', argentina: '🇦🇷', australia: '🇦🇺', brasil: '🇧🇷', canada: '🇨🇦', chile: '🇨🇱', china: '🇨🇳', colombia: '🇨🇴', coreiadosul: '🇰🇷', costarica: '🇨🇷', dinamarca: '🇩🇰', escocia: '🏴󠁧󠁢󠁳󠁣󠁴󠁿', espanha: '🇪🇸', estadosunidos: '🇺🇸', eua: '🇺🇸', franca: '🇫🇷', gana: '🇬🇭', holanda: '🇳🇱', inglaterra: '🏴󠁧󠁢󠁥󠁮󠁧󠁿', italia: '🇮🇹', jamaica: '🇯🇲', japao: '🇯🇵', marrocos: '🇲🇦', mexico: '🇲🇽', nigeria: '🇳🇬', noruega: '🇳🇴', novazelandia: '🇳🇿', portugal: '🇵🇹', suecia: '🇸🇪', suica: '🇨🇭'
};

function teamEmoji(team: MatchSnapshot['homeTeam']) {
  if (isPlaceholderTeam(team)) return '🏆';
  return TEAM_FLAG_EMOJIS[normalizeTeamName(team.name)] ?? '🏆';
}

function normalizeTeamName(name: string) {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z]/g, '');
}

function TeamBlock({ team, align, placeholderLabel }: { team: MatchSnapshot['homeTeam']; align: 'left' | 'right'; placeholderLabel?: string }) {
  const placeholder = isPlaceholderTeam(team);
  const label = placeholder ? placeholderLabel ?? '🏆/🏆' : team.name;
  const badge = placeholder ? <CupIcon /> : team.logoUrl ? <img alt={`Bandeira de ${team.name}`} className="h-full w-full scale-[1.85] object-cover" src={team.logoUrl} /> : team.name.slice(0, 2).toUpperCase();

  return <div className={`flex min-w-0 items-center gap-2 sm:gap-3 ${align === 'right' ? 'justify-end text-right' : 'justify-start text-left'}`}>{align === 'right' && <strong className="min-w-0 truncate whitespace-nowrap text-xs font-black leading-tight sm:text-lg" title={label}>{label}</strong>}<div className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-xl border border-black/80 bg-psf-background text-xs font-black sm:h-11 sm:w-11 sm:text-sm">{badge}</div>{align === 'left' && <strong className="min-w-0 truncate whitespace-nowrap text-xs font-black leading-tight sm:text-lg" title={label}>{label}</strong>}</div>;
}

function CupIcon() {
  return <svg aria-label="Confronto a definir" className="h-5 w-5 text-psf-gold sm:h-6 sm:w-6" fill="none" role="img" viewBox="0 0 24 24"><path d="M8 4h8v3a4 4 0 0 1-8 0V4Z" fill="currentColor"/><path d="M7 6H4v1a4 4 0 0 0 4 4M17 6h3v1a4 4 0 0 1-4 4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"/><path d="M12 11v5m-3 4h6m-7 0h8m-4-4a4 4 0 0 0 4-4H8a4 4 0 0 0 4 4Z" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"/></svg>;
}

function ScoreInput({ value, disabled, onChange }: { value?: string | number | null; disabled: boolean; onChange: (value: string) => void }) {
  return <input className="h-11 rounded-2xl bg-psf-background text-center text-lg font-black outline-none focus:ring-2 focus:ring-psf-blue disabled:text-psf-secondary sm:h-14 sm:text-2xl" disabled={disabled} inputMode="numeric" max={20} min={0} value={value ?? ''} onChange={(event) => onChange(event.target.value)} placeholder="-" />;
}
