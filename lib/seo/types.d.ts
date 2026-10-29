import type { Lang } from '../i18n/index.ts';
export type Localized = Record<Lang, string>;
/** Link extra do conteúdo pré-renderizado (ex.: política de privacidade, exigida para o AdSense). */
export interface SeoLink {
    text: string;
    /** Caminho com `/` no início (`/pt/privacidade/`) ou endereço https completo. */
    href: string;
}
/**
 * Página que o jogo gera por fora (ex.: `/pt/privacidade/`). O módulo não a escreve: só a põe no `sitemap.xml`
 * com `hreflang` correto. Informe o caminho de cada idioma, com `/` no início e no fim, começando por `/<idioma>/`.
 */
export interface SeoExtraPage {
    paths: Localized;
}
/** Variação do jogo com página própria (ex.: Sudoku difícil, Mahjong Dragão). */
export interface SeoVariant {
    /** Trecho da URL, sem barras: `dificil` vira `/pt/dificil/`. Letras minúsculas, números e hífen. */
    slug: string;
    title: Localized;
    description: Localized;
    /** Texto de ajuda desta variação (passos curtos). Se faltar, vale o do jogo. */
    help?: Record<Lang, readonly string[]>;
    /** Parágrafo de introdução próprio desta variação. O `intro` do jogo vale só na página inicial. */
    intro?: Partial<Record<Lang, string>>;
}
export interface SeoGame {
    /** Endereço público do jogo, sem barra no fim: `https://sudoku.racolabs.app`. */
    origin: string;
    /** Identificador curto, o mesmo do catálogo (`GAMES`). */
    id: string;
    name: Localized;
    /** Título da página inicial (até ~60 caracteres). Padrão: o nome. Ex.: `Sudoku grátis | RacoLabs`. */
    title?: Localized;
    /** Título visível (`<h1>`) da página inicial, por idioma. Padrão: o nome. Ex.: `Paciência online grátis`. Variações usam o próprio título. */
    heading?: Partial<Record<Lang, string>>;
    /** Descrição de uma ou duas frases (cabe em ~160 caracteres). */
    description: Localized;
    /** Parágrafo de introdução, depois da descrição, no HTML inicial da página inicial (por idioma, opcional). */
    intro?: Partial<Record<Lang, string>>;
    /** Links no HTML inicial de todas as páginas (ex.: privacidade), por idioma. Texto escapado; `href` validado. */
    links?: Partial<Record<Lang, readonly SeoLink[]>>;
    /**
     * Idioma do `hreflang="x-default"`. Padrão `'en'` (compatível com a v0.12.0).
     * Os jogos RacoLabs, de público principal brasileiro, devem passar `'pt'`.
     */
    defaultLocale?: Lang;
    /**
     * Tag BCP 47 de cada idioma, usada em `<html lang>`, `hreflang` e `og:locale` (`pt-BR` vira `pt_BR`).
     * Ex.: `{ pt: 'pt-BR', en: 'en-US' }`. Sem ela vale `pt` e `en`. A URL continua `/pt/` e `/en/`.
     */
    langTags?: Partial<Record<Lang, string>>;
    /** Páginas geradas por fora que devem entrar no sitemap (ex.: privacidade). */
    extraPages?: readonly SeoExtraPage[];
    /** "Como jogar", em passos curtos. Vai no HTML inicial para quem não executa JavaScript. */
    help: Record<Lang, readonly string[]>;
    /** Título da seção de ajuda. Padrão: "Como jogar" / "How to play". */
    helpTitle?: Localized;
    /** Gênero para os dados estruturados (ex.: `Puzzle`, `Card game`). */
    genre: string | readonly string[];
    /** Plataformas nos dados estruturados (`gamePlatform`), ex.: `['Web browser', 'Android']`. Sem ela, o campo não sai. */
    gamePlatform?: string | readonly string[];
    /**
     * Moeda (ISO 4217, 3 letras) de `offers.priceCurrency`. Pode ser uma só (`'BRL'`) ou por idioma (`{ pt: 'BRL', en: 'USD' }`).
     * Padrão: BRL no idioma pt e USD no en (o preço é sempre 0).
     */
    priceCurrency?: string | Partial<Record<Lang, string>>;
    variants?: readonly SeoVariant[];
    /**
     * Imagem de compartilhamento pronta: PNG ou JPG 1200x630, caminho com `/` no início (`/og.png`) ou endereço https completo.
     * Sem ela, o build gera um SVG por página e avisa: WhatsApp, Facebook e X ignoram SVG, então cada jogo precisa de um PNG.
     */
    shareImage?: string;
    /** Cor da barra do navegador no celular. */
    themeColor?: string;
    /** Quem publica, para os dados estruturados. */
    publisher?: {
        name: string;
        url: string;
    };
}
export interface SeoAlternate {
    hreflang: string;
    url: string;
}
/** O que o sitemap precisa de uma página: endereço e versões. `SeoPage` serve. */
export interface SitemapEntry {
    url: string;
    alternates: readonly SeoAlternate[];
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
    /** Texto do `<h1>` pré-renderizado: `heading` do jogo (página inicial) ou o mesmo que `heading`. */
    h1: string;
    helpTitle: string;
    help: readonly string[];
    /** Parágrafo de introdução, se houver. */
    intro?: string;
    /** Links extras desta página, se houver. */
    links: readonly SeoLink[];
    /** Tag BCP 47 desta página (`<html lang>` e `hreflang`). */
    langTag: string;
    /** Mesma página nos dois idiomas, mais o x-default. */
    alternates: SeoAlternate[];
    /** Imagem de compartilhamento, caminho a partir da raiz ou endereço completo. */
    image: string;
}
