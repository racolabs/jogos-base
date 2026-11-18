import { LANGS, localeOf } from "../i18n/index.js";
import { GUIDES_TITLE, langTagOf } from "./pages.js";
import { breadcrumbJsonLd, faqJsonLd, jsonForScript, videoGameJsonLd } from "./jsonld.js";
export const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const abs = (origin, p) => (/^https?:\/\//.test(p) ? p : origin + p);
/** `og:locale` (`pt_BR`) a partir da tag BCP 47 (`pt-BR`, `zh-Hans-CN`); sem região na tag, vale o padrão do idioma. */
function ogLocale(tag, lang) {
    const [base = '', ...rest] = tag.split('-');
    const region = rest.find((p) => /^[A-Za-z]{2}$/.test(p));
    return region ? `${base.toLowerCase()}_${region.toUpperCase()}` : localeOf(lang).replace('-', '_');
}
/** Tags do <head> da página: descrição, canonical, hreflang, Open Graph, Twitter e JSON-LD. */
export function headTags(game, page) {
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
    const crumbs = breadcrumbJsonLd(page.breadcrumb);
    if (crumbs)
        lines.push(`<script type="application/ld+json">${jsonForScript(crumbs)}</script>`);
    const faq = faqJsonLd(page.about?.faq ?? [], page.langTag);
    if (faq)
        lines.push(`<script type="application/ld+json">${jsonForScript(faq)}</script>`);
    if (page.about)
        lines.push(`<style data-seo="about">${ABOUT_CSS}</style>`);
    return lines.join('\n    ');
}
const linkList = (links) => `<ul>${links.map((l) => `<li><a href="${escapeHtml(l.href)}">${escapeHtml(l.text)}</a></li>`).join('')}</ul>`;
/**
 * Texto que já está no HTML inicial: título, descrição, introdução, ajuda, HTML da variação, guias, outros jogos e links.
 * O app troca isso quando carrega.
 */
export function bodyContent(page) {
    const steps = page.help.map((s) => `<li>${escapeHtml(s)}</li>`).join('');
    const intro = page.intro ? `<p>${escapeHtml(page.intro)}</p>` : '';
    const guides = page.guides.length ? `<nav data-seo="guides"><h2>${GUIDES_TITLE[page.lang]}</h2>${linkList(page.guides)}</nav>` : '';
    const others = page.others.length ? `<nav data-seo="others"><h2>${escapeHtml(page.othersTitle)}</h2>${linkList(page.others)}</nav>` : '';
    const links = page.links.length ? `<nav data-seo="links">${linkList(page.links)}</nav>` : '';
    return `<main data-seo="prerendered"><h1>${escapeHtml(page.h1)}</h1><p>${escapeHtml(page.description)}</p>${intro}<h2>${escapeHtml(page.helpTitle)}</h2><ol>${steps}</ol>${page.html ?? ''}${guides}${others}${links}</main>`;
}
const ABOUT_T = {
    pt: { title: 'Sobre o jogo', faq: 'Perguntas frequentes' },
    en: { title: 'About the game', faq: 'Frequently asked questions' },
};
/**
 * Estilo do "Sobre o jogo": usa as variáveis do próprio jogo (`--ink`, `--muted`, `--font-ui`), com reserva.
 * Os jogos zeram margens de h2/p e alguns bloqueiam seleção de texto; aqui isso é desfeito só dentro do bloco.
 */
export const ABOUT_CSS = [
    '.rl-about{box-sizing:border-box;max-width:720px;margin:0 auto;padding:40px 16px 56px;color:var(--ink,#1C1D2B);font:17px/1.6 var(--font-ui,system-ui,-apple-system,"Segoe UI",sans-serif);-webkit-user-select:text;user-select:text}',
    '.rl-about h2{font-size:24px;line-height:1.25;margin:0 0 12px}.rl-about h3{font-size:19px;line-height:1.3;margin:28px 0 8px}',
    '.rl-about p,.rl-about li{color:var(--muted,#5E6075);max-width:68ch}.rl-about p{margin:0 0 12px}.rl-about ul,.rl-about ol{margin:0 0 12px;padding-left:22px}.rl-about li{margin:4px 0}',
    '.rl-about dt{font-weight:700;margin:16px 0 4px}.rl-about dd{margin:0;color:var(--muted,#5E6075)}',
].join('');
const sectionHtml = (s) => {
    const paragraphs = (s.paragraphs ?? []).map((p) => `<p>${escapeHtml(p)}</p>`).join('');
    const tag = s.ordered ? 'ol' : 'ul';
    const list = s.list?.length ? `<${tag}>${s.list.map((i) => `<li>${escapeHtml(i)}</li>`).join('')}</${tag}>` : '';
    return `<h3>${escapeHtml(s.heading)}</h3>${paragraphs}${list}`;
};
/** Bloco "Sobre o jogo", visível abaixo do jogo. Vazio se a página não tiver `about`. */
export function aboutContent(game, page) {
    const about = page.about;
    if (!about)
        return '';
    const t = ABOUT_T[page.lang];
    const faq = about.faq?.length
        ? `<h3>${escapeHtml(about.faqTitle?.trim() || t.faq)}</h3><dl>${about.faq.map((f) => `<dt>${escapeHtml(f.q)}</dt><dd>${escapeHtml(f.a)}</dd>`).join('')}</dl>`
        : '';
    const title = about.title?.trim() || t.title;
    return `<section class="rl-about" data-seo="about" aria-labelledby="rl-about-title"><h2 id="rl-about-title">${escapeHtml(title)}</h2>${about.sections.map(sectionHtml).join('')}${faq}</section>`;
}
/** Acha o fim do `<div id=root>` contando divs aninhadas. Devolve [fim da tag de abertura, início do </div> de fechamento]. */
function findRoot(html, rootId) {
    const open = new RegExp(`<div\\b(?=[^>]*\\bid=["']${rootId}["'])[^>]*>`, 'i').exec(html);
    if (!open)
        return null;
    const start = open.index + open[0].length;
    const tag = /<(\/?)div\b[^>]*>/gi;
    tag.lastIndex = start;
    let depth = 1;
    for (let m = tag.exec(html); m; m = tag.exec(html)) {
        depth += m[1] ? -1 : 1;
        if (depth === 0)
            return [start, m.index];
    }
    return null;
}
const attr = (tag, name) => new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i').exec(tag)?.slice(1).find((v) => v !== undefined);
/**
 * Pega o index.html do build do jogo e devolve o da página: troca <html lang>, tira title/description/canonical/hreflang/OG
 * que o modelo já tinha (evita duplicata, em qualquer ordem de atributos), põe as tags novas no <head> e o texto dentro
 * do elemento raiz. O theme-color do modelo fica; só é trocado (o sem `media`) se o jogo informar `themeColor`.
 */
export function renderPage(template, game, page, { rootId = 'root' } = {}) {
    if (!/<\/head>/i.test(template))
        throw new Error('modelo sem </head>');
    if (!findRoot(template, rootId))
        throw new Error(`modelo sem <div id="${rootId}">`);
    let html = template
        .replace(/<title\b[^>]*>[\s\S]*?<\/title>\s*/i, '')
        .replace(/<meta\b[^>]*>\s*/gi, (tag) => {
        const name = (attr(tag, 'name') ?? '').toLowerCase();
        const property = (attr(tag, 'property') ?? '').toLowerCase();
        if (name === 'description' || /^(?:og|twitter):/.test(name) || /^(?:og|twitter):/.test(property))
            return '';
        if (name === 'theme-color' && game.themeColor && attr(tag, 'media') === undefined)
            return '';
        return tag;
    })
        .replace(/<link\b[^>]*>\s*/gi, (tag) => (attr(tag, 'rel')?.toLowerCase() === 'canonical' || /\bhreflang\s*=/i.test(tag) ? '' : tag))
        .replace(/<script\b(?=[^>]*\btype\s*=\s*["']application\/ld\+json["'])[^>]*>[\s\S]*?<\/script>\s*/gi, '');
    html = /<html\b[^>]*>/i.test(html)
        ? html.replace(/<html\b([^>]*)>/i, (_m, attrs) => `<html${attrs.replace(/\slang=["'][^"']*["']/i, '')} lang="${escapeHtml(page.langTag)}">`)
        : `<html lang="${escapeHtml(page.langTag)}">${html}`;
    html = html.replace(/<\/head>/i, () => `    ${headTags(game, page)}\n  </head>`);
    const [from, to] = findRoot(html, rootId);
    const close = to + '</div>'.length;
    // "Sobre o jogo" logo depois do elemento raiz: fica na página depois que o app monta.
    return html.slice(0, from) + bodyContent(page) + html.slice(to, close) + aboutContent(game, page) + html.slice(close);
}
