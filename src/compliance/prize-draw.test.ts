import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { assertNoPrizeDraw, findPrizeDrawInSource, findPrizeDrawViolations } from './prize-draw.ts';

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

const kinds = (src: string, window?: number): string[] => findPrizeDrawInSource(src, 'a.ts', window).map((v) => v.kind);

describe('guarda de sorteio de prêmio pago ou por vídeo', () => {
  it('acusa sorteio depois de vídeo premiado', () => {
    const src = [
      'const outcome = await ads.watchRewarded();',
      "if (outcome === 'earned') {",
      '  const prize = PRIZES[Math.floor(Math.random() * PRIZES.length)];',
      '}',
    ].join('\n');
    const v = findPrizeDrawInSource(src, 'a.ts');
    expect(v.map((x) => [x.line, x.kind])).toEqual([[3, 'rewarded-random']]);
  });

  it('acusa sorteio ligado a compra', () => {
    const src = 'await store.purchase(sku);\nconst drop = weightedPick(table, crypto.getRandomValues(new Uint32Array(1))[0]);';
    expect(kinds(src)).toContain('purchase-random');
  });

  it('acusa o vocabulário de caixa de recompensa mesmo sem gatilho', () => {
    expect(kinds('const lootBox = open();')).toEqual(['vocabulary']);
    expect(kinds("t('Abra a caixa de recompensa!')")).toEqual(['vocabulary']);
    expect(kinds('gachaPull()')).toEqual(['vocabulary']);
    expect(kinds('const x = "sorteio de prêmio";')).toEqual(['vocabulary']);
  });

  it('respeita a janela de linhas', () => {
    const gap = '\n'.repeat(60);
    expect(kinds(`await ads.showRewarded();${gap}Math.random();`)).toEqual([]);
    expect(kinds(`await ads.showRewarded();${gap}Math.random();`, 100)).toEqual(['rewarded-random']);
  });

  it('não acusa sorteio sem vídeo nem compra (embaralhar, grupo A/B)', () => {
    const src = [
      'const deck = shuffle(cards, Math.random);',
      'const group = pickGroup(deviceId, groups); // sorteio de grupos para teste A/B',
    ].join('\n');
    expect(kinds(src)).toEqual([]);
  });

  it('não acusa vídeo premiado com prêmio fixo', () => {
    const src = "const outcome = await ads.watchRewarded();\nif (outcome === 'earned') grantHint();";
    expect(kinds(src)).toEqual([]);
  });

  it('ignora comentários, e texto de tela não vale como gatilho', () => {
    expect(kinds('// nada de loot box aqui\n/* sorteio de prêmio proibido */\nconst a = 1;')).toEqual([]);
    expect(kinds("const label = 'Assistir showRewarded()';\nMath.random();")).toEqual([]);
  });

  it('percorre a pasta, ignora testes e respeita allow', () => {
    const jogo = fakeGame({
      'src/ok.ts': 'export const a = 1;',
      'src/bonus.ts': 'await ads.showRewarded();\nconst p = Math.random();',
      'src/bonus.test.ts': 'await ads.showRewarded();\nconst p = Math.random();',
      'test/x.ts': 'const lootBox = 1;',
    });
    const v = findPrizeDrawViolations(jogo);
    expect(v.map((x) => x.file)).toEqual(['src/bonus.ts']);
    expect(findPrizeDrawViolations(jogo, { includeTests: true })).toHaveLength(3);
    expect(findPrizeDrawViolations(jogo, { allow: ['src/bonus.ts'] })).toEqual([]);
    expect(() => assertNoPrizeDraw(jogo)).toThrow(/src\/bonus\.ts:2/);
  });

  it('um jogo limpo passa', () => {
    const jogo = fakeGame({ 'src/main.ts': 'export const x = 1;' });
    expect(() => assertNoPrizeDraw(jogo)).not.toThrow();
  });
});

describe('arquitetura da própria base', () => {
  it('nenhum código da base sorteia prêmio pago ou por vídeo', () => {
    // O próprio guarda fica de fora: ele contém as palavras que procura.
    expect(() => assertNoPrizeDraw(join(import.meta.dirname, '..', '..'), { allow: ['src/compliance'] })).not.toThrow();
  });
});
