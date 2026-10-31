/**
 * CrazyGames (portal) atrás da interface AdProvider. É o único arquivo da base que fala com o SDK HTML5 v3 dele
 * (https://docs.crazygames.com/sdk/intro/), e o guard `assertNoDirectAdSdk` continua barrando o jogo de falar direto.
 *
 * - Intersticial = anúncio "midgame"; premiado = "rewarded". O SDK decide quando mostrar (frequência, intervalo, cooldown):
 *   pedido cedo demais volta como erro e o jogo segue. Só o formato vai no pedido: nenhum dado do jogador sai daqui.
 * - Banner = `requestResponsiveBanner` num contêiner criado dentro do espaço reservado pelo jogo.
 * - Pausa: `onPause` quando o anúncio realmente começa (adStarted) e `onResume` quando termina ou falha. O jogo não avança enquanto
 *   espera a promessa de `showInterstitial`/`showRewarded`; `onPause`/`onResume` servem para calar o som, como no AdSenseProvider.
 * - Eventos do portal (`portal`): carregamento, início/fim de jogo, "happy time" e o pedido de silêncio do portal.
 * - Sem o SDK (script bloqueado, domínio que não é do portal, SDK "disabled"), tudo vira no-op seguro: nenhum anúncio,
 *   nenhum erro, o jogo segue. Também vale no Basic Launch do portal, em que ele desliga os anúncios (erro `adsDisabled`).
 *
 * Personalização: o SDK do CrazyGames não tem chave de "anúncio não personalizado" nem de "público infantil"; o portal é quem
 * serve o anúncio e cuida do consentimento e do modo infantil dele. Por isso este provider não aceita `ConsentProvider`, ignora o
 * que não é a política de privacidade e só repassa ao SDK o formato do anúncio e funções de retorno (contrato em contract.test.ts).
 */
import { portalProfileFromEnv, type PortalEvents } from './portal.ts';
import { DEFAULT_AD_POLICY, type AdPolicy, type AdProvider, type BannerPlacement, type FullscreenFormat, type RewardedOutcome } from './types.ts';

export const CRAZYGAMES_SCRIPT = 'https://sdk.crazygames.com/crazygames-sdk-v3.js';

/** Erro do SDK v3: sempre `code` e `message`. */
export interface CrazyGamesError {
  code?: string;
  message?: string;
}

export interface CrazyGamesAdCallbacks {
  adStarted?: () => void;
  adFinished?: () => void;
  adError?: (error: CrazyGamesError) => void;
}

export interface CrazyGamesSettings {
  muteAudio?: boolean;
  disableChat?: boolean;
}

/** Subconjunto do `window.CrazyGames.SDK` que usamos. */
export interface CrazyGamesSdk {
  init(): Promise<void>;
  readonly environment?: 'local' | 'crazygames' | 'disabled';
  ad: {
    requestAd(type: 'midgame' | 'rewarded', callbacks: CrazyGamesAdCallbacks): unknown;
    hasAdblock?(): Promise<boolean>;
  };
  banner: {
    requestResponsiveBanner(containerId: string): Promise<void>;
    clearBanner(containerId: string): void;
  };
  game: {
    gameplayStart(): void;
    gameplayStop(): void;
    loadingStart(): void;
    loadingStop(): void;
    happytime(): void;
    readonly settings?: CrazyGamesSettings;
    addSettingsChangeListener?(listener: (settings: CrazyGamesSettings) => void): void;
    removeSettingsChangeListener?(listener: (settings: CrazyGamesSettings) => void): void;
  };
}

type CrazyGamesWindow = Window & { CrazyGames?: { SDK?: CrazyGamesSdk } };

export interface CrazyGamesOptions {
  /** Cala o som enquanto o anúncio passa (chamado quando o anúncio de fato começa). */
  onPause?: () => void;
  onResume?: () => void;
  /** Quanto esperar o script e o init do SDK, em ms. Passou disso, segue sem anúncio. Padrão 8000. */
  loadTimeoutMs?: number;
  /**
   * Quanto esperar o intersticial começar (o leilão leva tempo), em ms. Padrão 20000. Depois disso o pedido conta como indisponível.
   * O relógio para no `adStarted`: anúncio que começou nunca estoura.
   */
  requestTimeoutMs?: number;
  /**
   * O mesmo para o premiado, em ms. Padrão 60000, mais alto de propósito: se o `adStarted` chegasse depois do tempo, o jogador veria o
   * anúncio inteiro e ficaria sem o prêmio (a promessa já teria voltado `unavailable`). Só estoura se o SDK ficar mudo por 1 minuto.
   */
  rewardedRequestTimeoutMs?: number;
  /** Só testes. */
  win?: CrazyGamesWindow;
}

type AdResult = 'finished' | 'dismissed' | 'unavailable';

const MIDGAME = 'midgame';
const REWARDED = 'rewarded';
/** Tamanho do contêiner quando o espaço do jogo ainda não tem medida (320x50 é o menor banner do portal). */
const FALLBACK_BANNER = { width: 320, height: 50 } as const;

function asError(e: unknown): CrazyGamesError {
  if (typeof e === 'object' && e !== null) return e as CrazyGamesError;
  return { code: 'other', message: String(e) };
}

const isThenable = (v: unknown): v is PromiseLike<unknown> => typeof v === 'object' && v !== null && typeof (v as { then?: unknown }).then === 'function';

export class CrazyGamesProvider implements AdProvider {
  readonly id = 'crazygames';
  readonly portal: PortalEvents;

  private readonly w: CrazyGamesWindow;
  private starting: Promise<void> | null = null;
  private settled = false;
  private sdk: CrazyGamesSdk | null = null;
  private queued: ((sdk: CrazyGamesSdk) => void)[] = [];
  private busy = false;
  private paused = false;
  /** Formatos que o portal desligou para esta sessão (adsDisabled, adblock). */
  private readonly off = new Set<FullscreenFormat>();
  private bannersOff = false;
  private readonly banners = new Map<BannerPlacement, HTMLElement>();
  private readonly muteListeners = new Set<(muted: boolean) => void>();
  private muted = false;
  private loading = false;
  private playing = false;

  constructor(private readonly opts: CrazyGamesOptions = {}) {
    this.w = opts.win ?? (window as CrazyGamesWindow);
    this.portal = {
      loadingStart: () => {
        if (this.loading) return;
        this.loading = true;
        this.call((s) => s.game.loadingStart());
      },
      loadingStop: () => {
        if (!this.loading) return;
        this.loading = false;
        this.call((s) => s.game.loadingStop());
      },
      gameplayStart: () => {
        if (this.playing) return;
        this.playing = true;
        this.call((s) => s.game.gameplayStart());
      },
      gameplayStop: () => {
        if (!this.playing) return;
        this.playing = false;
        this.call((s) => s.game.gameplayStop());
      },
      happyTime: () => this.call((s) => s.game.happytime()),
      audioMuted: () => this.sdk?.game.settings?.muteAudio === true,
      onAudioMutedChange: (listener) => {
        this.muteListeners.add(listener);
        return () => void this.muteListeners.delete(listener);
      },
    };
  }

  /** A política de privacidade do jogo não muda nada aqui: o SDK não aceita essas flags (ver o topo do arquivo). */
  async init(_policy: AdPolicy = DEFAULT_AD_POLICY): Promise<void> {
    this.starting ??= this.start();
    await this.starting;
  }

  async preload(_format: FullscreenFormat): Promise<void> {
    await this.init();
  }

  /** O SDK não pré-carrega: "pronto" é ter SDK, o portal não ter desligado o formato e não haver outro anúncio em andamento. */
  isReady(format: FullscreenFormat): boolean {
    if (!this.starting) void this.init();
    return this.sdk !== null && !this.busy && !this.off.has(format);
  }

  async showInterstitial(): Promise<boolean> {
    await this.init();
    return (await this.requestAd(MIDGAME)) === 'finished';
  }

  async showRewarded(): Promise<RewardedOutcome> {
    await this.init();
    const result = await this.requestAd(REWARDED);
    return result === 'finished' ? 'earned' : result;
  }

  async showBanner(placement: BannerPlacement, slot?: HTMLElement): Promise<boolean> {
    if (!slot) return false;
    await this.init();
    const sdk = this.sdk;
    if (!sdk || this.bannersOff) return false;
    this.hideBanner(placement);
    const el = slot.ownerDocument.createElement('div');
    el.id = `rl-crazygames-banner-${placement}`;
    // O portal escolhe o maior banner que cabe no contêiner; ele precisa ter tamanho e estar visível.
    el.style.width = `${slot.clientWidth > 0 ? slot.clientWidth : FALLBACK_BANNER.width}px`;
    el.style.height = `${slot.clientHeight > 0 ? slot.clientHeight : FALLBACK_BANNER.height}px`;
    slot.appendChild(el);
    this.banners.set(placement, el);
    try {
      await sdk.banner.requestResponsiveBanner(el.id);
      return this.banners.get(placement) === el;
    } catch (e) {
      if (asError(e).code === 'bannersDisabled') this.bannersOff = true;
      if (this.banners.get(placement) === el) this.hideBanner(placement);
      return false;
    }
  }

  hideBanner(placement: BannerPlacement): void {
    const el = this.banners.get(placement);
    if (!el) return;
    this.banners.delete(placement);
    try {
      this.sdk?.banner.clearBanner(el.id);
    } catch {
      // O banner já saiu ou o SDK recusou: só tiramos o contêiner.
    }
    el.remove();
  }

  // -------------------------------------------------------------------------------------------------------------------

  private async start(): Promise<void> {
    try {
      const sdk = await this.loadSdk();
      if (!sdk) return;
      await this.withTimeout(Promise.resolve(sdk.init()));
      // (se o init não terminar a tempo, rejeita e o catch abaixo deixa o provider sem SDK)
      // Fora do portal e de localhost o SDK fica "disabled" e toda chamada lança erro: não usar.
      if (sdk.environment === 'disabled') return;
      this.sdk = sdk;
      this.muted = this.portal.audioMuted();
      try {
        sdk.game.addSettingsChangeListener?.(this.onSettings);
      } catch {
        // Sem aviso de mudança, o jogo ainda lê `audioMuted()` quando quiser.
      }
      // Quem usa bloqueador não vê premiado: o portal bloqueia, então o jogo nem oferece o botão.
      try {
        if (sdk.ad.hasAdblock && (await this.withTimeout(sdk.ad.hasAdblock())) === true) this.off.add('rewarded');
      } catch {
        // Detecção é só uma dica; o primeiro pedido confirma.
      }
    } catch {
      this.sdk = null;
    } finally {
      this.settled = true;
      const run = this.queued;
      this.queued = [];
      const sdk = this.sdk;
      if (sdk) for (const fn of run) this.safe(() => fn(sdk));
    }
  }

  /** Acha o SDK na página ou carrega o script do portal. null: não veio (bloqueado, offline, tempo esgotado). */
  private async loadSdk(): Promise<CrazyGamesSdk | null> {
    const found = () => this.w.CrazyGames?.SDK ?? null;
    if (found()) return found();
    const doc = this.w.document;
    let script = doc.querySelector<HTMLScriptElement>(`script[src="${CRAZYGAMES_SCRIPT}"]`);
    if (!script) {
      script = doc.createElement('script');
      script.async = true;
      script.src = CRAZYGAMES_SCRIPT;
      doc.head.appendChild(script);
    }
    const el = script;
    try {
      await this.withTimeout(
        new Promise<void>((resolve) => {
          el.addEventListener('load', () => resolve(), { once: true });
          el.addEventListener('error', () => resolve(), { once: true });
        }),
      );
    } catch {
      // Tempo esgotado: vale o que já estiver na página.
    }
    return found();
  }

  /** Espera `p`, mas no máximo `loadTimeoutMs`; estourou o tempo, rejeita (o chamador segue sem o SDK). */
  private withTimeout<T>(p: PromiseLike<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('crazygames: tempo esgotado')), this.opts.loadTimeoutMs ?? 8000);
      p.then(
        (v) => {
          clearTimeout(timer);
          resolve(v);
        },
        (e: unknown) => {
          clearTimeout(timer);
          reject(e);
        },
      );
    });
  }

  private readonly onSettings = (settings: CrazyGamesSettings): void => {
    const now = settings?.muteAudio === true;
    if (now === this.muted) return;
    this.muted = now;
    for (const l of [...this.muteListeners]) this.safe(() => l(now));
  };

  private safe(fn: () => void): void {
    try {
      fn();
    } catch {
      // O portal nunca derruba o jogo.
    }
  }

  /** Chama o SDK agora, ou depois do init se ele ainda não terminou. Sem SDK, não faz nada. */
  private call(fn: (sdk: CrazyGamesSdk) => void): void {
    const sdk = this.sdk;
    if (sdk) return this.safe(() => fn(sdk));
    if (this.settled) return;
    if (this.queued.length < 32) this.queued.push(fn);
    void this.init();
  }

  private pause(): void {
    if (this.paused) return;
    this.paused = true;
    this.safe(() => this.opts.onPause?.());
  }

  private resume(): void {
    if (!this.paused) return;
    this.paused = false;
    this.safe(() => this.opts.onResume?.());
  }

  /**
   * Desliga por formato: `adsDisabled` num midgame não desliga o premiado (no modo offline só o premiado existe, segundo a doc do v3),
   * e vice-versa. Bloqueador de anúncio derruba o premiado, que o portal bloqueia nesse caso.
   */
  private noteError(e: CrazyGamesError, format: FullscreenFormat): void {
    if (e.code === 'adsDisabled') this.off.add(format);
    else if (e.code === 'adblock') this.off.add('rewarded');
  }

  private requestAd(type: typeof MIDGAME | typeof REWARDED): Promise<AdResult> {
    const sdk = this.sdk;
    const format: FullscreenFormat = type === MIDGAME ? 'interstitial' : 'rewarded';
    // Um anúncio por vez: encadear anúncios é proibido pelo portal.
    if (!sdk || this.busy || this.off.has(format)) return Promise.resolve('unavailable');
    this.busy = true;
    return new Promise<AdResult>((resolve) => {
      let started = false;
      let settledResult = false;
      const settle = (r: AdResult) => {
        if (settledResult) return;
        settledResult = true;
        clearTimeout(timer);
        resolve(r);
      };
      // Se o anúncio não começa a tempo, o jogo segue; o fim real (adFinished/adError) ainda libera o próximo pedido.
      // O relógio para no adStarted (abaixo). Premiado espera mais, para não perder o prêmio de quem vai assistir.
      const wait = format === 'rewarded' ? (this.opts.rewardedRequestTimeoutMs ?? 60000) : (this.opts.requestTimeoutMs ?? 20000);
      const timer = setTimeout(() => settle('unavailable'), wait);
      const end = (r: AdResult) => {
        this.busy = false;
        this.resume();
        settle(r);
      };
      const callbacks: CrazyGamesAdCallbacks = {
        adStarted: () => {
          started = true;
          clearTimeout(timer);
          this.pause();
        },
        adFinished: () => end('finished'),
        adError: (e) => {
          this.noteError(asError(e), format);
          end(started ? 'dismissed' : 'unavailable');
        },
      };
      try {
        const r = sdk.ad.requestAd(type, callbacks);
        if (isThenable(r)) r.then(undefined, (e: unknown) => callbacks.adError?.(asError(e)));
      } catch (e) {
        callbacks.adError?.(asError(e));
      }
    });
  }
}

/**
 * Escolhe o provider pelo ambiente do build: com `VITE_PORTAL=crazygames`, o CrazyGames; senão, null.
 * O ponto de composição do jogo usa o resultado no lugar do AdSense (e `activatePortal` para o resto do perfil do portal).
 */
export function crazyGamesFromEnv(env: Record<string, string | boolean | undefined>, extra: Pick<CrazyGamesOptions, 'onPause' | 'onResume'> = {}): CrazyGamesProvider | null {
  return portalProfileFromEnv(env)?.id === 'crazygames' ? new CrazyGamesProvider(extra) : null;
}
