// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ADSENSE_SCRIPT, adSenseFromEnv, AdSenseProvider, type AdBreakConfig } from './adsense.ts';

/** Janela falsa: guarda o que vai para a fila do Google para o teste disparar os retornos. */
function fakeWin() {
  const pushed: unknown[] = [];
  const queue = Object.assign([] as unknown[], { push: (x: unknown) => pushed.push(x) });
  return { win: Object.assign(window, { adsbygoogle: queue }) as never, pushed, configs: () => pushed.filter((x): x is AdBreakConfig => typeof x === 'object' && x !== null && ('type' in x || 'preloadAdBreaks' in x)) };
}

afterEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  delete (window as { adsbygoogle?: unknown }).adsbygoogle;
});

describe('AdSense (H5 Games Ads)', () => {
  it('carrega o script uma vez, em modo de teste, pedindo anúncio não personalizado', async () => {
    const { win, configs } = fakeWin();
    const ads = new AdSenseProvider({ client: 'ca-pub-6944803226650305', test: true, win });
    await ads.init({ nonPersonalized: true, childDirected: false });
    await ads.init({ nonPersonalized: true, childDirected: false });
    const scripts = document.head.querySelectorAll(`script[src^="${ADSENSE_SCRIPT}"]`);
    expect(scripts).toHaveLength(1);
    expect(scripts[0]!.getAttribute('src')).toContain('client=ca-pub-6944803226650305');
    expect(scripts[0]!.getAttribute('data-adbreak-test')).toBe('on');
    expect((window as { adsbygoogle?: { requestNonPersonalizedAds?: number } }).adsbygoogle!.requestNonPersonalizedAds).toBe(1);
    const cfg = configs().find((c) => c.preloadAdBreaks)!;
    expect(ads.isReady('rewarded')).toBe(false);
    cfg.onReady!();
    expect(ads.isReady('rewarded')).toBe(true);
  });

  it('vídeo com prêmio: só "earned" quando o Google diz que foi visto; pausa e retoma o jogo', async () => {
    const { win, configs } = fakeWin();
    const onPause = vi.fn();
    const onResume = vi.fn();
    const ads = new AdSenseProvider({ client: 'ca-pub-1', win, onPause, onResume });
    const seen = ads.showRewarded();
    await Promise.resolve();
    const brk = configs().find((c) => c.type === 'reward')!;
    const show = vi.fn();
    brk.beforeReward!(show);
    expect(show).toHaveBeenCalled();
    brk.beforeAd!();
    brk.adViewed!();
    brk.afterAd!();
    brk.adBreakDone!({ breakStatus: 'viewed' });
    expect(await seen).toBe('earned');
    expect(onPause).toHaveBeenCalled();
    expect(onResume).toHaveBeenCalled();

    const closed = ads.showRewarded();
    await Promise.resolve();
    const brk2 = configs().filter((c) => c.type === 'reward')[1]!;
    brk2.adDismissed!();
    brk2.adBreakDone!({ breakStatus: 'dismissed' });
    expect(await closed).toBe('dismissed');

    const none = ads.showRewarded();
    await Promise.resolve();
    configs().filter((c) => c.type === 'reward')[2]!.adBreakDone!({ breakStatus: 'noAdPreloaded' });
    expect(await none).toBe('unavailable');
  });

  it('intervalo entre partidas devolve se apareceu', async () => {
    const { win, configs } = fakeWin();
    const ads = new AdSenseProvider({ client: 'ca-pub-1', win });
    const p = ads.showInterstitial();
    await Promise.resolve();
    configs().find((c) => c.type === 'next')!.adBreakDone!({ breakStatus: 'frequencyCapped' });
    expect(await p).toBe(false);
  });

  it('banner só com bloco configurado e espaço reservado; esconde ao sair', async () => {
    const { win } = fakeWin();
    const slot = document.createElement('div');
    document.body.appendChild(slot);
    const ads = new AdSenseProvider({ client: 'ca-pub-1', test: true, bannerSlots: { home: '1234567890' }, win });
    expect(await ads.showBanner('end', slot)).toBe(false);
    expect(await ads.showBanner('home', slot)).toBe(true);
    const ins = slot.querySelector('ins.adsbygoogle')!;
    expect(ins.getAttribute('data-ad-slot')).toBe('1234567890');
    expect(ins.getAttribute('data-adtest')).toBe('on');
    expect(ins.getAttribute('data-ad-format')).toBe('auto');
    expect(ins.getAttribute('data-full-width-responsive')).toBe('true');
    expect((ins as HTMLElement).style.display).toBe('block');
    ads.hideBanner('home');
    expect(slot.querySelector('ins')).toBeNull();
  });

  it('banner de tamanho fixo: largura e altura no style, sem formato auto nem full-width-responsive', async () => {
    const { win } = fakeWin();
    const slot = document.createElement('div');
    document.body.appendChild(slot);
    const ads = new AdSenseProvider({ client: 'ca-pub-1', bannerSlots: { home: '1234567890' }, bannerSize: { width: 320, height: 50 }, win });
    expect(await ads.showBanner('home', slot)).toBe(true);
    const ins = slot.querySelector('ins.adsbygoogle') as HTMLElement;
    expect(ins.getAttribute('data-ad-slot')).toBe('1234567890');
    expect(ins.getAttribute('data-ad-client')).toBe('ca-pub-1');
    expect(ins.style.display).toBe('inline-block');
    expect(ins.style.width).toBe('320px');
    expect(ins.style.height).toBe('50px');
    expect(ins.hasAttribute('data-ad-format')).toBe(false);
    expect(ins.hasAttribute('data-full-width-responsive')).toBe(false);
    ads.hideBanner('home');
    expect(slot.querySelector('ins')).toBeNull();
  });

  it('bannerSize inválido (0, NaN, Infinity, 0.3) cai no banner responsivo', async () => {
    const invalidos = [{ width: 0, height: 50 }, { width: 320, height: NaN }, { width: Infinity, height: 50 }, { width: 320, height: 0.3 }];
    for (const bannerSize of invalidos) {
      const { win } = fakeWin();
      const slot = document.createElement('div');
      document.body.appendChild(slot);
      const ads = new AdSenseProvider({ client: 'ca-pub-1', bannerSlots: { home: '1234567890' }, bannerSize, win });
      expect(await ads.showBanner('home', slot)).toBe(true);
      const ins = slot.querySelector('ins.adsbygoogle') as HTMLElement;
      expect(ins.getAttribute('data-ad-format')).toBe('auto');
      expect(ins.getAttribute('data-full-width-responsive')).toBe('true');
      expect(ins.style.display).toBe('block');
      expect(ins.style.width).toBe('');
    }
  });

  it('pelo ambiente: sem ID válido, nenhum anúncio; com ID, AdSense', () => {
    expect(adSenseFromEnv({})).toBeNull();
    expect(adSenseFromEnv({ VITE_ADSENSE_CLIENT: 'pub-123' })).toBeNull();
    const ads = adSenseFromEnv({ VITE_ADSENSE_CLIENT: 'ca-pub-6944803226650305', VITE_ADS_TEST: '1', VITE_ADSENSE_SLOT_HOME: '1234567890' });
    expect(ads).toBeInstanceOf(AdSenseProvider);
  });
});
