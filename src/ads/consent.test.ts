// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { allowsPersonalization, FakeConsentProvider, NoCmpConsentProvider, type ConsentState } from './consent.ts';
import { GoogleConsentProvider, stateFromTcData, type GoogleConsentWindow, type TcData } from './consent-google.ts';

const ACCEPT: TcData = { tcString: 'CPx', gdprApplies: true, purpose: { consents: { '1': true, '3': true, '4': true, '7': true } }, vendor: { consents: { '755': true } } };
const DECLINE: TcData = { tcString: 'CPy', gdprApplies: true, purpose: { consents: { '1': false, '3': false, '4': false } }, vendor: { consents: { '755': false } } };

describe('allowsPersonalization', () => {
  it('só "personalized" libera; desconhecido não', () => {
    const r = (['unknown', 'personalized', 'non-personalized'] as ConsentState[]).map(allowsPersonalization);
    expect(r).toEqual([false, true, false]);
  });
});

describe('NoCmpConsentProvider', () => {
  it('devolve sempre só não personalizado e não tem o que rever', async () => {
    const c = new NoCmpConsentProvider();
    expect(c.state()).toBe('non-personalized');
    expect(await c.init()).toBe('non-personalized');
    expect(await c.request()).toBe('non-personalized');
    expect(c.privacyOptionsAvailable()).toBe(false);
    expect(await c.showPrivacyOptions()).toBe(false);
    expect(c.state()).toBe('non-personalized');
  });
});

describe('FakeConsentProvider: recusar custa o mesmo que aceitar', () => {
  it.each([
    ['accept', 'personalized'],
    ['decline', 'non-personalized'],
  ] as const)('%s: 1 resposta, 1 mudança de estado, formulário fechado', async (choice, expected) => {
    const c = new FakeConsentProvider();
    const seen: ConsentState[] = [];
    c.subscribe((s) => seen.push(s));
    await c.init();
    expect(await c.request()).toBe('unknown');
    expect(c.formOpen).toBe(true);
    c.respond(choice);
    expect(c.state()).toBe(expected);
    expect(seen).toEqual([expected]);
    expect(c.responses).toBe(1);
    expect(c.formOpen).toBe(false);
    expect(c.calls).toEqual(['init', 'request']);
  });

  it('nas configurações: reabre e muda a escolha nos dois sentidos com 1 resposta cada', async () => {
    const c = new FakeConsentProvider('personalized');
    expect(await c.request()).toBe('personalized');
    expect(c.formOpen).toBe(false);
    expect(await c.showPrivacyOptions()).toBe(true);
    c.respond('decline');
    expect(c.state()).toBe('non-personalized');
    expect(await c.showPrivacyOptions()).toBe(true);
    c.respond('accept');
    expect(c.state()).toBe('personalized');
    expect(c.responses).toBe(2);
  });

  it('cancelar a assinatura para de avisar; sem o que rever, não abre', async () => {
    const c = new FakeConsentProvider();
    const fn = vi.fn();
    const off = c.subscribe(fn);
    off();
    c.set('personalized');
    expect(fn).not.toHaveBeenCalled();
    c.available = false;
    expect(c.privacyOptionsAvailable()).toBe(false);
    expect(await c.showPrivacyOptions()).toBe(false);
  });
});

describe('stateFromTcData', () => {
  it('personalizado só com propósitos 1, 3, 4 e o Google', () => {
    expect(stateFromTcData(ACCEPT)).toBe('personalized');
    expect(stateFromTcData(DECLINE)).toBe('non-personalized');
    for (const missing of ['1', '3', '4']) {
      const consents = { ...ACCEPT.purpose!.consents, [missing]: false };
      expect(stateFromTcData({ ...ACCEPT, purpose: { consents } })).toBe('non-personalized');
    }
    expect(stateFromTcData({ ...ACCEPT, vendor: { consents: {} } })).toBe('non-personalized');
  });
  it('fora da GDPR não há consentimento registrado: não personalizado; sem escolha ainda: desconhecido', () => {
    expect(stateFromTcData({ ...ACCEPT, gdprApplies: false })).toBe('non-personalized');
    expect(stateFromTcData({ gdprApplies: true })).toBe('unknown');
    expect(stateFromTcData({})).toBe('unknown');
  });
});

/** Janela com um CMP falso: guarda o ouvinte do TCF para o teste disparar eventos. */
function cmpWindow() {
  let listener: ((d: TcData, ok: boolean) => void) | undefined;
  const calls: string[] = [];
  const win = { __tcfapi: undefined, googlefc: undefined } as unknown as GoogleConsentWindow;
  const install = () => {
    win.__tcfapi = (cmd, _v, cb) => {
      calls.push(cmd);
      if (cmd === 'addEventListener') listener = cb;
    };
  };
  const emit = (d: TcData) => listener?.({ listenerId: 7, ...d }, true);
  return { win, install, emit, calls };
}

describe('GoogleConsentProvider (TCF)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('lê a escolha guardada no carregamento, sem abrir formulário', async () => {
    const { win, install, emit } = cmpWindow();
    install();
    const c = new GoogleConsentProvider({ win });
    const p = c.init();
    emit({ ...ACCEPT, eventStatus: 'tcloaded' });
    expect(await p).toBe('personalized');
    expect(c.state()).toBe('personalized');
  });

  it('espera o script do Google criar o __tcfapi', async () => {
    const { win, install, emit } = cmpWindow();
    const c = new GoogleConsentProvider({ win });
    const p = c.init();
    await vi.advanceTimersByTimeAsync(1000);
    install();
    await vi.advanceTimersByTimeAsync(200);
    emit({ ...DECLINE, eventStatus: 'tcloaded' });
    expect(await p).toBe('non-personalized');
  });

  it('CMP que nunca carrega: init termina no limite, estado desconhecido, nada trava', async () => {
    const { win } = cmpWindow();
    const c = new GoogleConsentProvider({ win, initTimeoutMs: 2000, requestTimeoutMs: 1000 });
    const p = c.init();
    await vi.advanceTimersByTimeAsync(2000);
    expect(await p).toBe('unknown');
    const req = c.request();
    await vi.advanceTimersByTimeAsync(1000);
    expect(await req).toBe('unknown');
    c.destroy();
  });

  it.each([
    ['aceitar', ACCEPT, 'personalized'],
    ['recusar', DECLINE, 'non-personalized'],
  ] as const)('primeira vez, %s: formulário (cmpuishown) e UMA resposta (useractioncomplete) decidem', async (_nome, data, expected) => {
    const { win, install, emit } = cmpWindow();
    install();
    const c = new GoogleConsentProvider({ win });
    const seen: ConsentState[] = [];
    c.subscribe((s) => seen.push(s));
    const init = c.init();
    emit({ gdprApplies: true, eventStatus: 'cmpuishown' });
    expect(await init).toBe('unknown');
    const req = c.request();
    emit({ ...data, eventStatus: 'useractioncomplete' });
    expect(await req).toBe(expected);
    expect(seen).toEqual([expected]);
  });

  it('request sem resposta termina no limite com o estado atual; resposta tardia ainda chega', async () => {
    const { win, install, emit } = cmpWindow();
    install();
    const c = new GoogleConsentProvider({ win, requestTimeoutMs: 1000 });
    const init = c.init();
    emit({ gdprApplies: true, eventStatus: 'cmpuishown' });
    await init;
    const req = c.request();
    await vi.advanceTimersByTimeAsync(1000);
    expect(await req).toBe('unknown');
    emit({ ...DECLINE, eventStatus: 'useractioncomplete' });
    expect(c.state()).toBe('non-personalized');
  });

  it('nas configurações: reabre pelo googlefc e a nova escolha chega por subscribe (aceitar -> recusar)', async () => {
    const { win, install, emit } = cmpWindow();
    install();
    const show = vi.fn();
    win.googlefc = { showRevocationMessage: show };
    const c = new GoogleConsentProvider({ win });
    const seen: ConsentState[] = [];
    c.subscribe((s) => seen.push(s));
    const init = c.init();
    emit({ ...ACCEPT, eventStatus: 'tcloaded' });
    await init;
    expect(c.privacyOptionsAvailable()).toBe(true);
    expect(await c.showPrivacyOptions()).toBe(true);
    expect(show).toHaveBeenCalledTimes(1);
    emit({ ...DECLINE, eventStatus: 'useractioncomplete' });
    expect(seen).toEqual(['personalized', 'non-personalized']);
  });

  it('googlefc ainda não pronto: entra na fila e abre quando o Google avisa', async () => {
    const { win, install, emit } = cmpWindow();
    install();
    const c = new GoogleConsentProvider({ win });
    const init = c.init();
    emit({ gdprApplies: true, eventStatus: 'cmpuishown' });
    await init;
    expect(await c.showPrivacyOptions()).toBe(true);
    const show = vi.fn();
    win.googlefc!.showRevocationMessage = show;
    (win.googlefc!.callbackQueue![0] as { CONSENT_API_READY: () => void }).CONSENT_API_READY();
    expect(show).toHaveBeenCalledTimes(1);
  });

  it('fora da GDPR: não personalizado e sem botão para rever', async () => {
    const { win, install, emit } = cmpWindow();
    install();
    const c = new GoogleConsentProvider({ win });
    const init = c.init();
    emit({ gdprApplies: false, eventStatus: 'tcloaded' });
    expect(await init).toBe('non-personalized');
    expect(c.privacyOptionsAvailable()).toBe(false);
    expect(await c.showPrivacyOptions()).toBe(false);
  });

  it('destroy remove o ouvinte do TCF', async () => {
    const { win, install, emit, calls } = cmpWindow();
    install();
    const c = new GoogleConsentProvider({ win });
    const init = c.init();
    emit({ ...DECLINE, eventStatus: 'tcloaded' });
    await init;
    c.destroy();
    expect(calls).toContain('removeEventListener');
  });
});
