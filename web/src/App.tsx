import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MatchRound, MatchSnapshot, ParticipantPredictionsSnapshot } from '../../shared/types/domain';

const ROUND_LABELS: Record<MatchRound, string> = {
  round_of_16: 'Oitavas de Final',
  quarterfinal: 'Quartas de Final',
  semifinal: 'Semifinais',
  third_place: 'Disputa de 3º Lugar',
  final: 'Final',
};

const ROUND_ORDER: MatchRound[] = ['round_of_16', 'quarterfinal', 'semifinal', 'third_place', 'final'];

type ScoreDraft = { homeScore: string; awayScore: string; saved?: boolean; error?: string };
type ToastState = { type: 'success' | 'error'; message: string } | null;

export function App() {
  const [matches, setMatches] = useState<MatchSnapshot[]>([]);
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [drafts, setDrafts] = useState<Record<string, ScoreDraft>>({});
  const [loadingMatches, setLoadingMatches] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);
  const [lookupMessage, setLookupMessage] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const debounceRef = useRef<number | null>(null);

  useEffect(() => {
    fetch('/api/matches')
      .then((response) => response.json())
      .then((data) => setMatches(((data as { matches?: MatchSnapshot[] }).matches) ?? []))
      .catch(() => setToast({ type: 'error', message: 'Não foi possível carregar as partidas.' }))
      .finally(() => setLoadingMatches(false));
  }, []);

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

  const groupedMatches = useMemo(() => {
    return ROUND_ORDER.map((round) => ({
      round,
      matches: matches
        .filter((match) => match.round === round)
        .sort((a, b) => new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime()),
    })).filter((group) => group.matches.length > 0);
  }, [matches]);

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
      setToast({ type: 'success', message: 'Palpites salvos!' });
    } catch (error) {
      setToast({ type: 'error', message: error instanceof Error ? error.message : 'Erro de rede ao salvar.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-psf-background pb-28 text-psf-text">
      <header className="mx-auto max-w-5xl px-5 py-8">
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-psf-blue">PSFPREDICT</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight">Palpites do mata-mata</h1>
        <p className="mt-3 max-w-2xl text-psf-secondary">
          Preencha nome e username, marque seus placares das partidas abertas e salve tudo de uma vez.
        </p>
      </header>

      <section className="sticky top-0 z-20 border-b border-black/5 bg-psf-background/90 px-5 py-4 backdrop-blur">
        <div className="mx-auto grid max-w-5xl gap-3 rounded-[1.5rem] bg-psf-surface p-4 shadow-card md:grid-cols-[1fr_0.8fr_auto]">
          <label className="grid gap-1 text-sm font-bold">
            Nome de exibição
            <input className="rounded-2xl bg-psf-background px-4 py-3 font-semibold outline-none ring-0 focus:ring-2 focus:ring-psf-blue" maxLength={30} value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Ex: Pedro" />
          </label>
          <label className="grid gap-1 text-sm font-bold">
            Username
            <input className="rounded-2xl bg-psf-background px-4 py-3 font-semibold outline-none ring-0 focus:ring-2 focus:ring-psf-blue" maxLength={20} value={username} onBlur={() => lookupParticipant()} onChange={(event) => setUsername(event.target.value.replace(/\s/g, ''))} placeholder="pedro_psf" />
          </label>
          <button className="self-end rounded-2xl bg-psf-text px-5 py-3 font-black text-white disabled:opacity-60" type="button" onClick={() => lookupParticipant()} disabled={!username.trim()}>
            Buscar
          </button>
          {lookupMessage && <p className="text-sm font-semibold text-psf-secondary md:col-span-3">{lookupMessage}</p>}
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl gap-8 px-5 py-8">
        {loadingMatches && <EmptyCard message="Carregando partidas da ESPN..." />}
        {!loadingMatches && groupedMatches.length === 0 && <EmptyCard message="Nenhuma partida encontrada agora." />}

        {groupedMatches.map((group) => (
          <div className="grid gap-4" key={group.round}>
            <h2 className="text-2xl font-black tracking-tight">{ROUND_LABELS[group.round]}</h2>
            <div className="grid gap-4">
              {group.matches.map((match) => (
                <MatchCard key={match.externalId} match={match} draft={drafts[match.externalId]} now={now} onChange={updateDraft} />
              ))}
            </div>
          </div>
        ))}
      </section>

      {toast && (
        <div className={`fixed bottom-24 left-1/2 z-30 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-2xl px-5 py-4 text-center font-black shadow-card ${toast.type === 'success' ? 'bg-psf-success text-white' : 'bg-psf-danger text-white'}`}>
          {toast.message}
        </div>
      )}

      <footer className="fixed inset-x-0 bottom-0 z-20 border-t border-black/5 bg-psf-surface/95 px-5 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <p className="hidden text-sm font-semibold text-psf-secondary sm:block">Campos inválidos permanecem preenchidos para você corrigir sem perder nada.</p>
          <button className="ml-auto w-full rounded-full bg-psf-blue px-8 py-4 text-lg font-black text-white shadow-card disabled:opacity-60 sm:w-auto" type="button" onClick={savePredictions} disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar Palpites'}
          </button>
        </div>
      </footer>
    </main>
  );
}

function MatchCard({ match, draft, now, onChange }: { match: MatchSnapshot; draft?: ScoreDraft; now: number; onChange: (matchExternalId: string, side: 'homeScore' | 'awayScore', value: string) => void }) {
  const locked = match.status !== 'scheduled' || new Date(match.kickoffAt).getTime() <= now;
  const hasPlaceholder = match.homeTeam.isPlaceholder || match.awayTeam.isPlaceholder;
  const disabled = locked || hasPlaceholder;
  const statusLabel = hasPlaceholder ? 'Aguardando definição dos times' : locked ? statusText(match.status) : 'Aberto para palpite';

  return (
    <article className={`rounded-[2rem] bg-psf-surface p-5 shadow-card ${draft?.saved ? 'ring-2 ring-psf-success' : ''} ${disabled ? 'opacity-75' : ''}`}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <time className="text-sm font-bold text-psf-secondary">{formatKickoff(match.kickoffAt)}</time>
        <span className={`rounded-full px-3 py-1 text-xs font-black ${disabled ? 'bg-psf-background text-psf-secondary' : 'bg-blue-50 text-psf-blue'}`}>{statusLabel}</span>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <TeamBlock name={match.homeTeam.name} logoUrl={match.homeTeam.logoUrl} align="right" />
        <div className="grid grid-cols-[4rem_auto_4rem] items-center gap-2">
          <ScoreInput value={locked ? match.homeScore : draft?.homeScore} disabled={disabled} onChange={(value) => onChange(match.externalId, 'homeScore', value)} />
          <span className="text-xl font-black text-psf-muted">×</span>
          <ScoreInput value={locked ? match.awayScore : draft?.awayScore} disabled={disabled} onChange={(value) => onChange(match.externalId, 'awayScore', value)} />
        </div>
        <TeamBlock name={match.awayTeam.name} logoUrl={match.awayTeam.logoUrl} align="left" />
      </div>

      {draft?.error && <p className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm font-bold text-psf-danger">{draft.error}</p>}
      {draft?.saved && !draft.error && <p className="mt-4 text-sm font-black text-psf-success">✓ Salvo</p>}
    </article>
  );
}

function TeamBlock({ name, logoUrl, align }: { name: string; logoUrl: string | null; align: 'left' | 'right' }) {
  return (
    <div className={`flex items-center gap-3 ${align === 'right' ? 'justify-end text-right' : ''}`}>
      {align === 'right' && <strong className="text-base font-black sm:text-lg">{name}</strong>}
      <div className="grid h-11 w-11 place-items-center overflow-hidden rounded-full bg-psf-background text-sm font-black">
        {logoUrl ? <img alt="" className="h-full w-full object-cover" src={logoUrl} /> : name.slice(0, 2).toUpperCase()}
      </div>
      {align === 'left' && <strong className="text-base font-black sm:text-lg">{name}</strong>}
    </div>
  );
}

function ScoreInput({ value, disabled, onChange }: { value?: string | number | null; disabled: boolean; onChange: (value: string) => void }) {
  return (
    <input className="h-14 rounded-2xl bg-psf-background text-center text-2xl font-black outline-none focus:ring-2 focus:ring-psf-blue disabled:text-psf-secondary" disabled={disabled} inputMode="numeric" max={20} min={0} value={value ?? ''} onChange={(event) => onChange(event.target.value)} placeholder="-" />
  );
}

function EmptyCard({ message }: { message: string }) {
  return <div className="rounded-[2rem] bg-psf-surface p-8 text-center font-bold text-psf-secondary shadow-card">{message}</div>;
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

function formatKickoff(value: string) {
  if (!value) return 'Horário a confirmar';
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'America/Sao_Paulo',
  }).format(new Date(value));
}

function statusText(status: MatchSnapshot['status']) {
  if (status === 'final') return 'Encerrado';
  if (status === 'in_progress') return 'Ao vivo';
  return 'Bloqueado';
}
