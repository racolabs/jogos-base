import { dayKey, interstitialBlock, rewardedBlock, type AdConfig, type InterstitialBlock, type PlayerAdState, type RewardedBlock } from './rules.ts';
import type { AdProvider, RewardedOutcome } from './types.ts';

export interface AdsControllerOptions {
  now?: () => number;
  /** Chamado a cada mudança do estado, para o jogo salvar no aparelho. */
  onChange?: (state: PlayerAdState) => void;
}

/**
 * Junta fornecedor, configuração e estado do jogador. O jogo só chama:
 * gameEnded → betweenGames (pode mostrar intersticial) e canOfferRewarded → watchRewarded.
 */
export class AdsController {
  private readonly now: () => number;
  private readonly onChange: (state: PlayerAdState) => void;

  constructor(
    private readonly provider: AdProvider,
    private cfg: AdConfig,
    private state: PlayerAdState,
    opts: AdsControllerOptions = {},
  ) {
    this.now = opts.now ?? Date.now;
    this.onChange = opts.onChange ?? (() => {});
  }

  get snapshot(): Readonly<PlayerAdState> {
    return { ...this.state };
  }

  setConfig(cfg: AdConfig): void {
    this.cfg = cfg;
  }

  /** Abriu o jogo de novo: zera o contador da sessão. */
  startSession(): void {
    this.update({ interstitialsThisSession: 0 });
  }

  /** quick: derrota em partida curta (conta para a trava de frustração). */
  gameEnded(result: { durationSec: number; quickLoss: boolean }): void {
    this.update({
      gamesPlayed: this.state.gamesPlayed + 1,
      lastGameSec: result.durationSec,
      quickLossStreak: result.quickLoss ? this.state.quickLossStreak + 1 : 0,
    });
  }

  interstitialBlock(): InterstitialBlock | null {
    this.rollDay();
    return interstitialBlock(this.state, this.cfg, this.now(), this.provider.isReady('interstitial'));
  }

  /** Só no "jogar de novo". Devolve true se o intersticial apareceu. */
  async betweenGames(): Promise<boolean> {
    if (this.interstitialBlock() !== null) return false;
    const shown = await this.provider.showInterstitial();
    if (shown) {
      this.update({
        lastInterstitialAt: this.now(),
        interstitialsThisSession: this.state.interstitialsThisSession + 1,
        interstitialsToday: this.state.interstitialsToday + 1,
      });
    }
    void this.provider.preload('interstitial');
    return shown;
  }

  rewardedBlock(use: { usedThisGame: number; perGame?: number } = { usedThisGame: 0 }): RewardedBlock | null {
    this.rollDay();
    return rewardedBlock(this.state, this.cfg, use, this.provider.isReady('rewarded'));
  }

  /** Limite por partida do "Continuar", vindo da configuração. */
  get continuePerGame(): number {
    return this.cfg.continuePerGame;
  }

  /** Mostra o premiado depois do toque do jogador. O prêmio só vale com 'earned'. */
  async watchRewarded(use: { usedThisGame: number; perGame?: number } = { usedThisGame: 0 }): Promise<RewardedOutcome> {
    if (this.rewardedBlock(use) !== null) return 'unavailable';
    const outcome = await this.provider.showRewarded();
    if (outcome === 'earned') this.update({ lastRewardedAt: this.now(), rewardedToday: this.state.rewardedToday + 1 });
    void this.provider.preload('rewarded');
    return outcome;
  }

  /** Comprou "Sem anúncios": nunca mais intersticial nem banner; o premiado segue opcional. */
  markRemoveAds(): void {
    this.update({ removeAds: true, isPayer: true });
  }

  private rollDay(): void {
    const today = dayKey(this.now());
    if (today !== this.state.day) this.update({ day: today, interstitialsToday: 0, rewardedToday: 0 });
  }

  private update(patch: Partial<PlayerAdState>): void {
    this.state = { ...this.state, ...patch };
    this.onChange({ ...this.state });
  }
}
