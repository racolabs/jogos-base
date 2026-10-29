// @vitest-environment jsdom
/**
 * Contrato de anúncio (racolabs/jogos-base#55). Roda contra TODA implementação de `AdProvider` exportada por `./index.ts`:
 *
 * 1. Sem consentimento (ou recusado, desconhecido, CMP quebrado, público infantil, política padrão), todo pedido sai
 *    NÃO personalizado: banner, intersticial e premiado.
 * 2. A segmentação própria (nível, sessão, métricas, estado do jogador) só decide QUANTO anúncio aparece (AdsController e
 *    rules.ts), nunca QUAL: nada disso pode chegar à rede como parâmetro de targeting.
 *
 * As implementações são descobertas pelos exports de `./index.ts` (duck typing sobre a interface). Uma implementação nova
 * entra neste teste sozinha; se ela não tiver um harness em HARNESSES, o teste FALHA até alguém escrever o harness.
 * Não é para silenciar: o harness é a parte que prova que a rede recebe pedido não personalizado.
 * O contrato está documentado em README.md (seção "Contrato de anúncio").
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import * as api from './index.ts';
import {
  AdSenseProvider,
  AdsController,
  AD_DEFAULTS,
  DEFAULT_AD_POLICY,
  FakeAdProvider,
  FakeConsentProvider,
  NoAdsProvider,
  NoCmpConsentProvider,
  newPlayerAdState,
  type AdBreakConfig,
  type AdPolicy,
  type AdProvider,
  type ConsentProvider,
  type ConsentState,
} from './index.ts';

// ---------------------------------------------------------------------------------------------------------------------
// Descoberta
// ---------------------------------------------------------------------------------------------------------------------

const AD_PROVIDER_METHODS = ['init', 'preload', 'isReady', 'showInterstitial', 'showRewarded', 'showBanner', 'hideBanner'] as const;

type ProviderClass = new (...args: never[]) => AdProvider;

/** Toda classe exportada que tem a forma de `AdProvider`. */
function discoverProviders(): Record<string, ProviderClass> {
  const found: Record<string, ProviderClass> = {};
  for (const [name, value] of Object.entries(api as Record<string, unknown>)) {
    if (typeof value !== 'function') continue;
    const proto = (value as { prototype?: Record<string, unknown> }).prototype;
    if (proto && AD_PROVIDER_METHODS.every((m) => typeof proto[m] === 'function')) found[name] = value as ProviderClass;
  }
  return found;
}

// ---------------------------------------------------------------------------------------------------------------------
// Harness: como observar o que cada implementação manda para a rede
// ---------------------------------------------------------------------------------------------------------------------

type RequestKind = 'banner' | 'interstitial' | 'rewarded' | 'config';

interface AdRequest {
  kind: RequestKind;
  /** Verdadeiro se, no instante do pedido, a rede foi avisada de que pode personalizar. */
  personalized: boolean;
}

interface Scenario {
  label: string;
  policy: AdPolicy;
  consent?: ConsentProvider;
  /** Roda depois do init e antes dos pedidos (por exemplo, o jogador revoga o consentimento). */
  beforeShow?: () => void;
}

interface Outbound {
  /** Objetos entregues à fila do Google (adBreak/adConfig/push). */
  payloads: unknown[];
  /** Atributos de `script` e `ins` criados na página. */
  attributes: { tag: string; name: string; value: string }[];
}

interface Observation {
  requests: AdRequest[];
  /** Tudo que foi entregue à rede; o guard de targeting examina isto. */
  outbound: Outbound;
}

interface Harness {
  /** false: a implementação não fala com rede nenhuma (nunca há pedido a personalizar). */
  network: boolean;
  /** Cria a implementação, exercita init + banner + intersticial + premiado e devolve o que a rede recebeu. */
  run(s: Scenario): Promise<Observation>;
}

const tick = () => new Promise<void>((r) => setTimeout(r, 0));

type AdsQueue = unknown[] & { requestNonPersonalizedAds?: number };
const win = () => window as unknown as { adsbygoogle?: AdsQueue };

function resetPage() {
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  delete win().adsbygoogle;
}

/** Banner + intersticial + premiado, o mesmo roteiro para todas as implementações. */
async function exercise(ads: AdProvider, finish: { interstitial: () => void; rewarded: () => void } | null): Promise<void> {
  const slot = document.createElement('div');
  document.body.appendChild(slot);
  await ads.showBanner('home', slot);
  const i = ads.showInterstitial();
  await tick();
  finish?.interstitial();
  await i;
  const r = ads.showRewarded();
  await tick();
  finish?.rewarded();
  await r;
}

function outboundFromPage(payloads: unknown[]): Outbound {
  const attributes: Outbound['attributes'] = [];
  for (const el of Array.from(document.querySelectorAll('script, ins'))) {
    for (const a of Array.from(el.attributes)) attributes.push({ tag: el.tagName.toLowerCase(), name: a.name, value: a.value });
  }
  return { payloads, attributes };
}

/** AdSense (e variantes, para o auto-teste do contrato): observa a fila `adsbygoogle` e a flag requestNonPersonalizedAds. */
function adsenseHarness(Cls: new (o: ConstructorParameters<typeof AdSenseProvider>[0]) => AdProvider = AdSenseProvider): Harness {
  return {
    network: true,
    async run(s) {
      resetPage();
      const requests: AdRequest[] = [];
      const payloads: unknown[] = [];
      const queue = [] as unknown as AdsQueue;
      queue.push = (x: unknown) => {
        payloads.push(x);
        const type = (x as { type?: string } | null)?.type;
        const empty = typeof x === 'object' && x !== null && Object.keys(x).length === 0;
        const kind: RequestKind = type === 'next' ? 'interstitial' : type === 'reward' ? 'rewarded' : empty ? 'banner' : 'config';
        // Sem a flag em 1, a rede entende "pode personalizar".
        requests.push({ kind, personalized: queue.requestNonPersonalizedAds !== 1 });
        return payloads.length;
      };
      win().adsbygoogle = queue;
      const ads = new Cls({ client: 'ca-pub-1234567890', bannerSlots: { home: '1234567890' }, win: window as never, consent: s.consent });
      await ads.init(s.policy);
      await tick();
      s.beforeShow?.();
      // Só vale o que sai depois da mudança: pedidos feitos enquanto o consentimento ainda valia não contam.
      if (s.beforeShow) requests.length = 0;
      const configs = () => payloads.filter((x): x is AdBreakConfig => typeof x === 'object' && x !== null && 'type' in x);
      await exercise(ads, {
        interstitial: () => configs().find((c) => c.type === 'next')?.adBreakDone?.({ breakStatus: 'viewed' }),
        rewarded: () => configs().find((c) => c.type === 'reward')?.adBreakDone?.({ breakStatus: 'viewed' }),
      });
      return { requests, outbound: outboundFromPage(payloads) };
    },
  };
}

/** Implementações sem rede (nada a personalizar): provamos que continuam sem rede. */
function offlineHarness(make: () => AdProvider): Harness {
  return {
    network: false,
    async run(s) {
      resetPage();
      const ads = make();
      await ads.init(s.policy);
      s.beforeShow?.();
      await exercise(ads, null);
      const queue = win().adsbygoogle;
      // Se tocou na fila do Google ou criou script, não é mais "sem rede": vira um pedido sem como ser provado.
      const touched = (queue ? queue.length : 0) + document.querySelectorAll('script, ins').length;
      const requests: AdRequest[] = touched > 0 ? [{ kind: 'config', personalized: true }] : [];
      return { requests, outbound: outboundFromPage(queue ? [...queue] : []) };
    },
  };
}

/**
 * Um harness por implementação, pelo nome da classe exportada.
 * Implementação nova: o teste "toda implementação exportada tem harness" falha até ela entrar aqui.
 */
const HARNESSES: Record<string, Harness> = {
  AdSenseProvider: adsenseHarness(),
  NoAdsProvider: offlineHarness(() => new NoAdsProvider()),
  FakeAdProvider: offlineHarness(() => new FakeAdProvider()),
};

// ---------------------------------------------------------------------------------------------------------------------
// Critério 1: sem consentimento, nada personalizado
// ---------------------------------------------------------------------------------------------------------------------

const ADULT_GAME: AdPolicy = { nonPersonalized: false, childDirected: false };

/** CMP que quebra: nunca resolve a escolha. */
class BrokenConsent extends NoCmpConsentProvider {
  override state(): ConsentState {
    return 'unknown';
  }
  override async init(): Promise<ConsentState> {
    throw new Error('cmp fora do ar');
  }
}

/** Cenários em que NENHUM pedido pode sair personalizado. O jogo mais permissivo (ADULT_GAME) é o pior caso. */
function noConsentScenarios(): Scenario[] {
  const s = (label: string, policy: AdPolicy, consent?: ConsentProvider, beforeShow?: () => void): Scenario => ({ label, policy, consent, beforeShow });
  const revoked = new FakeConsentProvider('personalized');
  return [
    s('sem CMP configurado, política padrão', DEFAULT_AD_POLICY),
    s('sem CMP configurado, jogo adulto', ADULT_GAME),
    s('NoCmp, jogo adulto', ADULT_GAME, new NoCmpConsentProvider()),
    s('consentimento desconhecido, jogo adulto', ADULT_GAME, new FakeConsentProvider('unknown')),
    s('consentimento recusado, jogo adulto', ADULT_GAME, new FakeConsentProvider('non-personalized')),
    s('CMP quebrado, jogo adulto', ADULT_GAME, new BrokenConsent()),
    s('consentimento dado mas política padrão', DEFAULT_AD_POLICY, new FakeConsentProvider('personalized')),
    s('consentimento dado mas público infantil', { nonPersonalized: false, childDirected: true }, new FakeConsentProvider('personalized')),
    s('consentimento revogado antes dos pedidos', ADULT_GAME, revoked, () => revoked.set('non-personalized')),
  ];
}

/** Devolve as violações do critério 1 (lista vazia = cumpre). Usada nos testes e no auto-teste com implementação defeituosa. */
async function personalizationViolations(h: Harness, scenarios: Scenario[]): Promise<string[]> {
  const out: string[] = [];
  for (const s of scenarios) {
    const { requests } = await h.run(s);
    if (!h.network) {
      if (requests.length > 0) out.push(`${s.label}: declara não ter rede mas fez pedidos`);
      continue;
    }
    for (const kind of ['banner', 'interstitial', 'rewarded'] as const) {
      if (!requests.some((r) => r.kind === kind)) out.push(`${s.label}: o harness não viu nenhum pedido de ${kind} (teste cego)`);
    }
    for (const r of requests) if (r.personalized) out.push(`${s.label}: pedido de ${r.kind} saiu personalizado`);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------------
// Critério 2: segmentação própria nunca vira targeting
// ---------------------------------------------------------------------------------------------------------------------

/** Termos de segmentação (e os nomes de PlayerAdState, lidos em tempo de execução) que não podem ir à rede. */
const SEGMENTATION_TERMS = /level|n[ií]vel|sess|metric|score|streak|segment|payer|trend|gamesplayed|quit|rewardedtoday|interstitialstoday|firstseen|targeting|keyword|ppid|userid|custom_?params|kvs?\b|cohort|retention|ltv/i;
const playerStateKeys = (): string[] => Object.keys(newPlayerAdState(0));

/**
 * Chaves que a rede pode receber hoje. Chave nova ali: se for dado do jogador/segmentação, é violação do contrato;
 * se for técnica (formato, som, callback), basta acrescentar aqui com uma linha explicando.
 */
const ALLOWED_PAYLOAD_KEYS = new Set(['type', 'name', 'beforeAd', 'afterAd', 'beforeReward', 'adDismissed', 'adViewed', 'adBreakDone', 'preloadAdBreaks', 'sound', 'onReady']);
const ALLOWED_ATTRIBUTES: Record<string, Set<string>> = {
  script: new Set(['src', 'async', 'crossorigin', 'data-adbreak-test', 'data-ad-frequency-hint']),
  ins: new Set(['class', 'style', 'data-ad-client', 'data-ad-slot', 'data-ad-format', 'data-full-width-responsive', 'data-adtest']),
};
const ALLOWED_SCRIPT_QUERY = new Set(['client']);

function targetingLeaks(o: Outbound): string[] {
  const out: string[] = [];
  const stateKeys = playerStateKeys().map((k) => k.toLowerCase());
  const bad = (text: string) => SEGMENTATION_TERMS.test(text) || stateKeys.includes(text.toLowerCase());
  for (const p of o.payloads) {
    if (typeof p !== 'object' || p === null) continue;
    for (const [k, v] of Object.entries(p)) {
      if (!ALLOWED_PAYLOAD_KEYS.has(k)) out.push(`parâmetro novo para a rede: ${k}`);
      if (bad(k)) out.push(`chave de segmentação na rede: ${k}`);
      if (typeof v === 'string' && bad(v)) out.push(`valor de segmentação na rede: ${k}=${v}`);
    }
  }
  for (const a of o.attributes) {
    if (!ALLOWED_ATTRIBUTES[a.tag]?.has(a.name)) out.push(`atributo novo para a rede: <${a.tag} ${a.name}>`);
    if (bad(a.name) || (a.name !== 'src' && bad(a.value))) out.push(`dado de segmentação em <${a.tag} ${a.name}="${a.value}">`);
    if (a.name === 'src') {
      for (const key of new URL(a.value).searchParams.keys()) if (!ALLOWED_SCRIPT_QUERY.has(key)) out.push(`parâmetro novo na URL do script: ${key}`);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------------
// Testes
// ---------------------------------------------------------------------------------------------------------------------

afterEach(resetPage);

describe('contrato de anúncio: descoberta', () => {
  const providers = discoverProviders();

  it('acha as implementações exportadas (não ficou cego)', () => {
    expect(Object.keys(providers)).toEqual(expect.arrayContaining(['AdSenseProvider', 'NoAdsProvider', 'FakeAdProvider']));
  });

  it('toda implementação exportada tem harness (implementação nova precisa entrar em HARNESSES)', () => {
    const semHarness = Object.keys(providers).filter((n) => !(n in HARNESSES));
    expect(semHarness, `escreva o harness em contract.test.ts para: ${semHarness.join(', ')}`).toEqual([]);
  });

  it('toda classe "implements AdProvider" em src/ads é exportada pelo índice (senão escaparia do contrato)', () => {
    const dir = dirname(fileURLToPath(import.meta.url));
    const declared: string[] = [];
    for (const f of readdirSync(dir)) {
      if (!f.endsWith('.ts') || f.endsWith('.test.ts')) continue;
      for (const m of readFileSync(join(dir, f), 'utf8').matchAll(/class\s+(\w+)[^{]*\bimplements\b[^{]*\bAdProvider\b/g)) declared.push(m[1]!);
    }
    expect(declared.length).toBeGreaterThan(0);
    expect(declared.filter((n) => !(n in providers))).toEqual([]);
  });
});

describe('contrato de anúncio: sem consentimento, nada personalizado', () => {
  for (const name of Object.keys(discoverProviders())) {
    it(`${name}: banner, intersticial e premiado saem não personalizados`, async () => {
      const h = HARNESSES[name];
      expect(h, `sem harness para ${name}`).toBeDefined();
      expect(await personalizationViolations(h!, noConsentScenarios())).toEqual([]);
    });
  }

  it('o teste enxerga personalização (controle positivo): AdSense com consentimento explícito e jogo adulto pede personalizado', async () => {
    const consent = new FakeConsentProvider('personalized');
    const { requests } = await HARNESSES.AdSenseProvider!.run({ label: 'controle', policy: ADULT_GAME, consent });
    const shows = requests.filter((r) => r.kind !== 'config');
    expect(shows.map((r) => r.kind).sort()).toEqual(['banner', 'interstitial', 'rewarded']);
    expect(shows.every((r) => r.personalized)).toBe(true);
  });

  it('reprova implementação que pede personalizado sem consentimento (auto-teste do contrato)', async () => {
    // Defeituosa de propósito: liga a personalização antes de cada pedido, ignorando o consentimento.
    class Leaky extends AdSenseProvider {
      private lie() {
        win().adsbygoogle!.requestNonPersonalizedAds = 0;
      }
      override async showInterstitial() {
        await this.init();
        this.lie();
        return super.showInterstitial();
      }
      override async showRewarded() {
        await this.init();
        this.lie();
        return super.showRewarded();
      }
      override async showBanner(p: Parameters<AdSenseProvider['showBanner']>[0], slot?: HTMLElement) {
        await this.init();
        this.lie();
        return super.showBanner(p, slot);
      }
    }
    const violations = (await personalizationViolations(adsenseHarness(Leaky), noConsentScenarios())).join('\n');
    for (const kind of ['banner', 'interstitial', 'rewarded']) expect(violations).toContain(`pedido de ${kind} saiu personalizado`);
  });

  it('reprova implementação que se diz sem rede mas fala com a rede', async () => {
    class Sneaky extends NoAdsProvider {
      override async showBanner(): Promise<boolean> {
        (win().adsbygoogle ??= [] as unknown as AdsQueue).push({});
        return false;
      }
    }
    expect((await personalizationViolations(offlineHarness(() => new Sneaky()), noConsentScenarios())).length).toBeGreaterThan(0);
  });
});

describe('contrato de anúncio: a segmentação própria só decide quanto, nunca qual', () => {
  for (const name of Object.keys(discoverProviders())) {
    it(`${name}: nada de nível, sessão, métricas ou estado do jogador chega à rede`, async () => {
      const h = HARNESSES[name]!;
      const consented: Scenario = { label: 'consentido', policy: ADULT_GAME, consent: new FakeConsentProvider('personalized') };
      for (const s of [...noConsentScenarios(), consented]) {
        const { outbound } = await h.run(s);
        expect(targetingLeaks(outbound), s.label).toEqual([]);
      }
    });
  }

  it('reprova dado de segmentação como parâmetro para a rede (auto-teste do guard)', () => {
    const leak = (extra: object): Outbound => ({ payloads: [{ type: 'next', name: 'entre-partidas', ...extra }], attributes: [] });
    expect(targetingLeaks(leak({}))).toEqual([]);
    expect(targetingLeaks(leak({ level: 7 })).length).toBeGreaterThan(0);
    expect(targetingLeaks(leak({ sessionTrendFalling: true })).length).toBeGreaterThan(0);
    expect(targetingLeaks(leak({ name: 'nivel-12' })).length).toBeGreaterThan(0);
    expect(targetingLeaks(leak({ customParams: { gamesPlayed: 40 } })).length).toBeGreaterThan(0);
    const attr = (name: string, value: string): Outbound => ({ payloads: [], attributes: [{ tag: 'ins', name, value }] });
    expect(targetingLeaks(attr('data-ad-slot', '1234567890'))).toEqual([]);
    expect(targetingLeaks(attr('data-level', '7')).length).toBeGreaterThan(0);
    expect(targetingLeaks(attr('data-ad-slot', 'session-9')).length).toBeGreaterThan(0);
    const url = (q: string): Outbound => ({ payloads: [], attributes: [{ tag: 'script', name: 'src', value: `https://x.test/a.js?${q}` }] });
    expect(targetingLeaks(url('client=ca-pub-1'))).toEqual([]);
    expect(targetingLeaks(url('client=ca-pub-1&level=3')).length).toBeGreaterThan(0);
  });

  it('o AdsController só entrega ao provider formato/posição, nunca o estado do jogador', async () => {
    const calls: { method: string; args: unknown[] }[] = [];
    const inner = new FakeAdProvider();
    const spy = new Proxy(inner, {
      get(target, prop, recv) {
        const v = Reflect.get(target, prop, recv);
        if (typeof v !== 'function' || typeof prop !== 'string') return v;
        return (...args: unknown[]) => {
          calls.push({ method: prop, args });
          return (v as (...a: unknown[]) => unknown).apply(target, args);
        };
      },
    }) as AdProvider;
    const now = new Date(2026, 10, 5, 12).getTime();
    // Estado com valores-isca bem marcados nos campos de segmentação.
    const state = { ...newPlayerAdState(now - 3 * 86_400_000), day: '2026-11-05', gamesPlayed: 4242, lastGameSec: 3131, quickLossStreak: 2, rewardedToday: 3, sessionTrendFalling: true, quitAfterAdCount7d: 2 };
    const ctl = new AdsController(spy, AD_DEFAULTS, state, { now: () => now });
    ctl.startSession();
    ctl.gameEnded({ durationSec: 777, quickLoss: false });
    await ctl.betweenGames();
    await ctl.watchRewarded();
    expect(calls.map((c) => c.method)).toEqual(expect.arrayContaining(['showInterstitial', 'showRewarded', 'preload']));
    const fmt = (a: unknown) => a === 'interstitial' || a === 'rewarded';
    const place = (a: unknown) => a === 'home' || a === 'end';
    const ALLOWED_ARGS: Record<string, (a: unknown[]) => boolean> = {
      init: (a) => a.length === 1, // só a política de privacidade
      preload: (a) => a.length === 1 && fmt(a[0]),
      isReady: (a) => a.length === 1 && fmt(a[0]),
      showInterstitial: (a) => a.length === 0,
      showRewarded: (a) => a.length === 0,
      showBanner: (a) => a.length >= 1 && place(a[0]),
      hideBanner: (a) => a.length === 1 && place(a[0]),
    };
    for (const c of calls) {
      expect(ALLOWED_ARGS[c.method]?.(c.args), `provider.${c.method}(${JSON.stringify(c.args)}) leva dado além de formato/posição`).toBe(true);
    }
    const sent = JSON.stringify(calls);
    for (const isca of ['4242', '3131', '777']) expect(sent).not.toContain(isca);
  });

  it('código das implementações não lê estado do jogador nem importa métricas/missões/armazenamento/regras', () => {
    const dir = dirname(fileURLToPath(import.meta.url));
    // controller.ts e rules.ts são o lugar da frequência (quanto); o resto fala com a rede e não pode saber nada do jogador.
    const FREQUENCY = new Set(['controller.ts', 'rules.ts', 'index.ts', 'guard.ts']);
    const keys = playerStateKeys().filter((k) => k.length > 3);
    const stripped = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
    const problems: string[] = [];
    for (const f of readdirSync(dir)) {
      if (!f.endsWith('.ts') || f.endsWith('.test.ts') || FREQUENCY.has(f)) continue;
      const code = stripped(readFileSync(join(dir, f), 'utf8'));
      for (const m of code.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
        if (/\/(rules|controller)(\.ts)?$|\.\.\/(metrics|missions|storage|daily)\b/.test(m[1]!)) problems.push(`${f} importa ${m[1]}`);
      }
      for (const k of keys) if (new RegExp(`\\b${k}\\b`).test(code)) problems.push(`${f} usa o campo de segmentação ${k}`);
    }
    expect(problems).toEqual([]);
  });
});
