import type { ConfigSource } from './config.ts';

/** JSON fixo: testes e jogos ainda sem servidor de configuração. */
export class StaticConfigSource implements ConfigSource {
  constructor(private readonly data: unknown) {}
  async load(): Promise<unknown> {
    return this.data;
  }
}

/** JSON servido pelo próprio jogo (ex.: /config.json no Caddy). Desiste depois de timeoutMs. */
export class HttpConfigSource implements ConfigSource {
  constructor(
    private readonly url: string,
    private readonly timeoutMs = 3000,
    private readonly fetchFn: typeof fetch = (...args) => fetch(...args),
  ) {}

  async load(): Promise<unknown> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
    try {
      const res = await this.fetchFn(this.url, { signal: ctrl.signal, cache: 'no-cache', credentials: 'omit' });
      if (!res.ok) throw new Error(`config: HTTP ${res.status}`);
      return await res.json();
    } finally {
      clearTimeout(timer);
    }
  }
}
