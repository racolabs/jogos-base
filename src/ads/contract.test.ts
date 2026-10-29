// @vitest-environment jsdom
/**
 * Contrato de anúncio (racolabs/jogos-base#55). Roda contra TODA implementação de `AdProvider` exportada por `./index.ts`:
 *
 * 1. Sem consentimento (ou recusado, desconhecido, CMP quebrado, público infantil, política padrão), todo pedido sai
 *    NÃO personalizado: banner, intersticial e premiado.
 * 2. A segmentação própria (nível, sessão, métricas, estado do jogador) só decide QUANTO anúncio aparece (AdsController e
 *    rules.ts), nunca QUAL: nada disso pode chegar à rede como parâmetro de targeting.
 *
 * Descoberta (não depende de lembrar): por forma, nos exports de `./index.ts` (classe, classe com métodos em campos de
 * seta, objeto, fábrica sem argumentos) e por leitura recursiva dos fontes de src/ads (classe `implements AdProvider`,
 * fábrica que declara devolver um provider, em qualquer subpasta). Quem não tem harness em HARNESSES reprova o teste.
 * O contrato está documentado em README.md (seção "Contrato de anúncio").
 */
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, sep } from 'node:path';
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
  type PlayerAdState,
} from './index.ts';

const ADS_DIR = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------------------------------------------------
// Descoberta
// ---------------------------------------------------------------------------------------------------------------------

const AD_PROVIDER_METHODS = ['init', 'preload', 'isReady', 'showInterstitial', 'showRewarded', 'showBanner', 'hideBanner'] as const;

const hasMethods = (o: unknown): boolean =>
  (typeof o === 'object' || typeof o === 'function') && o !== null && AD_PROVIDER_METHODS.every((m) => typeof (o as Record<string, unknown>)[m] === 'function');
const isClass = (f: unknown): boolean => typeof f === 'function' && /^class[\s{]/.test(Function.prototype.toString.call(f));

/**
 * Exports que SÃO ou PRODUZEM, sem argumentos, algo com os métodos de `AdProvider`: classe (métodos no prototype ou em
 * campos de seta), objeto, fábrica. O que não der para instanciar sem argumentos não aparece aqui; a leitura dos fontes
 * (`declaredInSources`) cobre esse caso exigindo harness.
 */
function discoverFromExports(exportsObj: Record<string, unknown>): string[] {
  const found: string[] = [];
  for (const [name, v] of Object.entries(exportsObj)) {
    if (hasMethods(v) || (typeof v === 'function' && hasMethods(v.prototype))) {
      found.push(name);
      continue;
    }
    if (typeof v !== 'function') continue;
    try {
      const made = isClass(v) ? new (v as new () => unknown)() : (v as () => unknown)();
      if (hasMethods(made)) found.push(name);
    } catch {
      // Precisa de argumentos: fica por conta da leitura dos fontes.
    }
  }
  return found;
}

interface SrcFile {
  /** Caminho relativo a src/ads, com "/". */
  path: string;
  code: string;
}

/** Todos os fontes (não de teste) de src/ads, em qualquer subpasta. */
function readAdSources(dir: string): SrcFile[] {
  return (readdirSync(dir, { recursive: true }) as string[])
    .map((p) => p.split(sep).join('/'))
    .filter((p) => /\.tsx?$/.test(p) && !/\.test\.tsx?$/.test(p) && !p.endsWith('.d.ts') && !p.split('/').includes('node_modules'))
    .map((path) => ({ path, code: readFileSync(join(dir, path), 'utf8') }));
}

const stripComments = (src: string): string => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

interface Declared {
  classes: string[];
  /** Fábricas exportadas cujo tipo de retorno declarado menciona um provider. */
  factories: { name: string; returns: string }[];
}

/** O que os fontes declaram ser provider: `class X implements AdProvider` e funções que devolvem `AdProvider`/essas classes. */
function declaredInSources(files: SrcFile[]): Declared {
  const classes: string[] = [];
  for (const f of files) {
    for (const m of stripComments(f.code).matchAll(/\bclass\s+(\w+)[^{]*\bimplements\b[^{]*\bAdProvider\b/g)) classes.push(m[1]!);
  }
  const mentions = (ret: string) => /\bAdProvider\b/.test(ret) || classes.some((c) => new RegExp(`\\b${c}\\b`).test(ret));
  const factories: Declared['factories'] = [];
  for (const f of files) {
    const code = stripComments(f.code);
    const fn = /\bexport\s+(?:async\s+)?function\s+(\w+)\s*(?:<[^>]*>)?\s*\([^)]*\)\s*:\s*([^{;=]+?)\s*\{/g;
    const arrow = /\bexport\s+const\s+(\w+)\s*(?::[^=]+)?=\s*(?:async\s*)?\([^)]*\)\s*:\s*([^=]+?)\s*=>/g;
    for (const re of [fn, arrow]) for (const m of code.matchAll(re)) if (mentions(m[2]!)) factories.push({ name: m[1]!, returns: m[2]! });
  }
  return { classes, factories };
}

/**
 * Tudo que o contrato exige e não está atendido (lista vazia = ok):
 * - provider (por forma ou declarado nos fontes, em qualquer subpasta) precisa ser exportado pelo índice;
 * - e ter harness. Fábrica que só devolve classes já com harness (ex.: adSenseFromEnv) dispensa o seu.
 */
function coverageProblems(exportsObj: Record<string, unknown>, files: SrcFile[], harnessNames: string[]): string[] {
  const out: string[] = [];
  const exported = new Set(Object.keys(exportsObj));
  const has = new Set(harnessNames);
  const byShape = discoverFromExports(exportsObj);
  const declared = declaredInSources(files);
  for (const c of declared.classes) if (!exported.has(c)) out.push(`${c} implementa AdProvider mas não é exportada por index.ts (escaparia do contrato)`);
  for (const f of declared.factories) if (!exported.has(f.name)) out.push(`${f.name}() devolve um provider mas não é exportada por index.ts`);
  const covered = (ret: string) => {
    const tokens = ret.replace(/Promise\s*<|>/g, ' ').split(/[|\s]+/).filter((t) => t && t !== 'null' && t !== 'undefined');
    return tokens.length > 0 && tokens.every((t) => declared.classes.includes(t) && has.has(t));
  };
  const needs = new Set<string>([...byShape, ...declared.classes]);
  for (const f of declared.factories) if (!covered(f.returns)) needs.add(f.name);
  for (const n of needs) if (!has.has(n)) out.push(`${n} é um AdProvider sem harness: escreva em HARNESSES (contract.test.ts)`);
  return out;
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

/** Faz a "rede" terminar o anúncio em andamento. null: implementação sem rede. */
interface Finish {
  interstitial: () => void;
  rewarded: () => void;
}

interface RunOptions {
  /** Embrulha o provider (espião) antes do init. */
  wrap?: (ads: AdProvider) => AdProvider;
  /** Roteiro no lugar do padrão (por exemplo, guiado pelo AdsController). */
  drive?: (ads: AdProvider, finish: Finish | null) => Promise<void>;
}

interface Harness {
  /** false: a implementação não fala com rede nenhuma (nunca há pedido a personalizar). */
  network: boolean;
  /** Cria a implementação, exercita init + banner + intersticial + premiado e devolve o que a rede recebeu. */
  run(s: Scenario, o?: RunOptions): Promise<Observation>;
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
async function exercise(ads: AdProvider, finish: Finish | null): Promise<void> {
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
    async run(s, o = {}) {
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
      const ads = (o.wrap ?? ((a) => a))(new Cls({ client: 'ca-pub-1234567890', bannerSlots: { home: '1234567890' }, win: window as never, consent: s.consent }));
      await ads.init(s.policy);
      await tick();
      s.beforeShow?.();
      // Só vale o que sai depois da mudança: pedidos feitos enquanto o consentimento ainda valia não contam.
      if (s.beforeShow) requests.length = 0;
      // A rede avisa que há anúncio pronto (o AdsController só pede quando isReady).
      payloads.find((x): x is { onReady: () => void } => typeof x === 'object' && x !== null && 'onReady' in x)?.onReady();
      const configs = () => payloads.filter((x): x is AdBreakConfig => typeof x === 'object' && x !== null && 'type' in x);
      await (o.drive ?? exercise)(ads, {
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
    async run(s, o = {}) {
      resetPage();
      const ads = (o.wrap ?? ((a) => a))(make());
      await ads.init(s.policy);
      s.beforeShow?.();
      await (o.drive ?? exercise)(ads, null);
      const queue = win().adsbygoogle;
      // Se tocou na fila do Google ou criou script, não é mais "sem rede": vira um pedido sem como ser provado.
      const touched = (queue ? queue.length : 0) + document.querySelectorAll('script, ins').length;
      const requests: AdRequest[] = touched > 0 ? [{ kind: 'config', personalized: true }] : [];
      return { requests, outbound: outboundFromPage(queue ? [...queue] : []) };
    },
  };
}

/**
 * Um harness por implementação, pelo nome do export em index.ts.
 * Implementação nova: o teste "toda implementação tem harness" falha até ela entrar aqui.
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

/** Acoplamento proibido nos fontes das implementações (tudo menos o lugar da frequência: controller.ts, rules.ts, index.ts, guard.ts). */
const FREQUENCY_FILES = new Set(['controller.ts', 'rules.ts', 'index.ts', 'guard.ts']);
const FORBIDDEN_MODULE = /(?:^|\/)(?:rules|controller)(?:\.[tj]s)?$|(?:^|\/)(?:metrics|missions|storage|daily)(?:\/|$)/;
const STORAGE_GLOBALS = /\b(?:localStorage|sessionStorage|indexedDB)\b/;

function sourceCouplings(files: SrcFile[]): string[] {
  const keys = playerStateKeys().filter((k) => k.length > 3);
  const problems: string[] = [];
  for (const f of files) {
    if (FREQUENCY_FILES.has(f.path)) continue;
    const code = stripComments(f.code);
    // from '...', import '...', import('...'), require('...'): estático, dinâmico e CommonJS.
    for (const m of code.matchAll(/(?:\bfrom|\bimport|\brequire)\s*\(?\s*(['"`])([^'"`\n]+)\1/g)) {
      if (FORBIDDEN_MODULE.test(m[2]!)) problems.push(`${f.path} importa ${m[2]}`);
    }
    if (/\b(?:import|require)\s*\(\s*(?!['"`])/.test(code)) problems.push(`${f.path} usa import()/require() com caminho que não é literal (não dá para provar que não puxa métricas)`);
    if (STORAGE_GLOBALS.test(code)) problems.push(`${f.path} lê o armazenamento do aparelho (localStorage/sessionStorage/indexedDB)`);
    for (const k of keys) if (new RegExp(`\\b${k}\\b`).test(code)) problems.push(`${f.path} usa o campo de segmentação ${k}`);
  }
  return problems;
}

/** Isca: valores marcados no estado do jogador. Se qualquer um aparecer no que vai para a rede, houve vazamento. */
const CANARIES = ['4242', '3131', '7771', '31337', 'sessao-isca-8731', 'metrica-isca-5150'];
const CANARY_EXTRAS = { level: 31337, sessionId: 'sessao-isca-8731', metrics: 'metrica-isca-5150' };
const NOW = new Date(2026, 10, 5, 12).getTime();

function populatedPlayer(): PlayerAdState {
  // Campos reais de segmentação (PlayerAdState) mais nível/sessão/métricas que nem existem no tipo: nada pode passar daqui.
  return { ...newPlayerAdState(NOW - 3 * 86_400_000), day: '2026-11-05', gamesPlayed: 4242, lastGameSec: 3131, quickLossStreak: 2, rewardedToday: 3, sessionTrendFalling: true, quitAfterAdCount7d: 2, ...CANARY_EXTRAS } as PlayerAdState;
}

interface Call {
  method: string;
  args: unknown[];
}

function spyOn(ads: AdProvider, calls: Call[]): AdProvider {
  return new Proxy(ads, {
    get(target, prop, recv) {
      const v = Reflect.get(target, prop, recv);
      if (typeof v !== 'function' || typeof prop !== 'string') return v;
      return (...args: unknown[]) => {
        calls.push({ method: prop, args });
        return (v as (...a: unknown[]) => unknown).apply(target, args);
      };
    },
  });
}

/** O jogo jogando de verdade: AdsController com o estado preenchido, depois o banner. */
const driveWithPlayer =
  (state: PlayerAdState) =>
  async (ads: AdProvider, finish: Finish | null): Promise<void> => {
    const ctl = new AdsController(ads, AD_DEFAULTS, state, { now: () => NOW });
    ctl.startSession();
    ctl.gameEnded({ durationSec: 7771, quickLoss: false });
    const i = ctl.betweenGames();
    await tick();
    finish?.interstitial();
    await i;
    const r = ctl.watchRewarded();
    await tick();
    finish?.rewarded();
    await r;
    const slot = document.createElement('div');
    document.body.appendChild(slot);
    await ads.showBanner('home', slot);
  };

const fmt = (a: unknown) => a === 'interstitial' || a === 'rewarded';
const place = (a: unknown) => a === 'home' || a === 'end';
/** Argumentos que um provider pode receber do jogo/controller: só política, formato e posição. */
const ALLOWED_ARGS: Record<string, (a: unknown[]) => boolean> = {
  init: (a) => a.length === 1,
  preload: (a) => a.length === 1 && fmt(a[0]),
  isReady: (a) => a.length === 1 && fmt(a[0]),
  showInterstitial: (a) => a.length === 0,
  showRewarded: (a) => a.length === 0,
  showBanner: (a) => a.length >= 1 && place(a[0]),
  hideBanner: (a) => a.length === 1 && place(a[0]),
};

/**
 * Critério 2 ponta a ponta: joga com estado de jogador preenchido (nível, sessão, métricas), com e sem consentimento, e confere
 * (a) o argumento de init(policy), (b) os argumentos de todas as chamadas ao provider e (c) tudo que vai para a rede.
 * Numa segunda rodada a política chega "suja" com os mesmos dados: o provider tem de ignorá-los, não repassá-los.
 */
async function segmentationViolations(h: Harness): Promise<string[]> {
  const out: string[] = [];
  for (const consent of [undefined, 'personalized'] as const) {
    for (const dirty of [false, true]) {
      const label = `${consent ? 'com consentimento' : 'sem consentimento'}, política ${dirty ? 'suja' : 'limpa'}`;
      const calls: Call[] = [];
      const policy = (dirty ? { ...ADULT_GAME, ...CANARY_EXTRAS } : ADULT_GAME) as AdPolicy;
      const { outbound } = await h.run(
        { label, policy, consent: consent && new FakeConsentProvider(consent) },
        { wrap: (ads) => spyOn(ads, calls), drive: driveWithPlayer(populatedPlayer()) },
      );
      for (const l of targetingLeaks(outbound)) out.push(`${label}: ${l}`);
      for (const c of calls) {
        if (!ALLOWED_ARGS[c.method]?.(c.args)) out.push(`${label}: provider.${c.method}(${JSON.stringify(c.args)}) leva dado além de política/formato/posição`);
      }
      if (!dirty) {
        const initArg = calls.find((c) => c.method === 'init')?.args[0];
        const keys = initArg && typeof initArg === 'object' ? Object.keys(initArg).sort().join(',') : String(initArg);
        if (keys !== 'childDirected,nonPersonalized') out.push(`${label}: init(policy) recebeu ${keys} em vez de só a política de privacidade`);
      }
      // O argumento sujo de init é de propósito; as demais chamadas e a rede não podem ter nenhuma isca.
      const sent = JSON.stringify([calls.filter((c) => c.method !== 'init'), outbound.payloads, outbound.attributes]);
      for (const c of CANARIES) if (sent.includes(c)) out.push(`${label}: o valor ${c} do estado do jogador chegou ao provider/rede`);
      if (!calls.some((c) => c.method === 'showBanner')) out.push(`${label}: o roteiro não chegou ao banner (teste cego)`);
      if (h.network && !outbound.payloads.some((p) => (p as { type?: string } | null)?.type === 'next')) out.push(`${label}: o AdsController não chegou a pedir o intersticial (teste cego)`);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------------
// Testes
// ---------------------------------------------------------------------------------------------------------------------

afterEach(resetPage);

describe('contrato de anúncio: descoberta', () => {
  it('acha as implementações exportadas (não ficou cego)', () => {
    expect(discoverFromExports(api as Record<string, unknown>)).toEqual(expect.arrayContaining(['AdSenseProvider', 'NoAdsProvider', 'FakeAdProvider']));
    expect(declaredInSources(readAdSources(ADS_DIR)).classes).toEqual(expect.arrayContaining(['AdSenseProvider', 'NoAdsProvider', 'FakeAdProvider']));
  });

  it('todo provider (exportado, declarado nos fontes ou fábrica) tem harness e está no índice', () => {
    expect(coverageProblems(api as Record<string, unknown>, readAdSources(ADS_DIR), Object.keys(HARNESSES))).toEqual([]);
  });

  it('todo harness aponta para um export que existe', () => {
    expect(Object.keys(HARNESSES).filter((n) => !(n in api))).toEqual([]);
  });

  describe('auto-teste: formas que a descoberta antiga deixava escapar', () => {
    const methods = {
      init: async () => {},
      preload: async () => {},
      isReady: () => false,
      showInterstitial: async () => false,
      showRewarded: async () => 'unavailable',
      showBanner: async () => false,
      hideBanner: () => {},
    };

    it('provider exportado só por fábrica (sem argumentos)', () => {
      const exportsObj = { makeAds: () => ({ ...methods }) };
      expect(discoverFromExports(exportsObj)).toEqual(['makeAds']);
      expect(coverageProblems(exportsObj, [], []).join('\n')).toContain('makeAds é um AdProvider sem harness');
      expect(coverageProblems(exportsObj, [], ['makeAds'])).toEqual([]);
    });

    it('fábrica com argumentos obrigatórios: pelos fontes, exige harness', () => {
      const files = [{ path: 'factory.ts', code: 'export function adsFor(env: Record<string, string>): AdProvider { return null as never; }' }];
      const exportsObj = { adsFor: (env: { x: string }) => env.x.length };
      expect(discoverFromExports(exportsObj)).toEqual([]);
      expect(coverageProblems(exportsObj, files, []).join('\n')).toContain('adsFor é um AdProvider sem harness');
      expect(coverageProblems({}, files, []).join('\n')).toContain('adsFor() devolve um provider mas não é exportada');
    });

    it('fábrica que só devolve uma classe já coberta dispensa harness próprio (adSenseFromEnv)', () => {
      const exportsObj = api as Record<string, unknown>;
      const files = readAdSources(ADS_DIR);
      expect(declaredInSources(files).factories.map((f) => f.name)).toContain('adSenseFromEnv');
      expect(coverageProblems(exportsObj, files, Object.keys(HARNESSES))).toEqual([]);
      expect(coverageProblems(exportsObj, files, ['NoAdsProvider', 'FakeAdProvider']).join('\n')).toContain('AdSenseProvider é um AdProvider sem harness');
    });

    it('classe com métodos em campos de seta (nada no prototype)', () => {
      class ArrowAds {
        init = async () => {};
        preload = async () => {};
        isReady = () => false;
        showInterstitial = async () => false;
        showRewarded = async () => 'unavailable';
        showBanner = async () => false;
        hideBanner = () => {};
      }
      expect(hasMethods(ArrowAds.prototype)).toBe(false);
      expect(discoverFromExports({ ArrowAds })).toEqual(['ArrowAds']);
      expect(coverageProblems({ ArrowAds }, [], []).join('\n')).toContain('ArrowAds é um AdProvider sem harness');
    });

    it('objeto exportado (não classe) com a forma de AdProvider', () => {
      expect(discoverFromExports({ ads: { ...methods } })).toEqual(['ads']);
    });

    it('classe em subpasta (src/ads/admob/): leitura recursiva dos fontes', () => {
      const dir = mkdtempSync(join(tmpdir(), 'ads-contract-'));
      try {
        mkdirSync(join(dir, 'admob'));
        writeFileSync(join(dir, 'admob', 'provider.ts'), 'export class AdMobProvider implements AdProvider {\n  // ...\n}\n');
        writeFileSync(join(dir, 'admob', 'provider.test.ts'), 'export class FromTest implements AdProvider {}\n');
        const files = readAdSources(dir);
        expect(files.map((f) => f.path)).toEqual(['admob/provider.ts']);
        expect(declaredInSources(files).classes).toEqual(['AdMobProvider']);
        expect(coverageProblems({}, files, []).join('\n')).toContain('AdMobProvider implementa AdProvider mas não é exportada');
        expect(coverageProblems({ AdMobProvider: class {} }, files, []).join('\n')).toContain('AdMobProvider é um AdProvider sem harness');
        expect(coverageProblems({ AdMobProvider: class {} }, files, ['AdMobProvider'])).toEqual([]);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  });
});

describe('contrato de anúncio: sem consentimento, nada personalizado', () => {
  for (const name of Object.keys(HARNESSES)) {
    it(`${name}: banner, intersticial e premiado saem não personalizados`, async () => {
      expect(await personalizationViolations(HARNESSES[name]!, noConsentScenarios())).toEqual([]);
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
  for (const name of Object.keys(HARNESSES)) {
    it(`${name}: com o estado do jogador preenchido, nada de nível, sessão ou métricas chega à rede`, async () => {
      expect(await segmentationViolations(HARNESSES[name]!)).toEqual([]);
    });
  }

  it('reprova provider que repassa dado do jogador para a rede (auto-teste)', async () => {
    // Defeituoso de propósito: guarda a política recebida e a manda inteira como parâmetro do pedido.
    class Forwards extends AdSenseProvider {
      private seen: unknown;
      override async init(policy?: AdPolicy) {
        if (policy) this.seen = policy;
        return super.init(policy);
      }
      override async showInterstitial() {
        await this.init();
        win().adsbygoogle!.push({ name: 'entre-partidas', kv: this.seen });
        return super.showInterstitial();
      }
    }
    const violations = (await segmentationViolations(adsenseHarness(Forwards))).join('\n');
    expect(violations).toContain('parâmetro novo para a rede: kv');
    expect(violations).toContain('31337');
  });

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

  it('o código das implementações (qualquer subpasta) não lê estado do jogador, nem armazenamento, nem importa métricas/regras', () => {
    expect(sourceCouplings(readAdSources(ADS_DIR))).toEqual([]);
  });

  describe('auto-teste: acoplamentos que o guard antigo deixava escapar', () => {
    const one = (path: string, code: string) => sourceCouplings([{ path, code }]);

    it('import() dinâmico de métricas, missões, armazenamento, diário ou regras', () => {
      expect(one('admob/provider.ts', "const m = await import('../../metrics/index.ts');").join()).toContain('importa ../../metrics/index.ts');
      expect(one('admob/provider.ts', "const m = await import(`../missions/index.ts`);").join()).toContain('missions');
      expect(one('x.ts', "import('./rules.ts').then(() => {});").join()).toContain('rules');
      expect(one('x.ts', "const s = require('../storage/index.ts');").join()).toContain('storage');
    });

    it('import() com caminho calculado (não dá para provar) também reprova', () => {
      expect(one('x.ts', 'const m = await import(path);').join()).toContain('não é literal');
    });

    it('localStorage, sessionStorage e indexedDB', () => {
      expect(one('x.ts', "const lvl = localStorage.getItem('level');").join()).toContain('armazenamento');
      expect(one('admob/x.ts', "window.sessionStorage.getItem('s')").join()).toContain('armazenamento');
      expect(one('x.ts', 'indexedDB.open("m")').join()).toContain('armazenamento');
    });

    it('arquivo em subpasta (index.ts de subpasta não ganha a isenção do índice)', () => {
      expect(one('admob/index.ts', "import { gamesPlayedOf } from '../../daily/index.ts';").length).toBeGreaterThan(0);
      expect(one('admob/index.ts', 'const g = state.gamesPlayed;').join()).toContain('gamesPlayed');
      expect(one('index.ts', "export * from './rules.ts';")).toEqual([]);
    });

    it('código limpo e comentários não reprovam; import estático continua pego', () => {
      expect(one('admob/clean.ts', "// import('../metrics') e localStorage só em comentário\nimport type { AdProvider } from '../types.ts';")).toEqual([]);
      expect(one('x.ts', "import { x } from '../metrics/index.ts';").length).toBeGreaterThan(0);
    });

    it('de ponta a ponta numa pasta real com subpasta', () => {
      const dir = mkdtempSync(join(tmpdir(), 'ads-contract-'));
      try {
        mkdirSync(join(dir, 'admob'));
        writeFileSync(join(dir, 'admob', 'provider.ts'), "export const lazy = () => import('../../metrics/index.ts');\nexport const k = localStorage.getItem('level');\n");
        const problems = sourceCouplings(readAdSources(dir)).join('\n');
        expect(problems).toContain('admob/provider.ts importa ../../metrics/index.ts');
        expect(problems).toContain('armazenamento');
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  });
});
