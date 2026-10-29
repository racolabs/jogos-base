/**
 * Parte do módulo que escreve em disco (só roda no build, em Node). Chame depois do build do jogo:
 *   prerender({ game, templatePath: 'dist/index.html', outDir: 'dist' })
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { pagesFor, seoWarnings } from "./pages.js";
import { renderPage } from "./render.js";
import { shareImageSvg } from "./share-image.js";
import { robotsTxt, sitemapXml } from "./sitemap.js";
/** Escreve páginas por idioma e variação, sitemap.xml, robots.txt e (sem `shareImage`) as imagens SVG. */
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
    const warnings = seoWarnings(game);
    for (const w of warnings)
        console.warn(`seo: aviso: ${w}`);
    for (const page of pages) {
        write(`${page.path.slice(1)}index.html`, renderPage(template, game, page, { rootId: opts.rootId }));
        if (!game.shareImage)
            write(page.image.slice(1), shareImageSvg(page, { name: game.name[page.lang], color: game.themeColor ?? '#1B1B3A' }));
    }
    write('sitemap.xml', sitemapXml(pages, opts.lastmod));
    write('robots.txt', robotsTxt(game.origin));
    return { pages, files, warnings };
}
