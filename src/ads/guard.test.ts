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
