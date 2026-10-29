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

describe('vídeo premiado ligado a sorteio', () => {
  it('acusa Math.random depois de vídeo premiado', () => {
    const src = [
      'const outcome = await ads.watchRewarded();',
      "if (outcome === 'earned') {",
      '  const prize = PRIZES[Math.floor(Math.random() * PRIZES.length)];',
      '}',
    ].join('\n');
    const v = findPrizeDrawInSource(src, 'a.ts');
    expect(v.map((x) => [x.line, x.kind])).toEqual([[3, 'rewarded-random']]);
  });

  it('acusa o gerador injetado dos jogos (rng, seededRandom, dailyRandom, shuffle)', () => {
    const rng = 'await ads.watchRewarded(); give(PRIZES[Math.floor(rng() * n)]);';
    expect(kinds(rng)).toEqual(['rewarded-random']);
    expect(kinds('await ads.showRewarded();\ngive(seededRandom(seed));')).toEqual(['rewarded-random']);
    expect(kinds('await ads.showRewarded();\ngive(dailyRandom(day));')).toEqual(['rewarded-random']);
    expect(kinds('await ads.showRewarded();\nconst d = shuffle(cards);')).toEqual(['rewarded-random']);
  });

  it('o padrão dos jogos (rng = rngProp ?? Math.random) com vídeo e sorteio perto acusa', () => {
    const src = [
      'const rng = rngProp ?? Math.random;',
      'const onWatch = async () => {',
      "  if ((await ads.watchRewarded()) === 'earned') give(PRIZES[Math.floor(rng() * PRIZES.length)]);",
      '};',
    ].join('\n');
    expect(kinds(src)).toContain('rewarded-random');
  });

  it('respeita a janela de linhas', () => {
    const gap = '\n'.repeat(60);
    expect(kinds(`await ads.showRewarded();${gap}Math.random();`)).toEqual([]);
    expect(kinds(`await ads.showRewarded();${gap}Math.random();`, 100)).toEqual(['rewarded-random']);
  });

  it('shuffleCost() e outros nomes que só começam com shuffle não contam como sorteio', () => {
    expect(kinds('await ads.watchRewarded();\nconst c = shuffleCost(run);')).toEqual([]);
  });

  it('não acusa vídeo premiado com prêmio fixo, nem sorteio sem vídeo', () => {
    expect(kinds("const outcome = await ads.watchRewarded();\nif (outcome === 'earned') grantHint();")).toEqual([]);
    expect(kinds('const deck = shuffle(cards, rng);\nconst group = pickGroup(deviceId, groups);')).toEqual([]);
  });
});

describe('compra ligada a sorteio', () => {
  it('acusa sorteio depois de compra', () => {
    const src = 'await store.purchase(sku);\nconst drop = weightedPick(table, crypto.getRandomValues(new Uint32Array(1))[0]);';
    expect(kinds(src)).toContain('purchase-random');
    expect(kinds('await requestPurchase(id);\ngive(rng());')).toEqual(['purchase-random']);
    expect(kinds('const r = new PaymentRequest(m, d);\nMath.random();')).toEqual(['purchase-random']);
  });

  it('não confunde buyTime(), checkoutLayout() e afins com compra', () => {
    expect(kinds('buyTime(5);\nconst p = Math.random();')).toEqual([]);
    expect(kinds('checkoutLayout();\nconst p = rng();')).toEqual([]);
    expect(kinds('const purchased = true;\nonPurchaseLabel();\nshuffle(cards);')).toEqual([]);
  });
});

describe('texto de tela de sorteio', () => {
  it.each([
    "t('Gire a roleta e ganhe')",
    'const x = "Spin the wheel!";',
    "label: 'Prêmio surpresa'",
    "label: 'Recompensa aleatória'",
    "label: 'Random reward'",
    "label: 'Mystery box'",
    "label: 'Caixa misteriosa'",
    "label: 'Abra a caixa de recompensa!'",
    'const x = `Sorteio de prêmio: ${n}`;',
    "const loot = 'loot box';",
  ])('acusa %s', (src) => {
    expect(kinds(src)).toEqual(['vocabulary']);
  });

  it('acusa texto de JSX', () => {
    expect(kinds('const a = <button>Gire a roleta</button>;')).toEqual(['vocabulary']);
    expect(kinds('const a = (\n  <p>\n    Spin the wheel to win\n  </p>\n);')).toEqual(['vocabulary']);
  });

  it('não acusa identificadores inocentes', () => {
    const src = 'function RewardSpinner() {}\nopenReward();\nconst slotMachineLike = 1;\nconst lootBoxOpen = 2;\nrandomRewardId();';
    expect(kinds(src)).toEqual([]);
  });

  it('não acusa comentário', () => {
    expect(kinds('// nada de loot box aqui\n/* sorteio de prêmio proibido */\nconst a = 1;')).toEqual([]);
  });

  it('informa a linha do texto', () => {
    const v = findPrizeDrawInSource("const a = 1;\nconst b = 'Gire a roleta';", 'a.ts');
    expect(v.map((x) => [x.line, x.match])).toEqual([[2, 'Gire a roleta']]);
  });
});

describe('template literal', () => {
  it('chamada dentro de ${...} continua sendo código', () => {
    const src = 'const msg = `Resultado: ${await ads.watchRewarded()}`;\nconst p = Math.random();';
    expect(kinds(src)).toEqual(['rewarded-random']);
  });

  it('sorteio dentro de ${...} também conta, com chaves aninhadas e outra crase dentro', () => {
    const src = [
      'await ads.showRewarded();',
      'const m = `Prêmio: ${PRIZES[Math.floor(rng() * ({ a: 1 }).a)] + `x${1}`}`;',
    ].join('\n');
    expect(findPrizeDrawInSource(src, 'a.ts').filter((v) => v.kind === 'rewarded-random')).toHaveLength(1);
  });

  it('texto do template não vira gatilho', () => {
    expect(kinds('const m = `Assistir showRewarded() e Math.random()`;\nMath.random();')).toEqual([]);
  });

  it('mantém o número das linhas depois de um template de várias linhas', () => {
    const v = findPrizeDrawInSource('const a = `um\ndois\n${x}`;\nawait ads.showRewarded();\nrng();', 'a.ts');
    expect(v.map((x) => [x.line, x.kind])).toEqual([[5, 'rewarded-random']]);
  });
});

describe('texto de tela não vale como gatilho', () => {
  it('aspas não contam como código', () => {
    expect(kinds("const label = 'Assistir showRewarded()';\nMath.random();")).toEqual([]);
  });
});

describe('varredura da pasta', () => {
  it('percorre, ignora testes e respeita allow', () => {
    const jogo = fakeGame({
      'src/ok.ts': 'export const a = 1;',
      'src/bonus.ts': 'await ads.showRewarded();\nconst p = Math.random();',
      'src/bonus.test.ts': 'await ads.showRewarded();\nconst p = Math.random();',
      'test/x.ts': "const t = 'loot box';",
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
    // O próprio guarda fica de fora: as listas de frases dele estão em template literals.
    expect(() => assertNoPrizeDraw(join(import.meta.dirname, '..', '..'), { allow: ['src/compliance/prize-draw.ts'] })).not.toThrow();
  });
});
