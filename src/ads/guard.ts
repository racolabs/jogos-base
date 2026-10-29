/**
 * Teste de arquitetura: o jogo fala só com `AdProvider`. Esta checagem acusa qualquer
 * código de jogo que importe um SDK de anúncio direto, carregue o script de uma rede
 * ou use os globais que a rede cria na página.
 * Usa `node:fs`, por isso fica fora do índice `jogos-base/ads` (que vai para o navegador).
 * Os jogos chamam `assertNoDirectAdSdk` num teste deles; a própria base usa o mesmo guarda.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/**
 * Pacotes de SDK de anúncio que só um provider da base pode importar.
 * Entrada terminada em "/" vale para o escopo inteiro (ex.: "@crazygames/").
 */
export const AD_SDK_PACKAGES: readonly string[] = [
  '@capacitor-community/admob',
  '@admob-plus/',
  '@ionic-native/admob-plus',
  '@ionic-native/admob-free',
  'admob-plus-cordova',
  'cordova-plugin-admob',
  'react-native-google-mobile-ads',
  'react-native-admob',
  'expo-ads-admob',
  '@react-native-firebase/admob',
  'react-native-applovin-max',
  'react-native-unity-ads',
  'react-native-ironsource',
  'react-native-appodeal',
  'react-native-vungle',
  'react-adsense',
  'react-google-adsense',
  'react-google-publisher-tag',
  'react-ad-manager',
  'react-dfp',
  'google-publisher-tag',
  '@types/google-publisher-tag',
  'poki-sdk',
  '@poki/',
  'crazygames-sdk',
  '@crazygames/',
  'gamemonetize-sdk',
  '@gamemonetize/',
];

/** Endereços de script de redes de anúncio: carregar um deles no jogo também é acesso direto. */
export const AD_SDK_SCRIPT_HOSTS: readonly string[] = [
  'pagead2.googlesyndication.com',
  'googleads.g.doubleclick.net',
  'securepubads.g.doubleclick.net',
  'www.googletagservices.com',
  'imasdk.googleapis.com',
  'sdk.crazygames.com',
  'game-cdn.poki.com',
  'html5.api.gamemonetize.com',
  'unityads.unity3d.com',
];

/** Globais que as redes criam na página; o jogo não deve tocar neles. */
export const AD_SDK_GLOBALS: readonly string[] = ['adsbygoogle', 'googletag'];

export interface AdSdkViolation {
  file: string;
  line: number;
  /** Pacote, endereço ou global encontrado. */
  target: string;
  kind: 'import' | 'script' | 'global';
}

export interface ScanOptions {
  /** Pastas (relativas à raiz) onde um SDK é permitido, ex.: os providers da base em `src/ads`. */
  allow?: readonly string[];
  /** Caminhos relativos à raiz ignorados, além dos padrões. */
  ignore?: readonly string[];
  /** Extensões lidas. */
  extensions?: readonly string[];
}

/** Ignorados em qualquer nível. */
const IGNORE_ANYWHERE = ['node_modules', '.git'];
/** Ignorados só na raiz (saída de build, projetos nativos, worktrees). Uma pasta `build` dentro de `src` é lida. */
const IGNORE_AT_ROOT = ['dist', 'build', 'coverage', '.claude', 'android', 'ios'];
const DEFAULT_EXT = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.vue', '.svelte', '.html'];
const MARKUP_EXT = ['.html', '.vue', '.svelte'];

function matchesPackage(specifier: string): string | null {
  for (const pkg of AD_SDK_PACKAGES) {
    const hit = pkg.endsWith('/') ? specifier.startsWith(pkg) : specifier === pkg || specifier.startsWith(`${pkg}/`);
    if (hit) return pkg;
  }
  return null;
}

/** Só as quebras de linha de um trecho: ao remover texto, os números de linha dos próximos não mudam. */
const keepNewlines = (text: string): string => text.replace(/[^\n]/g, '');

/** Troca comentários por espaço (mantendo quebras de linha); respeita strings, então `//` dentro de URL fica. */
function stripComments(code: string): string {
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
      out += code.slice(i, j + 1);
      i = j + 1;
    } else {
      out += c;
      i++;
    }
  }
  return out;
}

/** 'a' + 'b' vira 'ab', para pegar host montado por concatenação. */
function foldConcatenation(code: string): string {
  let prev: string;
  let cur = code;
  do {
    prev = cur;
    cur = cur.replace(/(['"`])\s*\+\s*(['"`])/g, (m) => keepNewlines(m));
  } while (cur !== prev);
  return cur;
}

const lineAt = (text: string, index: number, firstLine: number): number =>
  firstLine + (text.slice(0, index).match(/\n/g)?.length ?? 0);

// from '...', import '...', import('...'), require('...'); o espaço entre as partes pode quebrar linha.
const SPECIFIER_RE = /(?:\bfrom|\bimport|\brequire)\s*\(?\s*(['"`])([^'"`\n]+)\1/g;
const STRING_RE = /(['"`])((?:\\.|(?!\1)[^\\])*)\1/g;

function scanCode(raw: string, file: string, firstLine: number, found: AdSdkViolation[]): void {
  const code = foldConcatenation(stripComments(raw));
  for (const m of code.matchAll(SPECIFIER_RE)) {
    const pkg = matchesPackage(m[2] ?? '');
    if (pkg) found.push({ file, line: lineAt(code, m.index + m[0].lastIndexOf(m[2] ?? ''), firstLine), target: pkg, kind: 'import' });
  }
  // Endereço de rede: só vale string que é uma URL sozinha (script src, fetch, import por URL).
  // Uma política CSP lista hosts separados por espaço e não entra aqui.
  for (const m of code.matchAll(STRING_RE)) {
    const value = (m[2] ?? '').replace(/\n/g, '');
    if (/[ \t]/.test(value)) continue;
    const host = AD_SDK_SCRIPT_HOSTS.find((h) => value.includes(h));
    if (host) found.push({ file, line: lineAt(code, m.index, firstLine), target: host, kind: 'script' });
  }
  for (const g of AD_SDK_GLOBALS) {
    for (const m of code.matchAll(new RegExp(`(?<![\\w$/-])${g}(?![\\w$-])`, 'g'))) {
      found.push({ file, line: lineAt(code, m.index, firstLine), target: g, kind: 'global' });
    }
  }
}

/** HTML, Vue e Svelte: olha só `<script src>` e o corpo dos scripts. `<meta>` (CSP) e comentários não contam. */
function scanMarkup(raw: string, file: string, found: AdSdkViolation[]): void {
  const html = raw.replace(/<!--[\s\S]*?-->/g, keepNewlines);
  for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const attrs = m[1] ?? '';
    const src = /\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(attrs);
    const url = src?.[1] ?? src?.[2] ?? src?.[3] ?? '';
    const host = AD_SDK_SCRIPT_HOSTS.find((h) => url.includes(h));
    if (host) found.push({ file, line: lineAt(html, m.index, 1), target: host, kind: 'script' });
    const bodyStart = m.index + '<script'.length + attrs.length + 1;
    scanCode(m[2] ?? '', file, lineAt(html, bodyStart, 1), found);
  }
}

/** Procura acesso direto a SDK de anúncio num texto de código-fonte (arquivo .html/.vue/.svelte é lido como marcação). */
export function findAdSdkInSource(source: string, file = '<memória>'): AdSdkViolation[] {
  const found: AdSdkViolation[] = [];
  if (MARKUP_EXT.some((e) => file.endsWith(e))) scanMarkup(source, file, found);
  else scanCode(source, file, 1, found);
  return found;
}

function* walk(root: string, dir: string, ignore: ReadonlySet<string>, ext: readonly string[]): Generator<string> {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    const rel = relative(root, full).split(sep).join('/');
    if (IGNORE_ANYWHERE.includes(name) || ignore.has(rel)) continue;
    if (statSync(full).isDirectory()) yield* walk(root, full, ignore, ext);
    else if (ext.some((e) => name.endsWith(e))) yield full;
  }
}

/** Varre `root` e devolve cada acesso direto a SDK de anúncio fora das pastas permitidas. */
export function findAdSdkViolations(root: string, opts: ScanOptions = {}): AdSdkViolation[] {
  const norm = (p: string): string => p.split('\\').join('/').replace(/\/+$/, '');
  const ignore = new Set([...IGNORE_AT_ROOT, ...(opts.ignore ?? [])].map(norm));
  const allow = (opts.allow ?? []).map(norm);
  const out: AdSdkViolation[] = [];
  for (const full of walk(root, root, ignore, opts.extensions ?? DEFAULT_EXT)) {
    const rel = relative(root, full).split(sep).join('/');
    if (allow.some((a) => rel === a || rel.startsWith(`${a}/`))) continue;
    out.push(...findAdSdkInSource(readFileSync(full, 'utf8'), rel));
  }
  return out;
}

/** Lança com a lista de arquivos e linhas se algum código usar SDK de anúncio direto. */
export function assertNoDirectAdSdk(root: string, opts: ScanOptions = {}): void {
  const bad = findAdSdkViolations(root, opts);
  if (bad.length === 0) return;
  const verb = { import: 'importa', script: 'carrega script de', global: 'usa o global' } as const;
  const list = bad.map((v) => `  ${v.file}:${v.line}  ${verb[v.kind]} ${v.target}`).join('\n');
  throw new Error(`Acesso direto a SDK de anúncio. O jogo deve falar só com AdProvider (jogos-base/ads):\n${list}`);
}
