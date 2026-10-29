/**
 * Teste de arquitetura: o jogo fala só com `AdProvider`. Esta checagem acusa qualquer
 * código de jogo que importe um SDK de anúncio direto ou carregue o script de uma rede.
 * Usa `node:fs`, por isso fica fora do índice `jogos-base/ads` (que vai para o navegador).
 * Os jogos chamam `assertNoDirectAdSdk` num teste deles; a própria base usa o mesmo guarda.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/** Pacotes de SDK de anúncio que só um provider da base pode importar. */
export const AD_SDK_PACKAGES: readonly string[] = [
  '@capacitor-community/admob',
  '@admob-plus',
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
  '@poki/sdk',
  'crazygames-sdk',
  'gamemonetize-sdk',
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

export interface AdSdkViolation {
  file: string;
  line: number;
  /** Pacote ou endereço encontrado. */
  target: string;
  kind: 'import' | 'script';
}

export interface ScanOptions {
  /** Pastas (relativas à raiz) onde um SDK é permitido, ex.: os providers da base em `src/ads`. */
  allow?: readonly string[];
  /** Pastas ignoradas além de node_modules, dist, coverage e .git. */
  ignore?: readonly string[];
  /** Extensões lidas. */
  extensions?: readonly string[];
}

const DEFAULT_IGNORE = ['node_modules', 'dist', 'build', 'coverage', '.git', '.claude', 'android', 'ios'];
const DEFAULT_EXT = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.vue', '.svelte', '.html'];

// from '...', import '...', import('...'), require('...')
const SPECIFIER_RE = /(?:\bfrom\s*|\bimport\s*\(?\s*|\brequire\s*\(\s*)(['"`])([^'"`\n]+)\1/g;

function matchesPackage(specifier: string): string | null {
  for (const pkg of AD_SDK_PACKAGES) {
    if (specifier === pkg || specifier.startsWith(`${pkg}/`)) return pkg;
  }
  return null;
}

/** Procura acesso direto a SDK de anúncio num texto de código-fonte. */
export function findAdSdkInSource(source: string, file = '<memória>'): AdSdkViolation[] {
  const found: AdSdkViolation[] = [];
  source.split(/\r?\n/).forEach((text, i) => {
    SPECIFIER_RE.lastIndex = 0;
    for (let m = SPECIFIER_RE.exec(text); m; m = SPECIFIER_RE.exec(text)) {
      const pkg = matchesPackage(m[2] ?? '');
      if (pkg) found.push({ file, line: i + 1, target: pkg, kind: 'import' });
    }
    for (const host of AD_SDK_SCRIPT_HOSTS) {
      if (text.includes(host)) found.push({ file, line: i + 1, target: host, kind: 'script' });
    }
  });
  return found;
}

function* walk(dir: string, ignore: ReadonlySet<string>, ext: readonly string[]): Generator<string> {
  for (const name of readdirSync(dir)) {
    if (ignore.has(name)) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) yield* walk(full, ignore, ext);
    else if (ext.some((e) => name.endsWith(e))) yield full;
  }
}

/** Varre `root` e devolve cada acesso direto a SDK de anúncio fora das pastas permitidas. */
export function findAdSdkViolations(root: string, opts: ScanOptions = {}): AdSdkViolation[] {
  const ignore = new Set([...DEFAULT_IGNORE, ...(opts.ignore ?? [])]);
  const allow = (opts.allow ?? []).map((a) => a.split('/').join(sep).replace(/[\\/]+$/, ''));
  const out: AdSdkViolation[] = [];
  for (const full of walk(root, ignore, opts.extensions ?? DEFAULT_EXT)) {
    const rel = relative(root, full);
    if (allow.some((a) => rel === a || rel.startsWith(a + sep))) continue;
    out.push(...findAdSdkInSource(readFileSync(full, 'utf8'), rel.split(sep).join('/')));
  }
  return out;
}

/** Lança com a lista de arquivos e linhas se algum código importar SDK de anúncio direto. */
export function assertNoDirectAdSdk(root: string, opts: ScanOptions = {}): void {
  const bad = findAdSdkViolations(root, opts);
  if (bad.length === 0) return;
  const list = bad.map((v) => `  ${v.file}:${v.line}  ${v.kind === 'import' ? 'importa' : 'carrega script de'} ${v.target}`).join('\n');
  throw new Error(`Acesso direto a SDK de anúncio. O jogo deve falar só com AdProvider (jogos-base/ads):\n${list}`);
}
