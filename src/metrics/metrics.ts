/**
 * Métricas sem cookie: o jogo registra eventos agregáveis (sessão, partida, anúncio, desafio do dia)
 * identificados só pelo id anônimo do aparelho. Nada de conta, e-mail, IP ou identificador de publicidade.
 */
export const METRICS_SCHEMA = 1;

export type EventType =
  | 'session_start'
  | 'session_end'
  | 'game_start'
  | 'game_end'
  | 'ad'
  | 'reward'
  | 'daily_complete'
  | 'setting';

export type EventValue = number | boolean | string;

export interface MetricsEvent {
  v: typeof METRICS_SCHEMA;
  game: string;
  type: EventType;
  /** ms desde 1970 (relógio do aparelho). */
  at: number;
  /** Id anônimo do aparelho (anonymousPlayerId). */
  pid: string;
  /** Id aleatório da sessão. */
  sid: string;
  lang: string;
  /** Grupos A/B sorteados pela configuração. */
  groups: Record<string, string>;
  data: Record<string, EventValue>;
}

/** Para onde os eventos vão. Devolve true se o lote foi aceito; false mantém o lote para tentar de novo. */
export interface MetricsSink {
  send(batch: MetricsEvent[]): Promise<boolean> | boolean;
}

/** Texto só pode ser um rótulo curto (ex.: "rewarded", "continue", "pt"). Qualquer outra coisa é descartada. */
const LABEL = /^[a-z0-9_.:-]{1,40}$/i;

/** Mantém só números finitos, booleanos e rótulos curtos. E-mail, frase ou objeto não passam. */
export function sanitizeData(data: Record<string, unknown>): Record<string, EventValue> {
  const out: Record<string, EventValue> = {};
  for (const [key, value] of Object.entries(data)) {
    if (!LABEL.test(key)) continue;
    if (typeof value === 'number' && Number.isFinite(value)) out[key] = value;
    else if (typeof value === 'boolean') out[key] = value;
    else if (typeof value === 'string' && LABEL.test(value)) out[key] = value;
  }
  return out;
}

export interface MetricsOptions {
  game: string;
  pid: string;
  lang: string;
  groups?: Record<string, string>;
  sink: MetricsSink;
  /** Envia ao juntar este número de eventos. */
  batchSize?: number;
  /** Teto da fila: o mais antigo sai primeiro (protege a memória sem rede). */
  maxQueue?: number;
  now?: () => number;
  sessionId?: string;
}

export class Metrics {
  private queue: MetricsEvent[] = [];
  private sending = false;
  private readonly opts: Required<Omit<MetricsOptions, 'groups' | 'sessionId'>> & { groups: Record<string, string> };
  readonly sid: string;

  constructor(opts: MetricsOptions) {
    this.opts = { batchSize: 20, maxQueue: 200, now: Date.now, groups: {}, ...opts };
    this.sid = opts.sessionId ?? randomSid();
  }

  setGroups(groups: Record<string, string>): void {
    this.opts.groups = { ...groups };
  }

  setLang(lang: string): void {
    this.opts.lang = lang;
  }

  track(type: EventType, data: Record<string, unknown> = {}): void {
    const { game, pid, lang, groups, now, maxQueue, batchSize } = this.opts;
    this.queue.push({ v: METRICS_SCHEMA, game, type, at: now(), pid, sid: this.sid, lang, groups: { ...groups }, data: sanitizeData(data) });
    if (this.queue.length > maxQueue) this.queue.splice(0, this.queue.length - maxQueue);
    if (this.queue.length >= batchSize) void this.flush();
  }

  get pending(): number {
    return this.queue.length;
  }

  /** Envia o que está na fila. Chame também ao esconder a página (pagehide / visibilitychange). */
  async flush(): Promise<void> {
    if (this.sending || this.queue.length === 0) return;
    this.sending = true;
    const batch = this.queue.slice(0, this.opts.batchSize);
    try {
      const ok = await this.opts.sink.send(batch);
      if (ok) this.queue.splice(0, batch.length);
    } catch {
      /* fica na fila para a próxima */
    } finally {
      this.sending = false;
    }
  }
}

function randomSid(): string {
  const c = globalThis.crypto;
  return c?.randomUUID ? c.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36);
}
