import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { FeedEventSnapshot, MatchRound, MatchSnapshot, ParticipantPredictionsSnapshot, PublicPredictionSnapshot, RankingEntrySnapshot } from '../../shared/types/domain';
import { isPlaceholderTeam, teamCode } from './lib/teams';
import { PredictionsPage } from './pages/PredictionsPage';

const ROUND_LABELS: Record<MatchRound, string> = {
  round_of_32: 'Round of 32',
  round_of_16: 'Oitavas de Final',
  quarterfinal: 'Quartas de Final',
  semifinal: 'Semifinais',
  third_place: 'Disputa de 3º Lugar',
  final: 'Final',
};

const ROUND_ORDER: MatchRound[] = ['round_of_32', 'round_of_16', 'quarterfinal', 'semifinal', 'third_place', 'final'];
const PREDICTION_ROUND_ORDER: MatchRound[] = ['round_of_16', 'quarterfinal', 'semifinal', 'third_place', 'final'];

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? 'https://api.psfes.space';

function apiUrl(path: string) {
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

type ScoreDraft = { homeScore: string; awayScore: string; saved?: boolean; error?: string };
type ToastState = { type: 'success' | 'error'; message: string } | null;
type MatchPredictionsState = Record<string, { loading?: boolean; predictions?: PublicPredictionSnapshot[]; error?: string }>;
type PublicDataError = string;

export function App() {
  const [route, setRoute] = useState(() => window.location.pathname);
  const [matches, setMatches] = useState<MatchSnapshot[]>([]);
  const [ranking, setRanking] = useState<RankingEntrySnapshot[]>([]);
  const [feed, setFeed] = useState<FeedEventSnapshot[]>([]);
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [drafts, setDrafts] = useState<Record<string, ScoreDraft>>({});
  const [matchPredictions, setMatchPredictions] = useState<MatchPredictionsState>({});
  const [openPredictionMatchIds, setOpenPredictionMatchIds] = useState<string[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(true);
  const [publicDataError, setPublicDataError] = useState<PublicDataError>();
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);
  const [lookupMessage, setLookupMessage] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    const onPopState = () => setRoute(window.location.pathname);
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = useCallback((path: string) => {
    window.history.pushState({}, '', path);
    setRoute(path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const refreshPublicData = useCallback(async () => {
    setPublicDataError(undefined);
    const [matchesResponse, rankingResponse, feedResponse] = await Promise.all([
      fetch(apiUrl('/api/matches')),
      fetch(apiUrl('/api/ranking')),
      fetch(apiUrl('/api/feed?limit=12')),
    ]);

    const [matchesData, rankingData, feedData] = await Promise.all([
      matchesResponse.json() as Promise<{ matches?: MatchSnapshot[] }>,
      rankingResponse.json() as Promise<{ ranking?: RankingEntrySnapshot[] }>,
      feedResponse.json() as Promise<{ events?: FeedEventSnapshot[] }>,
    ]);

    setMatches(matchesData.matches ?? []);
    setRanking(rankingData.ranking ?? []);
    setFeed(feedData.events ?? []);
  }, []);

  useEffect(() => {
    refreshPublicData()
      .catch(() => {
        setPublicDataError('Não foi possível carregar os dados públicos.');
      })
      .finally(() => setLoadingMatches(false));
  }, [refreshPublicData]);

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(intervalId);
  }, []);

  const lookupParticipant = useCallback(async (nextUsername = username) => {
    const normalized = nextUsername.trim();
    if (!normalized) return;

    try {
      const response = await fetch(apiUrl(`/api/participants/${encodeURIComponent(normalized)}`));
      const data = await response.json() as { participant: ParticipantPredictionsSnapshot | null };
      if (!data.participant) {
        setLookupMessage('Username novo — preencha seus palpites do zero.');
        return;
      }

      const participant = data.participant;
      setDisplayName(participant.displayName);
      setDrafts((current) => {
        const next = { ...current };
        for (const prediction of participant.predictions) {
          next[prediction.matchExternalId] = {
            homeScore: String(prediction.homeScore),
            awayScore: String(prediction.awayScore),
            saved: true,
          };
        }
        return next;
      });
      setLookupMessage('Palpites existentes carregados para edição.');
    } catch {
      setLookupMessage('Não foi possível buscar esse username agora.');
    }
  }, [username]);

  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    const normalized = username.trim();
    if (!normalized) return;

    debounceRef.current = window.setTimeout(() => {
      void lookupParticipant(normalized);
    }, 450);
  }, [lookupParticipant, username]);

  const predictionMatches = useMemo(() => matches.filter((match) => PREDICTION_ROUND_ORDER.includes(match.round)), [matches]);
  const groupedMatches = useMemo(() => groupMatches(predictionMatches, PREDICTION_ROUND_ORDER), [predictionMatches]);
  const nextMatch = useMemo(() => matches.find((match) => match.status === 'scheduled' && new Date(match.kickoffAt).getTime() > now), [matches, now]);
  const finalMatchClosed = matches.some((match) => match.round === 'final' && match.status === 'final');
  const leaders = ranking.length > 0 ? ranking.filter((entry) => entry.points === ranking[0].points) : [];

  function updateDraft(matchExternalId: string, side: 'homeScore' | 'awayScore', value: string) {
    setDrafts((current) => ({
      ...current,
      [matchExternalId]: {
        ...current[matchExternalId],
        [side]: value,
        saved: false,
        error: undefined,
      },
    }));
  }

  async function loadMatchPredictions(matchExternalId: string) {
    if (openPredictionMatchIds.includes(matchExternalId)) {
      setOpenPredictionMatchIds((current) => current.filter((id) => id !== matchExternalId));
      return;
    }

    setOpenPredictionMatchIds((current) => current.includes(matchExternalId) ? current : [...current, matchExternalId]);

    if (matchPredictions[matchExternalId]?.predictions) return;

    setMatchPredictions((current) => ({ ...current, [matchExternalId]: { ...current[matchExternalId], loading: true, error: undefined } }));
    try {
      const response = await fetch(apiUrl(`/api/matches/${encodeURIComponent(matchExternalId)}/predictions`));
      const data = await response.json() as { predictions?: PublicPredictionSnapshot[]; error?: string };
      if (!response.ok) throw new Error(data.error ?? 'Não foi possível revelar os palpites.');
      setMatchPredictions((current) => ({ ...current, [matchExternalId]: { predictions: data.predictions ?? [] } }));
    } catch (error) {
      setMatchPredictions((current) => ({ ...current, [matchExternalId]: { error: error instanceof Error ? error.message : 'Erro ao carregar palpites.' } }));
    }
  }

  async function savePredictions() {
    setToast(null);
    const participantError = validateParticipant(displayName, username);
    if (participantError) {
      setToast({ type: 'error', message: participantError });
      return;
    }

    const validation = validateDrafts(predictionMatches, drafts);
    setDrafts(validation.nextDrafts);
    if (validation.errorCount > 0) {
      setToast({ type: 'error', message: 'Revise os placares destacados antes de salvar.' });
      return;
    }

    if (validation.predictions.length === 0) {
      setToast({ type: 'error', message: 'Preencha pelo menos um palpite aberto.' });
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(apiUrl('/api/predictions'), {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ displayName, username, predictions: validation.predictions }),
      });
      const data = await response.json() as { error?: string; participant?: ParticipantPredictionsSnapshot };
      if (!response.ok) throw new Error(data.error ?? 'Erro ao salvar palpites.');

      setDrafts((current) => {
        const next = { ...current };
        for (const prediction of data.participant?.predictions ?? []) {
          next[prediction.matchExternalId] = { ...next[prediction.matchExternalId], saved: true, error: undefined };
        }
        return next;
      });
      await refreshPublicData();
      setToast({ type: 'success', message: 'Palpites salvos!' });
    } catch (error) {
      setToast({ type: 'error', message: error instanceof Error ? error.message : 'Erro de rede ao salvar.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-psf-background pb-28 text-psf-text">
      <TopNav route={route} navigate={navigate} />

      {route === '/' && <HomePage nextMatch={nextMatch} ranking={ranking.slice(0, 3)} feed={feed.slice(0, 3)} finalMatchClosed={finalMatchClosed} leaders={leaders} navigate={navigate} loading={loadingMatches} error={publicDataError} />}
      {route === '/palpites' && <PredictionsPage groupedMatches={groupedMatches} drafts={drafts} displayName={displayName} username={username} lookupMessage={lookupMessage} loadingMatches={loadingMatches} matchPredictions={matchPredictions} openPredictionMatchIds={openPredictionMatchIds} now={now} saving={saving} setDisplayName={setDisplayName} setUsername={setUsername} lookupParticipant={lookupParticipant} updateDraft={updateDraft} loadMatchPredictions={loadMatchPredictions} savePredictions={savePredictions} />}
      {route === '/ranking' && <RankingPage ranking={ranking} finalMatchClosed={finalMatchClosed} leaders={leaders} loading={loadingMatches} error={publicDataError} />}
      {route === '/feed' && <FeedPage feed={feed} loading={loadingMatches} error={publicDataError} />}
      {!['/', '/palpites', '/ranking', '/feed'].includes(route) && <HomePage nextMatch={nextMatch} ranking={ranking.slice(0, 3)} feed={feed.slice(0, 3)} finalMatchClosed={finalMatchClosed} leaders={leaders} navigate={navigate} loading={loadingMatches} error={publicDataError} />}

      {toast && <Toast toast={toast} />}
    </main>
  );
}

function TopNav({ route, navigate }: { route: string; navigate: (path: string) => void }) {
  const links = [
    ['/', 'Home'],
    ['/palpites', 'Palpites'],
    ['/ranking', 'Ranking'],
    ['/feed', 'Feed'],
  ] as const;

  return (
    <nav className="sticky top-0 z-30 border-b border-black/5 bg-psf-background/90 px-5 py-4 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
        <button className="text-left text-sm font-black uppercase tracking-[0.24em] text-psf-blue" onClick={() => navigate('/')} type="button">PSFPREDICT</button>
        <div className="flex gap-2 overflow-x-auto rounded-full bg-psf-surface p-1 shadow-card">
          {links.map(([href, label]) => (
            <button className={`rounded-full px-4 py-2 text-sm font-black ${route === href ? 'bg-psf-blue text-white' : 'text-psf-secondary'}`} key={href} onClick={() => navigate(href)} type="button">{label}</button>
          ))}
        </div>
      </div>
    </nav>
  );
}

function HomePage({ nextMatch, ranking, feed, finalMatchClosed, leaders, navigate, loading, error }: { nextMatch?: MatchSnapshot; ranking: RankingEntrySnapshot[]; feed: FeedEventSnapshot[]; finalMatchClosed: boolean; leaders: RankingEntrySnapshot[]; navigate: (path: string) => void; loading: boolean; error?: PublicDataError }) {
  return (
    <section className="mx-auto grid max-w-5xl gap-6 px-5 py-8">
      {error && <ErrorCard message={error} />}
      {finalMatchClosed && leaders.length > 0 && <ChampionBanner leaders={leaders} />}
      <div className="rounded-[2rem] bg-psf-surface p-8 shadow-card">
        <p className="text-sm font-black uppercase tracking-[0.24em] text-psf-blue">Copa do Mundo 2026</p>
        <h1 className="mt-3 text-5xl font-black tracking-tight">O bolão oficial da PSF no mata-mata.</h1>
        <p className="mt-4 max-w-2xl text-lg text-psf-secondary">Palpite rápido, ranking automático e suspense até o kickoff. Tudo em uma experiência clara, mobile first e feita para a comunidade.</p>
        <button className="mt-7 rounded-full bg-psf-blue px-8 py-4 text-lg font-black text-white shadow-card" onClick={() => navigate('/palpites')} type="button">Fazer meus palpites</button>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <InfoPanel title="Próximo jogo">{loading ? <EmptySmall text="Carregando dados..." /> : nextMatch ? <MiniMatch match={nextMatch} /> : <EmptySmall text="Nenhum jogo aberto agora." />}</InfoPanel>
        <InfoPanel title="Liderança">{loading ? <EmptySmall text="Carregando ranking..." /> : ranking.length > 0 ? ranking.map((entry) => <RankingMini entry={entry} key={entry.username} />) : <EmptySmall text="Ranking ainda vazio." />}</InfoPanel>
        <InfoPanel title="Últimos eventos">{loading ? <EmptySmall text="Carregando feed..." /> : feed.length > 0 ? feed.map((event) => <p className="rounded-2xl bg-psf-background p-3 text-sm font-bold" key={event.id}>{event.message}</p>) : <EmptySmall text="Feed será gerado após os jogos." />}</InfoPanel>
      </div>
    </section>
  );
}

function RankingPage({ ranking, finalMatchClosed, leaders, loading, error }: { ranking: RankingEntrySnapshot[]; finalMatchClosed: boolean; leaders: RankingEntrySnapshot[]; loading: boolean; error?: PublicDataError }) {
  return <section className="mx-auto grid max-w-3xl gap-4 px-5 py-8">{finalMatchClosed && leaders.length > 0 && <ChampionBanner leaders={leaders} />}
    <h1 className="text-4xl font-black tracking-tight">Ranking Geral</h1>
    {error && <ErrorCard message={error} />}
    {loading && <EmptyCard message="Carregando ranking..." />}
    {!loading && ranking.length === 0 && <EmptyCard message="Ranking ainda vazio." />}
    {ranking.map((entry) => <RankingCard entry={entry} key={entry.username} highlight={finalMatchClosed && entry.position === 1} />)}
  </section>;
}

function FeedPage({ feed, loading, error }: { feed: FeedEventSnapshot[]; loading: boolean; error?: PublicDataError }) {
  return <section className="mx-auto grid max-w-3xl gap-4 px-5 py-8"><h1 className="text-4xl font-black tracking-tight">Feed PSF</h1>{error && <ErrorCard message={error} />}{loading && <EmptyCard message="Carregando feed..." />}{!loading && feed.length === 0 && <EmptyCard message="Eventos automáticos aparecerão após o recálculo dos jogos." />}{feed.map((event) => <article className="rounded-[1.5rem] bg-psf-surface p-5 shadow-card" key={event.id}><p className="font-black">{event.message}</p><time className="mt-2 block text-sm font-bold text-psf-secondary">{formatKickoff(event.createdAt)}</time></article>)}</section>;
}

function ChampionBanner({ leaders }: { leaders: RankingEntrySnapshot[] }) {
  return <div className="rounded-[2rem] bg-psf-gold p-6 shadow-card"><p className="text-sm font-black uppercase tracking-[0.24em]">Campeão do Bolão PSF</p><h2 className="mt-2 text-3xl font-black">{leaders.map((leader) => leader.displayName).join(', ')}</h2><p className="mt-2 font-bold">Final encerrada. O topo do ranking virou o hall da fama desta Copa.</p></div>;
}

function RankingCard({ entry, highlight }: { entry: RankingEntrySnapshot; highlight?: boolean }) {
  return <article className={`flex items-center gap-4 rounded-[1.75rem] p-5 shadow-card ${highlight ? 'bg-psf-gold' : 'bg-psf-surface'}`}><strong className="text-2xl font-black">#{entry.position}</strong><div className="grid h-12 w-12 place-items-center rounded-full bg-psf-background font-black">{entry.initials}</div><div className="min-w-0 flex-1"><h2 className="truncate text-lg font-black">{entry.displayName}</h2><p className="text-sm font-bold text-psf-secondary">{entry.accuracy}% de aproveitamento · {trendLabel(entry.positionDelta)}</p></div><strong className="text-2xl font-black">{entry.points}</strong></article>;
}

function RankingMini({ entry }: { entry: RankingEntrySnapshot }) {
  return <div className="flex items-center justify-between rounded-2xl bg-psf-background p-3"><span className="font-black">#{entry.position} {entry.displayName}</span><span className="font-black text-psf-blue">{entry.points} pts</span></div>;
}

function MiniMatch({ match }: { match: MatchSnapshot }) {
  return <div className="rounded-2xl bg-psf-background p-4"><p className="text-sm font-bold text-psf-secondary">{ROUND_LABELS[match.round]} · {formatKickoff(match.kickoffAt)}</p><p className="mt-2 text-lg font-black">{teamCode(match.homeTeam)} × {teamCode(match.awayTeam)}</p></div>;
}

function InfoPanel({ title, children }: { title: string; children: ReactNode }) {
  return <section className="rounded-[1.75rem] bg-psf-surface p-5 shadow-card"><h2 className="mb-4 text-xl font-black">{title}</h2><div className="grid gap-3">{children}</div></section>;
}

function EmptyCard({ message }: { message: string }) {
  return <div className="rounded-[2rem] bg-psf-surface p-8 text-center font-bold text-psf-secondary shadow-card">{message}</div>;
}

function EmptySmall({ text }: { text: string }) {
  return <p className="rounded-2xl bg-psf-background p-4 text-sm font-bold text-psf-secondary">{text}</p>;
}

function ErrorCard({ message }: { message: string }) {
  return <div className="rounded-[1.5rem] bg-red-50 p-4 font-bold text-psf-danger">{message}</div>;
}

function Toast({ toast }: { toast: Exclude<ToastState, null> }) {
  return <div className={`fixed bottom-24 left-1/2 z-30 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-2xl px-5 py-4 text-center font-black shadow-card ${toast.type === 'success' ? 'bg-psf-success text-white' : 'bg-psf-danger text-white'}`}>{toast.message}</div>;
}

function validateParticipant(displayName: string, username: string) {
  if (!displayName.trim()) return 'Informe seu nome de exibição.';
  if (displayName.trim().length > 30) return 'Nome de exibição deve ter até 30 caracteres.';
  if (!username.trim()) return 'Informe seu username.';
  if (username.trim().length > 20) return 'Username deve ter até 20 caracteres.';
  if (/\s/.test(username)) return 'Username não pode conter espaços.';
  return null;
}

function validateDrafts(matches: MatchSnapshot[], drafts: Record<string, ScoreDraft>) {
  let errorCount = 0;
  const predictions: Array<{ matchExternalId: string; homeScore: number; awayScore: number }> = [];
  const nextDrafts: Record<string, ScoreDraft> = { ...drafts };

  for (const match of matches) {
    const draft = drafts[match.externalId];
    if (!draft?.homeScore && !draft?.awayScore) continue;
    const locked = match.status !== 'scheduled' || new Date(match.kickoffAt).getTime() <= Date.now();
    const hasPlaceholder = isPlaceholderTeam(match.homeTeam) || isPlaceholderTeam(match.awayTeam);
    if (locked || hasPlaceholder) continue;

    const homeScore = Number(draft.homeScore);
    const awayScore = Number(draft.awayScore);
    const invalid = !Number.isInteger(homeScore) || !Number.isInteger(awayScore) || homeScore < 0 || homeScore > 20 || awayScore < 0 || awayScore > 20;
    if (invalid) {
      errorCount += 1;
      nextDrafts[match.externalId] = { ...draft, error: 'Placar deve ser um número inteiro entre 0 e 20.' };
      continue;
    }

    predictions.push({ matchExternalId: match.externalId, homeScore, awayScore });
    nextDrafts[match.externalId] = { ...draft, error: undefined };
  }

  return { errorCount, predictions, nextDrafts };
}

function groupMatches(matches: MatchSnapshot[], roundOrder: MatchRound[] = ROUND_ORDER) {
  return roundOrder.map((round) => ({
    round,
    matches: matches.filter((match) => match.round === round).sort((a, b) => new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime()),
  })).filter((group) => group.matches.length > 0);
}

function formatKickoff(value: string) {
  if (!value) return 'Horário a confirmar';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(value));
}

function trendLabel(delta: number) {
  if (delta > 0) return `↑ ${delta}`;
  if (delta < 0) return `↓ ${Math.abs(delta)}`;
  return '=';
}
