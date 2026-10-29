/**
 * Parte do módulo que escreve em disco (só roda no build, em Node). Chame depois do build do jogo:
 *   prerender({ game, templatePath: 'dist/index.html', outDir: 'dist' })
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { pagesFor } from './pages.ts';
import { renderPage, type RenderOptions } from './render.ts';
import { shareImageSvg } from './share-image.ts';
import { robotsTxt, sitemapXml } from './sitemap.ts';
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
}

/** Escreve páginas por idioma e variação, sitemap.xml, robots.txt e (sem `shareImage`) as imagens SVG. */
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
  for (const page of pages) {
    write(`${page.path.slice(1)}index.html`, renderPage(template, game, page, { rootId: opts.rootId }));
    if (!game.shareImage) write(page.image.slice(1), shareImageSvg(page, { name: game.name[page.lang], color: game.themeColor ?? '#1B1B3A' }));
  }
  write('sitemap.xml', sitemapXml(pages, opts.lastmod));
  write('robots.txt', robotsTxt(game.origin));
  return { pages, files };
}
