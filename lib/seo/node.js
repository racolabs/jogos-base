/**
 * Parte do módulo que escreve em disco (só roda no build, em Node). Chame depois do build do jogo:
 *   prerender({ game, templatePath: 'dist/index.html', outDir: 'dist' })
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { renderArticle } from "./article.js";
import { llmsTxt } from "./llms.js";
import { articlePagesFor, extraEntriesFor, pagesFor, seoWarnings } from "./pages.js";
import { renderPage } from "./render.js";
import { shareImageSvg } from "./share-image.js";
import { robotsTxt, sitemapXml } from "./sitemap.js";
export { RACOLABS_GAMES, RACOLABS_STUDIO } from "./catalog.js";
export { breadcrumbJsonLd, faqJsonLd } from "./jsonld.js";
export { llmsTxt } from "./llms.js";
export { articlePagesFor, pagesFor } from "./pages.js";
export { renderArticle } from "./article.js";
/**
 * Caminhos que o service worker do PWA **não** deve trocar pelo `index.html` do jogo (páginas de conteúdo e as `extraPages`,
 * como a privacidade). Use em `VitePWA({ workbox: { navigateFallbackDenylist: navigateFallbackDenylist(game) } })`.
 */
export function navigateFallbackDenylist(game) {
    const esc = (p) => p.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
    const paths = [...(game.articles ?? []).flatMap((a) => Object.values(a.paths)), ...(game.extraPages ?? []).flatMap((e) => Object.values(e.paths))];
    // O Workbox compara caminho + query: `?utm_...` não pode fazer a página cair no index.html.
    return paths.map((p) => new RegExp(`^${esc(p)}?(?:\\?.*)?$`));
}
/**
 * Escreve páginas por idioma e variação, páginas de conteúdo, sitemap.xml (com as `extraPages` do jogo), robots.txt,
 * llms.txt e (sem `shareImage`) as imagens SVG.
 */
export function prerender(opts) {
    const { game, outDir } = opts;
    const template = opts.template ?? (opts.templatePath ? readFileSync(opts.templatePath, 'utf8') : undefined);
    if (template === undefined)
        throw new Error('informe template ou templatePath');
    const root = resolve(outDir);
    const files = [];
    const write = (rel, content) => {
        const target = resolve(join(root, rel));
        if (!target.startsWith(root + sep))
            throw new Error(`caminho fora de outDir: ${rel}`);
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, content);
        files.push(rel.split(sep).join('/'));
    };
    const pages = pagesFor(game);
    const articles = articlePagesFor(game);
    const warnings = seoWarnings(game);
    for (const w of warnings)
        console.warn(`seo: aviso: ${w}`);
    for (const page of pages) {
        write(`${page.path.slice(1)}index.html`, renderPage(template, game, page, { rootId: opts.rootId }));
        if (!game.shareImage)
            write(page.image.slice(1), shareImageSvg(page, { name: game.name[page.lang], color: game.themeColor ?? '#1B1B3A' }));
    }
    for (const a of articles)
        write(`${a.path.slice(1)}index.html`, renderArticle(game, a, { lastmod: opts.lastmod }));
    write('sitemap.xml', sitemapXml([...pages, ...articles, ...extraEntriesFor(game)], opts.lastmod));
    write('robots.txt', robotsTxt(game.origin));
    write('llms.txt', llmsTxt(game));
    return { pages, articles, files, warnings };
}
