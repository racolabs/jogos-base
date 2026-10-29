/**
 * Consentimento de anúncio atrás de uma interface, como `AdProvider`.
 * O jogo (e o AdSenseProvider) falam só com `ConsentProvider`; quem mostra o formulário certificado
 * é a implementação: CMP do Google na web (consent-google.ts) e UMP no app (consent-app.ts, ainda sem implementação).
 *
 * Regras (LGPD, ECA Digital, GDPR):
 * - Na dúvida, não personalizado. `unknown` conta como não personalizado.
 * - Recusar é tão fácil quanto aceitar: a mesma tela, o mesmo número de toques, o mesmo peso. O jogo nunca é bloqueado por causa disso.
 * - A escolha pode ser mudada depois, nas configurações (`showPrivacyOptions`).
 */

/**
 * - unknown: ainda não houve resposta (ou não há como saber).
 * - personalized: o jogador consentiu anúncio personalizado.
 * - non-personalized: recusou, ou não há consentimento. Só anúncio não personalizado.
 */
export type ConsentState = 'unknown' | 'personalized' | 'non-personalized';

export type ConsentListener = (state: ConsentState) => void;

export interface ConsentProvider {
  readonly id: string;
  /** Estado atual, sem efeito colateral. */
  state(): ConsentState;
  /** Prepara o CMP e lê a escolha já guardada, sem abrir formulário. Nunca trava: tem limite de tempo. */
  init(): Promise<ConsentState>;
  /**
   * Garante que o jogador viu o formulário quando a lei pede (primeira vez ou escolha vencida).
   * Resolve com o estado depois da resposta, ou o estado atual se o tempo acabar. O jogo não deve esperar isto para jogar.
   */
  request(): Promise<ConsentState>;
  /** Há uma escolha para o jogador rever (o botão "Escolhas de privacidade" das configurações só aparece então). */
  privacyOptionsAvailable(): boolean;
  /** Reabre o formulário nas configurações. false se não foi possível abrir. A resposta chega por `subscribe`. */
  showPrivacyOptions(): Promise<boolean>;
  /** Avisa a cada mudança de estado. Devolve a função que cancela. */
  subscribe(listener: ConsentListener): () => void;
}

/** Só `personalized` libera personalização; `unknown` e `non-personalized` não. */
export const allowsPersonalization = (state: ConsentState): boolean => state === 'personalized';

/** Lista de ouvintes compartilhada pelas implementações. */
export class ConsentListeners {
  private readonly set = new Set<ConsentListener>();
  add(listener: ConsentListener): () => void {
    this.set.add(listener);
    return () => void this.set.delete(listener);
  }
  clear(): void {
    this.set.clear();
  }
  emit(state: ConsentState): void {
    for (const l of [...this.set]) {
      try {
        l(state);
      } catch {
        // Um ouvinte com defeito não pode derrubar os outros nem o jogo.
      }
    }
  }
}

/** "Sem CMP": desenvolvimento, plataformas sem formulário e quem não configurou nada. Sempre só não personalizado. */
export class NoCmpConsentProvider implements ConsentProvider {
  readonly id = 'none';
  state(): ConsentState {
    return 'non-personalized';
  }
  async init(): Promise<ConsentState> {
    return 'non-personalized';
  }
  async request(): Promise<ConsentState> {
    return 'non-personalized';
  }
  privacyOptionsAvailable(): boolean {
    return false;
  }
  async showPrivacyOptions(): Promise<boolean> {
    return false;
  }
  subscribe(_listener: ConsentListener): () => void {
    return () => {};
  }
}

export type FakeConsentCall = 'init' | 'request' | 'showPrivacyOptions';

/**
 * Falso para testes dos jogos. O formulário tem um único passo: `respond('accept' | 'decline')`.
 * Aceitar e recusar custam o mesmo (1 resposta); `responses` conta, para o teste provar.
 */
export class FakeConsentProvider implements ConsentProvider {
  readonly id = 'fake';
  readonly calls: FakeConsentCall[] = [];
  /** Quantas respostas o jogador deu ao formulário. */
  responses = 0;
  /** Formulário aberto esperando resposta. */
  formOpen = false;
  /** Se false, `privacyOptionsAvailable()` e `showPrivacyOptions()` dizem que não há o que rever. */
  available = true;
  private current: ConsentState;
  private readonly listeners = new ConsentListeners();

  constructor(initial: ConsentState = 'unknown') {
    this.current = initial;
  }

  state(): ConsentState {
    return this.current;
  }
  async init(): Promise<ConsentState> {
    this.calls.push('init');
    return this.current;
  }
  async request(): Promise<ConsentState> {
    this.calls.push('request');
    if (this.current === 'unknown') this.formOpen = true;
    return this.current;
  }
  privacyOptionsAvailable(): boolean {
    return this.available;
  }
  async showPrivacyOptions(): Promise<boolean> {
    this.calls.push('showPrivacyOptions');
    if (!this.available) return false;
    this.formOpen = true;
    return true;
  }
  subscribe(listener: ConsentListener): () => void {
    return this.listeners.add(listener);
  }

  /** O jogador responde ao formulário aberto. Sem formulário aberto, não faz nada. */
  respond(choice: 'accept' | 'decline'): void {
    if (!this.formOpen) return;
    this.formOpen = false;
    this.responses += 1;
    this.set(choice === 'accept' ? 'personalized' : 'non-personalized');
  }

  /** O CMP muda o estado por conta própria (por exemplo, escolha lida do armazenamento). */
  set(state: ConsentState): void {
    if (state === this.current) return;
    this.current = state;
    this.listeners.emit(state);
  }
}
