/**
 * Contrato que todo fornecedor de anúncio cumpre (AdMob, AdSense/H5, portais, "sem anúncio").
 * O jogo fala só com esta interface: trocar de rede é trocar a implementação.
 */
import type { PortalEvents } from './portal.ts';

export type FullscreenFormat = 'interstitial' | 'rewarded';

/** Onde um banner pode aparecer. Nunca sobre o tabuleiro. */
export type BannerPlacement = 'home' | 'end';

/** earned: assistiu até o fim; dismissed: fechou antes; unavailable: não havia anúncio. */
export type RewardedOutcome = 'earned' | 'dismissed' | 'unavailable';

/** Como pedir anúncios. Os jogos começam sempre com DEFAULT_AD_POLICY. */
export interface AdPolicy {
  /** Sem perfil nem histórico do jogador (LGPD e ECA Digital). */
  nonPersonalized: boolean;
  /** Marca o pedido como de público infantil enquanto a idade for desconhecida (Google Play Famílias). */
  childDirected: boolean;
}

export const DEFAULT_AD_POLICY: Readonly<AdPolicy> = Object.freeze({ nonPersonalized: true, childDirected: false });

export interface AdProvider {
  readonly id: string;
  /**
   * Opcional. Só provider de portal (CrazyGames...) tem: eventos de carregamento e de jogo que o portal mede.
   * O jogo não lê isto direto: usa `portalOf(provider)`, que devolve um objeto sem efeito quando não há portal.
   */
  readonly portal?: PortalEvents;
  init(policy: AdPolicy): Promise<void>;
  /** Pede um anúncio com antecedência. Nunca trava o jogo esperando. */
  preload(format: FullscreenFormat): Promise<void>;
  isReady(format: FullscreenFormat): boolean;
  /** Devolve true se o anúncio apareceu. */
  showInterstitial(): Promise<boolean>;
  showRewarded(): Promise<RewardedOutcome>;
  /** slot: elemento reservado na página (web). Apps nativos podem ignorar. Devolve true se apareceu. */
  showBanner(placement: BannerPlacement, slot?: HTMLElement): Promise<boolean>;
  hideBanner(placement: BannerPlacement): void;
}
