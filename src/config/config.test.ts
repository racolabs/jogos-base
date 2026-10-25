import { describe, expect, it } from 'vitest';
import { assignGroup, HttpConfigSource, loadConfig, resolveConfig, sanitize, StaticConfigSource, type ConfigSource } from './index.ts';

const DEFAULTS = { gapSec: 180, perSession: 4, noAdsFirstDay: true, theme: 'mesa' };
const LIMITS = { gapSec: { min: 60, max: 600 }, perSession: { min: 0, max: 10 } };

describe('sanitize', () => {
  it('ignora chave desconhecida, tipo errado, número inválido e fora da faixa', () => {
    expect(
      sanitize(DEFAULTS, { gapSec: '120', perSession: 99, noAdsFirstDay: false, extra: 1, theme: 5 }, LIMITS),
    ).toEqual({ noAdsFirstDay: false });
    expect(sanitize(DEFAULTS, { gapSec: Number.NaN }, LIMITS)).toEqual({});
    expect(sanitize(DEFAULTS, { gapSec: 120 }, LIMITS)).toEqual({ gapSec: 120 });
    expect(sanitize(DEFAULTS, null)).toEqual({});
  });
});

describe('loadConfig', () => {
  const opts = { playerId: 'p1', limits: LIMITS };

  it('sem rede, devolve os padrões', async () => {
    const offline: ConfigSource = { load: () => Promise.reject(new Error('offline')) };
    expect(await loadConfig(DEFAULTS, offline, opts)).toEqual({ values: DEFAULTS, groups: {} });
  });

  it('JSON que não é objeto vira padrões', async () => {
    expect((await loadConfig(DEFAULTS, new StaticConfigSource('oops'), opts)).values).toEqual(DEFAULTS);
    expect((await loadConfig(DEFAULTS, new StaticConfigSource([1, 2]), opts)).values).toEqual(DEFAULTS);
  });

  it('aplica só os valores válidos por cima dos padrões', async () => {
    const cfg = await loadConfig(DEFAULTS, new StaticConfigSource({ values: { gapSec: 240, perSession: -1 } }), opts);
    expect(cfg.values).toEqual({ ...DEFAULTS, gapSec: 240 });
  });

  it('não altera o objeto de padrões', async () => {
    const defaults = { ...DEFAULTS };
    await loadConfig(defaults, new StaticConfigSource({ values: { gapSec: 240 } }), opts);
    expect(defaults).toEqual(DEFAULTS);
  });
});

describe('experimentos A/B', () => {
  const raw = { experiments: [{ id: 'gap', groups: { a: { gapSec: 180 }, b: { gapSec: 120 } } }] };

  it('o mesmo jogador cai sempre no mesmo grupo', () => {
    const first = resolveConfig(DEFAULTS, raw, { playerId: 'jogador-42' });
    for (let i = 0; i < 5; i++) expect(resolveConfig(DEFAULTS, raw, { playerId: 'jogador-42' })).toEqual(first);
    expect(first.values.gapSec).toBe(first.groups.gap === 'a' ? 180 : 120);
  });

  it('a ordem dos grupos no JSON não muda o sorteio', () => {
    expect(assignGroup('x', 'gap', ['b', 'a'])).toBe(assignGroup('x', 'gap', ['a', 'b']));
  });

  it('10 mil jogadores se dividem com menos de 2% de diferença', () => {
    let a = 0;
    for (let i = 0; i < 10_000; i++) if (assignGroup(`player-${i}-${(i * 7919).toString(36)}`, 'gap', ['a', 'b']) === 'a') a++;
    expect(Math.abs(a - (10_000 - a)) / 10_000).toBeLessThan(0.02);
  });

  it('experimento só para novos não vale para quem já joga', () => {
    const onlyNew = { experiments: [{ ...raw.experiments[0], onlyNewPlayers: true }] };
    expect(resolveConfig(DEFAULTS, onlyNew, { playerId: 'p', isNewPlayer: false }).groups).toEqual({});
    expect(Object.keys(resolveConfig(DEFAULTS, onlyNew, { playerId: 'p', isNewPlayer: true }).groups)).toEqual(['gap']);
  });

  it('experimento malformado é ignorado', () => {
    const bad = { experiments: [{ id: 'x', groups: { so: {} } }, { groups: { a: {}, b: {} } }, 'lixo'] };
    expect(resolveConfig(DEFAULTS, bad, { playerId: 'p' })).toEqual({ values: DEFAULTS, groups: {} });
  });

  it('override fora da faixa no grupo é ignorado', () => {
    const r = { experiments: [{ id: 'gap', groups: { a: { gapSec: 5 }, b: { gapSec: 5 } } }] };
    expect(resolveConfig(DEFAULTS, r, { playerId: 'p', limits: LIMITS }).values.gapSec).toBe(180);
  });
});

describe('HttpConfigSource', () => {
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

  it('lê o JSON sem enviar cookies', async () => {
    let init: RequestInit | undefined;
    const src = new HttpConfigSource('/config.json', 1000, async (_url, i) => ((init = i), json({ values: { gapSec: 200 } })));
    expect(await src.load()).toEqual({ values: { gapSec: 200 } });
    expect(init?.credentials).toBe('omit');
  });

  it('erro HTTP rejeita, e loadConfig cai nos padrões', async () => {
    const src = new HttpConfigSource('/config.json', 1000, async () => json({}, 500));
    await expect(src.load()).rejects.toThrow('HTTP 500');
    expect((await loadConfig(DEFAULTS, src, { playerId: 'p' })).values).toEqual(DEFAULTS);
  });

  it('desiste depois do tempo limite', async () => {
    const never: typeof fetch = (_url, init) =>
      new Promise((_, reject) => init?.signal?.addEventListener('abort', () => reject(new Error('abortado'))));
    await expect(new HttpConfigSource('/config.json', 20, never).load()).rejects.toThrow('abortado');
  });
});
