import { escapeHtml } from './render.ts';
import type { SeoPage } from './types.ts';

const MAX_URLS = 50_000;

/**
 * sitemap.xml com todas as páginas e, em cada uma, as versões nos dois idiomas (xhtml:link).
 * `lastmod` (AAAA-MM-DD) é opcional: só informe se for a data real da última mudança.
 */
export function sitemapXml(pages: readonly SeoPage[], lastmod?: string): string {
  if (pages.length > MAX_URLS) throw new Error(`sitemap passa de ${MAX_URLS} endereços: divida em índice`);
  if (lastmod !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(lastmod)) throw new Error('lastmod deve ser AAAA-MM-DD');
  const urls = pages.map((p) => {
    const alts = p.alternates.map((a) => `    <xhtml:link rel="alternate" hreflang="${a.hreflang}" href="${escapeHtml(a.url)}"/>`).join('\n');
    return `  <url>\n    <loc>${escapeHtml(p.url)}</loc>${lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : ''}\n${alts}\n  </url>`;
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join('\n')}\n</urlset>\n`;
}

export const robotsTxt = (origin: string): string => `User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n`;
