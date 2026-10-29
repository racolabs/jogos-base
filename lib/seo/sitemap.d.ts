import type { SeoPage } from './types.ts';
/**
 * sitemap.xml com todas as páginas e, em cada uma, as versões nos dois idiomas (xhtml:link).
 * `lastmod` (AAAA-MM-DD) é opcional: só informe se for a data real da última mudança.
 */
export declare function sitemapXml(pages: readonly SeoPage[], lastmod?: string): string;
export declare const robotsTxt: (origin: string) => string;
