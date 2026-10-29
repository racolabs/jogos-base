/**
 * AdSense para jogos na web (API "H5 Games Ads": adBreak/adConfig) e banner comum.
 * - Intervalo entre partidas: adBreak type "next".
 * - Vídeo com prêmio: adBreak type "reward" (o prêmio só vem em adViewed).
 * - Banner: <ins class="adsbygoogle"> no espaço reservado, nunca sobre o tabuleiro.
 * Modo de teste (test: true) pede anúncios de teste: nada é cobrado nem conta como impressão.
 * Só fala com o Google por aqui: o jogo continua vendo apenas a interface AdProvider.
 */
import { DEFAULT_AD_POLICY, type AdPolicy, type AdProvider, type BannerPlacement, type FullscreenFormat, type RewardedOutcome } from './types.ts';

interface BreakInfo {
  breakStatus: 'notReady' | 'timeout' | 'error' | 'noAdPreloaded' | 'frequencyCapped' | 'ignored' | 'other' | 'dismissed' | 'viewed';
}

/** O que passamos ao adBreak/adConfig (subconjunto da API do Google). */
export interface AdBreakConfig {
  type?: 'next' | 'reward' | 'start' | 'pause' | 'browse';
  name?: string;
  beforeAd?: () => void;
  afterAd?: () => void;
  beforeReward?: (showAdFn: () => void) => void;
  adDismissed?: () => void;
  adViewed?: () => void;
  adBreakDone?: (info: BreakInfo) => void;
  preloadAdBreaks?: 'on' | 'auto';
  sound?: 'on' | 'off';
  onReady?: () => void;
}

type AdsQueue = unknown[] & { requestNonPersonalizedAds?: number; push(x: unknown): number };

export interface AdSenseOptions {
  /** ca-pub-... (público). */
  client: string;
  /** Id do bloco de anúncio de cada banner (criado no painel do AdSense). Sem id, sem banner. */
  bannerSlots?: Partial<Record<BannerPlacement, string>>;
  /**
   * Banner de tamanho fixo, em px (ex.: { width: 320, height: 50 }). O `ins` sai com essa largura e altura no style,
   * sem data-ad-format=auto nem data-full-width-responsive, e o bloco no painel do AdSense deve ser "fixo" do mesmo tamanho.
   * Use quando o jogo reserva um espaço de altura fixa: o anúncio nunca passa dele. Sem a opção, o banner é responsivo.
   */
  bannerSize?: { width: number; height: number };
  /** Anúncios de teste do Google (desenvolvimento e revisão). */
  test?: boolean;
  policy?: AdPolicy;
  /** O jogo silencia o som enquanto o anúncio passa. */
  onPause?: () => void;
  onResume?: () => void;
  /** Só testes. */
  win?: Window & { adsbygoogle?: AdsQueue; adBreak?: (c: AdBreakConfig) => void; adConfig?: (c: AdBreakConfig) => void };
}

export const ADSENSE_SCRIPT = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js';

export class AdSenseProvider implements AdProvider {
  readonly id = 'adsense';
  private started = false;
  private ready = false;
  private readonly banners = new Map<BannerPlacement, HTMLElement>();
  private readonly w: NonNullable<AdSenseOptions['win']>;

  constructor(private readonly opts: AdSenseOptions) {
    this.w = opts.win ?? (window as NonNullable<AdSenseOptions['win']>);
  }

  async init(policy: AdPolicy = this.opts.policy ?? DEFAULT_AD_POLICY): Promise<void> {
    if (this.started) return;
    this.started = true;
    const w = this.w;
    const q = (w.adsbygoogle = w.adsbygoogle || ([] as unknown as AdsQueue));
    if (policy.nonPersonalized) q.requestNonPersonalizedAds = 1;
    w.adBreak = w.adConfig = (c: AdBreakConfig) => void q.push(c);
    const doc = w.document;
    if (!doc.querySelector(`script[src^="${ADSENSE_SCRIPT}"]`)) {
      const s = doc.createElement('script');
      s.async = true;
      s.crossOrigin = 'anonymous';
      s.src = `${ADSENSE_SCRIPT}?client=${encodeURIComponent(this.opts.client)}`;
      if (this.opts.test) s.setAttribute('data-adbreak-test', 'on');
      // Quem controla a frequência é o AdsController; aqui só o mínimo do Google.
      s.setAttribute('data-ad-frequency-hint', '30s');
      doc.head.appendChild(s);
    }
    w.adConfig({ preloadAdBreaks: 'on', sound: 'on', onReady: () => void (this.ready = true) });
  }

  async preload(_format: FullscreenFormat): Promise<void> {
    await this.init();
  }

  isReady(_format: FullscreenFormat): boolean {
    if (!this.started) void this.init();
    return this.ready;
  }

  async showInterstitial(): Promise<boolean> {
    await this.init();
    return new Promise((resolve) => {
      this.w.adBreak!({
        type: 'next',
        name: 'entre-partidas',
        beforeAd: () => this.opts.onPause?.(),
        afterAd: () => this.opts.onResume?.(),
        adBreakDone: (info) => resolve(info.breakStatus === 'viewed'),
      });
    });
  }

  async showRewarded(): Promise<RewardedOutcome> {
    await this.init();
    return new Promise((resolve) => {
      let outcome: RewardedOutcome = 'unavailable';
      this.w.adBreak!({
        type: 'reward',
        name: 'premio',
        beforeAd: () => this.opts.onPause?.(),
        afterAd: () => this.opts.onResume?.(),
        // O jogo já perguntou ao jogador (folha do prêmio): aqui mostra direto.
        beforeReward: (showAdFn) => showAdFn(),
        adDismissed: () => void (outcome = 'dismissed'),
        adViewed: () => void (outcome = 'earned'),
        adBreakDone: () => resolve(outcome),
      });
    });
  }

  async showBanner(placement: BannerPlacement, slot?: HTMLElement): Promise<boolean> {
    const id = this.opts.bannerSlots?.[placement];
    if (!slot || !id) return false;
    await this.init();
    this.hideBanner(placement);
    const ins = this.w.document.createElement('ins');
    ins.className = 'adsbygoogle';
    ins.setAttribute('data-ad-client', this.opts.client);
    ins.setAttribute('data-ad-slot', id);
    const size = this.opts.bannerSize;
    if (size && Number.isFinite(size.width) && Number.isFinite(size.height) && size.width >= 1 && size.height >= 1) {
      // Bloco de tamanho fixo (formato documentado do AdSense): inline-block, largura e altura no style.
      ins.style.display = 'inline-block';
      ins.style.width = `${Math.round(size.width)}px`;
      ins.style.height = `${Math.round(size.height)}px`;
    } else {
      ins.style.display = 'block';
      ins.setAttribute('data-ad-format', 'auto');
      ins.setAttribute('data-full-width-responsive', 'true');
    }
    if (this.opts.test) ins.setAttribute('data-adtest', 'on');
    slot.appendChild(ins);
    this.banners.set(placement, ins);
    this.w.adsbygoogle!.push({});
    return true;
  }

  hideBanner(placement: BannerPlacement): void {
    this.banners.get(placement)?.remove();
    this.banners.delete(placement);
  }
}

/**
 * Escolhe o fornecedor pelo ambiente do build: com VITE_ADSENSE_CLIENT, AdSense; sem, nenhum anúncio.
 * VITE_ADS_TEST=1 liga os anúncios de teste. Slots de banner: VITE_ADSENSE_SLOT_HOME e VITE_ADSENSE_SLOT_END.
 */
export function adSenseFromEnv(env: Record<string, string | boolean | undefined>, extra: Pick<AdSenseOptions, 'onPause' | 'onResume' | 'bannerSize'> = {}): AdSenseProvider | null {
  const client = typeof env.VITE_ADSENSE_CLIENT === 'string' ? env.VITE_ADSENSE_CLIENT.trim() : '';
  if (!/^ca-pub-\d{10,20}$/.test(client)) return null;
  const slot = (k: string) => (typeof env[k] === 'string' && /^\d{6,12}$/.test(env[k] as string) ? (env[k] as string) : undefined);
  return new AdSenseProvider({
    client,
    test: env.VITE_ADS_TEST === '1' || env.VITE_ADS_TEST === true,
    bannerSlots: { home: slot('VITE_ADSENSE_SLOT_HOME'), end: slot('VITE_ADSENSE_SLOT_END') },
    ...extra,
  });
}
