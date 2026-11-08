/**
 * Páginas de conteúdo (como jogar, estratégias, perguntas): HTML puro, sem o jogo e sem JavaScript.
 * Cada uma tem head completo, trilha visível e em `BreadcrumbList`, `FAQPage` quando há perguntas,
 * botão para jogar e links para as outras páginas do jogo e para os outros jogos.
 */
import { LANGS, type Lang } from '../i18n/index.ts';
import { breadcrumbJsonLd, faqJsonLd, jsonForScript } from './jsonld.ts';
import { GUIDES_TITLE, guidesOf, langTagOf, otherGamesTitleOf, othersOf } from './pages.ts';
import { escapeHtml } from './render.ts';
import type { SeoArticlePage, SeoGame, SeoLink } from './types.ts';

const T = {
  pt: { faq: 'Perguntas frequentes', play: (n: string) => `Jogar ${n}`, playNow: (n: string) => `Jogar ${n} agora, grátis`, modes: 'Jogue também', other: 'English', trail: 'Você está em', free: 'Grátis, sem cadastro e sem instalar.' },
  en: { faq: 'Frequently asked questions', play: (n: string) => `Play ${n}`, playNow: (n: string) => `Play ${n} now, free`, modes: 'Also play', other: 'Português', trail: 'You are here', free: 'Free, no sign-up, nothing to install.' },
} as const;

const DEFAULT_THEME = { accent: '#2F6BFF', accentDark: '#7EA2FF', onAccent: '#FFFFFF', onAccentDark: '#12131D' };
const abs = (origin: string, p: string) => (/^https?:\/\//.test(p) ? p : origin + p);
const ogLocale = (tag: string) => tag.replace('-', '_');

const list = (links: readonly SeoLink[]) => `<ul>${links.map((l) => `<li><a href="${escapeHtml(l.href)}">${escapeHtml(l.text)}</a></li>`).join('')}</ul>`;

/** Variações com página própria que valem como link (as que não saem do `llms.txt`, como os dias do arquivo, ficam de fora). */
export const variantLinksOf = (game: SeoGame, lang: Lang): SeoLink[] =>
  (game.variants ?? []).filter((v) => v.llms !== false).map((v) => ({ text: v.title[lang], href: `/${lang}/${v.slug}/` }));

function css(game: SeoGame): string {
  const g = game.articleTheme;
  const t = { accent: g?.accent ?? DEFAULT_THEME.accent, accentDark: g?.accentDark ?? DEFAULT_THEME.accentDark, onAccent: g?.onAccent ?? DEFAULT_THEME.onAccent, onAccentDark: g?.onAccentDark ?? DEFAULT_THEME.onAccentDark };
  return [
    `:root{color-scheme:light dark;--bg:#F4F5F9;--card:#FFFFFF;--ink:#1C1D2B;--muted:#5E6075;--line:#D9DBE6;--accent:${t.accent};--on:${t.onAccent}}`,
    `@media (prefers-color-scheme:dark){:root{--bg:#12131D;--card:#1C1E2C;--ink:#EDEEF5;--muted:#A9ABBF;--line:#2C2F42;--accent:${t.accentDark};--on:${t.onAccentDark}}}`,
    `*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:17px/1.6 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif}`,
    `.wrap{max-width:720px;margin:0 auto;padding:0 16px}`,
    `header{border-bottom:1px solid var(--line);background:var(--card)}header .wrap{display:flex;gap:12px;align-items:center;justify-content:space-between;min-height:56px;flex-wrap:wrap}`,
    `.crumbs{display:flex;flex-wrap:wrap;gap:6px;margin:0;padding:8px 0;list-style:none;font-size:15px;color:var(--muted)}.crumbs li+li::before{content:'›';margin-right:6px}`,
    `a{color:var(--accent);font-weight:700}.crumbs a{color:inherit;font-weight:500}`,
    `main{padding:28px 0 40px}h1{font-size:32px;line-height:1.2;margin:0 0 12px}h2{font-size:22px;line-height:1.3;margin:32px 0 8px}h3{font-size:18px;margin:20px 0 4px}`,
    `.lead{font-size:19px;color:var(--muted)}p,li{max-width:68ch}li{margin:4px 0}`,
    `.btn{display:inline-block;background:var(--accent);color:var(--on);text-decoration:none;padding:12px 20px;border-radius:12px;font-weight:800;margin:8px 0}`,
    `.note{color:var(--muted);font-size:15px;margin:0}`,
    `nav.more{border-top:1px solid var(--line);margin-top:32px}`,
    `footer{border-top:1px solid var(--line);padding:20px 0 32px;color:var(--muted);font-size:15px}footer .wrap{display:flex;gap:16px;flex-wrap:wrap}`,
  ].join('');
}

/** `Article` com o jogo em `about` e o estúdio como autor e editor. */
function articleJsonLd(game: SeoGame, page: SeoArticlePage, lastmod?: string): Record<string, unknown> {
  const org = game.publisher ? { '@type': 'Organization', name: game.publisher.name, url: game.publisher.url } : undefined;
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: page.text.title,
    description: page.text.description,
    inLanguage: page.langTag,
    url: page.url,
    mainEntityOfPage: page.url,
    image: abs(game.origin, page.image),
    ...(lastmod ? { dateModified: lastmod } : {}),
    ...(org ? { author: org, publisher: org } : {}),
    about: { '@type': 'VideoGame', name: game.name[page.lang], url: `${game.origin}/${page.lang}/` },
  };
}

/** HTML completo de uma página de conteúdo. */
export function renderArticle(game: SeoGame, page: SeoArticlePage, opts: { lastmod?: string } = {}): string {
  const { lang, text } = page;
  const t = T[lang];
  const name = game.name[lang];
  const image = abs(game.origin, page.image);
  const other = LANGS.find((l) => l !== lang)!;
  const otherPath = page.article.paths[other];
  const ld = [articleJsonLd(game, page, opts.lastmod), breadcrumbJsonLd(page.breadcrumb), faqJsonLd(text.faq ?? [], page.langTag)].filter(Boolean);

  const head = [
    `<meta charset="utf-8">`,
    `<meta name="viewport" content="width=device-width, initial-scale=1">`,
    `<title>${escapeHtml(`${text.title} | ${name}`)}</title>`,
    `<meta name="description" content="${escapeHtml(text.description)}">`,
    `<link rel="canonical" href="${escapeHtml(page.url)}">`,
    ...page.alternates.map((a) => `<link rel="alternate" hreflang="${escapeHtml(a.hreflang)}" href="${escapeHtml(a.url)}">`),
    `<meta property="og:type" content="article">`,
    `<meta property="og:site_name" content="${escapeHtml(name)}">`,
    `<meta property="og:title" content="${escapeHtml(text.title)}">`,
    `<meta property="og:description" content="${escapeHtml(text.description)}">`,
    `<meta property="og:url" content="${escapeHtml(page.url)}">`,
    `<meta property="og:locale" content="${ogLocale(page.langTag)}">`,
    `<meta property="og:locale:alternate" content="${ogLocale(langTagOf(game, other))}">`,
    `<meta property="og:image" content="${escapeHtml(image)}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${escapeHtml(text.title)}">`,
    `<meta name="twitter:description" content="${escapeHtml(text.description)}">`,
    `<meta name="twitter:image" content="${escapeHtml(image)}">`,
    ...(game.themeColor ? [`<meta name="theme-color" content="${escapeHtml(game.themeColor)}">`] : []),
    `<link rel="icon" href="${escapeHtml(game.articleTheme?.icon ?? '/icon-192.png')}">`,
    `<style>${css(game)}</style>`,
    ...ld.map((x) => `<script type="application/ld+json">${jsonForScript(x)}</script>`),
  ];

  const crumbs = page.breadcrumb
    .map((c, i) => (i === page.breadcrumb.length - 1 ? `<li aria-current="page">${escapeHtml(c.name)}</li>` : `<li><a href="${escapeHtml(c.url)}">${escapeHtml(c.name)}</a></li>`))
    .join('');
  const sections = text.sections
    .map((s) => {
      const ps = (s.paragraphs ?? []).map((p) => `<p>${escapeHtml(p)}</p>`).join('');
      const tag = s.ordered ? 'ol' : 'ul';
      const items = s.list?.length ? `<${tag}>${s.list.map((x) => `<li>${escapeHtml(x)}</li>`).join('')}</${tag}>` : '';
      return `<section><h2>${escapeHtml(s.heading)}</h2>${ps}${items}</section>`;
    })
    .join('');
  const faq = text.faq?.length
    ? `<section id="faq"><h2>${escapeHtml(text.faqTitle ?? t.faq)}</h2>${text.faq.map((f) => `<h3>${escapeHtml(f.q)}</h3><p>${escapeHtml(f.a)}</p>`).join('')}</section>`
    : '';
  const guides = guidesOf(game, lang).filter((g) => g.href !== page.path);
  const modes = variantLinksOf(game, lang);
  const others = othersOf(game, lang);
  const more = [
    guides.length ? `<h2>${GUIDES_TITLE[lang]}</h2>${list(guides)}` : '',
    modes.length ? `<h2>${t.modes}</h2>${list(modes)}` : '',
    others.length ? `<h2>${escapeHtml(otherGamesTitleOf(game, lang))}</h2>${list(others)}` : '',
  ].join('');
  const cta = (label: string) => `<p><a class="btn" href="/${lang}/">${escapeHtml(label)}</a></p><p class="note">${t.free}</p>`;
  const footLinks = (game.links?.[lang] ?? []).map((l) => `<a href="${escapeHtml(l.href)}">${escapeHtml(l.text)}</a>`).join('');

  return `<!doctype html>
<html lang="${escapeHtml(page.langTag)}">
  <head>
    ${head.join('\n    ')}
  </head>
  <body>
    <header><div class="wrap"><nav aria-label="${t.trail}"><ol class="crumbs">${crumbs}</ol></nav><a href="${escapeHtml(otherPath)}" hreflang="${escapeHtml(langTagOf(game, other))}">${t.other}</a></div></header>
    <main class="wrap" data-seo="article">
      <h1>${escapeHtml(text.title)}</h1>
      <p class="lead">${escapeHtml(text.description)}</p>${text.intro ? `\n      <p>${escapeHtml(text.intro)}</p>` : ''}
      ${cta(t.play(name))}
      ${sections}${faq}
      ${cta(t.playNow(name))}
      ${more ? `<nav class="more" data-seo="more">${more}</nav>` : ''}
    </main>
    <footer><div class="wrap"><a href="/${lang}/">${escapeHtml(name)}</a>${footLinks}${game.studio ? `<a href="${escapeHtml(game.studio.url[lang])}">${escapeHtml(game.studio.name)}</a>` : ''}</div></footer>
  </body>
</html>
`;
}
