import type { AdPolicy, AdProvider, BannerPlacement, FullscreenFormat, RewardedOutcome } from './types.ts';

export type FakeAdCall =
  | { type: 'init'; policy: AdPolicy }
  | { type: 'preload'; format: FullscreenFormat }
  | { type: 'interstitial' }
  | { type: 'rewarded'; outcome: RewardedOutcome }
  | { type: 'banner'; placement: BannerPlacement }
  | { type: 'hideBanner'; placement: BannerPlacement };

/** Fornecedor falso para testes dos jogos: diz o que aconteceu e deixa escolher o resultado. */
export class FakeAdProvider implements AdProvider {
  readonly id = 'fake';
  readonly calls: FakeAdCall[] = [];
  ready: Record<FullscreenFormat, boolean>;
  rewardedOutcome: Exclude<RewardedOutcome, 'unavailable'>;

  constructor(opts: { ready?: Partial<Record<FullscreenFormat, boolean>>; rewardedOutcome?: 'earned' | 'dismissed' } = {}) {
    this.ready = { interstitial: true, rewarded: true, ...opts.ready };
    this.rewardedOutcome = opts.rewardedOutcome ?? 'earned';
  }

  async init(policy: AdPolicy): Promise<void> {
    this.calls.push({ type: 'init', policy: { ...policy } });
  }
  async preload(format: FullscreenFormat): Promise<void> {
    this.calls.push({ type: 'preload', format });
  }
  isReady(format: FullscreenFormat): boolean {
    return this.ready[format];
  }
  async showInterstitial(): Promise<boolean> {
    if (!this.ready.interstitial) return false;
    this.calls.push({ type: 'interstitial' });
    return true;
  }
  async showRewarded(): Promise<RewardedOutcome> {
    const outcome: RewardedOutcome = this.ready.rewarded ? this.rewardedOutcome : 'unavailable';
    this.calls.push({ type: 'rewarded', outcome });
    return outcome;
  }
  async showBanner(placement: BannerPlacement): Promise<boolean> {
    this.calls.push({ type: 'banner', placement });
    return true;
  }
  hideBanner(placement: BannerPlacement): void {
    this.calls.push({ type: 'hideBanner', placement });
  }
  count(type: FakeAdCall['type']): number {
    return this.calls.filter((c) => c.type === type).length;
  }
}
