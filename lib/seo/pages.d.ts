import { type Lang } from '../i18n/index.ts';
import type { SeoArticlePage, SeoGame, SeoLink, SeoPage, SitemapEntry } from './types.ts';
export declare const DEFAULT_LANG: Lang;
/** Tag BCP 47 do idioma neste jogo: a de `langTags` ou, sem ela, o próprio `pt`/`en`. */
export declare const langTagOf: (game: SeoGame, lang: Lang) => string;
/** Moeda de `offers.priceCurrency` neste idioma: a de `priceCurrency` ou BRL (pt) / USD (en). */
export declare const currencyOf: (game: SeoGame, lang: Lang) => string;
/** Idioma do x-default: `defaultLocale` ou `en`. */
export declare const defaultLangOf: (game: SeoGame) => Lang;
/** Confere o que quebraria o SEO sem avisar: origem, slugs repetidos, texto vazio nos dois idiomas. */
export declare function validateGame(game: SeoGame): string[];
export declare const GUIDES_TITLE: {
    readonly pt: "Guias";
    readonly en: "Guides";
};
export declare const otherGamesTitleOf: (game: SeoGame, lang: Lang) => string;
/** Links para as páginas de conteúdo do jogo num idioma (rótulo curto ou título). */
export declare const guidesOf: (game: SeoGame, lang: Lang) => SeoLink[];
/** Links para os outros jogos num idioma, sem o próprio jogo. */
export declare const othersOf: (game: SeoGame, lang: Lang) => SeoLink[];
/** Páginas de conteúdo (`articles`), uma por idioma, cada uma com as versões dos idiomas e o x-default. */
export declare function articlePagesFor(game: SeoGame): SeoArticlePage[];
/** Páginas geradas por fora (`extraPages`), prontas para o sitemap, cada uma com as versões dos idiomas e o x-default. */
export declare function extraEntriesFor(game: SeoGame): SitemapEntry[];
/** Uma página por idioma e por variação, cada uma apontando para a sua versão no outro idioma. */
export declare function pagesFor(game: SeoGame): SeoPage[];
/**
 * Avisos que não impedem o build, mas deixam o compartilhamento pior: imagem em SVG (ou ausente, o que gera SVG)
 * não aparece no WhatsApp, Facebook e X. Cada jogo deve informar um PNG ou JPG de 1200x630.
 */
export declare function seoWarnings(game: SeoGame): string[];
