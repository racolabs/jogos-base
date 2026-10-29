import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { assertNoDirectAdSdk, findAdSdkInSource, findAdSdkViolations } from './guard.ts';

const dirs: string[] = [];
function fakeGame(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), 'jogo-'));
  dirs.push(root);
  for (const [name, text] of Object.entries(files)) {
    const full = join(root, name);
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, text);
  }
  return root;
}
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe('guarda de SDK de anúncio', () => {
  it('acusa import estático, dinâmico e require de SDK', () => {
    const src = [
      "import { AdMob } from '@capacitor-community/admob';",
      'const m = await import("react-native-google-mobile-ads");',
      "const r = require('@capacitor-community/admob/dist/esm');",
    ].join('\n');
    const v = findAdSdkInSource(src, 'a.ts');
    expect(v.map((x) => [x.line, x.target, x.kind])).toEqual([
      [1, '@capacitor-community/admob', 'import'],
      [2, 'react-native-google-mobile-ads', 'import'],
      [3, '@capacitor-community/admob', 'import'],
    ]);
  });

  it('acusa script de rede de anúncio carregado direto', () => {
    const v = findAdSdkInSource('<script src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"></script>');
    expect(v).toHaveLength(1);
    expect(v[0]?.kind).toBe('script');
  });

  it('acusa import dinâmico quebrado em várias linhas', () => {
    const src = "const m = await import(\n  /* chunk */\n  '@capacitor-community/admob'\n);\nimport {\n  A,\n} from\n  \"react-native-google-mobile-ads\";";
    const v = findAdSdkInSource(src, 'a.ts');
    expect(v.map((x) => [x.line, x.target])).toEqual([
      [3, '@capacitor-community/admob'],
      [8, 'react-native-google-mobile-ads'],
    ]);
  });

  it('acusa os globais window.adsbygoogle e googletag', () => {
    const v = findAdSdkInSource("(window.adsbygoogle = window.adsbygoogle || []).push({});\nwindow.googletag.cmd.push(() => {});\nwindow['adsbygoogle'];");
    expect(v.filter((x) => x.kind === 'global').map((x) => x.target)).toEqual(['adsbygoogle', 'adsbygoogle', 'adsbygoogle', 'googletag']);
    expect(findAdSdkInSource('const meuadsbygoogle2 = 1; // googletag')).toEqual([]);
  });

  it('acusa host montado por concatenação', () => {
    const v = findAdSdkInSource("s.src = 'https://pagead2.' + 'googlesyndication.com' + '/pagead/js/adsbygoogle.js';");
    expect(v.map((x) => [x.kind, x.target])).toEqual([['script', 'pagead2.googlesyndication.com']]);
    expect(findAdSdkInSource('const u = "https://pagead2." +\n  "googlesyndication.com";')).toHaveLength(1);
  });

  it('acusa o SDK da CrazyGames com escopo e outros pacotes com escopo', () => {
    expect(findAdSdkInSource("import { sdk } from '@crazygames/sdk';").map((x) => x.target)).toEqual(['@crazygames/']);
    expect(findAdSdkInSource("import '@poki/sdk/loader';")).toHaveLength(1);
    expect(findAdSdkInSource("import { x } from '@admob-plus/core';")).toHaveLength(1);
    expect(findAdSdkInSource("import { x } from '@crazygamesfake/sdk';")).toEqual([]);
  });

  it('ignora build/ios/android só na raiz; em subpastas lê', () => {
    const sdk = "import { AdMob } from '@capacitor-community/admob';";
    const jogo = fakeGame({ 'build/a.ts': sdk, 'android/b.ts': sdk, 'ios/c.ts': sdk, 'dist/d.ts': sdk });
    expect(findAdSdkViolations(jogo)).toEqual([]);
    const fundo = fakeGame({ 'src/build/a.ts': sdk, 'src/android/b.ts': sdk, 'src/ios/c.ts': sdk, 'src/dist/d.ts': sdk });
    expect(findAdSdkViolations(fundo).map((v) => v.file).sort()).toEqual([
      'src/android/b.ts',
      'src/build/a.ts',
      'src/dist/d.ts',
      'src/ios/c.ts',
    ]);
  });

  it('não reprova host em meta CSP do index.html nem em comentário', () => {
    const html = [
      '<!doctype html>',
      '<!-- <script src="https://pagead2.googlesyndication.com/x.js"></script> -->',
      '<meta http-equiv="Content-Security-Policy" content="script-src \'self\' https://pagead2.googlesyndication.com; frame-src https://googleads.g.doubleclick.net">',
      '<script type="module" src="/src/main.ts"></script>',
    ].join('\n');
    expect(findAdSdkInSource(html, 'index.html')).toEqual([]);
    const ts = "// carrega https://pagead2.googlesyndication.com/x.js\n/* import 'react-adsense'; googletag */\nconst csp = \"script-src 'self' https://pagead2.googlesyndication.com\";\nconst url = 'https://exemplo.com//x';";
    expect(findAdSdkInSource(ts, 'csp.ts')).toEqual([]);
  });

  it('acusa <script src> de rede no HTML e script inline com global', () => {
    const html = '<head>\n<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js"></script>\n<script>\n  window.googletag = window.googletag || {};\n</script>';
    const v = findAdSdkInSource(html, 'index.html');
    expect(v.map((x) => [x.line, x.kind, x.target])).toEqual([
      [2, 'script', 'pagead2.googlesyndication.com'],
      [4, 'global', 'googletag'],
      [4, 'global', 'googletag'],
    ]);
  });

  it('aceita quem usa só a interface da base', () => {
    const src = "import { AdsController, NoAdsProvider } from 'jogos-base/ads';\nimport { x } from './admob-like';";
    expect(findAdSdkInSource(src)).toEqual([]);
  });

  it('falha quando um jogo importa SDK de anúncio diretamente', () => {
    const jogo = fakeGame({
      'src/main.ts': "import { AdsController } from 'jogos-base/ads';",
      'src/telas/fim.tsx': "import { AdMob } from '@capacitor-community/admob';\nexport const x = AdMob;",
    });
    expect(() => assertNoDirectAdSdk(jogo)).toThrow(/src\/telas\/fim\.tsx:1/);
  });

  it('passa quando o jogo usa só AdProvider', () => {
    const jogo = fakeGame({
      'src/main.ts': "import { AdsController, FakeAdProvider } from 'jogos-base/ads';",
      'node_modules/x/ads.js': "require('@capacitor-community/admob')",
    });
    expect(() => assertNoDirectAdSdk(jogo)).not.toThrow();
  });

  it('libera o SDK só nas pastas permitidas (providers)', () => {
    const base = fakeGame({ 'src/ads/admob.ts': "import { AdMob } from '@capacitor-community/admob';" });
    expect(findAdSdkViolations(base)).toHaveLength(1);
    expect(findAdSdkViolations(base, { allow: ['src/ads'] })).toEqual([]);
  });
});

describe('arquitetura da própria base', () => {
  it('nada fora de src/ads fala com SDK de anúncio', () => {
    expect(() => assertNoDirectAdSdk(join(import.meta.dirname, '..'), { allow: ['ads'] })).not.toThrow();
  });
});
