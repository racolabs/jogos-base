/**
 * Parte do módulo que escreve em disco (só roda no build, em Node). Chame depois do build do jogo:
 *   prerender({ game, templatePath: 'dist/index.html', outDir: 'dist' })
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { renderArticle } from './article.ts';
import { llmsTxt } from './llms.ts';
import { articlePagesFor, extraEntriesFor, pagesFor, seoWarnings } from './pages.ts';
import { renderPage, type RenderOptions } from './render.ts';
import { shareImageSvg } from './share-image.ts';
import { robotsTxt, sitemapXml } from './sitemap.ts';
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
export function navigateFallbackDenylist(game: Pick<SeoGame, 'articles' | 'extraPages'>): RegExp[] {
  const esc = (p: string) => p.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
  const paths = [...(game.articles ?? []).flatMap((a) => Object.values(a.paths)), ...(game.extraPages ?? []).flatMap((e) => Object.values(e.paths))];
  // O Workbox compara caminho + query: `?utm_...` não pode fazer a página cair no index.html.
  return paths.map((p) => new RegExp(`^${esc(p)}?(?:\?.*)?$`));
}

/**
 * Escreve páginas por idioma e variação, páginas de conteúdo, sitemap.xml (com as `extraPages` do jogo), robots.txt,
 * llms.txt e (sem `shareImage`) as imagens SVG.
 */
export function prerender(opts: PrerenderOptions): PrerenderResult {
  const { game, outDir } = opts;
  const template = opts.template ?? (opts.templatePath ? readFileSync(opts.templatePath, 'utf8') : undefined);
  if (template === undefined) throw new Error('informe template ou templatePath');
  const root = resolve(outDir);
  const files: string[] = [];
  const write = (rel: string, content: string) => {
    const target = resolve(join(root, rel));
    if (!target.startsWith(root + sep)) throw new Error(`caminho fora de outDir: ${rel}`);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, content);
    files.push(rel.split(sep).join('/'));
  };

  const pages = pagesFor(game);
  const articles = articlePagesFor(game);
  const warnings = seoWarnings(game);
  for (const w of warnings) console.warn(`seo: aviso: ${w}`);
  for (const page of pages) {
    write(`${page.path.slice(1)}index.html`, renderPage(template, game, page, { rootId: opts.rootId }));
    if (!game.shareImage) write(page.image.slice(1), shareImageSvg(page, { name: game.name[page.lang], color: game.themeColor ?? '#1B1B3A' }));
  }
  for (const a of articles) write(`${a.path.slice(1)}index.html`, renderArticle(game, a, { lastmod: opts.lastmod }));
  write('sitemap.xml', sitemapXml([...pages, ...articles, ...extraEntriesFor(game)], opts.lastmod));
  write('robots.txt', robotsTxt(game.origin));
  write('llms.txt', llmsTxt(game));
  return { pages, articles, files, warnings };
}
