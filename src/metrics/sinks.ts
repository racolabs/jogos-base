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

/** Ingestor padrão do Analisa (protocolo v1). */
export const ANALISA_ENDPOINT = 'https://function-bun-production-3339.up.railway.app/v1/i';

export interface AnalisaSinkOptions {
  /** Chave pública do app no painel do Analisa (pk_...). */
  siteKey: string;
  endpoint?: string;
  fetchFn?: typeof fetch;
  now?: () => number;
  /** Página atual (padrão: location). */
  page?: () => { path: string; url: string; referrer: string; search: string };
}

type Flat = Record<string, string | number | boolean>;

/**
 * Envia para o Analisa (analytics sem cookie, protocolo v1): cada evento vira um evento do Analisa
 * com as mesmas propriedades; o início de sessão também gera um page_view (origem, UTM).
 * Trocável: é só mais um MetricsSink.
 */
export class AnalisaSink implements MetricsSink {
  private readonly endpoint: string;
  private readonly fetchFn: typeof fetch;
  private readonly now: () => number;
  private readonly page: NonNullable<AnalisaSinkOptions['page']>;

  constructor(private readonly opts: AnalisaSinkOptions) {
    this.endpoint = opts.endpoint ?? ANALISA_ENDPOINT;
    this.fetchFn = opts.fetchFn ?? ((...args) => fetch(...args));
    this.now = opts.now ?? Date.now;
    this.page =
      opts.page ??
      (() => ({
        path: typeof location !== 'undefined' ? location.pathname : '/',
        url: typeof location !== 'undefined' ? location.origin + location.pathname : '',
        referrer: typeof document !== 'undefined' ? document.referrer : '',
        search: typeof location !== 'undefined' ? location.search : '',
      }));
  }

  /** Corpo do envio (separado para teste). */
  body(batch: MetricsEvent[]): string {
    const page = this.page();
    const events: Record<string, unknown>[] = [];
    for (const e of batch) {
      const props: Flat = { game: e.game, lang: e.lang };
      for (const [k, v] of Object.entries(e.groups)) props[`ab_${k}`] = v;
      Object.assign(props, e.data);
      const base = { ts: e.at, anon_id: e.pid, session_id: e.sid, path: page.path };
      if (e.type === 'session_start') {
        const q = new URLSearchParams(page.search);
        const utm: Record<string, string> = {};
        for (const k of ['source', 'medium', 'campaign', 'term', 'content']) {
          const v = q.get(`utm_${k}`);
          if (v) utm[k] = v;
        }
        events.push({ ...base, id: `${e.id}.pv`, event: 'page_view', url: page.url, referrer: page.referrer, ...(Object.keys(utm).length ? { utm } : {}), props });
      }
      events.push({ ...base, id: e.id, event: e.type, props });
    }
    const screen =
      typeof window !== 'undefined' && window.screen ? { w: window.screen.width, h: window.screen.height, density: window.devicePixelRatio || 1 } : undefined;
    let tz: string | undefined;
    try {
      tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      tz = undefined;
    }
    return JSON.stringify({
      site_key: this.opts.siteKey,
      sent_at: this.now(),
      context: { platform: 'web', framework: 'web', sdk: { name: 'jogos-base' }, locale: batch[0]?.lang === 'pt' ? 'pt-BR' : 'en', tz, screen },
      batch: events,
    });
  }

  async send(batch: MetricsEvent[]): Promise<boolean> {
    if (!batch.length) return true;
    try {
      const res = await this.fetchFn(this.endpoint, {
        method: 'POST',
        // text/plain evita a pré-verificação de CORS (o Analisa aceita).
        headers: { 'Content-Type': 'text/plain' },
        body: this.body(batch),
        keepalive: true,
        credentials: 'omit',
      });
      return res.ok;
    } catch {
      return false;
    }
  }
}
