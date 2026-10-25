/**
 * Travas de anúncio do documento de monetização. Funções puras: recebem o estado do jogador,
 * a configuração e o relógio, e dizem se pode (null) ou por que não pode.
 */
import type { ConfigLimits } from '../config/index.ts';

export type AdConfig = {
  /** Partidas antes do primeiro intersticial. */
  minGames: number;
  /** Nenhum intersticial nas primeiras 24 h. */
  noAdsFirstDay: boolean;
  /** Intervalo mínimo entre intersticiais, antes do ajuste por segmento. */
  gapSec: number;
  /** Bloqueio de intersticial depois de um premiado assistido. */
  afterRewardedSec: number;
  perSession: number;
  perDay: number;
  /** Partida mais curta que isso não leva intersticial. */
  minGameSec: number;
  /** Derrotas rápidas seguidas que pulam o intersticial. */
  skipAfterQuickLosses: number;
  /** Premiados "Continuar" por partida. */
  continuePerGame: number;
  rewardedPerDay: number;
};

/** Valores iniciais do documento: conservadores, só sobem quando um teste A/B mostrar que a retenção não cai. */
export const AD_DEFAULTS: AdConfig = {
  minGames: 3,
  noAdsFirstDay: true,
  gapSec: 180,
  afterRewardedSec: 600,
  perSession: 4,
  perDay: 12,
  minGameSec: 45,
  skipAfterQuickLosses: 2,
  continuePerGame: 1,
  rewardedPerDay: 20,
};

/** Faixas aceitas da configuração remota. Um valor fora delas é ignorado e vale o padrão. */
export const AD_LIMITS: ConfigLimits<AdConfig> = {
  minGames: { min: 0, max: 20 },
  gapSec: { min: 60, max: 900 },
  afterRewardedSec: { min: 0, max: 3600 },
  perSession: { min: 0, max: 20 },
  perDay: { min: 0, max: 50 },
  minGameSec: { min: 0, max: 300 },
  skipAfterQuickLosses: { min: 1, max: 10 },
  continuePerGame: { min: 0, max: 3 },
  rewardedPerDay: { min: 0, max: 50 },
};

/** Tudo que as travas precisam saber do jogador. Vive só no aparelho. */
export interface PlayerAdState {
  /** Primeira vez que o jogo abriu neste aparelho (ms). */
  firstSeenAt: number;
  isPayer: boolean;
  removeAds: boolean;
  gamesPlayed: number;
  lastGameSec: number;
  quickLossStreak: number;
  lastInterstitialAt: number | null;
  lastRewardedAt: number | null;
  interstitialsThisSession: number;
  /** Dia (AAAA-MM-DD, horário local) a que os contadores "hoje" se referem. */
  day: string;
  interstitialsToday: number;
  rewardedToday: number;
  /** Média de sessões dos últimos 3 dias abaixo da metade da média da semana. */
  sessionTrendFalling: boolean;
  /** Vezes que saiu do jogo logo depois de um intersticial nos últimos 7 dias. */
  quitAfterAdCount7d: number;
}

export function newPlayerAdState(now: number): PlayerAdState {
  return {
    firstSeenAt: now,
    isPayer: false,
    removeAds: false,
    gamesPlayed: 0,
    lastGameSec: 0,
    quickLossStreak: 0,
    lastInterstitialAt: null,
    lastRewardedAt: null,
    interstitialsThisSession: 0,
    day: dayKey(now),
    interstitialsToday: 0,
    rewardedToday: 0,
    sessionTrendFalling: false,
    quitAfterAdCount7d: 0,
  };
}

export function dayKey(now: number): string {
  const d = new Date(now);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export type InterstitialBlock =
  | 'payer'
  | 'first-day'
  | 'too-few-games'
  | 'short-game'
  | 'frustrated'
  | 'gap'
  | 'after-rewarded'
  | 'session-cap'
  | 'day-cap'
  | 'not-ready';

const DAY_MS = 24 * 60 * 60 * 1000;

/** Regras simples por segmento: quem já rende ou está esfriando vê intersticial com menos frequência. */
export function segmentMultiplier(p: PlayerAdState): number {
  let m = 1;
  if (p.rewardedToday >= 3) m *= 1.5;
  if (p.sessionTrendFalling) m *= 2;
  if (p.quitAfterAdCount7d >= 2) m *= 1.5;
  return m;
}

/** Só mostra o intersticial quando todas as travas deixam. Devolve o motivo do bloqueio, ou null. */
export function interstitialBlock(p: PlayerAdState, cfg: AdConfig, now: number, ready: boolean): InterstitialBlock | null {
  if (p.removeAds || p.isPayer) return 'payer';
  if (cfg.noAdsFirstDay && now - p.firstSeenAt < DAY_MS) return 'first-day';
  if (p.gamesPlayed < cfg.minGames) return 'too-few-games';
  if (p.lastGameSec < cfg.minGameSec) return 'short-game';
  if (p.quickLossStreak >= cfg.skipAfterQuickLosses) return 'frustrated';
  const gapMs = cfg.gapSec * segmentMultiplier(p) * 1000;
  if (p.lastInterstitialAt !== null && now - p.lastInterstitialAt < gapMs) return 'gap';
  if (p.lastRewardedAt !== null && now - p.lastRewardedAt < cfg.afterRewardedSec * 1000) return 'after-rewarded';
  if (p.interstitialsThisSession >= cfg.perSession) return 'session-cap';
  if (p.interstitialsToday >= cfg.perDay) return 'day-cap';
  if (!ready) return 'not-ready';
  return null;
}

export type RewardedBlock = 'day-cap' | 'game-cap' | 'not-ready';

/** Pode oferecer premiado? Sem anúncio pronto, a oferta some (nunca mostra erro). */
export function rewardedBlock(
  p: PlayerAdState,
  cfg: AdConfig,
  use: { usedThisGame: number; perGame?: number },
  ready: boolean,
): RewardedBlock | null {
  if (p.rewardedToday >= cfg.rewardedPerDay) return 'day-cap';
  if (use.perGame !== undefined && use.usedThisGame >= use.perGame) return 'game-cap';
  if (!ready) return 'not-ready';
  return null;
}
