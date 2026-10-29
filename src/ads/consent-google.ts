/**
 * Consentimento na web: CMP do Google (AdSense > Privacidade e mensagens), lido pela API IAB TCF v2 (`__tcfapi`)
 * e reaberto por `googlefc.showRevocationMessage()`.
 *
 * Como funciona:
 * - O formulário é do Google e aparece sozinho quando o script do AdSense carrega (é configurado no painel do AdSense,
 *   onde "Consentir" e "Não consentir" devem ficar na 1ª camada, com o mesmo peso). Aqui não há SDK novo: só leitura do TCF.
 * - `init()` assina o TCF (`addEventListener`) e lê a escolha guardada. `request()` espera a resposta do jogador, com limite de tempo.
 * - Personalizado só com consentimento explícito: propósitos 1, 3 e 4 e o fornecedor Google (id 755). Qualquer outra coisa
 *   (recusa, fora da GDPR, sem CMP, CMP que não carregou) é só não personalizado ou desconhecido, que também não personaliza.
 * - Falha ou demora do CMP nunca trava o jogo: o estado fica `unknown` e os anúncios saem não personalizados.
 */
import { ConsentListeners, type ConsentListener, type ConsentProvider, type ConsentState } from './consent.ts';

/** Fornecedor "Google Advertising Products" na lista global do TCF. */
export const GOOGLE_TCF_VENDOR_ID = 755;
/** 1 armazenar/acessar, 3 criar perfil de anúncio, 4 escolher anúncio personalizado. */
export const PERSONALIZATION_PURPOSES: readonly number[] = [1, 3, 4];

export interface TcData {
  tcString?: string;
  gdprApplies?: boolean;
  eventStatus?: 'tcloaded' | 'cmpuishown' | 'useractioncomplete';
  listenerId?: number;
  purpose?: { consents?: Record<string, boolean> };
  vendor?: { consents?: Record<string, boolean> };
}

export type TcfApi = (command: string, version: number, callback: (data: TcData, success: boolean) => void, parameter?: unknown) => void;

export interface GoogleFc {
  callbackQueue?: unknown[];
  showRevocationMessage?: () => void;
}

export type GoogleConsentWindow = Window & { __tcfapi?: TcfApi; googlefc?: GoogleFc };

export interface GoogleConsentOptions {
  /** Quanto `init()` espera pelo CMP antes de seguir como `unknown`. Padrão 5 s. */
  initTimeoutMs?: number;
  /** Quanto `request()` espera pela resposta do jogador. Padrão 30 s; a resposta tardia ainda chega por `subscribe`. */
  requestTimeoutMs?: number;
  /** Intervalo para procurar o `__tcfapi` enquanto o script do Google não o criou. Padrão 100 ms. */
  pollMs?: number;
  /** Só testes. */
  win?: GoogleConsentWindow;
}

/** Decide o estado a partir do que o TCF informa. Função pura. */
export function stateFromTcData(data: TcData): ConsentState {
  if (data.gdprApplies === false) return 'non-personalized'; // sem consentimento registrado, não se personaliza
  if (!data.tcString) return 'unknown'; // ainda não houve escolha
  const purposes = data.purpose?.consents ?? {};
  const vendors = data.vendor?.consents ?? {};
  const yes = PERSONALIZATION_PURPOSES.every((p) => purposes[String(p)] === true) && vendors[String(GOOGLE_TCF_VENDOR_ID)] === true;
  return yes ? 'personalized' : 'non-personalized';
}

export class GoogleConsentProvider implements ConsentProvider {
  readonly id = 'google-cmp';
  private current: ConsentState = 'unknown';
  private gdprApplies: boolean | undefined;
  private attached = false;
  private listenerId: number | undefined;
  private destroyed = false;
  private pollTimer: ReturnType<typeof setTimeout> | undefined;
  private initPromise: Promise<ConsentState> | undefined;
  private onFirstEvent: (() => void) | undefined;
  private readonly listeners = new ConsentListeners();
  private readonly w: GoogleConsentWindow;
  private readonly initTimeoutMs: number;
  private readonly requestTimeoutMs: number;
  private readonly pollMs: number;

  constructor(opts: GoogleConsentOptions = {}) {
    this.w = opts.win ?? (window as GoogleConsentWindow);
    this.initTimeoutMs = opts.initTimeoutMs ?? 5000;
    this.requestTimeoutMs = opts.requestTimeoutMs ?? 30_000;
    this.pollMs = opts.pollMs ?? 100;
  }

  state(): ConsentState {
    return this.current;
  }

  init(): Promise<ConsentState> {
    this.initPromise ??= new Promise<ConsentState>((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        off();
        resolve(this.current);
      };
      const timer = setTimeout(finish, this.initTimeoutMs);
      // Qualquer primeiro sinal do CMP (escolha lida, formulário aberto) encerra a espera.
      const off = this.listeners.add(finish);
      this.onFirstEvent = finish;
      this.startPolling();
    });
    return this.initPromise;
  }

  async request(): Promise<ConsentState> {
    await this.init();
    if (this.current !== 'unknown') return this.current;
    return new Promise<ConsentState>((resolve) => {
      const done = () => {
        clearTimeout(timer);
        off();
        resolve(this.current);
      };
      const timer = setTimeout(done, this.requestTimeoutMs);
      const off = this.listeners.add((s) => s !== 'unknown' && done());
    });
  }

  privacyOptionsAvailable(): boolean {
    return typeof this.w.googlefc?.showRevocationMessage === 'function' || this.gdprApplies === true;
  }

  async showPrivacyOptions(): Promise<boolean> {
    const fc = this.w.googlefc;
    if (typeof fc?.showRevocationMessage === 'function') {
      fc.showRevocationMessage();
      return true;
    }
    if (this.gdprApplies !== true) return false; // nada para rever (fora da GDPR ou CMP ausente)
    // O Google ainda não terminou de carregar: pede para abrir assim que a API ficar pronta.
    const g = (this.w.googlefc ??= {});
    (g.callbackQueue ??= []).push({ CONSENT_API_READY: () => g.showRevocationMessage?.() });
    return true;
  }

  subscribe(listener: ConsentListener): () => void {
    return this.listeners.add(listener);
  }

  /** Para de ouvir o CMP e cancela esperas. Para trocar de provider ou nos testes. */
  destroy(): void {
    this.destroyed = true;
    clearTimeout(this.pollTimer);
    const api = this.w.__tcfapi;
    if (this.attached && api && this.listenerId !== undefined) api('removeEventListener', 2, () => {}, this.listenerId);
  }

  private startPolling(): void {
    const started = Date.now();
    const tick = () => {
      if (this.destroyed || this.attached) return;
      if (typeof this.w.__tcfapi === 'function') return this.attach(this.w.__tcfapi);
      // Continua procurando por até 1 minuto: o script do Google pode chegar tarde.
      if (Date.now() - started < 60_000) this.pollTimer = setTimeout(tick, this.pollMs);
    };
    tick();
  }

  private attach(api: TcfApi): void {
    this.attached = true;
    api('addEventListener', 2, (data, success) => {
      if (!success || !data || this.destroyed) return;
      if (data.listenerId !== undefined) this.listenerId = data.listenerId;
      if (typeof data.gdprApplies === 'boolean') this.gdprApplies = data.gdprApplies;
      // "cmpuishown": o formulário está na tela; a escolha vem em "useractioncomplete".
      const next = data.eventStatus === 'cmpuishown' ? this.current : stateFromTcData(data);
      const changed = next !== this.current;
      this.current = next;
      if (changed) this.listeners.emit(next);
      else this.onFirstEvent?.();
    });
  }
}
