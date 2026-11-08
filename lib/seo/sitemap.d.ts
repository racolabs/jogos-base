import type { SitemapEntry } from './types.ts';
/**
 * sitemap.xml com todas as páginas e, em cada uma, as versões nos dois idiomas (xhtml:link).
 * `lastmod` (AAAA-MM-DD) é opcional: só informe se for a data real da última mudança.
 */
export declare function sitemapXml(pages: readonly SitemapEntry[], lastmod?: string): string;
/** Robôs de busca e de IA nomeados no robots.txt (o `*` já libera; o nome deixa a decisão explícita). */
export declare const ALLOWED_BOTS: readonly ["Googlebot", "Bingbot", "GPTBot", "OAI-SearchBot", "ChatGPT-User", "PerplexityBot", "ClaudeBot", "Claude-SearchBot", "Google-Extended", "Applebot-Extended"];
/** robots.txt: libera tudo, nomeia os robôs de busca e de IA e aponta para o sitemap (e para o `llms.txt`, num comentário). */
export declare const robotsTxt: (origin: string) => string;
