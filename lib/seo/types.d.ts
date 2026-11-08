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
    /**
     * HTML extra depois da ajuda, por idioma (ex.: a grade do Sudoku do dia). **Não é escapado**: só texto gerado pelo
     * próprio jogo no build, nunca entrada de usuário. Sem `<script>`.
     */
    html?: Partial<Record<Lang, string>>;
    /** Fica fora do `llms.txt` (ex.: as páginas de cada dia do arquivo). Padrão: entra. */
    llms?: boolean;
}
/** Bloco de texto de uma página de conteúdo: título (`<h2>`), parágrafos e lista opcional. Tudo escapado. */
export interface SeoSection {
    heading: string;
    paragraphs?: readonly string[];
    list?: readonly string[];
    /** Lista numerada (`<ol>`) em vez de marcadores. */
    ordered?: boolean;
}
export interface SeoFaqItem {
    q: string;
    a: string;
}
/** Texto de uma página de conteúdo num idioma. */
export interface SeoArticleText {
    /** `<title>` e `<h1>`. */
    title: string;
    /** Meta description (~160 caracteres). */
    description: string;
    /** Rótulo curto nos links entre páginas (ex.: "Como jogar"). Padrão: o título. */
    label?: string;
    intro?: string;
    sections: readonly SeoSection[];
    /** Perguntas frequentes: viram `<h2>`/`<h3>` visíveis e dados estruturados `FAQPage`. */
    faq?: readonly SeoFaqItem[];
    /** Título da seção de perguntas. Padrão: "Perguntas frequentes" / "Frequently asked questions". */
    faqTitle?: string;
}
/**
 * Página de conteúdo (regras, estratégias, perguntas), em HTML puro e sem o jogo: o módulo escreve a página inteira
 * com `canonical`, `hreflang`, Open Graph, `BreadcrumbList`, `FAQPage`, botão para jogar e links para as outras páginas.
 */
export interface SeoArticle {
    /** Caminho em cada idioma: `/pt/como-jogar/` e `/en/how-to-play/` (minúsculas, barra no fim). */
    paths: Localized;
    text: Record<Lang, SeoArticleText>;
}
/** Outro jogo do estúdio, para os links cruzados ("Outros jogos da RacoLabs"). */
export interface SeoOtherGame {
    id: string;
    /** Endereço da página do jogo em cada idioma. */
    url: Localized;
    name: Localized;
    /** Uma frase sobre o jogo. */
    blurb: Localized;
}
/** Cores das páginas de conteúdo (claro e escuro). Padrão: a casca comum da RacoLabs. */
export interface SeoArticleTheme {
    accent: string;
    accentDark: string;
    /** Texto sobre o botão de destaque. Padrão: branco no claro e a cor do chão no escuro. */
    onAccent?: string;
    onAccentDark?: string;
    /** Ícone da aba (`<link rel="icon">`). Padrão: `/icon-192.png`. */
    icon?: string;
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
    /**
     * Primeiro degrau do `BreadcrumbList` (ex.: RacoLabs, com o endereço do site em cada idioma). Sem ele, a trilha começa no jogo.
     */
    studio?: {
        name: string;
        url: Localized;
    };
    /** Páginas de conteúdo (como jogar, estratégias, perguntas). Entram no sitemap, no `llms.txt` e nos links das páginas do jogo. */
    articles?: readonly SeoArticle[];
    /** Outros jogos do estúdio, linkados em todas as páginas ("Outros jogos da RacoLabs"). */
    otherGames?: readonly SeoOtherGame[];
    /** Título da seção de outros jogos. Padrão: "Outros jogos" / "More games". */
    otherGamesTitle?: Localized;
    /** Cores das páginas de conteúdo. */
    articleTheme?: SeoArticleTheme;
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
    /** HTML extra da variação (não escapado). */
    html?: string;
    /** Páginas de conteúdo do idioma, para os links ("Guias"). */
    guides: readonly SeoLink[];
    /** Outros jogos, para os links cruzados. */
    others: readonly SeoLink[];
    /** Título da seção de outros jogos. */
    othersTitle: string;
    /** Trilha do `BreadcrumbList`, do estúdio (se houver) até esta página. */
    breadcrumb: readonly {
        name: string;
        url: string;
    }[];
}
/** Página de conteúdo pronta para escrever: texto de um idioma, endereço e versões. */
export interface SeoArticlePage {
    lang: Lang;
    path: string;
    url: string;
    langTag: string;
    article: SeoArticle;
    text: SeoArticleText;
    alternates: SeoAlternate[];
    image: string;
    breadcrumb: readonly {
        name: string;
        url: string;
    }[];
}
