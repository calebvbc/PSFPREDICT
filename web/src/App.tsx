import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { FeedEventSnapshot, MatchRound, MatchSnapshot, ParticipantPredictionsSnapshot, PublicPredictionSnapshot, RankingEntrySnapshot } from '../../shared/types/domain';

const ROUND_LABELS: Record<MatchRound, string> = {
  round_of_16: 'Oitavas de Final',
  quarterfinal: 'Quartas de Final',
  semifinal: 'Semifinais',
  third_place: 'Disputa de 3º Lugar',
  final: 'Final',
};

const ROUND_ORDER: MatchRound[] = ['round_of_16', 'quarterfinal', 'semifinal', 'third_place', 'final'];
const BUILD_VERSION = import.meta.env.VITE_APP_VERSION ?? import.meta.env.VITE_COMMIT_SHA ?? 'local';


type ScoreDraft = { homeScore: string; awayScore: string; saved?: boolean; error?: string };
type ToastState = { type: 'success' | 'error'; message: string } | null;
type MatchPredictionsState = Record<string, { loading?: boolean; predictions?: PublicPredictionSnapshot[]; error?: string }>;
type PublicDataError = { message: string; retry: () => void };

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Falha ao carregar ${url}: status ${response.status}`);
  }

  const contentType = response.headers.get('content-type');
  if (!contentType?.toLowerCase().includes('application/json')) {
    throw new Error(`Resposta inválida de ${url}: conteúdo não é JSON.`);
  }

  return response.json() as Promise<T>;
}

export function App() {
  const [route, setRoute] = useState(() => window.location.pathname);
  const [matches, setMatches] = useState<MatchSnapshot[]>([]);
  const [ranking, setRanking] = useState<RankingEntrySnapshot[]>([]);
  const [feed, setFeed] = useState<FeedEventSnapshot[]>([]);
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [drafts, setDrafts] = useState<Record<string, ScoreDraft>>({});
  const [matchPredictions, setMatchPredictions] = useState<MatchPredictionsState>({});
  const [loadingMatches, setLoadingMatches] = useState(true);
  const [loadingPublicData, setLoadingPublicData] = useState(true);
  const [publicDataError, setPublicDataError] = useState<string | null>(null);
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
    setPublicDataError(null);
    setLoadingPublicData(true);

    try {
      const [matchesData, rankingData, feedData] = await Promise.all([
        fetchJson<{ matches?: MatchSnapshot[] }>('/api/matches'),
        fetchJson<{ ranking?: RankingEntrySnapshot[] }>('/api/ranking'),
        fetchJson<{ events?: FeedEventSnapshot[] }>('/api/feed?limit=12'),
      ]);

      setMatches(matchesData.matches ?? []);
      setRanking(rankingData.ranking ?? []);
      setFeed(feedData.events ?? []);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível carregar os dados públicos.';
      setPublicDataError(message);
      throw error;
    } finally {
      setLoadingPublicData(false);
      setLoadingMatches(false);
    }
  }, []);

  useEffect(() => {
    refreshPublicData()
      .catch(() => setToast({ type: 'error', message: 'Não foi possível carregar os dados públicos.' }));
  }, [refreshPublicData]);

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(intervalId);
  }, []);

  const lookupParticipant = useCallback(async (nextUsername = username) => {
    const normalized = nextUsername.trim();
    if (!normalized) return;

    try {
      const response = await fetch(`/api/participants/${encodeURIComponent(normalized)}`);
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

  const groupedMatches = useMemo(() => groupMatches(matches), [matches]);
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
    setMatchPredictions((current) => ({ ...current, [matchExternalId]: { loading: true } }));
    try {
      const response = await fetch(`/api/matches/${encodeURIComponent(matchExternalId)}/predictions`);
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

    const validation = validateDrafts(matches, drafts);
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
      const response = await fetch('/api/predictions', {
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

  const publicDataErrorState = publicDataError ? { message: publicDataError, retry: refreshPublicData } : undefined;

  return (
    <main className="min-h-screen bg-psf-background pb-28 text-psf-text">
      <TopNav route={route} navigate={navigate} />

      {route === '/' && <HomePage nextMatch={nextMatch} ranking={ranking.slice(0, 3)} feed={feed.slice(0, 3)} finalMatchClosed={finalMatchClosed} leaders={leaders} loading={loadingPublicData} error={publicDataErrorState} navigate={navigate} />}
      {route === '/palpites' && <PredictionsPage groupedMatches={groupedMatches} drafts={drafts} displayName={displayName} username={username} lookupMessage={lookupMessage} loadingMatches={loadingMatches} matchPredictions={matchPredictions} now={now} saving={saving} setDisplayName={setDisplayName} setUsername={setUsername} lookupParticipant={lookupParticipant} updateDraft={updateDraft} loadMatchPredictions={loadMatchPredictions} savePredictions={savePredictions} />}
      {route === '/ranking' && <RankingPage ranking={ranking} finalMatchClosed={finalMatchClosed} leaders={leaders} />}
      {route === '/feed' && <FeedPage feed={feed} />}
      {route === '/health' && <HealthPage buildVersion={BUILD_VERSION} />}
      {!['/', '/palpites', '/ranking', '/feed', '/health'].includes(route) && <HomePage nextMatch={nextMatch} ranking={ranking.slice(0, 3)} feed={feed.slice(0, 3)} finalMatchClosed={finalMatchClosed} leaders={leaders} navigate={navigate} />}

      <BuildFooter buildVersion={BUILD_VERSION} navigate={navigate} />
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

function HomePage({ nextMatch, ranking, feed, finalMatchClosed, leaders, loading, error, navigate }: { nextMatch?: MatchSnapshot; ranking: RankingEntrySnapshot[]; feed: FeedEventSnapshot[]; finalMatchClosed: boolean; leaders: RankingEntrySnapshot[]; loading: boolean; error?: PublicDataError; navigate: (path: string) => void }) {
  return (
    <section className="mx-auto grid max-w-5xl gap-6 px-5 py-8">
      {finalMatchClosed && leaders.length > 0 && <ChampionBanner leaders={leaders} />}
      <div className="rounded-[2rem] bg-psf-surface p-8 shadow-card">
        <p className="text-sm font-black uppercase tracking-[0.24em] text-psf-blue">Copa do Mundo 2026</p>
        <h1 className="mt-3 text-5xl font-black tracking-tight">O bolão oficial da PSF no mata-mata.</h1>
        <p className="mt-4 max-w-2xl text-lg text-psf-secondary">Palpite rápido, ranking automático e suspense até o kickoff. Tudo em uma experiência clara, mobile first e feita para a comunidade.</p>
        <button className="mt-7 rounded-full bg-psf-blue px-8 py-4 text-lg font-black text-white shadow-card" onClick={() => navigate('/palpites')} type="button">Fazer meus palpites</button>
      </div>
      {error ? <ErrorCard message={error.message} onRetry={error.retry} /> : (
        <div className="grid gap-4 md:grid-cols-3">
          <InfoPanel title="Próximo jogo">{loading ? <EmptySmall text="Carregando próximo jogo..." /> : nextMatch ? <MiniMatch match={nextMatch} /> : <EmptySmall text="Nenhum jogo aberto agora." />}</InfoPanel>
          <InfoPanel title="Liderança">{loading ? <EmptySmall text="Carregando ranking..." /> : ranking.length > 0 ? ranking.map((entry) => <RankingMini entry={entry} key={entry.username} />) : <EmptySmall text="Ranking ainda vazio." />}</InfoPanel>
          <InfoPanel title="Últimos eventos">{loading ? <EmptySmall text="Carregando feed..." /> : feed.length > 0 ? feed.map((event) => <p className="rounded-2xl bg-psf-background p-3 text-sm font-bold" key={event.id}>{event.message}</p>) : <EmptySmall text="Feed será gerado após os jogos." />}</InfoPanel>
        </div>
      )}
    </section>
  );
}

function PredictionsPage(props: { groupedMatches: Array<{ round: MatchRound; matches: MatchSnapshot[] }>; drafts: Record<string, ScoreDraft>; displayName: string; username: string; lookupMessage: string; loadingMatches: boolean; matchPredictions: MatchPredictionsState; now: number; saving: boolean; setDisplayName: (value: string) => void; setUsername: (value: string) => void; lookupParticipant: (username?: string) => void; updateDraft: (matchExternalId: string, side: 'homeScore' | 'awayScore', value: string) => void; loadMatchPredictions: (matchExternalId: string) => void; savePredictions: () => void }) {
  return (
    <>
      <header className="mx-auto max-w-5xl px-5 py-8">
        <h1 className="text-4xl font-black tracking-tight">Palpites do mata-mata</h1>
        <p className="mt-3 max-w-2xl text-psf-secondary">Preencha nome e username, marque seus placares das partidas abertas e salve tudo de uma vez.</p>
      </header>
      <section className="px-5 py-4">
        <div className="mx-auto grid max-w-5xl gap-3 rounded-[1.5rem] bg-psf-surface p-4 shadow-card md:grid-cols-[1fr_0.8fr_auto]">
          <label className="grid gap-1 text-sm font-bold">Nome de exibição<input className="rounded-2xl bg-psf-background px-4 py-3 font-semibold outline-none focus:ring-2 focus:ring-psf-blue" maxLength={30} value={props.displayName} onChange={(event) => props.setDisplayName(event.target.value)} placeholder="Ex: Pedro" /></label>
          <label className="grid gap-1 text-sm font-bold">Username<input className="rounded-2xl bg-psf-background px-4 py-3 font-semibold outline-none focus:ring-2 focus:ring-psf-blue" maxLength={20} value={props.username} onBlur={() => props.lookupParticipant()} onChange={(event) => props.setUsername(event.target.value.replace(/\s/g, ''))} placeholder="pedro_psf" /></label>
          <button className="self-end rounded-2xl bg-psf-text px-5 py-3 font-black text-white disabled:opacity-60" type="button" onClick={() => props.lookupParticipant()} disabled={!props.username.trim()}>Buscar</button>
          {props.lookupMessage && <p className="text-sm font-semibold text-psf-secondary md:col-span-3">{props.lookupMessage}</p>}
        </div>
      </section>
      <section className="mx-auto grid max-w-5xl gap-8 px-5 py-8">
        {props.loadingMatches && <EmptyCard message="Carregando partidas da ESPN..." />}
        {!props.loadingMatches && props.groupedMatches.length === 0 && <EmptyCard message="Nenhuma partida encontrada agora." />}
        {props.groupedMatches.map((group) => <div className="grid gap-4" key={group.round}><h2 className="text-2xl font-black tracking-tight">{ROUND_LABELS[group.round]}</h2><div className="grid gap-4">{group.matches.map((match) => <MatchCard key={match.externalId} match={match} draft={props.drafts[match.externalId]} now={props.now} publicPredictions={props.matchPredictions[match.externalId]} onChange={props.updateDraft} onReveal={props.loadMatchPredictions} />)}</div></div>)}
      </section>
      <footer className="fixed inset-x-0 bottom-0 z-20 border-t border-black/5 bg-psf-surface/95 px-5 py-4 backdrop-blur"><div className="mx-auto flex max-w-5xl items-center justify-between gap-4"><p className="hidden text-sm font-semibold text-psf-secondary sm:block">Campos inválidos permanecem preenchidos para você corrigir sem perder nada.</p><button className="ml-auto w-full rounded-full bg-psf-blue px-8 py-4 text-lg font-black text-white shadow-card disabled:opacity-60 sm:w-auto" type="button" onClick={props.savePredictions} disabled={props.saving}>{props.saving ? 'Salvando...' : 'Salvar Palpites'}</button></div></footer>
    </>
  );
}

function RankingPage({ ranking, finalMatchClosed, leaders, loading, error }: { ranking: RankingEntrySnapshot[]; finalMatchClosed: boolean; leaders: RankingEntrySnapshot[]; loading: boolean; error?: PublicDataError }) {
  return <section className="mx-auto grid max-w-3xl gap-4 px-5 py-8">{finalMatchClosed && leaders.length > 0 && <ChampionBanner leaders={leaders} />}
    <h1 className="text-4xl font-black tracking-tight">Ranking Geral</h1>
    {error && <ErrorCard message={error.message} onRetry={error.retry} />}
    {!error && loading && <EmptyCard message="Carregando ranking..." />}
    {!error && !loading && ranking.length === 0 && <EmptyCard message="Ranking ainda vazio." />}
    {!error && ranking.map((entry) => <RankingCard entry={entry} key={entry.username} highlight={finalMatchClosed && entry.position === 1} />)}
  </section>;
}

function FeedPage({ feed, loading, error }: { feed: FeedEventSnapshot[]; loading: boolean; error?: PublicDataError }) {
  return <section className="mx-auto grid max-w-3xl gap-4 px-5 py-8"><h1 className="text-4xl font-black tracking-tight">Feed PSF</h1>{error && <ErrorCard message={error.message} onRetry={error.retry} />}{!error && loading && <EmptyCard message="Carregando feed..." />}{!error && !loading && feed.length === 0 && <EmptyCard message="Eventos automáticos aparecerão após o recálculo dos jogos." />}{!error && feed.map((event) => <article className="rounded-[1.5rem] bg-psf-surface p-5 shadow-card" key={event.id}><p className="font-black">{event.message}</p><time className="mt-2 block text-sm font-bold text-psf-secondary">{formatKickoff(event.createdAt)}</time></article>)}</section>;
}


function HealthPage({ buildVersion }: { buildVersion: string }) {
  return (
    <section className="mx-auto grid max-w-3xl gap-4 px-5 py-8">
      <h1 className="text-4xl font-black tracking-tight">Health</h1>
      <div className="rounded-[2rem] bg-psf-surface p-6 shadow-card">
        <p className="text-sm font-black uppercase tracking-[0.24em] text-psf-blue">Frontend</p>
        <dl className="mt-4 grid gap-3 text-sm font-bold text-psf-secondary">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-psf-background p-4">
            <dt>Build</dt>
            <dd className="font-mono text-psf-text" data-testid="build-version">{buildVersion}</dd>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-psf-background p-4">
            <dt>Status</dt>
            <dd className="text-psf-success">ok</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}

function BuildFooter({ buildVersion, navigate }: { buildVersion: string; navigate: (path: string) => void }) {
  return (
    <footer className="mx-auto max-w-5xl px-5 pb-6 pt-2 text-right text-xs font-bold text-psf-muted">
      <button className="font-mono hover:text-psf-secondary" onClick={() => navigate('/health')} type="button" title="Build version">
        build {buildVersion.slice(0, 12)}
      </button>
    </footer>
  );
}

function MatchCard({ match, draft, now, publicPredictions, onChange, onReveal }: { match: MatchSnapshot; draft?: ScoreDraft; now: number; publicPredictions?: { loading?: boolean; predictions?: PublicPredictionSnapshot[]; error?: string }; onChange: (matchExternalId: string, side: 'homeScore' | 'awayScore', value: string) => void; onReveal: (matchExternalId: string) => void }) {
  const locked = match.status !== 'scheduled' || new Date(match.kickoffAt).getTime() <= now;
  const hasPlaceholder = match.homeTeam.isPlaceholder || match.awayTeam.isPlaceholder;
  const disabled = locked || hasPlaceholder;
  const statusLabel = hasPlaceholder ? 'Aguardando definição dos times' : locked ? statusText(match.status) : 'Aberto para palpite';

  return (
    <article className={`rounded-[2rem] bg-psf-surface p-5 shadow-card ${draft?.saved ? 'ring-2 ring-psf-success' : ''} ${disabled ? 'opacity-90' : ''}`}>
      <div className="mb-4 flex items-center justify-between gap-3"><time className="text-sm font-bold text-psf-secondary">{formatKickoff(match.kickoffAt)}</time><span className={`rounded-full px-3 py-1 text-xs font-black ${disabled ? 'bg-psf-background text-psf-secondary' : 'bg-blue-50 text-psf-blue'}`}>{statusLabel}</span></div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3"><TeamBlock name={match.homeTeam.name} logoUrl={match.homeTeam.logoUrl} align="right" /><div className="grid grid-cols-[4rem_auto_4rem] items-center gap-2"><ScoreInput value={locked ? match.homeScore : draft?.homeScore} disabled={disabled} onChange={(value) => onChange(match.externalId, 'homeScore', value)} /><span className="text-xl font-black text-psf-muted">×</span><ScoreInput value={locked ? match.awayScore : draft?.awayScore} disabled={disabled} onChange={(value) => onChange(match.externalId, 'awayScore', value)} /></div><TeamBlock name={match.awayTeam.name} logoUrl={match.awayTeam.logoUrl} align="left" /></div>
      {draft?.error && <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-psf-danger">{draft.error}</p>}
      {draft?.saved && !draft.error && <p className="mt-4 text-sm font-black text-psf-success">✓ Salvo</p>}
      {locked && <section className="mt-4 rounded-[1.5rem] bg-psf-background p-4"><button className="text-sm font-black text-psf-blue" type="button" onClick={() => onReveal(match.externalId)}>{publicPredictions?.loading ? 'Carregando...' : 'Ver palpites revelados'}</button>{publicPredictions?.error && <p className="mt-2 text-sm font-bold text-psf-danger">{publicPredictions.error}</p>}{publicPredictions?.predictions && <div className="mt-3 grid gap-2">{publicPredictions.predictions.length === 0 ? <p className="text-sm font-bold text-psf-secondary">Nenhum palpite registrado.</p> : publicPredictions.predictions.map((prediction) => <div className="flex items-center justify-between rounded-2xl bg-psf-surface p-3 text-sm font-bold" key={prediction.participantKey}><span>{prediction.displayName}</span><span className={prediction.points === 1 ? 'text-psf-success' : 'text-psf-secondary'}>{prediction.homeScore} × {prediction.awayScore}</span></div>)}</div>}</section>}
    </article>
  );
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
  return <div className="rounded-2xl bg-psf-background p-4"><p className="text-sm font-bold text-psf-secondary">{ROUND_LABELS[match.round]} · {formatKickoff(match.kickoffAt)}</p><p className="mt-2 text-lg font-black">{match.homeTeam.name} × {match.awayTeam.name}</p></div>;
}

function InfoPanel({ title, children }: { title: string; children: ReactNode }) {
  return <section className="rounded-[1.75rem] bg-psf-surface p-5 shadow-card"><h2 className="mb-4 text-xl font-black">{title}</h2><div className="grid gap-3">{children}</div></section>;
}

function TeamBlock({ name, logoUrl, align }: { name: string; logoUrl: string | null; align: 'left' | 'right' }) {
  return <div className={`flex items-center gap-3 ${align === 'right' ? 'justify-end text-right' : ''}`}>{align === 'right' && <strong className="text-base font-black sm:text-lg">{name}</strong>}<div className="grid h-11 w-11 place-items-center overflow-hidden rounded-full bg-psf-background text-sm font-black">{logoUrl ? <img alt="" className="h-full w-full object-cover" src={logoUrl} /> : name.slice(0, 2).toUpperCase()}</div>{align === 'left' && <strong className="text-base font-black sm:text-lg">{name}</strong>}</div>;
}

function ScoreInput({ value, disabled, onChange }: { value?: string | number | null; disabled: boolean; onChange: (value: string) => void }) {
  return <input className="h-14 rounded-2xl bg-psf-background text-center text-2xl font-black outline-none focus:ring-2 focus:ring-psf-blue disabled:text-psf-secondary" disabled={disabled} inputMode="numeric" max={20} min={0} value={value ?? ''} onChange={(event) => onChange(event.target.value)} placeholder="-" />;
}

function EmptyCard({ message }: { message: string }) {
  return <div className="rounded-[2rem] bg-psf-surface p-8 text-center font-bold text-psf-secondary shadow-card">{message}</div>;
}

function ErrorCard({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <div className="rounded-[2rem] border border-red-100 bg-red-50 p-8 text-center shadow-card"><p className="text-sm font-black uppercase tracking-[0.2em] text-psf-danger">Erro ao carregar dados</p><p className="mt-3 font-bold text-psf-text">{message}</p><button className="mt-5 rounded-full bg-psf-danger px-6 py-3 font-black text-white" onClick={() => void onRetry()} type="button">Tentar recarregar</button></div>;
}

function EmptySmall({ text }: { text: string }) {
  return <p className="rounded-2xl bg-psf-background p-4 text-sm font-bold text-psf-secondary">{text}</p>;
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
    const hasPlaceholder = match.homeTeam.isPlaceholder || match.awayTeam.isPlaceholder;
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

function groupMatches(matches: MatchSnapshot[]) {
  return ROUND_ORDER.map((round) => ({
    round,
    matches: matches.filter((match) => match.round === round).sort((a, b) => new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime()),
  })).filter((group) => group.matches.length > 0);
}

function formatKickoff(value: string) {
  if (!value) return 'Horário a confirmar';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(value));
}

function statusText(status: MatchSnapshot['status']) {
  if (status === 'final') return 'Encerrado';
  if (status === 'in_progress') return 'Ao vivo';
  return 'Bloqueado';
}

function trendLabel(delta: number) {
  if (delta > 0) return `↑ ${delta}`;
  if (delta < 0) return `↓ ${Math.abs(delta)}`;
  return '=';
}
