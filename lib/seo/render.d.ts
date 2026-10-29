import type { SeoGame, SeoPage } from './types.ts';
export declare const escapeHtml: (s: string) => string;
/** Tags do <head> da página: descrição, canonical, hreflang, Open Graph, Twitter e JSON-LD. */
export declare function headTags(game: SeoGame, page: SeoPage): string;
/** Texto que já está no HTML inicial: título, descrição e ajuda. O app troca isso quando carrega. */
export declare function bodyContent(page: SeoPage): string;
export interface RenderOptions {
    /** Elemento onde o app monta. Padrão: `root`. */
    rootId?: string;
}
/**
 * Pega o index.html do build do jogo e devolve o da página: troca <html lang>, tira title/description/canonical/hreflang/OG
 * que o modelo já tinha (evita duplicata, em qualquer ordem de atributos), põe as tags novas no <head> e o texto dentro
 * do elemento raiz. O theme-color do modelo fica; só é trocado (o sem `media`) se o jogo informar `themeColor`.
 */
export declare function renderPage(template: string, game: SeoGame, page: SeoPage, { rootId }?: RenderOptions): string;
