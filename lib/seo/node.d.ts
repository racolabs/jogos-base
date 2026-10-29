import { type RenderOptions } from './render.ts';
import type { SeoGame, SeoPage } from './types.ts';
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
    /** Arquivos escritos, relativos a outDir, com `/`. */
    files: string[];
    /** Avisos do build (ex.: imagem de compartilhamento em SVG). Também vão para o console. */
    warnings: string[];
}
/** Escreve páginas por idioma e variação, sitemap.xml (com as `extraPages` do jogo), robots.txt e (sem `shareImage`) as imagens SVG. */
export declare function prerender(opts: PrerenderOptions): PrerenderResult;
