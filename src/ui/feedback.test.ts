import { afterEach, describe, expect, it } from 'vitest';
import { activatePortal, CRAZYGAMES_PROFILE, NO_PORTAL_EVENTS } from '../ads/portal.ts';
import { Feedback, REWARD_VIBRATION, type AudioOut, type FeedbackSettings } from './feedback.ts';

/** AudioContext falso: guarda as frequências e os volumes pedidos. */
function fakeAudio() {
  const tones: { freq: number; peak: number; type: string }[] = [];
  const noises: number[] = [];
  const param = () => ({ value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} });
  let created = 0;
  const audio = {
    currentTime: 0,
    sampleRate: 8000,
    state: 'running',
    destination: {},
    resume: async () => {},
    createOscillator() {
      const o = {
        type: 'sine',
        frequency: { setValueAtTime: (f: number) => tones.push({ freq: f, peak: 0, type: o.type }) },
        connect() {},
        start() {},
        stop() {},
      };
      return o;
    },
    createGain() {
      const g = { gain: { ...param(), exponentialRampToValueAtTime: (v: number) => v > 0.001 && tones.length && (tones.at(-1)!.peak ||= v) }, connect() {} };
      return g;
    },
    createBuffer: (_c: number, len: number) => ({ getChannelData: () => new Float32Array(len) }),
    createBufferSource() {
      noises.push(1);
      return { buffer: null, connect() {}, start() {} };
    },
    createBiquadFilter: () => ({ type: 'lowpass', frequency: { value: 0 }, connect() {} }),
  } as unknown as AudioOut;
  return { audio, tones, noises, created: () => created, factory: () => (created++, audio) };
}

function setup(settings: Partial<FeedbackSettings> = {}, activated = true) {
  const a = fakeAudio();
  const vibrations: (number | number[])[] = [];
  const fb = new Feedback({
    settings: () => ({ sound: true, haptics: true, ...settings }),
    createAudio: a.factory,
    vibrate: (p) => (vibrations.push(p), true),
    userActivated: () => activated,
  });
  return { fb, ...a, vibrations };
}

describe('som', () => {
  it('junção sobe a nota a cada nível da peça', () => {
    const { fb, tones } = setup();
    for (let level = 1; level <= 6; level++) fb.play('merge', level);
    const freqs = tones.map((t) => t.freq);
    expect(freqs).toEqual([...freqs].sort((x, y) => x - y));
    expect(freqs[0]).toBeCloseTo(392, 1);
  });

  it('só senoide e volume baixo nos sons do Dobra', () => {
    const { fb, tones } = setup();
    for (const cue of ['tap', 'merge', 'over', 'fanfare'] as const) fb.play(cue, 3);
    expect(tones.every((t) => t.type === 'sine')).toBe(true);
    expect(Math.max(...tones.map((t) => t.peak))).toBeLessThanOrEqual(0.05);
  });

  it('com som desligado não cria nem o áudio', () => {
    const { fb, created, tones } = setup({ sound: false });
    fb.play('merge', 4);
    fb.reward();
    expect(created()).toBe(0);
    expect(tones).toHaveLength(0);
  });

  it('o áudio é criado uma vez só, no primeiro som', () => {
    const { fb, created } = setup();
    expect(created()).toBe(0);
    fb.play('tap');
    fb.play('tap');
    expect(created()).toBe(1);
  });

  it('cartas da Paciência: estalo de papel e sino que sobe com a carta', () => {
    const { fb, noises, tones } = setup();
    fb.play('pick');
    fb.play('found', 1);
    fb.play('found', 13);
    expect(noises.length).toBe(1);
    expect(tones[2]!.freq).toBeGreaterThan(tones[0]!.freq);
  });

  it('sem Web Audio no navegador, nada quebra', () => {
    const fb = new Feedback({ settings: () => ({ sound: true, haptics: false }), createAudio: () => null });
    expect(() => fb.play('merge', 2)).not.toThrow();
    expect(() => fb.reward()).not.toThrow();
  });
});

describe('vibração só no prêmio', () => {
  it('nenhum som de jogada vibra', () => {
    const { fb, vibrations } = setup();
    for (const cue of ['tap', 'merge', 'over', 'fanfare', 'pick', 'place', 'found'] as const) fb.play(cue, 5);
    expect(vibrations).toHaveLength(0);
  });

  it('prêmio entregue vibra uma vez, com o padrão aprovado', () => {
    const { fb, vibrations } = setup();
    fb.reward();
    expect(vibrations).toEqual([REWARD_VIBRATION]);
  });

  it('respeita a chave de vibração e espera o primeiro toque do jogador', () => {
    const off = setup({ haptics: false });
    off.fb.reward();
    expect(off.vibrations).toHaveLength(0);
    const early = setup({}, false);
    early.fb.reward();
    expect(early.vibrations).toHaveLength(0);
  });
});

describe('silêncio do portal', () => {
  afterEach(() => activatePortal(null));

  it('portal que pediu silêncio cala som e prêmio, mesmo com o som ligado nas configurações, e a vibração do prêmio segue o jogador', () => {
    let muted = true;
    activatePortal(CRAZYGAMES_PROFILE, { ...NO_PORTAL_EVENTS, audioMuted: () => muted });
    const { fb, tones, vibrations } = setup();
    fb.play('tap');
    fb.reward();
    expect(tones).toHaveLength(0);
    expect(vibrations).toEqual([REWARD_VIBRATION]);
    muted = false;
    fb.play('tap');
    expect(tones.length).toBeGreaterThan(0);
  });
});
