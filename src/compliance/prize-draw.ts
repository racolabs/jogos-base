/**
 * Teste de arquitetura: nenhum jogo sorteia prêmio pago ou ganho por vídeo (caixa de recompensa,
 * roleta, gacha). O prêmio é sempre fixo e dito antes (decisão de 2026-10-25; ver o checklist
 * do template de PR). Os jogos chamam `assertNoPrizeDraw` num teste deles; a própria base usa o mesmo guarda.
 * Usa `node:fs`, por isso não vai para o navegador: importe só em teste (`jogos-base/compliance`).
 *
 * Como funciona (heurística, não prova):
 *  1. Texto de tela (aspas, crases e texto de JSX) com vocabulário de sorteio de prêmio, em português
 *     ou inglês ("gire a roleta", "spin the wheel", "prêmio surpresa", "random reward", "mystery box"...)
 *     acusa sozinho. Nomes de variável e de função não entram: `openReward` e `RewardSpinner` passam.
 *  2. Um gatilho de vídeo premiado (`showRewarded`, `watchRewarded`...) ou de compra
 *     (`purchase(`, `requestPurchase`, `PaymentRequest`, SDK de compra...) a poucas linhas de uma
 *     fonte de aleatoriedade (`Math.random`, `rng(`, `shuffle(`, `crypto.getRandomValues`, `weightedPick`...)
 *     acusa como "premiado + sorteio" ou "compra + sorteio". Chamadas dentro de `${...}` de um
 *     template literal contam como código.
 *
 * Limitações conhecidas:
 *  - Proximidade é por linhas (padrão 30) no mesmo arquivo, sem ler o fluxo de dados. Um sorteio
 *    ligado ao gatilho por outro arquivo, ou com nomes fora das listas abaixo, passa. É uma rede
 *    de segurança; a revisão do PR (checklist do template) continua sendo a defesa principal.
 *  - Falso positivo possível: embaralhar ou sortear a jogada (`rng(`, `shuffle(`) logo ao lado de
 *    `showRewarded`, por exemplo reembaralhar depois de um vídeo que libera a ajuda. Resolva afastando os
 *    trechos ou liberando o arquivo em `allow`, com justificativa no PR (o prêmio do vídeo tem de continuar fixo).
 *  - Não há API de compra na base (sem StoreProvider por enquanto): o gatilho de compra usa nomes exatos
 *    de funções e SDKs conhecidos. `buyTime()` e `checkoutLayout()` não contam; uma loja com outro nome passa.
 *  - Só lê código-fonte (.ts, .tsx, .js...). Não lê JSON de configuração nem texto de loja.
 *  - Os testes (*.test.*, *.spec.*, pastas test/tests/__tests__) ficam de fora por padrão.
 *  - Comentários são ignorados. O vocabulário vale só para texto de tela; os gatilhos, só para código.
 *  - Regex literal com aspas dentro pode confundir a leitura das strings da linha; texto de JSX com
 *    apóstrofo ("Don't") conta como string até o fim da linha, o que é inofensivo para o vocabulário.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

export type PrizeDrawKind = 'vocabulary' | 'rewarded-random' | 'purchase-random';

export interface PrizeDrawViolation {
  file: string;
  /** Linha do sinal mais forte: a frase, ou a fonte de aleatoriedade. */
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

const S = String.raw`\s+`;
const phrase = (...parts: string[]): RegExp => new RegExp(String.raw`(?<![\p{L}\p{N}])(?:${parts.join('|')})`, 'iu');

/**
 * Frases de sorteio de prêmio em texto de tela (português e inglês). Procuradas só no texto: aspas, crases
 * e texto de JSX. Exigem espaço entre as palavras (ou a palavra sozinha), então identificadores não casam.
 */
export const PRIZE_DRAW_VOCABULARY: readonly RegExp[] = [
  phrase(String.raw`loot${S}?box`, String.raw`gacha(?![\p{L}])`, String.raw`blind${S}box`, String.raw`slot${S}machine`),
  phrase(String.raw`mystery${S}(?:box|chest|crate|prize|reward)`, String.raw`surprise${S}(?:box|prize|reward|chest)`),
  phrase(String.raw`random${S}(?:reward|prize|drop|gift)s?`, String.raw`(?:reward|prize)${S}(?:draw|wheel|roulette|raffle|lottery)`),
  phrase(String.raw`(?:spin|turn)${S}(?:the${S})?(?:wheel|roulette)`, String.raw`spin${S}(?:to${S}win|for${S}(?:a${S})?(?:prize|reward))`),
  phrase(String.raw`(?:open|pick)${S}(?:the${S}|a${S})?(?:mystery|reward|prize|loot|surprise)${S}(?:box|chest|crate)`),
  phrase(String.raw`wheel${S}of${S}fortune`, String.raw`raffle(?![\p{L}])`, String.raw`prize${S}draw`),
  phrase(String.raw`caixa${S}(?:de${S})?(?:recompensa|pr[eê]mio|surpresa)s?`, String.raw`caixa${S}misteriosa`),
  phrase(String.raw`ba[uú]${S}(?:de${S})?(?:recompensa|pr[eê]mio|surpresa)s?`),
  phrase(String.raw`pr[eê]mio${S}(?:surpresa|aleat[oó]rio|misterioso)`, String.raw`recompensa${S}(?:aleat[oó]ria|surpresa|misteriosa)`),
  phrase(String.raw`(?:gire|girar|giro|rode|rodar)${S}(?:a${S}|na${S})?roleta`, String.raw`roleta${S}(?:de${S})?(?:pr[eê]mio|recompensa|sorte)s?`),
  phrase(String.raw`sorteio${S}(?:de${S})?(?:pr[eê]mio|recompensa|brinde)s?`, String.raw`(?:sortear|sorteie)${S}(?:o${S}|um${S})?(?:pr[eê]mio|recompensa)s?`),
  phrase(String.raw`gire${S}e${S}ganhe`),
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

/**
 * Compra: dinheiro vira acesso ao sorteio. Procurado só no código. A base não tem API de compra ainda,
 * então são nomes exatos (sem `\w*` no fim): `buyTime()` e `checkoutLayout()` não casam.
 */
export const PURCHASE_TRIGGERS: readonly RegExp[] = [
  /\b(?:purchase|purchaseProduct|purchaseItem|requestPurchase|buyProduct|buyItem|launchBillingFlow|initiateCheckout|createCheckoutSession|restorePurchases?)\s*\(/,
  /\bonPurchase(?:Complete|Success|d)?\b/,
  /\bPaymentRequest\b/,
  /\bgetDigitalGoodsService\b/,
  /\bInAppPurchases?\b/,
  /\bStoreKit\b/,
  /\bBillingClient\b/,
];

/** Aleatoriedade, inclusive o gerador injetado nos jogos (`rng`). Procurada só no código. */
export const RANDOM_SOURCES: readonly RegExp[] = [
  /\bMath\.random\b/,
  /\bcrypto\.getRandomValues\b/,
  /\bgetRandomValues\s*\(/,
  /\brandomInt\s*\(/,
  /\brandomBytes\s*\(/,
  /\brng\s*\(/,
  /\bseededRandom\w*/,
  /\bdailyRandom\w*/,
  /\bshuffle(?:d|Array|Cards?|Deck|Tiles?|InPlace)?\s*\(/,
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

const BLANK = '\u0001';

interface Lexed {
  /** Código: comentários e miolo de strings viram espaço; chamadas dentro de `${...}` ficam. Mesmo tamanho e mesmas linhas do original. */
  code: string;
  /** Texto de tela: miolo de strings e crases e texto de JSX; o resto vira \u0001. Mesmo tamanho e mesmas linhas do original. */
  text: string;
}

/** Separa código e texto de tela, preservando posições e quebras de linha. */
function lex(src: string): Lexed {
  const len = src.length;
  const code = new Array<string>(len);
  const text = new Array<string>(len);
  const put = (k: number, asCode: boolean, asText: boolean): void => {
    const ch = src[k] as string;
    if (ch === '\n') {
      code[k] = '\n';
      text[k] = '\n';
      return;
    }
    code[k] = asCode ? ch : ' ';
    text[k] = asText ? ch : BLANK;
  };
  let i = 0;
  const scanCode = (insideBraces: boolean): void => {
    let depth = 0;
    while (i < len) {
      const c = src[i] as string;
      const n = src[i + 1];
      if (c === '/' && n === '/') {
        while (i < len && src[i] !== '\n') put(i++, false, false);
      } else if (c === '/' && n === '*') {
        const end = src.indexOf('*/', i + 2);
        const stop = end < 0 ? len : end + 2;
        while (i < stop) put(i++, false, false);
      } else if (c === '"' || c === "'") {
        put(i++, true, false);
        while (i < len && src[i] !== c && src[i] !== '\n') {
          if (src[i] === '\\' && i + 1 < len) put(i++, false, true);
          put(i++, false, true);
        }
        if (i < len && src[i] === c) put(i++, true, false);
      } else if (c === '`') {
        put(i++, true, false);
        while (i < len && src[i] !== '`') {
          if (src[i] === '\\' && i + 1 < len) {
            put(i++, false, true);
            put(i++, false, true);
          } else if (src[i] === '$' && src[i + 1] === '{') {
            put(i++, false, false);
            put(i++, true, false);
            scanCode(true); // a chamada dentro do ${...} é código e não some na limpeza
          } else put(i++, false, true);
        }
        if (i < len) put(i++, true, false);
      } else if (insideBraces && c === '}' && depth === 0) {
        put(i++, true, false);
        return;
      } else {
        if (c === '{') depth++;
        else if (c === '}') depth--;
        put(i++, true, false);
      }
    }
  };
  scanCode(false);
  // Texto de JSX: >texto< com letras, sem chaves. Procurado no código já sem strings nem comentários.
  const codeText = code.join('');
  for (const m of codeText.matchAll(/>([^<>{}=;]*\p{L}[^<>{}=;]*)</gu)) {
    const start = m.index + 1;
    const end = start + (m[1] as string).length;
    for (let k = start; k < end; k++) if (src[k] !== '\n') text[k] = src[k] as string;
  }
  return { code: codeText, text: text.join('') };
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
  const { code, text } = lex(source);
  for (const h of hits(text, PRIZE_DRAW_VOCABULARY)) {
    found.push({ file, line: h.line, kind: 'vocabulary', match: h.text.replace(/\s+/g, ' ') });
  }
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
    vocabulary: 'texto de tela de sorteio',
    'rewarded-random': 'vídeo premiado ligado a sorteio',
    'purchase-random': 'compra ligada a sorteio',
  } as const;
  const list = bad.map((v) => `  ${v.file}:${v.line}  ${why[v.kind]}: ${v.match}`).join('\n');
  throw new Error(`Prêmio pago ou por vídeo não pode ser sorteado; o prêmio é fixo e dito antes:\n${list}`);
}
