import type { MatchSnapshot, PublicPredictionSnapshot } from '../../../shared/types/domain';
import type { ScoreDraft } from '../types';
import { formatKickoff, statusText } from '../lib/presentation';

export function MatchCard({ match, draft, now, publicPredictions, isOpen, allMatches = [match], onChange, onToggleReveal }: { match: MatchSnapshot; draft?: ScoreDraft; now: number; publicPredictions?: { loading?: boolean; predictions?: PublicPredictionSnapshot[]; error?: string }; isOpen: boolean; allMatches?: MatchSnapshot[]; onChange: (matchExternalId: string, side: 'homeScore' | 'awayScore', value: string) => void; onToggleReveal: (matchExternalId: string) => void }) {
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
      {locked && <section className="mt-4 rounded-[1.5rem] bg-psf-background p-4"><button className="text-sm font-black text-psf-blue" type="button" onClick={() => onToggleReveal(match.externalId)}>{isOpen && publicPredictions?.loading ? 'Carregando...' : isOpen ? 'Ocultar palpites' : 'Ver palpites revelados'}</button>{isOpen && publicPredictions?.error && <p className="mt-2 text-sm font-bold text-psf-danger">{publicPredictions.error}</p>}{isOpen && publicPredictions?.predictions && <div className="mt-3 grid gap-2">{publicPredictions.predictions.length === 0 ? <p className="text-sm font-bold text-psf-secondary">Nenhum palpite registrado.</p> : publicPredictions.predictions.map((prediction) => <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-psf-surface p-3 text-sm font-bold" key={`${prediction.displayName}-${prediction.savedAt}`}><span>{prediction.displayName}</span><span className={prediction.points > 0 ? 'text-psf-success' : 'text-psf-secondary'}>{prediction.homeScore} × {prediction.awayScore} · {prediction.points} pts</span></div>)}</div>}</section>}
    </article>
  );
}

function isPlaceholderTeam(team: MatchSnapshot['homeTeam']) {
  return team.isPlaceholder || /^(a definir|vencedor|perdedor)/i.test(team.name.trim());
}

function placeholderCandidateLabel(match: MatchSnapshot, team: MatchSnapshot['homeTeam'], allMatches: MatchSnapshot[]) {
  if (!isPlaceholderTeam(team)) return undefined;

  const sourceMatch = findSourceMatch(match, team.name, allMatches);
  if (!sourceMatch) return 'A definir';

  const homeCandidate = resolveTeamEmoji(sourceMatch, sourceMatch.homeTeam, allMatches);
  const awayCandidate = resolveTeamEmoji(sourceMatch, sourceMatch.awayTeam, allMatches);
  if (!homeCandidate || !awayCandidate) return 'A definir';

  return `${homeCandidate} / ${awayCandidate}`;
}

function resolveTeamEmoji(match: MatchSnapshot, team: MatchSnapshot['homeTeam'], allMatches: MatchSnapshot[], seen = new Set<string>()): string | undefined {
  const emoji = teamEmoji(team);
  if (emoji) return emoji;
  if (!isPlaceholderTeam(team)) return undefined;

  const seenKey = `${match.externalId}:${team.name}`;
  if (seen.has(seenKey)) return undefined;
  seen.add(seenKey);

  const sourceMatch = findSourceMatch(match, team.name, allMatches);
  if (!sourceMatch) return undefined;

  const homeCandidate = resolveTeamEmoji(sourceMatch, sourceMatch.homeTeam, allMatches, seen);
  const awayCandidate = resolveTeamEmoji(sourceMatch, sourceMatch.awayTeam, allMatches, seen);
  if (!homeCandidate || !awayCandidate) return undefined;

  return `${homeCandidate} / ${awayCandidate}`;
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

const TEAM_CODES: Record<string, string> = {
  franca: 'FRA',
  marrocos: 'MAR',
  japao: 'JPN',
  coreiadosul: 'KOR',
};

function teamEmoji(team: MatchSnapshot['homeTeam']) {
  if (isPlaceholderTeam(team)) return undefined;
  return TEAM_FLAG_EMOJIS[normalizeTeamName(team.name)];
}

function teamCode(team: MatchSnapshot['homeTeam']) {
  if (team.abbreviation) return team.abbreviation.toUpperCase();

  const normalizedName = normalizeTeamName(team.name);
  return TEAM_CODES[normalizedName] ?? normalizedName.slice(0, 3).toUpperCase();
}

function normalizeTeamName(name: string) {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z]/g, '');
}

function TeamBlock({ team, align, placeholderLabel }: { team: MatchSnapshot['homeTeam']; align: 'left' | 'right'; placeholderLabel?: string }) {
  const placeholder = isPlaceholderTeam(team);
  const label = placeholder ? placeholderLabel ?? 'A definir' : teamCode(team);
  const badge = placeholder ? <CupIcon /> : team.logoUrl ? <img alt={`Bandeira de ${team.name}`} className="h-full w-full scale-[1.85] object-cover" src={team.logoUrl} /> : team.name.slice(0, 2).toUpperCase();

  return <div className={`flex min-w-0 items-center gap-2 sm:gap-3 ${align === 'right' ? 'justify-end text-right' : 'justify-start text-left'}`}>{align === 'right' && <strong className="min-w-0 truncate whitespace-nowrap text-xs font-black leading-tight sm:text-lg" title={label}>{label}</strong>}<div className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-xl bg-psf-background ring-2 ring-inset ring-black/80 text-xs font-black sm:h-11 sm:w-11 sm:text-sm">{badge}</div>{align === 'left' && <strong className="min-w-0 truncate whitespace-nowrap text-xs font-black leading-tight sm:text-lg" title={label}>{label}</strong>}</div>;
}

function CupIcon() {
  return <svg aria-label="Confronto a definir" className="h-5 w-5 text-psf-gold sm:h-6 sm:w-6" fill="currentColor" role="img" viewBox="0 0 16 16"><path d="M2.5.5A.5.5 0 0 1 3 0h10a.5.5 0 0 1 .5.5c0 .538-.012 1.05-.034 1.536a3 3 0 1 1-1.133 5.89c-.79 1.865-1.878 2.777-2.833 3.011v2.173l1.425.356c.194.048.377.135.537.255L13.3 15.1a.5.5 0 0 1-.3.9H3a.5.5 0 0 1-.3-.9l1.838-1.379c.16-.12.343-.207.537-.255L6.5 13.11v-2.173c-.955-.234-2.043-1.146-2.833-3.012a3 3 0 1 1-1.132-5.89A33.076 33.076 0 0 1 2.5.5m.099 2.54a2 2 0 0 0 .72 3.935c-.333-1.05-.588-2.346-.72-3.935m10.083 3.935a2 2 0 0 0 .72-3.935c-.133 1.59-.388 2.885-.72 3.935" /></svg>;
}

function ScoreInput({ value, disabled, onChange }: { value?: string | number | null; disabled: boolean; onChange: (value: string) => void }) {
  return <input className="h-11 rounded-2xl bg-psf-background text-center text-lg font-black outline-none focus:ring-2 focus:ring-psf-blue disabled:text-psf-secondary sm:h-14 sm:text-2xl" disabled={disabled} inputMode="numeric" max={20} min={0} value={value ?? ''} onChange={(event) => onChange(event.target.value)} placeholder="-" />;
}
