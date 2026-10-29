/**
 * Teste de arquitetura: nenhum jogo sorteia prêmio pago ou ganho por vídeo (caixa de recompensa,
 * roleta, gacha). O prêmio é sempre fixo e dito antes (decisão de 2026-10-25; ver o checklist
 * do template de PR). Os jogos chamam `assertNoPrizeDraw` num teste deles; a própria base usa o mesmo guarda.
 * Usa `node:fs`, por isso não entra em nenhum índice que vá para o navegador.
 *
 * Como funciona (heurística, não prova):
 *  1. Vocabulário de sorteio de prêmio (lootbox, gacha, caixa de recompensa, roleta de prêmio...)
 *     em código ou texto de tela acusa sozinho.
 *  2. Um gatilho de vídeo premiado (`showRewarded`, `watchRewarded`...) ou de compra
 *     (`purchase`, `requestPurchase`, `PaymentRequest`, SDK de compra...) a poucas linhas de uma
 *     fonte de aleatoriedade (`Math.random`, `crypto.getRandomValues`, `randomInt`, `weightedPick`...)
 *     acusa como "premiado + sorteio" ou "compra + sorteio".
 *
 * Limitações conhecidas:
 *  - Proximidade é por linhas (padrão 30) no mesmo arquivo, sem ler o fluxo de dados. Um sorteio
 *    ligado ao gatilho por outro arquivo, ou com nomes fora das listas abaixo, passa. É uma rede
 *    de segurança; a revisão do PR (checklist do template) continua sendo a defesa principal.
 *  - Falso positivo possível: embaralhar o baralho ou escolher o desafio logo ao lado de
 *    `showRewarded`. Resolva afastando os trechos ou liberando o arquivo em `allow`, com justificativa no PR.
 *  - Só lê código-fonte (.ts, .tsx, .js...). Não lê JSON de configuração nem texto de loja.
 *  - Os testes (*.test.*, *.spec.*, pastas test/tests/__tests__) ficam de fora por padrão.
 *  - Comentários são ignorados; texto entre aspas conta para o vocabulário, mas não para os gatilhos.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

export type PrizeDrawKind = 'vocabulary' | 'rewarded-random' | 'purchase-random';

export interface PrizeDrawViolation {
  file: string;
  /** Linha do sinal mais forte: a palavra, ou a fonte de aleatoriedade. */
  line: number;
  kind: PrizeDrawKind;
  /** Trecho que disparou o alerta (e, nos pares, o gatilho encontrado perto). */
  match: string;
}

export interface PrizeDrawOptions {
  /** Pastas ou arquivos (relativos à raiz) liberados, com justificativa no PR. */
  allow?: readonly string[];
  /** Caminhos relativos à raiz ignorados, além dos padrões. */
  ignore?: readonly string[];
  /** Extensões lidas. */
  extensions?: readonly string[];
  /** Distância máxima, em linhas, entre o gatilho (vídeo ou compra) e o sorteio. Padrão 30. */
  window?: number;
  /** Lê também os arquivos de teste. */
  includeTests?: boolean;
}

/** Palavras que só existem em mecânica de sorteio de prêmio. Procuradas no código e nos textos. */
export const PRIZE_DRAW_VOCABULARY: readonly RegExp[] = [
  /loot[\s_-]?box(?:es)?/i,
  /\bgacha/i,
  /mystery[\s_-]?(?:box|chest|crate)/i,
  /blind[\s_-]?box/i,
  /(?:prize|reward)[\s_-]?(?:draw|wheel|roulette|spin|raffle|lottery)/i,
  /(?:draw|spin|open)[\s_-]?(?:the[\s_-]?)?(?:prize|reward)s?\b/i,
  /slot[\s_-]?machine/i,
  /wheel[\s_-]?of[\s_-]?fortune/i,
  /\braffle\b/i,
  /caixa[\s_-]?(?:de[\s_-]?)?(?:recompensa|pr[eê]mio|surpresa|misteriosa)s?/i,
  /roleta[\s_-]?(?:de[\s_-]?)?(?:pr[eê]mio|recompensa|sorte)s?/i,
  /sorteio[\s_-]?(?:de[\s_-]?)?(?:pr[eê]mio|recompensa|brinde)s?/i,
  /(?:sortear|girar)[\s_-]?(?:o[\s_-]?)?(?:pr[eê]mio|recompensa)s?/i,
  /ba[uú][\s_-]?(?:de[\s_-]?)?(?:recompensa|pr[eê]mio|surpresa)s?/i,
];

/** Vídeo premiado: o jogador assiste e "ganha". Procurado só no código (fora de aspas e comentários). */
export const REWARDED_TRIGGERS: readonly RegExp[] = [
  /\bshowRewarded\w*\s*\(/,
  /\bwatchRewarded\w*\s*\(/,
  /\bcanOfferRewarded\w*\b/,
  /\brewardedBlock\s*\(/,
  /\bRewardedOutcome\b/,
  /\brewardedAd\b/i,
];

/** Compra: dinheiro vira acesso ao sorteio. Procurado só no código. */
export const PURCHASE_TRIGGERS: readonly RegExp[] = [
  /\b(?:purchase|buy|checkout)\w*\s*\(/i,
  /\brequestPurchase\b/,
  /\brestorePurchases?\b/,
  /\bonPurchase\w*\b/,
  /\bPaymentRequest\b/,
  /\bgetDigitalGoodsService\b/,
  /\bInAppPurchases?\b/,
  /\bStoreKit\b/,
  /\bBillingClient\b/,
];

/** Aleatoriedade. Procurada só no código. */
export const RANDOM_SOURCES: readonly RegExp[] = [
  /\bMath\.random\b/,
  /\bcrypto\.getRandomValues\b/,
  /\bgetRandomValues\s*\(/,
  /\brandomInt\s*\(/,
  /\brandomBytes\s*\(/,
  /\brandom(?:Item|Element|Choice|Pick|Prize|Reward|Weighted)\w*\s*\(/i,
  /\b(?:pickRandom|weightedPick|weightedRandom|weightedChoice|rollTable|lootTable|dropTable|prizeTable|rewardTable)\w*/i,
  /\b(?:rollDice|rollPrize|rollReward|spinWheel|spinRoulette)\w*\s*\(/i,
];

const DEFAULT_WINDOW = 30;
const DEFAULT_EXT = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.vue', '.svelte'];
const IGNORE_ANYWHERE = ['node_modules', '.git'];
const IGNORE_AT_ROOT = ['dist', 'build', 'coverage', '.claude', 'android', 'ios'];
const TEST_DIRS = ['test', 'tests', '__tests__'];
const TEST_FILE = /\.(?:test|spec)\.[cm]?[jt]sx?$/;

/** Só as quebras de linha de um trecho: ao remover texto, os números de linha dos próximos não mudam. */
const keepNewlines = (text: string): string => text.replace(/[^\n]/g, '');

/**
 * Remove comentários (mantendo quebras de linha). Com `blank`, esvazia também o miolo das strings,
 * para que texto de tela não conte como código.
 */
function clean(code: string, blank: boolean): string {
  let out = '';
  let i = 0;
  while (i < code.length) {
    const c = code[i] as string;
    const n = code[i + 1];
    if (c === '/' && n === '/') {
      while (i < code.length && code[i] !== '\n') i++;
    } else if (c === '/' && n === '*') {
      const end = code.indexOf('*/', i + 2);
      const stop = end < 0 ? code.length : end + 2;
      out += ' ' + keepNewlines(code.slice(i, stop));
      i = stop;
    } else if (c === '"' || c === "'" || c === '`') {
      let j = i + 1;
      while (j < code.length && code[j] !== c) {
        if (code[j] === '\\') j++;
        else if (code[j] === '\n' && c !== '`') break;
        j++;
      }
      const piece = code.slice(i, j + 1);
      out += blank ? c + keepNewlines(piece) + c : piece;
      i = j + 1;
    } else {
      out += c;
      i++;
    }
  }
  return out;
}

const lineAt = (text: string, index: number): number => 1 + (text.slice(0, index).match(/\n/g)?.length ?? 0);

interface Hit {
  line: number;
  text: string;
}

function hits(code: string, patterns: readonly RegExp[]): Hit[] {
  const out: Hit[] = [];
  for (const re of patterns) {
    const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`);
    for (const m of code.matchAll(g)) out.push({ line: lineAt(code, m.index), text: m[0].trim() });
  }
  return out;
}

/** Procura sorteio de prêmio pago ou por vídeo num texto de código-fonte. */
export function findPrizeDrawInSource(source: string, file = '<memória>', window = DEFAULT_WINDOW): PrizeDrawViolation[] {
  const found: PrizeDrawViolation[] = [];
  for (const h of hits(clean(source, false), PRIZE_DRAW_VOCABULARY)) {
    found.push({ file, line: h.line, kind: 'vocabulary', match: h.text });
  }
  const code = clean(source, true);
  const randoms = hits(code, RANDOM_SOURCES);
  if (randoms.length > 0) {
    const pairs: [PrizeDrawKind, Hit[]][] = [
      ['rewarded-random', hits(code, REWARDED_TRIGGERS)],
      ['purchase-random', hits(code, PURCHASE_TRIGGERS)],
    ];
    for (const [kind, triggers] of pairs) {
      for (const r of randoms) {
        const near = triggers.find((t) => Math.abs(t.line - r.line) <= window);
        if (near) found.push({ file, line: r.line, kind, match: `${r.text} perto de ${near.text} (linha ${near.line})` });
      }
    }
  }
  const seen = new Set<string>();
  return found
    .filter((v) => {
      const key = `${v.kind}:${v.line}:${v.match}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.line - b.line);
}

function* walk(root: string, dir: string, ignore: ReadonlySet<string>, ext: readonly string[], tests: boolean): Generator<string> {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const rel = relative(root, full).split(sep).join('/');
    if (IGNORE_ANYWHERE.includes(name) || ignore.has(rel)) continue;
    if (statSync(full).isDirectory()) {
      if (!tests && TEST_DIRS.includes(name)) continue;
      yield* walk(root, full, ignore, ext, tests);
    } else if (ext.some((e) => name.endsWith(e)) && (tests || !TEST_FILE.test(name))) yield full;
  }
}

/** Varre `root` e devolve cada sinal de sorteio de prêmio pago ou por vídeo fora do que foi liberado. */
export function findPrizeDrawViolations(root: string, opts: PrizeDrawOptions = {}): PrizeDrawViolation[] {
  const norm = (p: string): string => p.split('\\').join('/').replace(/\/+$/, '');
  const ignore = new Set([...IGNORE_AT_ROOT, ...(opts.ignore ?? [])].map(norm));
  const allow = (opts.allow ?? []).map(norm);
  const out: PrizeDrawViolation[] = [];
  for (const full of walk(root, root, ignore, opts.extensions ?? DEFAULT_EXT, opts.includeTests ?? false)) {
    const rel = relative(root, full).split(sep).join('/');
    if (allow.some((a) => rel === a || rel.startsWith(`${a}/`))) continue;
    out.push(...findPrizeDrawInSource(readFileSync(full, 'utf8'), rel, opts.window));
  }
  return out;
}

/** Lança com a lista de arquivos e linhas se algum código parecer sortear prêmio pago ou por vídeo. */
export function assertNoPrizeDraw(root: string, opts: PrizeDrawOptions = {}): void {
  const bad = findPrizeDrawViolations(root, opts);
  if (bad.length === 0) return;
  const why = {
    vocabulary: 'palavra de sorteio de prêmio',
    'rewarded-random': 'vídeo premiado ligado a sorteio',
    'purchase-random': 'compra ligada a sorteio',
  } as const;
  const list = bad.map((v) => `  ${v.file}:${v.line}  ${why[v.kind]}: ${v.match}`).join('\n');
  throw new Error(`Sorteio de prêmio pago ou por vídeo não é permitido; o prêmio é fixo e dito antes:\n${list}`);
}
