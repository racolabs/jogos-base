import { describe, expect, it } from 'vitest';
import { DEFAULT_AD_POLICY, FakeAdProvider, NoAdsProvider } from './index.ts';

describe('política padrão', () => {
  it('pede anúncio não personalizado e marcado como público infantil', () => {
    expect(DEFAULT_AD_POLICY).toEqual({ nonPersonalized: true, childDirected: true });
    expect(Object.isFrozen(DEFAULT_AD_POLICY)).toBe(true);
  });
});

describe('NoAdsProvider', () => {
  it('nunca tem anúncio e nunca mostra nada', async () => {
    const ads = new NoAdsProvider();
    await ads.init(DEFAULT_AD_POLICY);
    expect(ads.isReady('interstitial')).toBe(false);
    expect(ads.isReady('rewarded')).toBe(false);
    expect(await ads.showInterstitial()).toBe(false);
    expect(await ads.showRewarded()).toBe('unavailable');
    expect(await ads.showBanner('home')).toBe(false);
  });
});

describe('FakeAdProvider', () => {
  it('registra o que foi mostrado e devolve o resultado escolhido', async () => {
    const ads = new FakeAdProvider({ rewardedOutcome: 'dismissed' });
    await ads.init(DEFAULT_AD_POLICY);
    expect(await ads.showInterstitial()).toBe(true);
    expect(await ads.showRewarded()).toBe('dismissed');
    expect(ads.calls.map((c) => c.type)).toEqual(['init', 'interstitial', 'rewarded']);
  });

  it('sem anúncio pronto, não mostra intersticial e o premiado vem indisponível', async () => {
    const ads = new FakeAdProvider({ ready: { interstitial: false, rewarded: false } });
    expect(await ads.showInterstitial()).toBe(false);
    expect(await ads.showRewarded()).toBe('unavailable');
    expect(ads.count('interstitial')).toBe(0);
  });
});
