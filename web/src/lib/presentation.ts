import type { MatchRound, MatchSnapshot } from '../../../shared/types/domain';

export const ROUND_LABELS: Record<MatchRound, string> = {
  round_of_32: 'Dezesseis-avos de Final',
  round_of_16: 'Oitavas de Final',
  quarterfinal: 'Quartas de Final',
  semifinal: 'Semifinais',
  third_place: 'Disputa de 3º Lugar',
  final: 'Final',
};

export const ROUND_ORDER: MatchRound[] = ['round_of_32', 'round_of_16', 'quarterfinal', 'semifinal', 'third_place', 'final'];

export function formatKickoff(value: string) {
  if (!value) return 'Horário a confirmar';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(new Date(value));
}

export function statusText(status: MatchSnapshot['status']) {
  if (status === 'final') return 'Encerrado';
  if (status === 'in_progress') return 'Ao vivo';
  return 'Bloqueado';
}

export function trendLabel(delta: number) {
  if (delta > 0) return `↑ ${delta}`;
  if (delta < 0) return `↓ ${Math.abs(delta)}`;
  return '=';
}
