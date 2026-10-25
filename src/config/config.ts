/**
 * Configuração remota: números de anúncio e de jogo mudam sem nova versão.
 * O JSON vem do próprio servidor do jogo; qualquer falha cai nos valores padrão embutidos.
 *
 * Formato do JSON:
 * {
 *   "values": { "gapSec": 180 },
 *   "experiments": [{ "id": "gap-2026-11", "onlyNewPlayers": true, "groups": { "a": { "gapSec": 180 }, "b": { "gapSec": 120 } } }]
 * }
 */
export type ConfigValue = number | boolean | string;
export type ConfigValues = Record<string, ConfigValue>;

/** De onde o JSON vem. Trocar de fornecedor é trocar esta implementação. */
export interface ConfigSource {
  load(): Promise<unknown>;
}

export type ConfigLimits<T extends ConfigValues> = { [K in keyof T]?: { min?: number; max?: number } };

export interface ResolvedConfig<T extends ConfigValues> {
  values: T;
  /** Grupo sorteado em cada experimento ativo, para registrar nas métricas. */
  groups: Record<string, string>;
}

export interface ResolveOptions<T extends ConfigValues> {
  playerId: string;
  /** Jogador novo (primeiro dia). Experimentos com onlyNewPlayers só valem para eles. */
  isNewPlayer?: boolean;
  limits?: ConfigLimits<T>;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Fica só com chaves conhecidas, do mesmo tipo do padrão e dentro da faixa. */
export function sanitize<T extends ConfigValues>(defaults: T, raw: unknown, limits: ConfigLimits<T> = {}): Partial<T> {
  if (!isObject(raw)) return {};
  const out: Partial<T> = {};
  for (const key of Object.keys(defaults) as (keyof T & string)[]) {
    const value = raw[key];
    if (typeof value !== typeof defaults[key]) continue;
    if (typeof value === 'number') {
      const lim = limits[key];
      if (!Number.isFinite(value)) continue;
      if (lim?.min !== undefined && value < lim.min) continue;
      if (lim?.max !== undefined && value > lim.max) continue;
    }
    out[key] = value as T[typeof key];
  }
  return out;
}

/** FNV-1a de 32 bits: rápido, sem dependência e igual em qualquer aparelho. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Grupo fixo do jogador num experimento: o mesmo em toda sessão e em todo aparelho com o mesmo id. */
export function assignGroup(playerId: string, experimentId: string, groups: readonly string[]): string {
  const sorted = [...groups].sort();
  if (sorted.length === 0) throw new Error('experimento sem grupos');
  return sorted[hash(`${experimentId}:${playerId}`) % sorted.length]!;
}

export function resolveConfig<T extends ConfigValues>(defaults: T, raw: unknown, opts: ResolveOptions<T>): ResolvedConfig<T> {
  const values: T = { ...defaults, ...sanitize(defaults, isObject(raw) ? raw.values : undefined, opts.limits) };
  const groups: Record<string, string> = {};
  const experiments = isObject(raw) && Array.isArray(raw.experiments) ? raw.experiments : [];
  for (const exp of experiments) {
    if (!isObject(exp) || typeof exp.id !== 'string' || !isObject(exp.groups)) continue;
    const names = Object.keys(exp.groups);
    if (names.length < 2) continue;
    if (exp.onlyNewPlayers === true && !opts.isNewPlayer) continue;
    const group = assignGroup(opts.playerId, exp.id, names);
    Object.assign(values, sanitize(defaults, exp.groups[group], opts.limits));
    groups[exp.id] = group;
  }
  return { values, groups };
}

/** Carrega e resolve. Nunca rejeita: sem rede ou com JSON inválido, devolve os padrões. */
export async function loadConfig<T extends ConfigValues>(
  defaults: T,
  source: ConfigSource,
  opts: ResolveOptions<T>,
): Promise<ResolvedConfig<T>> {
  let raw: unknown;
  try {
    raw = await source.load();
  } catch {
    return { values: { ...defaults }, groups: {} };
  }
  return resolveConfig(defaults, raw, opts);
}
