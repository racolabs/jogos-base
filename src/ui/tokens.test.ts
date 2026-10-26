import { describe, expect, it } from 'vitest';
import { contrast } from './contrast.ts';
import { DOBRA, DOBRA_TILES, LARGE_TEXT, ON_GOLD, MAHJONG, PACIENCIA, SHELL, SUDOKU, themeCss, TYPE_SCALE, type Palette } from './tokens.ts';

const AA = 4.5;
const AA_LARGE = 3;

/** Pares texto/fundo que aparecem nas telas aprovadas. */
function shellPairs(p: Palette): [string, string, string][] {
  return [
    ['tinta no chão', p.ink!, p.ground!],
    ['tinta na superfície', p.ink!, p.surface!],
    ['tinta na superfície 2', p.ink!, p['surface-2']!],
    ['apoio no chão', p.muted!, p.ground!],
    ['apoio na superfície', p.muted!, p.surface!],
    ['texto do prêmio', p['gold-ink']!, p['gold-soft']!],
    ['texto no dourado', ON_GOLD, p.gold!],
  ];
}

describe('contraste AA nos dois temas', () => {
  for (const theme of [DOBRA, PACIENCIA, SUDOKU, MAHJONG]) {
    for (const mode of ['light', 'dark'] as const) {
      it(`${theme.id} ${mode === 'light' ? 'claro' : 'escuro'}`, () => {
        for (const [name, fg, bg] of shellPairs(theme[mode])) {
          expect(contrast(fg, bg), name).toBeGreaterThanOrEqual(AA);
        }
      });
    }
  }

  it('números das peças do Dobra (texto grande e negrito)', () => {
    DOBRA_TILES.forEach(([bg, fg], i) => expect(contrast(fg, bg), `peça ${2 ** (i + 1)}`).toBeGreaterThanOrEqual(AA_LARGE));
  });

  it('cartas e mesa da Paciência', () => {
    for (const p of [PACIENCIA.light, PACIENCIA.dark]) {
      expect(contrast(p.red!, p.card!), 'copas e ouros').toBeGreaterThanOrEqual(AA);
      expect(contrast(p.black!, p.card!), 'espadas e paus').toBeGreaterThanOrEqual(AA);
      expect(contrast(p['felt-ink']!, p.felt!), 'texto no feltro').toBeGreaterThanOrEqual(AA);
    }
  });

  it('números e anotações do Sudoku no papel e nas casas destacadas', () => {
    for (const p of [SUDOKU.light, SUDOKU.dark]) {
      for (const bg of ['paper', 'sel', 'peer', 'same'] as const) {
        expect(contrast(p.given!, p[bg]!), `fixo em ${bg}`).toBeGreaterThanOrEqual(AA);
        expect(contrast(p.pen!, p[bg]!), `jogador em ${bg}`).toBeGreaterThanOrEqual(AA_LARGE);
      }
      expect(contrast(p.pencil!, p.paper!), 'anotação').toBeGreaterThanOrEqual(AA);
      expect(contrast(p.err!, p['err-bg']!), 'erro').toBeGreaterThanOrEqual(AA);
    }
  });

  it('desenhos das peças e texto na mesa do Mahjong', () => {
    for (const p of [MAHJONG.light, MAHJONG.dark]) {
      for (const c of ['dot-blue', 'dot-red', 'dot-green', 'bam-dark'] as const) expect(contrast(p[c]!, p.tile!), c).toBeGreaterThanOrEqual(AA_LARGE);
      expect(contrast(p['table-ink']!, p.table!), 'texto na mesa').toBeGreaterThanOrEqual(AA);
    }
  });

  it('a casca comum também passa sozinha', () => {
    for (const p of [SHELL.light, SHELL.dark]) for (const [name, fg, bg] of shellPairs(p)) expect(contrast(fg, bg), name).toBeGreaterThanOrEqual(AA);
  });
});

describe('tipografia', () => {
  it('nada abaixo de 14 px, e letra grande aumenta 1,3×', () => {
    expect(Math.min(...Object.values(TYPE_SCALE))).toBeGreaterThanOrEqual(14);
    expect(LARGE_TEXT).toBe(1.3);
  });
});

describe('themeCss', () => {
  const css = themeCss(DOBRA);
  it('claro na raiz, escuro pelo aparelho e pela escolha, letra grande por data-big', () => {
    expect(css).toContain(':root { --ground: #ECEEF6;');
    expect(css).toContain('@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --ground: #121320;');
    expect(css).toContain(':root[data-theme="dark"] { --ground: #121320;');
    expect(css).toContain(':root[data-big] { --fs: 1.3; }');
  });
  it('todo token do escuro existe no claro (nenhuma cor só num tema)', () => {
    for (const t of [DOBRA, PACIENCIA]) expect(Object.keys(t.dark).sort()).toEqual(Object.keys(t.light).sort());
  });
  it('contraste: a fórmula bate com os valores conhecidos', () => {
    expect(contrast('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrast('#777777', '#FFFFFF')).toBeCloseTo(4.48, 2);
  });
});
