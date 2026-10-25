/**
 * Armazenamento no aparelho. Partida, recordes e estado de anúncio nunca saem dele.
 * Se o navegador bloquear o armazenamento (aba anônima, cota cheia), o jogo segue normal sem salvar.
 */
export interface KeyValueStore {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

/** Memória: testes e quando não há armazenamento disponível. */
export class MemoryStore implements KeyValueStore {
  private readonly map = new Map<string, string>();
  get(key: string): string | null {
    return this.map.get(key) ?? null;
  }
  set(key: string, value: string): void {
    this.map.set(key, value);
  }
  remove(key: string): void {
    this.map.delete(key);
  }
}

/** localStorage do navegador. Qualquer erro é engolido: salvar é melhor esforço, nunca quebra o jogo. */
export class BrowserStore implements KeyValueStore {
  constructor(private readonly storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | undefined = safeLocalStorage()) {}
  get(key: string): string | null {
    try {
      return this.storage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  }
  set(key: string, value: string): void {
    try {
      this.storage?.setItem(key, value);
    } catch {
      /* sem armazenamento */
    }
  }
  remove(key: string): void {
    try {
      this.storage?.removeItem(key);
    } catch {
      /* sem armazenamento */
    }
  }
}

function safeLocalStorage(): Storage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

export interface BoxOptions<T> {
  /** Versão atual do formato. Suba ao mudar a forma dos dados e escreva migrate. */
  version: number;
  defaults: () => T;
  /** Converte dados de uma versão antiga. null = descarta e usa os padrões. */
  migrate?: (data: unknown, fromVersion: number) => T | null;
  /** Lê um formato antigo salvo em outra chave (ex.: o "dobra:v1" de antes da base). */
  legacy?: { key: string; read: (raw: unknown) => T | null };
}

export interface Box<T> {
  load(): T;
  save(data: T): void;
  clear(): void;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function parse(raw: string | null): unknown {
  if (raw === null) return undefined;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
}

/**
 * Uma "caixa" versionada numa chave: { v, data }. Campos novos ganham o valor padrão;
 * versão antiga passa por migrate; versão desconhecida ou JSON quebrado volta aos padrões.
 */
export function createBox<T extends object>(store: KeyValueStore, key: string, opts: BoxOptions<T>): Box<T> {
  const withDefaults = (data: T): T => ({ ...opts.defaults(), ...data });
  return {
    load(): T {
      const saved = parse(store.get(key));
      if (isObject(saved) && typeof saved.v === 'number' && isObject(saved.data)) {
        if (saved.v === opts.version) return withDefaults(saved.data as T);
        if (saved.v < opts.version && opts.migrate) {
          const migrated = opts.migrate(saved.data, saved.v);
          if (migrated) return withDefaults(migrated);
        }
        return opts.defaults();
      }
      if (saved === undefined && opts.legacy) {
        const old = parse(store.get(opts.legacy.key));
        const converted = old === undefined ? null : opts.legacy.read(old);
        if (converted) return withDefaults(converted);
      }
      return opts.defaults();
    },
    save(data: T): void {
      store.set(key, JSON.stringify({ v: opts.version, data }));
    },
    clear(): void {
      store.remove(key);
    },
  };
}

/**
 * Identificador anônimo deste aparelho, só para sorteio de grupo A/B e métricas agregadas.
 * Aleatório, sem relação com conta, e-mail ou identificador de publicidade.
 */
export function anonymousPlayerId(store: KeyValueStore, key = 'jogos:pid'): string {
  const existing = store.get(key);
  if (existing && /^[a-z0-9-]{16,64}$/.test(existing)) return existing;
  const id = randomId();
  store.set(key, id);
  return id;
}

function randomId(): string {
  const c = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID();
  const bytes = new Uint8Array(16);
  if (c?.getRandomValues) c.getRandomValues(bytes);
  else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
