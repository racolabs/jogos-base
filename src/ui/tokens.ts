/**
 * Tokens da direção estética Mesa Viva, aprovada em 2026-10-25 (docs/estetica.md).
 * Cada jogo usa a casca comum e acrescenta as cores da própria superfície.
 */
export type Palette = Record<string, string>;

export interface Theme {
  /** Nome curto do jogo, usado em data-game. */
  id: string;
  light: Palette;
  dark: Palette;
  fonts: { ui: string; display: string };
}

/** Casca comum a todos os jogos. */
export const SHELL: { light: Palette; dark: Palette } = {
  light: {
    ground: '#F4F5F9',
    surface: '#FFFFFF',
    'surface-2': '#E4E7F2',
    ink: '#1C1D2B',
    muted: '#5E6075',
    line: '#D9DBE6',
    gold: '#F2B33D',
    'gold-soft': '#FFF3D6',
    'gold-ink': '#6B4A0E',
    focus: '#2F6BFF',
    good: '#1F8A5E',
  },
  dark: {
    ground: '#12131D',
    surface: '#1C1E2C',
    'surface-2': '#272A3D',
    ink: '#EDEEF5',
    muted: '#A3A6BC',
    line: '#34364A',
    gold: '#F2B33D',
    'gold-soft': '#3A3020',
    'gold-ink': '#F7D58C',
    focus: '#7EA2FF',
    good: '#4CD69A',
  },
};

/** Texto sobre o dourado é sempre tinta escura, nos dois temas. */
export const ON_GOLD = '#1C1D2B';

const FIGTREE = "'Figtree', system-ui, -apple-system, 'Segoe UI', sans-serif";

export const DOBRA: Theme = {
  id: 'dobra',
  light: { ...SHELL.light, ground: '#ECEEF6', ink: '#1B1B3A', board: '#D5D9EA', cell: '#E6E9F4', accent: '#FF6A3D' },
  dark: { ...SHELL.dark, ground: '#121320', ink: '#F2F1F8', board: '#242639', cell: '#2E3148', accent: '#FF8458' },
  fonts: { ui: FIGTREE, display: "'Fredoka', " + FIGTREE },
};

/** Rampa das peças do Dobra (2 a 4096+), igual nos dois temas: a peça é um objeto. [fundo, número]. */
export const DOBRA_TILES: readonly (readonly [string, string])[] = [
  ['#FFF6E6', '#1B1B3A'],
  ['#FFE8B8', '#1B1B3A'],
  ['#FFD84D', '#1B1B3A'],
  ['#FFB547', '#1B1B3A'],
  ['#FF8A5C', '#1B1B3A'],
  ['#E8434F', '#FFFFFF'],
  ['#C93A83', '#FFFFFF'],
  ['#8F4AD8', '#FFFFFF'],
  ['#4D5EE8', '#FFFFFF'],
  ['#2FB5FF', '#1B1B3A'],
  ['#3DD6A3', '#1B1B3A'],
  ['#1B1B3A', '#FFD84D'],
];

export const PACIENCIA: Theme = {
  id: 'paciencia',
  light: {
    ...SHELL.light,
    ground: '#F2F4F1',
    felt: '#1E5A4C',
    'felt-ink': '#FFFFFF',
    card: '#FBF8F1',
    red: '#C42F3A',
    black: '#1C1D2B',
    select: '#7FD1FF',
    back: '#2B3A8C',
  },
  dark: {
    ...SHELL.dark,
    ground: '#101614',
    felt: '#0F2F28',
    'felt-ink': '#EEF2F0',
    card: '#ECE7DA',
    red: '#B52A35',
    black: '#1C1D2B',
    select: '#7FD1FF',
    back: '#24306F',
  },
  fonts: { ui: FIGTREE, display: "'Fraunces', Georgia, 'Times New Roman', serif" },
};

/** Escala de texto em px (normal). Letra grande multiplica por LARGE_TEXT. Nada abaixo de 14 px. */
export const TYPE_SCALE = { screenTitle: 34, sheetTitle: 26, button: 19, body: 17, label: 15, caption: 14 } as const;
export const LARGE_TEXT = 1.3;

/** Movimento: toque responde em menos de 100 ms; nada que trava a jogada passa de 300 ms. */
export const MOTION = {
  tap: 90,
  slide: 120,
  born: 180,
  merge: 220,
  card: 220,
  sheet: 300,
  counter: 400,
  easeOut: 'cubic-bezier(.22, 1, .36, 1)',
  spring: 'cubic-bezier(.34, 1.56, .64, 1)',
  inOut: 'cubic-bezier(.65, 0, .35, 1)',
} as const;

const vars = (p: Palette): string =>
  Object.entries(p)
    .map(([k, v]) => `--${k}: ${v};`)
    .join(' ');

/**
 * CSS das variáveis do tema: claro por padrão, escuro pelo aparelho ou pela escolha em Configurações
 * (data-theme no <html>), e letra grande por data-big.
 */
export function themeCss(theme: Theme): string {
  return [
    `:root { ${vars(theme.light)} --font-ui: ${theme.fonts.ui}; --font-display: ${theme.fonts.display}; --fs: 1; color-scheme: light; }`,
    `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { ${vars(theme.dark)} color-scheme: dark; } }`,
    `:root[data-theme="dark"] { ${vars(theme.dark)} color-scheme: dark; }`,
    `:root[data-big] { --fs: ${LARGE_TEXT}; }`,
  ].join('\n');
}
