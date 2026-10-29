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

  it('o export aponta para JS e tipos que existem', () => {
    const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { exports: Record<string, { default: string; types: string }>; files: string[] };
    const e = pkg.exports['./seo/node']!;
    expect(existsSync(join(root, e.default))).toBe(true);
    expect(existsSync(join(root, e.types))).toBe(true);
    expect(pkg.files).toContain('lib');
  });
});
