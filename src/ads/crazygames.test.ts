// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  activatePortal,
  AdsController,
  AD_DEFAULTS,
  CRAZYGAMES_PROFILE,
  CRAZYGAMES_SCRIPT,
  crazyGamesFromEnv,
  CrazyGamesProvider,
  DEFAULT_AD_POLICY,
  newPlayerAdState,
  NO_PORTAL_EVENTS,
  portalAudioMuted,
  portalBlocks,
  portalOf,
  portalProfileFromEnv,
  NoAdsProvider,
  type CrazyGamesAdCallbacks,
  type CrazyGamesSdk,
  type CrazyGamesSettings,
} from './index.ts';

const tick = () => new Promise<void>((r) => setTimeout(r, 0));

interface FakeSdk extends CrazyGamesSdk {
  calls: string[];
  /** Último pedido de anúncio por tipo. */
  ads: Record<string, CrazyGamesAdCallbacks>;
  settingsListeners: ((s: CrazyGamesSettings) => void)[];
  mute(on: boolean): void;
}

function fakeSdk(over: { environment?: 'local' | 'crazygames' | 'disabled'; adblock?: boolean; initFails?: boolean; banner?: () => Promise<void> } = {}): FakeSdk {
  const calls: string[] = [];
  const settings: CrazyGamesSettings = { muteAudio: false };
  const sdk: FakeSdk = {
    calls,
    ads: {},
    settingsListeners: [],
    environment: over.environment ?? 'crazygames',
    init: async () => {
      calls.push('init');
      if (over.initFails) throw { code: 'other', message: 'falhou' };
    },
    ad: {
      requestAd(type, callbacks) {
        calls.push(`ad:${type}`);
        sdk.ads[type] = callbacks;
      },
      hasAdblock: async () => over.adblock === true,
    },
    banner: {
      requestResponsiveBanner: over.banner ?? (async (id: string) => void calls.push(`banner:${id}`)),
      clearBanner: (id: string) => void calls.push(`clear:${id}`),
    },
    game: {
      gameplayStart: () => void calls.push('gameplayStart'),
      gameplayStop: () => void calls.push('gameplayStop'),
      loadingStart: () => void calls.push('loadingStart'),
      loadingStop: () => void calls.push('loadingStop'),
      happytime: () => void calls.push('happytime'),
      settings,
      addSettingsChangeListener: (l) => void sdk.settingsListeners.push(l),
      removeSettingsChangeListener: () => {},
    },
    mute(on) {
      settings.muteAudio = on;
      for (const l of sdk.settingsListeners) l({ ...settings });
    },
  };
  return sdk;
}

const w = () => window as unknown as { CrazyGames?: { SDK?: CrazyGamesSdk } };
const install = (sdk: CrazyGamesSdk) => void (w().CrazyGames = { SDK: sdk });

async function ready(sdk: FakeSdk, opts: ConstructorParameters<typeof CrazyGamesProvider>[0] = {}) {
  install(sdk);
  const ads = new CrazyGamesProvider({ win: window as never, ...opts });
  await ads.init(DEFAULT_AD_POLICY);
  return ads;
}

beforeEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  delete w().CrazyGames;
});
afterEach(() => {
  vi.useRealTimers();
  activatePortal(null);
});

describe('CrazyGamesProvider: anúncios', () => {
  it('intersticial = midgame: pausa quando começa, retoma quando termina e devolve true', async () => {
    const sdk = fakeSdk();
    const log: string[] = [];
    const ads = await ready(sdk, { onPause: () => log.push('pause'), onResume: () => log.push('resume') });
    expect(ads.isReady('interstitial')).toBe(true);
    const p = ads.showInterstitial();
    await tick();
    expect(sdk.calls).toContain('ad:midgame');
    expect(log).toEqual([]); // só cala quando o anúncio de fato começa
    sdk.ads.midgame!.adStarted!();
    expect(log).toEqual(['pause']);
    expect(ads.isReady('interstitial')).toBe(false); // um por vez
    sdk.ads.midgame!.adFinished!();
    expect(await p).toBe(true);
    expect(log).toEqual(['pause', 'resume']);
    expect(ads.isReady('interstitial')).toBe(true);
  });

  it('intersticial sem anúncio (adError antes de começar): false, sem pausar o jogo', async () => {
    const sdk = fakeSdk();
    const log: string[] = [];
    const ads = await ready(sdk, { onPause: () => log.push('pause'), onResume: () => log.push('resume') });
    const p = ads.showInterstitial();
    await tick();
    sdk.ads.midgame!.adError!({ code: 'adCooldown', message: 'cedo demais' });
    expect(await p).toBe(false);
    expect(log).toEqual([]);
    expect(ads.isReady('interstitial')).toBe(true); // cooldown não desliga o formato
  });

  it('premiado: earned só com adFinished; erro antes de começar é unavailable; erro depois de começar é dismissed', async () => {
    const sdk = fakeSdk();
    const log: string[] = [];
    const ads = await ready(sdk, { onPause: () => log.push('pause'), onResume: () => log.push('resume') });

    let p = ads.showRewarded();
    await tick();
    sdk.ads.rewarded!.adStarted!();
    sdk.ads.rewarded!.adFinished!();
    expect(await p).toBe('earned');

    p = ads.showRewarded();
    await tick();
    sdk.ads.rewarded!.adError!({ code: 'unfilled' });
    expect(await p).toBe('unavailable');

    p = ads.showRewarded();
    await tick();
    sdk.ads.rewarded!.adStarted!();
    sdk.ads.rewarded!.adError!({ code: 'other' });
    expect(await p).toBe('dismissed');
    expect(log).toEqual(['pause', 'resume', 'pause', 'resume']);
  });

  it('não encadeia anúncios: pedido enquanto outro está em andamento volta indisponível', async () => {
    const sdk = fakeSdk();
    const ads = await ready(sdk);
    const first = ads.showInterstitial();
    await tick();
    expect(await ads.showRewarded()).toBe('unavailable');
    expect(await ads.showInterstitial()).toBe(false);
    expect(sdk.calls.filter((c) => c.startsWith('ad:'))).toEqual(['ad:midgame']);
    sdk.ads.midgame!.adFinished!();
    expect(await first).toBe(true);
  });

  it('adsDisabled desliga só o formato que recebeu o erro: no modo offline o premiado segue existindo', async () => {
    const sdk = fakeSdk();
    const ads = await ready(sdk);
    const mid = ads.showInterstitial();
    await tick();
    sdk.ads.midgame!.adError!({ code: 'adsDisabled', message: 'offline' });
    expect(await mid).toBe(false);
    expect(ads.isReady('interstitial')).toBe(false);
    expect(ads.isReady('rewarded')).toBe(true);
    expect(await ads.showInterstitial()).toBe(false);
    expect(sdk.calls.filter((c) => c.startsWith('ad:'))).toEqual(['ad:midgame']);

    const rew = ads.showRewarded();
    await tick();
    sdk.ads.rewarded!.adStarted!();
    sdk.ads.rewarded!.adFinished!();
    expect(await rew).toBe('earned');
  });

  it('adsDisabled no premiado (Basic Launch, modo infantil) desliga o premiado; o intersticial só se o portal disser a ele', async () => {
    const sdk = fakeSdk();
    const ads = await ready(sdk);
    const p = ads.showRewarded();
    await tick();
    sdk.ads.rewarded!.adError!({ code: 'adsDisabled', message: 'Basic Launch' });
    expect(await p).toBe('unavailable');
    expect(ads.isReady('rewarded')).toBe(false);
    expect(await ads.showRewarded()).toBe('unavailable');
    expect(ads.isReady('interstitial')).toBe(true);
    const mid = ads.showInterstitial();
    await tick();
    sdk.ads.midgame!.adError!({ code: 'adsDisabled', message: 'Basic Launch' });
    expect(await mid).toBe(false);
    expect(ads.isReady('interstitial')).toBe(false);
    expect(sdk.calls.filter((c) => c.startsWith('ad:'))).toEqual(['ad:rewarded', 'ad:midgame']);
  });

  it('com bloqueador de anúncio o premiado não é oferecido, mas o jogo segue normal', async () => {
    const ads = await ready(fakeSdk({ adblock: true }));
    expect(ads.isReady('rewarded')).toBe(false);
    expect(await ads.showRewarded()).toBe('unavailable');
  });

  it('intersticial que não começa a tempo: o jogo segue; o fim real ainda libera o próximo pedido', async () => {
    vi.useFakeTimers();
    const sdk = fakeSdk();
    install(sdk);
    const ads = new CrazyGamesProvider({ win: window as never, requestTimeoutMs: 1000 });
    await ads.init(DEFAULT_AD_POLICY);
    const p = ads.showInterstitial();
    await vi.advanceTimersByTimeAsync(1000);
    expect(await p).toBe(false);
    expect(ads.isReady('interstitial')).toBe(false);
    sdk.ads.midgame!.adError!({ code: 'unfilled' });
    expect(ads.isReady('interstitial')).toBe(true);
  });

  it('premiado: o tempo de espera é maior e para no adStarted, então quem assiste sempre recebe o prêmio', async () => {
    vi.useFakeTimers();
    const sdk = fakeSdk();
    install(sdk);
    const ads = new CrazyGamesProvider({ win: window as never, requestTimeoutMs: 1000, rewardedRequestTimeoutMs: 5000 });
    await ads.init(DEFAULT_AD_POLICY);
    let outcome: string | undefined;
    const p = ads.showRewarded().then((o) => (outcome = o));
    await vi.advanceTimersByTimeAsync(4000); // passou do prazo do intersticial, ainda dentro do premiado
    expect(outcome).toBeUndefined();
    sdk.ads.rewarded!.adStarted!(); // começou: o relógio para
    await vi.advanceTimersByTimeAsync(10 * 60_000); // anúncio longo: nada estoura
    expect(outcome).toBeUndefined();
    sdk.ads.rewarded!.adFinished!();
    await p;
    expect(outcome).toBe('earned');
  });

  it('premiado em que o SDK fica mudo por todo o prazo: o jogo segue sem prêmio', async () => {
    vi.useFakeTimers();
    const sdk = fakeSdk();
    install(sdk);
    const ads = new CrazyGamesProvider({ win: window as never, rewardedRequestTimeoutMs: 5000 });
    await ads.init(DEFAULT_AD_POLICY);
    const p = ads.showRewarded();
    await vi.advanceTimersByTimeAsync(5000);
    expect(await p).toBe('unavailable');
  });

  it('SDK que lança no pedido não derruba o jogo', async () => {
    const sdk = fakeSdk();
    sdk.ad.requestAd = () => {
      throw { code: 'other', message: 'boom' };
    };
    const ads = await ready(sdk);
    expect(await ads.showInterstitial()).toBe(false);
    expect(await ads.showRewarded()).toBe('unavailable');
  });

  it('funciona dentro do AdsController (o jogo só vê a interface): intersticial entre partidas e premiado com prêmio só no fim', async () => {
    const sdk = fakeSdk();
    const ads = await ready(sdk);
    const T0 = new Date(2026, 10, 2, 12).getTime();
    const state = { ...newPlayerAdState(T0), day: '2026-11-05', gamesPlayed: 10, lastGameSec: 120 };
    const ctl = new AdsController(ads, AD_DEFAULTS, state, { now: () => T0 + 3 * 86_400_000 });
    const shown = ctl.betweenGames();
    await tick();
    sdk.ads.midgame!.adStarted!();
    sdk.ads.midgame!.adFinished!();
    expect(await shown).toBe(true);
    expect(ctl.snapshot.interstitialsToday).toBe(1);
    const reward = ctl.watchRewarded();
    await tick();
    sdk.ads.rewarded!.adStarted!();
    sdk.ads.rewarded!.adError!({ code: 'other' });
    expect(await reward).toBe('dismissed');
    expect(ctl.snapshot.rewardedToday).toBe(0); // sem prêmio, sem contagem
  });
});

describe('CrazyGamesProvider: banner', () => {
  it('cria o contêiner no espaço do jogo, pede o banner responsivo e limpa ao esconder', async () => {
    const sdk = fakeSdk();
    const ads = await ready(sdk);
    const slot = document.createElement('div');
    document.body.appendChild(slot);
    expect(await ads.showBanner('home', slot)).toBe(true);
    const el = slot.querySelector('#rl-crazygames-banner-home') as HTMLElement;
    expect(el).not.toBeNull();
    expect(el.style.width).toBe('320px');
    expect(sdk.calls).toContain('banner:rl-crazygames-banner-home');
    ads.hideBanner('home');
    expect(slot.querySelector('#rl-crazygames-banner-home')).toBeNull();
    expect(sdk.calls).toContain('clear:rl-crazygames-banner-home');
  });

  it('sem espaço reservado, não mostra', async () => {
    const ads = await ready(fakeSdk());
    expect(await ads.showBanner('home')).toBe(false);
  });

  it('bannersDisabled: remove o contêiner, devolve false e não insiste na sessão', async () => {
    const sdk = fakeSdk({
      banner: async () => {
        throw { code: 'bannersDisabled', message: 'Basic Launch' };
      },
    });
    const ads = await ready(sdk);
    const slot = document.createElement('div');
    document.body.appendChild(slot);
    expect(await ads.showBanner('end', slot)).toBe(false);
    expect(slot.children).toHaveLength(0);
    sdk.banner.requestResponsiveBanner = vi.fn();
    expect(await ads.showBanner('end', slot)).toBe(false);
    expect(sdk.banner.requestResponsiveBanner).not.toHaveBeenCalled();
  });
});

describe('CrazyGamesProvider: sem SDK é no-op seguro', () => {
  it('script bloqueado (erro de carga): nada de anúncio, nada de erro', async () => {
    const ads = new CrazyGamesProvider({ win: window as never });
    const started = ads.init(DEFAULT_AD_POLICY);
    await tick();
    const script = document.querySelector(`script[src="${CRAZYGAMES_SCRIPT}"]`)!;
    expect(script).not.toBeNull();
    script.dispatchEvent(new Event('error'));
    await started;
    expect(ads.isReady('interstitial')).toBe(false);
    expect(await ads.showInterstitial()).toBe(false);
    expect(await ads.showRewarded()).toBe('unavailable');
    const slot = document.createElement('div');
    expect(await ads.showBanner('home', slot)).toBe(false);
    ads.hideBanner('home');
    expect(() => {
      ads.portal.gameplayStart();
      ads.portal.gameplayStop();
      ads.portal.loadingStart();
      ads.portal.happyTime();
    }).not.toThrow();
    expect(ads.portal.audioMuted()).toBe(false);
  });

  it('script que nunca responde: o init desiste no tempo limite', async () => {
    vi.useFakeTimers();
    const ads = new CrazyGamesProvider({ win: window as never, loadTimeoutMs: 500 });
    const started = ads.init(DEFAULT_AD_POLICY);
    await vi.advanceTimersByTimeAsync(500);
    await started;
    expect(ads.isReady('rewarded')).toBe(false);
  });

  it('ambiente "disabled" (domínio fora do portal) não usa o SDK', async () => {
    const sdk = fakeSdk({ environment: 'disabled' });
    const ads = await ready(sdk);
    expect(ads.isReady('interstitial')).toBe(false);
    expect(await ads.showInterstitial()).toBe(false);
    ads.portal.gameplayStart();
    expect(sdk.calls).toEqual(['init']);
  });

  it('init do SDK que falha: segue sem anúncio', async () => {
    const ads = await ready(fakeSdk({ initFails: true }));
    expect(ads.isReady('interstitial')).toBe(false);
    expect(await ads.showInterstitial()).toBe(false);
  });

  it('carrega o script uma vez só e usa o SDK quando ele chega (sem parâmetros na URL)', async () => {
    const ads = new CrazyGamesProvider({ win: window as never });
    const a = ads.init(DEFAULT_AD_POLICY);
    const b = ads.init(DEFAULT_AD_POLICY);
    await tick();
    const scripts = document.querySelectorAll('script');
    expect(scripts).toHaveLength(1);
    expect(scripts[0]!.getAttribute('src')).toBe('https://sdk.crazygames.com/crazygames-sdk-v3.js');
    install(fakeSdk());
    scripts[0]!.dispatchEvent(new Event('load'));
    await Promise.all([a, b]);
    expect(ads.isReady('interstitial')).toBe(true);
  });

  it('script já presente no HTML do portal (sem criar outro)', async () => {
    const tag = document.createElement('script');
    tag.src = CRAZYGAMES_SCRIPT;
    document.head.appendChild(tag);
    const ads = new CrazyGamesProvider({ win: window as never });
    const started = ads.init(DEFAULT_AD_POLICY);
    await tick();
    install(fakeSdk());
    tag.dispatchEvent(new Event('load'));
    await started;
    expect(document.querySelectorAll('script')).toHaveLength(1);
    expect(ads.isReady('rewarded')).toBe(true);
  });
});

describe('CrazyGamesProvider: eventos do portal', () => {
  it('gameplay e carregamento: sem repetir início ou fim, e o que vem antes do init espera por ele', async () => {
    const sdk = fakeSdk();
    install(sdk);
    const ads = new CrazyGamesProvider({ win: window as never });
    ads.portal.loadingStart(); // antes do init: entra na fila e dispara o init
    ads.portal.loadingStop();
    ads.portal.gameplayStart();
    ads.portal.gameplayStart();
    await ads.init(DEFAULT_AD_POLICY);
    ads.portal.gameplayStop();
    ads.portal.gameplayStop();
    ads.portal.gameplayStart();
    ads.portal.happyTime();
    expect(sdk.calls.filter((c) => c !== 'init')).toEqual(['loadingStart', 'loadingStop', 'gameplayStart', 'gameplayStop', 'gameplayStart', 'happytime']);
  });

  it('erro do SDK num evento não derruba o jogo', async () => {
    const sdk = fakeSdk();
    sdk.game.gameplayStart = () => {
      throw new Error('boom');
    };
    const ads = await ready(sdk);
    expect(() => ads.portal.gameplayStart()).not.toThrow();
  });

  it('silêncio do portal: lê o valor atual e avisa as mudanças (cancelável)', async () => {
    const sdk = fakeSdk();
    const ads = await ready(sdk);
    const seen: boolean[] = [];
    const off = ads.portal.onAudioMutedChange((m) => seen.push(m));
    expect(ads.portal.audioMuted()).toBe(false);
    sdk.mute(true);
    expect(ads.portal.audioMuted()).toBe(true);
    sdk.mute(true); // sem mudança: não avisa de novo
    sdk.mute(false);
    off();
    sdk.mute(true);
    expect(seen).toEqual([true, false]);
  });

  it('portalOf: provider de portal devolve os eventos; os demais, um objeto que não faz nada', () => {
    const cg = new CrazyGamesProvider({ win: window as never });
    expect(portalOf(cg)).toBe(cg.portal);
    expect(portalOf(new NoAdsProvider())).toBe(NO_PORTAL_EVENTS);
    expect(() => NO_PORTAL_EVENTS.gameplayStart()).not.toThrow();
    expect(NO_PORTAL_EVENTS.audioMuted()).toBe(false);
    expect(NO_PORTAL_EVENTS.onAudioMutedChange(() => {})).toBeTypeOf('function');
  });
});

describe('perfil do portal e composição', () => {
  it('VITE_PORTAL=crazygames escolhe o provider e o perfil; qualquer outro valor, nada', () => {
    expect(crazyGamesFromEnv({ VITE_PORTAL: 'crazygames' })).toBeInstanceOf(CrazyGamesProvider);
    expect(crazyGamesFromEnv({ VITE_PORTAL: ' CrazyGames ' })).toBeInstanceOf(CrazyGamesProvider);
    expect(crazyGamesFromEnv({})).toBeNull();
    expect(crazyGamesFromEnv({ VITE_PORTAL: 'poki' })).toBeNull();
    expect(crazyGamesFromEnv({ VITE_PORTAL: true })).toBeNull();
    expect(portalProfileFromEnv({ VITE_PORTAL: 'crazygames' })).toBe(CRAZYGAMES_PROFILE);
    expect(portalProfileFromEnv({ VITE_PORTAL: '' })).toBeNull();
  });

  it('o perfil do CrazyGames proíbe divulgação, instalação, links para fora e service worker; sem portal nada é proibido', () => {
    expect(portalBlocks('crossPromo')).toBe(false);
    activatePortal(CRAZYGAMES_PROFILE);
    for (const f of ['crossPromo', 'install', 'externalLinks', 'serviceWorker'] as const) expect(portalBlocks(f)).toBe(true);
    activatePortal(null);
    expect(portalBlocks('install')).toBe(false);
  });

  it('o silêncio do portal ativo chega à interface (Feedback) pelo perfil', async () => {
    const sdk = fakeSdk();
    const ads = await ready(sdk);
    expect(portalAudioMuted()).toBe(false);
    activatePortal(CRAZYGAMES_PROFILE, ads.portal);
    expect(portalAudioMuted()).toBe(false);
    sdk.mute(true);
    expect(portalAudioMuted()).toBe(true);
  });
});
