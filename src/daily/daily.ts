/**
 * Desafio do dia: a mesma semente para todo mundo no mesmo dia (UTC), dias seguidos sem punição pesada
 * e nada de sorteio ou moeda (decisão de 2026-10-25).
 */

/** Dia do desafio em UTC (AAAA-MM-DD): vira à 0 h UTC, igual no mundo todo. */
export function dailyKey(now: Date | number): string {
  return new Date(now).toISOString().slice(0, 10);
}

/** Número aleatório reproduzível: mesma semente, mesma sequência, em qualquer aparelho. */
export function seededRandom(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let x = Math.imul(a ^ (a >>> 15), 1 | a);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/** Gerador do desafio de um jogo num dia: "dobra" e "paciencia" não compartilham sequência. */
export function dailyRandom(game: string, day: string): () => number {
  return seededRandom(`${game}:${day}`);
}

export interface StreakState {
  /** Último dia (dailyKey) com desafio concluído. */
  lastDay: string | null;
  streak: number;
  best: number;
  /** Semana ISO (AAAA-Www) em que a folga foi usada. */
  freezeWeek: string | null;
}

export const emptyStreak = (): StreakState => ({ lastDay: null, streak: 0, best: 0, freezeWeek: null });

const DAY_MS = 86_400_000;
const toMs = (day: string): number => Date.parse(`${day}T00:00:00Z`);
const daysBetween = (from: string, to: string): number => Math.round((toMs(to) - toMs(from)) / DAY_MS);

/** Semana ISO 8601 do dia, ex.: 2026-W44. */
export function isoWeek(day: string): string {
  const d = new Date(toMs(day));
  const weekday = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - weekday + 3);
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((d.getTime() - firstThursday.getTime()) / DAY_MS - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

/** Faltou exatamente um dia e a folga desta semana ainda está livre? */
function canUseFreeze(state: StreakState, today: string): boolean {
  return state.lastDay !== null && daysBetween(state.lastDay, today) === 2 && state.freezeWeek !== isoWeek(today);
}

/** Registra o desafio concluído hoje. Concluir de novo no mesmo dia não muda nada. */
export function completeDay(state: StreakState, today: string): StreakState {
  if (state.lastDay === today) return state;
  let streak = 1;
  let freezeWeek = state.freezeWeek;
  if (state.lastDay !== null && daysBetween(state.lastDay, today) === 1) streak = state.streak + 1;
  else if (canUseFreeze(state, today)) {
    streak = state.streak + 1;
    freezeWeek = isoWeek(today);
  }
  return { lastDay: today, streak, best: Math.max(state.best, streak), freezeWeek };
}

/** Sequência que a tela mostra hoje: continua viva enquanto o jogador ainda pode emendar. */
export function visibleStreak(state: StreakState, today: string): number {
  if (state.lastDay === null) return 0;
  const gap = daysBetween(state.lastDay, today);
  if (gap <= 1) return state.streak;
  if (canUseFreeze(state, today)) return state.streak;
  return 0;
}

/** Próximo desafio: milissegundos até a 0 h UTC seguinte. */
export function msUntilNextDaily(now: Date | number): number {
  const t = new Date(now).getTime();
  const next = Date.UTC(new Date(t).getUTCFullYear(), new Date(t).getUTCMonth(), new Date(t).getUTCDate() + 1);
  return next - t;
}
