import { describe, expect, it } from 'vitest';
import { HttpSink, Metrics, sanitizeData, type MetricsEvent, type MetricsSink } from './index.ts';

class MemorySink implements MetricsSink {
  batches: MetricsEvent[][] = [];
  ok = true;
  send(batch: MetricsEvent[]) {
    if (this.ok) this.batches.push(batch);
    return this.ok;
  }
}

const make = (sink: MetricsSink, extra = {}) =>
  new Metrics({ game: 'dobra', pid: 'pid-123456789012345', lang: 'pt', sink, batchSize: 3, now: () => 1000, sessionId: 's1', ...extra });

describe('sanitizeData', () => {
  it('só número, booleano e rótulo curto passam', () => {
    expect(
      sanitizeData({ score: 1200, won: true, format: 'rewarded', email: 'rafael@exemplo.com', text: 'uma frase com espaço', nan: Number.NaN, obj: { a: 1 } }),
    ).toEqual({ score: 1200, won: true, format: 'rewarded' });
  });
  it('chave estranha também cai', () => {
    expect(sanitizeData({ 'nome completo': 'x', ok: 1 })).toEqual({ ok: 1 });
  });
});

describe('Metrics', () => {
  it('monta o evento com esquema, jogo, id anônimo, sessão, idioma e grupos', async () => {
    const sink = new MemorySink();
    const m = make(sink, { groups: { gap: 'b' } });
    m.track('game_end', { score: 900, maxTile: 128 });
    await m.flush();
    expect(sink.batches[0]![0]).toEqual({
      v: 1, game: 'dobra', type: 'game_end', at: 1000, pid: 'pid-123456789012345', sid: 's1', lang: 'pt', groups: { gap: 'b' }, data: { score: 900, maxTile: 128 },
    });
  });

  it('envia sozinho ao completar o lote', async () => {
    const sink = new MemorySink();
    const m = make(sink);
    m.track('game_start');
    m.track('game_start');
    expect(sink.batches).toHaveLength(0);
    m.track('game_start');
    await Promise.resolve();
    expect(sink.batches).toHaveLength(1);
    expect(m.pending).toBe(0);
  });

  it('sem rede, guarda e reenvia depois', async () => {
    const sink = new MemorySink();
    sink.ok = false;
    const m = make(sink);
    m.track('ad', { format: 'interstitial' });
    await m.flush();
    expect(m.pending).toBe(1);
    sink.ok = true;
    await m.flush();
    expect(sink.batches.flat()).toHaveLength(1);
    expect(m.pending).toBe(0);
  });

  it('a fila tem teto e descarta o mais antigo', () => {
    const sink = new MemorySink();
    sink.ok = false;
    const m = make(sink, { batchSize: 1000, maxQueue: 5 });
    for (let i = 0; i < 8; i++) m.track('setting', { i });
    expect(m.pending).toBe(5);
  });

  it('erro no envio não quebra o jogo', async () => {
    const m = make({ send: () => Promise.reject(new Error('offline')) });
    m.track('session_start');
    await expect(m.flush()).resolves.toBeUndefined();
    expect(m.pending).toBe(1);
  });
});

describe('HttpSink', () => {
  const event = { v: 1, game: 'dobra', type: 'session_start', at: 1, pid: 'p', sid: 's', lang: 'pt', groups: {}, data: {} } as MetricsEvent;

  it('usa sendBeacon quando o navegador aceita', async () => {
    const sent: string[] = [];
    const sink = new HttpSink('/m', { beacon: (url) => (sent.push(url), true), fetchFn: () => Promise.reject(new Error('não devia')) });
    expect(await sink.send([event])).toBe(true);
    expect(sent).toEqual(['/m']);
  });

  it('cai para fetch sem cookies quando não há beacon', async () => {
    let init: RequestInit | undefined;
    const sink = new HttpSink('/m', { beacon: null, fetchFn: async (_u, i) => ((init = i), new Response(null, { status: 204 })) });
    expect(await sink.send([event])).toBe(true);
    expect(init).toMatchObject({ method: 'POST', credentials: 'omit', keepalive: true });
    expect(JSON.parse(String(init?.body))).toEqual([event]);
  });

  it('resposta de erro devolve false (o lote fica na fila)', async () => {
    const sink = new HttpSink('/m', { beacon: null, fetchFn: async () => new Response(null, { status: 503 }) });
    expect(await sink.send([event])).toBe(false);
  });
});
