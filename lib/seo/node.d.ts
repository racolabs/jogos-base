import { type RenderOptions } from './render.ts';
import type { SeoArticlePage, SeoGame, SeoPage } from './types.ts';
export { RACOLABS_GAMES, RACOLABS_STUDIO } from './catalog.ts';
export { breadcrumbJsonLd, faqJsonLd } from './jsonld.ts';
export { llmsTxt } from './llms.ts';
export { articlePagesFor, pagesFor } from './pages.ts';
export { renderArticle } from './article.ts';
export interface PrerenderOptions extends RenderOptions {
    game: SeoGame;
    /** index.html gerado pelo build do jogo. */
    templatePath?: string;
    /** Ou o próprio HTML. */
    template?: string;
    /** Pasta do build (a que vai para o servidor). */
    outDir: string;
    /** AAAA-MM-DD da última mudança, se quiser no sitemap. */
    lastmod?: string;
}
export interface PrerenderResult {
    pages: SeoPage[];
    /** Páginas de conteúdo (`articles`). */
    articles: SeoArticlePage[];
    /** Arquivos escritos, relativos a outDir, com `/`. */
    files: string[];
    /** Avisos do build (ex.: imagem de compartilhamento em SVG). Também vão para o console. */
    warnings: string[];
}
/**
 * Caminhos que o service worker do PWA **não** deve trocar pelo `index.html` do jogo (páginas de conteúdo e as `extraPages`,
 * como a privacidade). Use em `VitePWA({ workbox: { navigateFallbackDenylist: navigateFallbackDenylist(game) } })`.
 */
export declare function navigateFallbackDenylist(game: SeoGame): RegExp[];
/**
 * Escreve páginas por idioma e variação, páginas de conteúdo, sitemap.xml (com as `extraPages` do jogo), robots.txt,
 * llms.txt e (sem `shareImage`) as imagens SVG.
 */
export declare function prerender(opts: PrerenderOptions): PrerenderResult;
