import { type Lang } from '../i18n/index.ts';
import type { SeoGame, SeoPage } from './types.ts';
export declare const DEFAULT_LANG: Lang;
/** Confere o que quebraria o SEO sem avisar: origem, slugs repetidos, texto vazio nos dois idiomas. */
export declare function validateGame(game: SeoGame): string[];
/** Uma página por idioma e por variação, cada uma apontando para a sua versão no outro idioma. */
export declare function pagesFor(game: SeoGame): SeoPage[];
/**
 * Avisos que não impedem o build, mas deixam o compartilhamento pior: imagem em SVG (ou ausente, o que gera SVG)
 * não aparece no WhatsApp, Facebook e X. Cada jogo deve informar um PNG ou JPG de 1200x630.
 */
export declare function seoWarnings(game: SeoGame): string[];
