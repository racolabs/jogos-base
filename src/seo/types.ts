import type { Lang } from '../i18n/index.ts';

export type Localized = Record<Lang, string>;

/** Variação do jogo com página própria (ex.: Sudoku difícil, Mahjong Dragão). */
export interface SeoVariant {
  /** Trecho da URL, sem barras: `dificil` vira `/pt/dificil/`. Letras minúsculas, números e hífen. */
  slug: string;
  title: Localized;
  description: Localized;
  /** Texto de ajuda desta variação (passos curtos). Se faltar, vale o do jogo. */
  help?: Record<Lang, readonly string[]>;
}

export interface SeoGame {
  /** Endereço público do jogo, sem barra no fim: `https://sudoku.racolabs.app`. */
  origin: string;
  /** Identificador curto, o mesmo do catálogo (`GAMES`). */
  id: string;
  name: Localized;
  /** Título da página inicial (até ~60 caracteres). Padrão: o nome. Ex.: `Sudoku grátis | RacoLabs`. */
  title?: Localized;
  /** Descrição de uma ou duas frases (cabe em ~160 caracteres). */
  description: Localized;
  /** "Como jogar", em passos curtos. Vai no HTML inicial para quem não executa JavaScript. */
  help: Record<Lang, readonly string[]>;
  /** Título da seção de ajuda. Padrão: "Como jogar" / "How to play". */
  helpTitle?: Localized;
  /** Gênero para os dados estruturados (ex.: `Puzzle`, `Card game`). */
  genre: string;
  variants?: readonly SeoVariant[];
  /**
   * Imagem de compartilhamento pronta: PNG ou JPG 1200x630, caminho com `/` no início (`/og.png`) ou endereço https completo.
   * Sem ela, o build gera um SVG por página e avisa: WhatsApp, Facebook e X ignoram SVG, então cada jogo precisa de um PNG.
   */
  shareImage?: string;
  /** Cor da barra do navegador no celular. */
  themeColor?: string;
  /** Quem publica, para os dados estruturados. */
  publisher?: { name: string; url: string };
}

export interface SeoPage {
  lang: Lang;
  /** Caminho com barra no início e no fim: `/pt/` ou `/pt/dificil/`. */
  path: string;
  /** Endereço completo e canônico. */
  url: string;
  variant: SeoVariant | null;
  title: string;
  description: string;
  heading: string;
  helpTitle: string;
  help: readonly string[];
  /** Mesma página nos dois idiomas, mais o x-default. */
  alternates: { hreflang: string; url: string }[];
  /** Imagem de compartilhamento, caminho a partir da raiz ou endereço completo. */
  image: string;
}
