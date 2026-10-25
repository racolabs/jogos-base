/**
 * Metas do dia: 3 por dia (fácil, média, difícil), cumpridas jogando a partida normal.
 * Iguais para todo mundo no mesmo dia; sem sorteio de prêmio (o prêmio é fixo, cada jogo decide qual).
 * Tudo aqui é puro: o jogo informa o que aconteceu (`report`) e mostra o resultado.
 */
import { seededRandom } from '../daily/daily.ts';

export type Level = 0 | 1 | 2;

export interface MissionDef {
  id: string;
  level: Level;
  /** O que o jogo informa (ex.: 'merges', 'score', 'wins'). */
  metric: string;
  /** 'sum' soma ao longo do dia; 'max' guarda o maior valor visto (melhor partida). */
  mode: 'sum' | 'max';
  target: number;
  text: { pt: string; en: string };
}

export interface MissionsState {
  day: string;
  progress: Record<string, number>;
  /** Já entregou o prêmio das 3 metas hoje. */
  rewarded: boolean;
}

export interface MissionView {
  id: string;
  level: Level;
  text: string;
  progress: number;
  target: number;
  done: boolean;
}

/** Dia local do aparelho (AAAA-MM-DD): as metas trocam à meia-noite de quem joga. */
export function localDayKey(now: Date | number): string {
  const d = new Date(now);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Milissegundos até a próxima meia-noite local. */
export function msUntilLocalMidnight(now: Date | number): number {
  const d = new Date(now);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime() - d.getTime();
}

/** As 3 metas do dia: uma de cada nível, escolhidas pelo dia e pelo jogo, sem repetir o tipo de meta. */
export function dailyMissions(pool: readonly MissionDef[], day: string, game: string): MissionDef[] {
  const rnd = seededRandom(`missions:${game}:${day}`);
  const used = new Set<string>();
  return ([0, 1, 2] as const).map((level) => {
    const all = pool.filter((m) => m.level === level);
    if (!all.length) throw new Error(`sem metas de nível ${level} para ${game}`);
    const fresh = all.filter((m) => !used.has(m.metric));
    const options = fresh.length ? fresh : all;
    const pick = options[Math.floor(rnd() * options.length)]!;
    used.add(pick.metric);
    return pick;
  });
}

export const emptyMissions = (day: string): MissionsState => ({ day, progress: {}, rewarded: false });

/** Começa do zero quando o dia virou. */
export function ensureDay(state: MissionsState | null | undefined, day: string): MissionsState {
  return state && state.day === day ? state : emptyMissions(day);
}

export const isDone = (state: MissionsState, m: MissionDef) => (state.progress[m.id] ?? 0) >= m.target;

export interface ReportResult {
  state: MissionsState;
  /** Metas que acabaram de ser cumpridas. */
  completed: MissionDef[];
  /** As 3 ficaram prontas agora (entregar o prêmio uma vez só). */
  allDone: boolean;
}

/** Aplica o que aconteceu na partida. Eventos: pares [métrica, valor]. */
export function report(state: MissionsState, missions: readonly MissionDef[], events: readonly (readonly [string, number])[]): ReportResult {
  const progress = { ...state.progress };
  const completed: MissionDef[] = [];
  for (const m of missions) {
    const before = progress[m.id] ?? 0;
    let now = before;
    for (const [metric, value] of events) {
      if (metric !== m.metric || !(value > 0)) continue;
      now = m.mode === 'sum' ? now + value : Math.max(now, value);
    }
    if (now === before) continue;
    progress[m.id] = Math.min(now, m.target);
    if (before < m.target && now >= m.target) completed.push(m);
  }
  const next: MissionsState = { ...state, progress };
  const allDone = !state.rewarded && missions.length > 0 && missions.every((m) => isDone(next, m));
  if (allDone) next.rewarded = true;
  return { state: next, completed, allDone };
}

export function viewMissions(state: MissionsState, missions: readonly MissionDef[], lang: 'pt' | 'en'): MissionView[] {
  return missions.map((m) => ({
    id: m.id,
    level: m.level,
    text: m.text[lang],
    progress: Math.min(state.progress[m.id] ?? 0, m.target),
    target: m.target,
    done: isDone(state, m),
  }));
}

/** A meta não cumprida mais perto de acabar (para a etiqueta durante a partida). */
export function closestMission(views: readonly MissionView[]): MissionView | null {
  let best: MissionView | null = null;
  for (const v of views) {
    if (v.done) continue;
    if (!best || v.progress / v.target > best.progress / best.target) best = v;
  }
  return best;
}
