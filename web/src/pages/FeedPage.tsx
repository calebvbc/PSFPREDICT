import type { FeedEventSnapshot } from '../../../shared/types/domain';
import { EmptyCard, ErrorCard } from '../components/InfoPanel';
import { formatKickoff } from '../lib/presentation';
import type { PublicDataError } from '../types';

export function FeedPage({ feed, loading, error }: { feed: FeedEventSnapshot[]; loading: boolean; error?: PublicDataError }) {
  return <section className="mx-auto grid max-w-3xl gap-4 px-4 py-6 sm:px-5 sm:py-8"><h1 className="text-3xl font-black tracking-tight sm:text-4xl">Feed PSF</h1>{error && <ErrorCard message={error} />}{loading && <EmptyCard message="Carregando feed..." />}{!loading && feed.length === 0 && <EmptyCard message="Eventos automáticos aparecerão após o recálculo dos jogos." />}{feed.map((event) => <article className="rounded-[1.5rem] bg-psf-surface p-4 shadow-card sm:p-5" key={event.id}><p className="font-black">{event.message}</p><time className="mt-2 block text-sm font-bold text-psf-secondary">{formatKickoff(event.createdAt)}</time></article>)}</section>;
}
