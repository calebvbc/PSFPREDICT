import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FeedEventSnapshot, MatchSnapshot, ParticipantPredictionsSnapshot, PublicPredictionSnapshot, RankingEntrySnapshot } from '../../shared/types/domain';
import { TopNav } from './components/TopNav';
import { FeedPage } from './pages/FeedPage';
import { HomePage } from './pages/HomePage';
import { PredictionsPage } from './pages/PredictionsPage';
import { RankingPage } from './pages/RankingPage';
import { ROUND_ORDER } from './lib/presentation';
import type { MatchPredictionsState, PublicDataError, ScoreDraft, ToastState } from './types';

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
      fetch('/api/matches'),
      fetch('/api/ranking'),
      fetch('/api/feed?limit=12'),
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
        setToast({ type: 'error', message: 'Não foi possível carregar os dados públicos.' });
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

  return (
    <main className={`min-h-screen bg-psf-background text-psf-text ${route === '/palpites' ? 'pb-[calc(8rem+env(safe-area-inset-bottom))]' : 'pb-28'}`}>
      <TopNav route={route} navigate={navigate} />

      {route === '/' && <HomePage nextMatch={nextMatch} ranking={ranking.slice(0, 3)} feed={feed.slice(0, 3)} finalMatchClosed={finalMatchClosed} leaders={leaders} navigate={navigate} loading={loadingMatches} error={publicDataError} />}
      {route === '/palpites' && <PredictionsPage groupedMatches={groupedMatches} drafts={drafts} displayName={displayName} username={username} lookupMessage={lookupMessage} loadingMatches={loadingMatches} matchPredictions={matchPredictions} now={now} saving={saving} setDisplayName={setDisplayName} setUsername={setUsername} lookupParticipant={lookupParticipant} updateDraft={updateDraft} loadMatchPredictions={loadMatchPredictions} savePredictions={savePredictions} />}
      {route === '/ranking' && <RankingPage ranking={ranking} finalMatchClosed={finalMatchClosed} leaders={leaders} loading={loadingMatches} error={publicDataError} />}
      {route === '/feed' && <FeedPage feed={feed} loading={loadingMatches} error={publicDataError} />}
      {!['/', '/palpites', '/ranking', '/feed'].includes(route) && <HomePage nextMatch={nextMatch} ranking={ranking.slice(0, 3)} feed={feed.slice(0, 3)} finalMatchClosed={finalMatchClosed} leaders={leaders} navigate={navigate} loading={loadingMatches} error={publicDataError} />}

      {toast && <Toast toast={toast} />}
    </main>
  );
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

