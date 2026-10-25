import type { AdPolicy, AdProvider, BannerPlacement, FullscreenFormat, RewardedOutcome } from './types.ts';

/** "Sem anúncio": usado sem configuração, em desenvolvimento e para quem comprou "Sem anúncios". */
export class NoAdsProvider implements AdProvider {
  readonly id = 'none';
  async init(_policy: AdPolicy): Promise<void> {}
  async preload(_format: FullscreenFormat): Promise<void> {}
  isReady(_format: FullscreenFormat): boolean {
    return false;
  }
  async showInterstitial(): Promise<boolean> {
    return false;
  }
  async showRewarded(): Promise<RewardedOutcome> {
    return 'unavailable';
  }
  async showBanner(_placement: BannerPlacement, _slot?: HTMLElement): Promise<boolean> {
    return false;
  }
  hideBanner(_placement: BannerPlacement): void {}
}
