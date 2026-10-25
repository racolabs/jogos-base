/**
 * Som e vibração, como nos protótipos aprovados (direção v2):
 * - som sintetizado no próprio jogo (sem arquivo), baixo e macio; nada toca antes do primeiro toque;
 * - vibração só quando o jogador recebe um prêmio, nunca durante a jogada.
 */
export interface FeedbackSettings {
  sound: boolean;
  haptics: boolean;
}

/** O pedaço do Web Audio que usamos. Permite trocar por um falso nos testes. */
export interface AudioOut {
  readonly currentTime: number;
  readonly sampleRate: number;
  readonly state: string;
  readonly destination: AudioNode;
  resume(): Promise<void>;
  createOscillator(): OscillatorNode;
  createGain(): GainNode;
  createBuffer(channels: number, length: number, sampleRate: number): AudioBuffer;
  createBufferSource(): AudioBufferSourceNode;
  createBiquadFilter(): BiquadFilterNode;
}

export type Cue =
  /** Toque de botão: quase mudo. */
  | 'tap'
  /** Dobra: nota suave que sobe a pentatônica com o nível da peça (passe o nível 1 = peça 4). */
  | 'merge'
  /** Dobra: duas notas que descem. */
  | 'over'
  /** 2048, recorde, vitória: arpejo curto e baixo. */
  | 'fanfare'
  /** Paciência: estalo de papel ao pegar a carta. */
  | 'pick'
  /** Paciência: toque no feltro ao pousar. */
  | 'place'
  /** Paciência: sino que sobe com o valor da carta na pilha final (passe o valor, 1 a 13). */
  | 'found';

export interface FeedbackDeps {
  settings: () => FeedbackSettings;
  /** Cria o AudioContext só quando o primeiro som toca (o navegador exige um toque antes). */
  createAudio?: () => AudioOut | null;
  vibrate?: (pattern: number | number[]) => boolean;
  /** O jogador já tocou na página? Vibrar antes disso gera erro no console do navegador. */
  userActivated?: () => boolean;
}

const PENTA = [0, 2, 4, 7, 9];
export const REWARD_VIBRATION = [16, 40, 24];

export class Feedback {
  private audio: AudioOut | null = null;
  private master: GainNode | null = null;
  private readonly deps: Required<FeedbackDeps>;

  constructor(deps: FeedbackDeps) {
    this.deps = {
      createAudio: deps.createAudio ?? browserAudio,
      vibrate: deps.vibrate ?? browserVibrate,
      userActivated: deps.userActivated ?? browserActivated,
      settings: deps.settings,
    };
  }

  play(cue: Cue, value = 1): void {
    if (!this.deps.settings().sound || !this.out()) return;
    switch (cue) {
      case 'tap':
        return this.soft(880, 0.05, 0.03);
      case 'merge': {
        const i = Math.max(0, value - 1);
        return this.soft(392 * 2 ** ((PENTA[i % 5]! + 12 * Math.floor(i / 5)) / 12), 0.22, 0.05);
      }
      case 'over':
        return [392, 329.63].forEach((f, k) => this.soft(f, 0.35, 0.04, k * 0.14));
      case 'fanfare':
        return [392, 493.88, 587.33, 783.99].forEach((f, k) => this.soft(f, 0.4, 0.05, k * 0.09));
      case 'pick':
        return this.noise(0.035, 'highpass', 2500, 0.09);
      case 'place':
        this.noise(0.05, 'bandpass', 900, 0.15);
        return this.soft(180, 0.05, 0.07);
      case 'found': {
        const f = 523.25 * 2 ** ((value - 1) / 12);
        this.soft(f, 0.32, 0.11);
        return this.soft(f * 2.01, 0.22, 0.03);
      }
    }
  }

  /** Prêmio entregue: dim-dom e a única vibração do jogo. */
  reward(): void {
    if (this.deps.settings().sound && this.out()) {
      this.soft(783.99, 0.3, 0.05);
      this.soft(1174.66, 0.45, 0.045, 0.12);
    }
    if (this.deps.settings().haptics && this.deps.userActivated()) {
      try {
        this.deps.vibrate(REWARD_VIBRATION);
      } catch {
        /* sem vibração */
      }
    }
  }

  private out(): AudioOut | null {
    try {
      if (!this.audio) {
        this.audio = this.deps.createAudio();
        if (!this.audio) return null;
        this.master = this.audio.createGain();
        this.master.gain.value = 0.7;
        this.master.connect(this.audio.destination);
      }
      if (this.audio.state === 'suspended') void this.audio.resume();
      return this.audio;
    } catch {
      return null;
    }
  }

  private soft(freq: number, dur: number, vol: number, at = 0): void {
    const a = this.audio!;
    const t = a.currentTime + at;
    const osc = a.createOscillator();
    const gain = a.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, t);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain);
    gain.connect(this.master!);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private noise(dur: number, kind: BiquadFilterType, freq: number, vol: number): void {
    const a = this.audio!;
    const len = Math.max(1, Math.floor(a.sampleRate * dur));
    const buf = a.createBuffer(1, len, a.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = a.createBufferSource();
    src.buffer = buf;
    const filter = a.createBiquadFilter();
    filter.type = kind;
    filter.frequency.value = freq;
    const gain = a.createGain();
    gain.gain.value = vol;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master!);
    src.start();
  }
}

function browserAudio(): AudioOut | null {
  const C = (globalThis as { AudioContext?: new () => AudioOut; webkitAudioContext?: new () => AudioOut }).AudioContext ??
    (globalThis as { webkitAudioContext?: new () => AudioOut }).webkitAudioContext;
  return C ? new C() : null;
}

function browserVibrate(pattern: number | number[]): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function' ? navigator.vibrate(pattern) : false;
}

function browserActivated(): boolean {
  const ua = typeof navigator !== 'undefined' ? (navigator as { userActivation?: { hasBeenActive: boolean } }).userActivation : undefined;
  return ua ? ua.hasBeenActive : true;
}
