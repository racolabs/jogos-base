import { localeOf } from '../i18n/index.ts';
import { jsonForScript, videoGameJsonLd } from './jsonld.ts';
import type { SeoGame, SeoPage } from './types.ts';

export const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const abs = (origin: string, p: string) => (/^https?:\/\//.test(p) ? p : origin + p);
const ogLocale = (lang: string) => localeOf(lang as SeoPage['lang']).replace('-', '_');

/** Tags do <head> da página: descrição, canonical, hreflang, Open Graph, Twitter e JSON-LD. */
export function headTags(game: SeoGame, page: SeoPage): string {
  const image = abs(game.origin, page.image);
  const other = page.alternates.filter((a) => a.hreflang !== page.lang && a.hreflang !== 'x-default');
  const lines = [
    `<title>${escapeHtml(page.title)}</title>`,
    `<meta name="description" content="${escapeHtml(page.description)}">`,
    `<link rel="canonical" href="${escapeHtml(page.url)}">`,
    ...page.alternates.map((a) => `<link rel="alternate" hreflang="${a.hreflang}" href="${escapeHtml(a.url)}">`),
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="${escapeHtml(game.name[page.lang])}">`,
    `<meta property="og:title" content="${escapeHtml(page.title)}">`,
    `<meta property="og:description" content="${escapeHtml(page.description)}">`,
    `<meta property="og:url" content="${escapeHtml(page.url)}">`,
    `<meta property="og:locale" content="${ogLocale(page.lang)}">`,
    ...other.map((a) => `<meta property="og:locale:alternate" content="${ogLocale(a.hreflang)}">`),
    `<meta property="og:image" content="${escapeHtml(image)}">`,
    `<meta property="og:image:alt" content="${escapeHtml(page.heading)}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${escapeHtml(page.title)}">`,
    `<meta name="twitter:description" content="${escapeHtml(page.description)}">`,
    `<meta name="twitter:image" content="${escapeHtml(image)}">`,
    ...(game.themeColor ? [`<meta name="theme-color" content="${escapeHtml(game.themeColor)}">`] : []),
    `<script type="application/ld+json">${jsonForScript(videoGameJsonLd(game, page))}</script>`,
  ];
  return lines.join('\n    ');
}

/** Texto que já está no HTML inicial: título, descrição e ajuda. O app troca isso quando carrega. */
export function bodyContent(page: SeoPage): string {
  const steps = page.help.map((s) => `<li>${escapeHtml(s)}</li>`).join('');
  return `<main data-seo="prerendered"><h1>${escapeHtml(page.heading)}</h1><p>${escapeHtml(page.description)}</p><h2>${escapeHtml(page.helpTitle)}</h2><ol>${steps}</ol></main>`;
}

export interface RenderOptions {
  /** Elemento onde o app monta. Padrão: `root`. */
  rootId?: string;
}

/**
 * Pega o index.html do build do jogo e devolve o da página: troca <html lang>, tira title/description/canonical
 * que o modelo já tinha (evita duplicata), põe as tags novas no <head> e o texto dentro do elemento raiz.
 */
export function renderPage(template: string, game: SeoGame, page: SeoPage, { rootId = 'root' }: RenderOptions = {}): string {
  if (!/<\/head>/i.test(template)) throw new Error('modelo sem </head>');
  const rootRe = new RegExp(`(<div\\s+id=["']${rootId}["'][^>]*>)([\\s\\S]*?)(</div>)`, 'i');
  if (!rootRe.test(template)) throw new Error(`modelo sem <div id="${rootId}">`);

  let html = template
    .replace(/<title>[\s\S]*?<\/title>\s*/i, '')
    .replace(/<meta\s+name=["'](?:description|theme-color)["'][^>]*>\s*/gi, '')
    .replace(/<link\b[^>]*>\s*/gi, (tag) => (/\brel=["']canonical["']/i.test(tag) || /\bhreflang=/i.test(tag) ? '' : tag))
    .replace(/<meta\s+(?:property|name)=["'](?:og|twitter):[^"']*["'][^>]*>\s*/gi, '')
    .replace(/<script\s+type=["']application\/ld\+json["']>[\s\S]*?<\/script>\s*/gi, '');

  html = /<html\b[^>]*>/i.test(html)
    ? html.replace(/<html\b([^>]*)>/i, (_m, attrs: string) => `<html${attrs.replace(/\slang=["'][^"']*["']/i, '')} lang="${page.lang}">`)
    : `<html lang="${page.lang}">${html}`;
  html = html.replace(/<\/head>/i, () => `    ${headTags(game, page)}\n  </head>`);
  return html.replace(rootRe, (_m, open: string, _inner: string, close: string) => `${open}${bodyContent(page)}${close}`);
}
