import type { MetricsEvent, MetricsSink } from './metrics.ts';

/** Nenhum envio: desenvolvimento, testes e enquanto não há coletor. */
export class NullSink implements MetricsSink {
  send(): boolean {
    return true;
  }
}

/** Mostra os eventos no console do navegador (só desenvolvimento). */
export class ConsoleSink implements MetricsSink {
  constructor(private readonly log: (...args: unknown[]) => void = console.info) {}
  send(batch: MetricsEvent[]): boolean {
    for (const e of batch) this.log('[metrics]', e.type, e.data);
    return true;
  }
}

export interface HttpSinkDeps {
  beacon?: ((url: string, body: Blob) => boolean) | null;
  fetchFn?: typeof fetch;
}

/**
 * Envia para o coletor do próprio jogo. Usa sendBeacon (sobrevive ao fechar a aba) e cai para fetch.
 * Nunca manda cookie.
 */
export class HttpSink implements MetricsSink {
  private readonly beacon: ((url: string, body: Blob) => boolean) | null;
  private readonly fetchFn: typeof fetch;

  constructor(
    private readonly url: string,
    deps: HttpSinkDeps = {},
  ) {
    this.beacon =
      deps.beacon !== undefined
        ? deps.beacon
        : typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function'
          ? (u, b) => navigator.sendBeacon(u, b)
          : null;
    this.fetchFn = deps.fetchFn ?? ((...args) => fetch(...args));
  }

  async send(batch: MetricsEvent[]): Promise<boolean> {
    const body = JSON.stringify(batch);
    if (this.beacon && this.beacon(this.url, new Blob([body], { type: 'application/json' }))) return true;
    try {
      const res = await this.fetchFn(this.url, {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json' },
        keepalive: true,
        credentials: 'omit',
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}
