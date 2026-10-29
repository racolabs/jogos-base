import { LANGS, localeOf, type Lang } from '../i18n/index.ts';
import { langTagOf } from './pages.ts';
import { jsonForScript, videoGameJsonLd } from './jsonld.ts';
import type { SeoGame, SeoPage } from './types.ts';

export const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const abs = (origin: string, p: string) => (/^https?:\/\//.test(p) ? p : origin + p);
/** `og:locale` (`pt_BR`) a partir da tag BCP 47 (`pt-BR`, `zh-Hans-CN`); sem região na tag, vale o padrão do idioma. */
function ogLocale(tag: string, lang: Lang): string {
  const [base = '', ...rest] = tag.split('-');
  const region = rest.find((p) => /^[A-Za-z]{2}$/.test(p));
  return region ? `${base.toLowerCase()}_${region.toUpperCase()}` : localeOf(lang).replace('-', '_');
}

/** Tags do <head> da página: descrição, canonical, hreflang, Open Graph, Twitter e JSON-LD. */
export function headTags(game: SeoGame, page: SeoPage): string {
  const image = abs(game.origin, page.image);
  const other = LANGS.filter((l) => l !== page.lang);
  const lines = [
    `<title>${escapeHtml(page.title)}</title>`,
    `<meta name="description" content="${escapeHtml(page.description)}">`,
    `<link rel="canonical" href="${escapeHtml(page.url)}">`,
    ...page.alternates.map((a) => `<link rel="alternate" hreflang="${escapeHtml(a.hreflang)}" href="${escapeHtml(a.url)}">`),
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="${escapeHtml(game.name[page.lang])}">`,
    `<meta property="og:title" content="${escapeHtml(page.title)}">`,
    `<meta property="og:description" content="${escapeHtml(page.description)}">`,
    `<meta property="og:url" content="${escapeHtml(page.url)}">`,
    `<meta property="og:locale" content="${ogLocale(page.langTag, page.lang)}">`,
    ...other.map((l) => `<meta property="og:locale:alternate" content="${ogLocale(langTagOf(game, l), l)}">`),
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

/** Texto que já está no HTML inicial: título, descrição, introdução, ajuda e links. O app troca isso quando carrega. */
export function bodyContent(page: SeoPage): string {
  const steps = page.help.map((s) => `<li>${escapeHtml(s)}</li>`).join('');
  const intro = page.intro ? `<p>${escapeHtml(page.intro)}</p>` : '';
  const links = page.links.length
    ? `<nav data-seo="links"><ul>${page.links.map((l) => `<li><a href="${escapeHtml(l.href)}">${escapeHtml(l.text)}</a></li>`).join('')}</ul></nav>`
    : '';
  return `<main data-seo="prerendered"><h1>${escapeHtml(page.h1)}</h1><p>${escapeHtml(page.description)}</p>${intro}<h2>${escapeHtml(page.helpTitle)}</h2><ol>${steps}</ol>${links}</main>`;
}

export interface RenderOptions {
  /** Elemento onde o app monta. Padrão: `root`. */
  rootId?: string;
}

/** Acha o fim do `<div id=root>` contando divs aninhadas. Devolve [fim da tag de abertura, início do </div> de fechamento]. */
function findRoot(html: string, rootId: string): [number, number] | null {
  const open = new RegExp(`<div\\b(?=[^>]*\\bid=["']${rootId}["'])[^>]*>`, 'i').exec(html);
  if (!open) return null;
  const start = open.index + open[0].length;
  const tag = /<(\/?)div\b[^>]*>/gi;
  tag.lastIndex = start;
  let depth = 1;
  for (let m = tag.exec(html); m; m = tag.exec(html)) {
    depth += m[1] ? -1 : 1;
    if (depth === 0) return [start, m.index];
  }
  return null;
}

const attr = (tag: string, name: string): string | undefined => new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i').exec(tag)?.slice(1).find((v) => v !== undefined);

/**
 * Pega o index.html do build do jogo e devolve o da página: troca <html lang>, tira title/description/canonical/hreflang/OG
 * que o modelo já tinha (evita duplicata, em qualquer ordem de atributos), põe as tags novas no <head> e o texto dentro
 * do elemento raiz. O theme-color do modelo fica; só é trocado (o sem `media`) se o jogo informar `themeColor`.
 */
export function renderPage(template: string, game: SeoGame, page: SeoPage, { rootId = 'root' }: RenderOptions = {}): string {
  if (!/<\/head>/i.test(template)) throw new Error('modelo sem </head>');
  if (!findRoot(template, rootId)) throw new Error(`modelo sem <div id="${rootId}">`);

  let html = template
    .replace(/<title\b[^>]*>[\s\S]*?<\/title>\s*/i, '')
    .replace(/<meta\b[^>]*>\s*/gi, (tag) => {
      const name = (attr(tag, 'name') ?? '').toLowerCase();
      const property = (attr(tag, 'property') ?? '').toLowerCase();
      if (name === 'description' || /^(?:og|twitter):/.test(name) || /^(?:og|twitter):/.test(property)) return '';
      if (name === 'theme-color' && game.themeColor && attr(tag, 'media') === undefined) return '';
      return tag;
    })
    .replace(/<link\b[^>]*>\s*/gi, (tag) => (attr(tag, 'rel')?.toLowerCase() === 'canonical' || /\bhreflang\s*=/i.test(tag) ? '' : tag))
    .replace(/<script\b(?=[^>]*\btype\s*=\s*["']application\/ld\+json["'])[^>]*>[\s\S]*?<\/script>\s*/gi, '');

  html = /<html\b[^>]*>/i.test(html)
    ? html.replace(/<html\b([^>]*)>/i, (_m, attrs: string) => `<html${attrs.replace(/\slang=["'][^"']*["']/i, '')} lang="${escapeHtml(page.langTag)}">`)
    : `<html lang="${escapeHtml(page.langTag)}">${html}`;
  html = html.replace(/<\/head>/i, () => `    ${headTags(game, page)}\n  </head>`);
  const [from, to] = findRoot(html, rootId)!;
  return html.slice(0, from) + bodyContent(page) + html.slice(to);
}
