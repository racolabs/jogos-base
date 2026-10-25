import { describe, expect, it } from 'vitest';
import { sanitize } from '../config/index.ts';
import {
  AD_DEFAULTS,
  AD_LIMITS,
  interstitialBlock,
  newPlayerAdState,
  rewardedBlock,
  segmentMultiplier,
  type PlayerAdState,
} from './rules.ts';

const DAY = 24 * 60 * 60 * 1000;
const T0 = new Date(2026, 10, 2, 12).getTime();
const NOW = T0 + 3 * DAY;

/** Jogador de 3 dias que já pode ver intersticial: cada teste muda uma coisa só. */
const veteran = (patch: Partial<PlayerAdState> = {}): PlayerAdState => ({
  ...newPlayerAdState(T0),
  gamesPlayed: 10,
  lastGameSec: 120,
  ...patch,
});

describe('intersticial: cada trava do documento', () => {
  it('libera quando todas deixam', () => {
    expect(interstitialBlock(veteran(), AD_DEFAULTS, NOW, true)).toBeNull();
  });
  it('pagante ou "Sem anúncios" nunca vê', () => {
    expect(interstitialBlock(veteran({ isPayer: true }), AD_DEFAULTS, NOW, true)).toBe('payer');
    expect(interstitialBlock(veteran({ removeAds: true }), AD_DEFAULTS, NOW, true)).toBe('payer');
  });
  it('nenhum no primeiro dia', () => {
    expect(interstitialBlock(veteran({ firstSeenAt: NOW - DAY + 1 }), AD_DEFAULTS, NOW, true)).toBe('first-day');
    expect(interstitialBlock(veteran({ firstSeenAt: NOW - DAY + 1 }), { ...AD_DEFAULTS, noAdsFirstDay: false }, NOW, true)).toBeNull();
  });
  it('só depois de 3 partidas', () => {
    expect(interstitialBlock(veteran({ gamesPlayed: 2 }), AD_DEFAULTS, NOW, true)).toBe('too-few-games');
    expect(interstitialBlock(veteran({ gamesPlayed: 3 }), AD_DEFAULTS, NOW, true)).toBeNull();
  });
  it('partida de menos de 45 s não leva', () => {
    expect(interstitialBlock(veteran({ lastGameSec: 44 }), AD_DEFAULTS, NOW, true)).toBe('short-game');
  });
  it('2 derrotas rápidas seguidas pulam o anúncio', () => {
    expect(interstitialBlock(veteran({ quickLossStreak: 2 }), AD_DEFAULTS, NOW, true)).toBe('frustrated');
    expect(interstitialBlock(veteran({ quickLossStreak: 1 }), AD_DEFAULTS, NOW, true)).toBeNull();
  });
  it('180 s entre intersticiais', () => {
    expect(interstitialBlock(veteran({ lastInterstitialAt: NOW - 179_000 }), AD_DEFAULTS, NOW, true)).toBe('gap');
    expect(interstitialBlock(veteran({ lastInterstitialAt: NOW - 180_000 }), AD_DEFAULTS, NOW, true)).toBeNull();
  });
  it('600 s sem intersticial depois de um premiado', () => {
    expect(interstitialBlock(veteran({ lastRewardedAt: NOW - 599_000 }), AD_DEFAULTS, NOW, true)).toBe('after-rewarded');
    expect(interstitialBlock(veteran({ lastRewardedAt: NOW - 600_000 }), AD_DEFAULTS, NOW, true)).toBeNull();
  });
  it('4 por sessão e 12 por dia', () => {
    expect(interstitialBlock(veteran({ interstitialsThisSession: 4 }), AD_DEFAULTS, NOW, true)).toBe('session-cap');
    expect(interstitialBlock(veteran({ interstitialsToday: 12 }), AD_DEFAULTS, NOW, true)).toBe('day-cap');
  });
  it('sem anúncio carregado, pula em vez de esperar', () => {
    expect(interstitialBlock(veteran(), AD_DEFAULTS, NOW, false)).toBe('not-ready');
  });
});

describe('ajuste por segmento', () => {
  it('multiplica o intervalo de quem já rende, está esfriando ou saiu depois de anúncio', () => {
    expect(segmentMultiplier(veteran())).toBe(1);
    expect(segmentMultiplier(veteran({ rewardedToday: 3 }))).toBe(1.5);
    expect(segmentMultiplier(veteran({ sessionTrendFalling: true }))).toBe(2);
    expect(segmentMultiplier(veteran({ quitAfterAdCount7d: 2 }))).toBe(1.5);
    expect(segmentMultiplier(veteran({ rewardedToday: 3, sessionTrendFalling: true, quitAfterAdCount7d: 2 }))).toBe(4.5);
  });
  it('quem assistiu 3 premiados hoje espera 270 s, não 180 s', () => {
    const p = veteran({ rewardedToday: 3, lastInterstitialAt: NOW - 200_000 });
    expect(interstitialBlock(p, AD_DEFAULTS, NOW, true)).toBe('gap');
    expect(interstitialBlock({ ...p, lastInterstitialAt: NOW - 270_000 }, AD_DEFAULTS, NOW, true)).toBeNull();
  });
});

describe('premiado', () => {
  it('limite diário, limite por partida e oferta escondida sem anúncio', () => {
    expect(rewardedBlock(veteran(), AD_DEFAULTS, { usedThisGame: 0, perGame: 1 }, true)).toBeNull();
    expect(rewardedBlock(veteran({ rewardedToday: 20 }), AD_DEFAULTS, { usedThisGame: 0 }, true)).toBe('day-cap');
    expect(rewardedBlock(veteran(), AD_DEFAULTS, { usedThisGame: 1, perGame: 1 }, true)).toBe('game-cap');
    expect(rewardedBlock(veteran(), AD_DEFAULTS, { usedThisGame: 0 }, false)).toBe('not-ready');
  });
  it('pagante continua podendo assistir por vontade própria', () => {
    expect(rewardedBlock(veteran({ isPayer: true, removeAds: true }), AD_DEFAULTS, { usedThisGame: 0 }, true)).toBeNull();
  });
});

describe('configuração', () => {
  it('os padrões passam nas faixas da configuração remota', () => {
    expect(sanitize(AD_DEFAULTS, AD_DEFAULTS, AD_LIMITS)).toEqual(AD_DEFAULTS);
  });
});
