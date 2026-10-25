import { describe, expect, it } from 'vitest';
import { AdsController } from './controller.ts';
import { FakeAdProvider } from './fake.ts';
import { AD_DEFAULTS, newPlayerAdState, type PlayerAdState } from './rules.ts';

const DAY = 24 * 60 * 60 * 1000;
const T0 = new Date(2026, 10, 2, 12).getTime();

function setup(patch: Partial<PlayerAdState> = {}, ads = new FakeAdProvider()) {
  let now = T0 + 3 * DAY;
  const saved: PlayerAdState[] = [];
  const state = { ...newPlayerAdState(T0), day: '2026-11-05', gamesPlayed: 10, lastGameSec: 120, ...patch };
  const ctl = new AdsController(ads, AD_DEFAULTS, state, { now: () => now, onChange: (s) => saved.push(s) });
  return { ctl, ads, saved, tick: (ms: number) => (now += ms) };
}

describe('AdsController: intersticial', () => {
  it('mostra entre partidas, conta e respeita o intervalo', async () => {
    const { ctl, ads, tick } = setup();
    expect(await ctl.betweenGames()).toBe(true);
    expect(ctl.snapshot.interstitialsToday).toBe(1);
    tick(60_000);
    expect(await ctl.betweenGames()).toBe(false);
    expect(ctl.interstitialBlock()).toBe('gap');
    tick(120_000);
    expect(await ctl.betweenGames()).toBe(true);
    expect(ads.count('interstitial')).toBe(2);
  });

  it('para no limite da sessão e volta a zero na sessão seguinte', async () => {
    const { ctl, tick } = setup();
    for (let i = 0; i < 4; i++) {
      expect(await ctl.betweenGames()).toBe(true);
      tick(181_000);
    }
    expect(ctl.interstitialBlock()).toBe('session-cap');
    ctl.startSession();
    expect(ctl.interstitialBlock()).toBeNull();
  });

  it('virar o dia zera os contadores de hoje', () => {
    const { ctl, tick } = setup({ interstitialsToday: 12, rewardedToday: 20 });
    expect(ctl.interstitialBlock()).toBe('day-cap');
    tick(DAY);
    expect(ctl.interstitialBlock()).toBeNull();
    expect(ctl.snapshot.rewardedToday).toBe(0);
  });

  it('derrotas rápidas seguidas bloqueiam até uma partida normal', () => {
    const { ctl } = setup();
    ctl.gameEnded({ durationSec: 50, quickLoss: true });
    ctl.gameEnded({ durationSec: 50, quickLoss: true });
    expect(ctl.interstitialBlock()).toBe('frustrated');
    ctl.gameEnded({ durationSec: 200, quickLoss: false });
    expect(ctl.interstitialBlock()).toBeNull();
  });

  it('comprou "Sem anúncios": nunca mais intersticial', async () => {
    const { ctl, ads } = setup();
    ctl.markRemoveAds();
    expect(await ctl.betweenGames()).toBe(false);
    expect(ads.count('interstitial')).toBe(0);
  });
});

describe('AdsController: premiado', () => {
  it('prêmio só com o vídeo até o fim, e bloqueia intersticial por 10 minutos', async () => {
    const { ctl } = setup();
    expect(await ctl.watchRewarded()).toBe('earned');
    expect(ctl.snapshot.rewardedToday).toBe(1);
    expect(ctl.interstitialBlock()).toBe('after-rewarded');
  });

  it('fechar antes não dá prêmio nem conta', async () => {
    const { ctl } = setup({}, new FakeAdProvider({ rewardedOutcome: 'dismissed' }));
    expect(await ctl.watchRewarded()).toBe('dismissed');
    expect(ctl.snapshot.rewardedToday).toBe(0);
    expect(ctl.snapshot.lastRewardedAt).toBeNull();
  });

  it('"Continuar" 1 vez por partida, pela configuração', async () => {
    const { ctl, ads } = setup();
    const use = { usedThisGame: 1, perGame: ctl.continuePerGame };
    expect(ctl.rewardedBlock(use)).toBe('game-cap');
    expect(await ctl.watchRewarded(use)).toBe('unavailable');
    expect(ads.count('rewarded')).toBe(0);
  });

  it('salva o estado a cada mudança', async () => {
    const { ctl, saved } = setup();
    await ctl.watchRewarded();
    expect(saved.at(-1)?.rewardedToday).toBe(1);
  });
});
