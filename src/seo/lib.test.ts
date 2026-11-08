import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../../', import.meta.url));

function listFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? listFiles(p) : [p];
  });
}

/** O `seo/node` é entregue compilado (lib/), porque o Node 22 não roda .ts dentro de node_modules. */
describe('lib/ compilada do seo/node', () => {
  it('está em dia com o código-fonte (rode `pnpm build` e commite lib/)', () => {
    const out = mkdtempSync(join(tmpdir(), 'seo-lib-'));
    try {
      execFileSync(process.execPath, [join(root, 'node_modules/typescript/bin/tsc'), '-p', join(root, 'tsconfig.node.json'), '--outDir', out], { cwd: root });
      const fresh = listFiles(out).map((f) => relative(out, f)).sort();
      const committed = listFiles(join(root, 'lib')).map((f) => relative(join(root, 'lib'), f)).sort();
      expect(committed).toEqual(fresh);
      const norm = (f: string) => readFileSync(f, 'utf8').replace(/\r\n/g, '\n');
      for (const f of fresh) expect(norm(join(root, 'lib', f)), f).toBe(norm(join(out, f)));
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  }, 60_000);

  it('o export aponta para JS e tipos que existem (seo/node e daily/node)', () => {
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { exports: Record<string, { default: string; types: string }>; files: string[] };
    for (const key of ['./seo/node', './daily/node']) {
      const e = pkg.exports[key]!;
      expect(existsSync(join(root, e.default)), key).toBe(true);
      expect(existsSync(join(root, e.types)), key).toBe(true);
    }
    expect(pkg.files).toContain('lib');
  });
});

describe('daily/node', () => {
  it('a semente compilada dá a mesma sequência do código-fonte (o build do jogo e o navegador geram o mesmo desafio)', async () => {
    const compiled = (await import('../../lib/daily/index.js')) as typeof import('../daily/index.ts');
    const source = await import('../daily/index.ts');
    const a = compiled.dailyRandom('sudoku', '2026-11-08');
    const b = source.dailyRandom('sudoku', '2026-11-08');
    for (let i = 0; i < 20; i++) expect(a()).toBe(b());
  });
});
