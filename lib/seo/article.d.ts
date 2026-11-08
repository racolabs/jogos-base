/**
 * Páginas de conteúdo (como jogar, estratégias, perguntas): HTML puro, sem o jogo e sem JavaScript.
 * Cada uma tem head completo, trilha visível e em `BreadcrumbList`, `FAQPage` quando há perguntas,
 * botão para jogar e links para as outras páginas do jogo e para os outros jogos.
 */
import { type Lang } from '../i18n/index.ts';
import type { SeoArticlePage, SeoGame, SeoLink } from './types.ts';
/** Variações com página própria que valem como link (as que não saem do `llms.txt`, como os dias do arquivo, ficam de fora). */
export declare const variantLinksOf: (game: SeoGame, lang: Lang) => SeoLink[];
/** HTML completo de uma página de conteúdo. */
export declare function renderArticle(game: SeoGame, page: SeoArticlePage, opts?: {
    lastmod?: string;
}): string;
