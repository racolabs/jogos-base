// @vitest-environment jsdom
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { EXAMPLE_GAME, EXAMPLE_TEMPLATE } from './fixture.ts';
import { prerender } from './node.ts';
import { jsonForScript, pagesFor, renderPage, robotsTxt, shareImageSvg, sitemapXml, validateGame, validateVideoGameJsonLd, videoGameJsonLd, wrapText } from './index.ts';

const parse = (html: string) => new DOMParser().parseFromString(html, 'text/html');
const pages = pagesFor(EXAMPLE_GAME);
const page = (path: string) => pages.find((p) => p.path === path)!;

describe('páginas', () => {
  it('uma por idioma e por variação, com caminho e canonical terminando em barra', () => {
    expect(pages.map((p) => p.path)).toEqual(['/pt/', '/en/', '/pt/dificil/', '/en/dificil/', '/pt/diario/', '/en/diario/']);
    expect(page('/pt/dificil/').url).toBe('https://exemplo.racolabs.app/pt/dificil/');
  });

  it('cada página aponta para a sua versão nos dois idiomas e para o x-default em inglês', () => {
    expect(page('/pt/dificil/').alternates).toEqual([
      { hreflang: 'pt', url: 'https://exemplo.racolabs.app/pt/dificil/' },
      { hreflang: 'en', url: 'https://exemplo.racolabs.app/en/dificil/' },
      { hreflang: 'x-default', url: 'https://exemplo.racolabs.app/en/dificil/' },
    ]);
  });

  it('variação sem ajuda própria herda a do jogo', () => {
    expect(page('/en/diario/').help).toEqual(EXAMPLE_GAME.help.en);
    expect(page('/en/dificil/').help).toEqual(['No hints: trust your logic.']);
  });

  it('recusa configuração que quebraria o SEO', () => {
    const bad = { ...EXAMPLE_GAME, origin: 'http://x.app/', variants: [{ ...EXAMPLE_GAME.variants![0]!, slug: 'Ruim Slug' }, EXAMPLE_GAME.variants![0]!, EXAMPLE_GAME.variants![0]!] };
    const errors = validateGame(bad);
    expect(errors).toContain('origin deve ser https sem barra no fim');
    expect(errors).toContain('slug inválido: Ruim Slug');
    expect(errors).toContain('slug repetido: dificil');
    expect(() => pagesFor(bad)).toThrow(/SEO inválido/);
    expect(validateGame({ ...EXAMPLE_GAME, help: { pt: [], en: ['x'] } })).toEqual(['help.pt vazio']);
  });
});

describe('HTML inicial (sem executar JS)', () => {
  const html = renderPage(EXAMPLE_TEMPLATE, EXAMPLE_GAME, page('/pt/dificil/'));
  const doc = parse(html);

  it('traz título, descrição e texto de ajuda já no HTML', () => {
    expect(doc.title).toBe('Exemplo difícil | Exemplo');
    expect(doc.querySelector('meta[name=description]')?.getAttribute('content')).toBe('A versão difícil do Exemplo: menos dicas e tabuleiro maior.');
    expect(doc.querySelector('#root h1')?.textContent).toBe('Exemplo difícil');
    expect(doc.querySelector('#root p')?.textContent).toContain('versão difícil');
    expect(doc.querySelector('#root h2')?.textContent).toBe('Como jogar');
    expect([...doc.querySelectorAll('#root li')].map((li) => li.textContent)).toEqual(['Sem dicas: confie na lógica.']);
  });

  it('html lang, canonical e hreflang corretos, sem duplicar o que o modelo tinha', () => {
    expect(doc.documentElement.lang).toBe('pt');
    expect(doc.querySelectorAll('title')).toHaveLength(1);
    expect(doc.querySelectorAll('meta[name=description]')).toHaveLength(1);
    const canonical = doc.querySelectorAll('link[rel=canonical]');
    expect(canonical).toHaveLength(1);
    expect(canonical[0]?.getAttribute('href')).toBe('https://exemplo.racolabs.app/pt/dificil/');
    const alts = [...doc.querySelectorAll('link[rel=alternate]')].map((l) => [l.getAttribute('hreflang'), l.getAttribute('href')]);
    expect(alts).toEqual([
      ['pt', 'https://exemplo.racolabs.app/pt/dificil/'],
      ['en', 'https://exemplo.racolabs.app/en/dificil/'],
      ['x-default', 'https://exemplo.racolabs.app/en/dificil/'],
    ]);
    expect(doc.querySelector('link[rel=icon]')).not.toBeNull();
    expect(doc.querySelector('script[type=module]')).not.toBeNull();
  });

  it('Open Graph e Twitter apontam para a imagem da página, em endereço completo', () => {
    expect(doc.querySelector('meta[property="og:image"]')?.getAttribute('content')).toBe('https://exemplo.racolabs.app/og/pt-dificil.svg');
    expect(doc.querySelectorAll('meta[property="og:title"]')).toHaveLength(1);
    expect(doc.querySelector('meta[property="og:locale"]')?.getAttribute('content')).toBe('pt_BR');
    expect(doc.querySelector('meta[property="og:locale:alternate"]')?.getAttribute('content')).toBe('en_US');
    expect(doc.querySelector('meta[name="twitter:card"]')?.getAttribute('content')).toBe('summary_large_image');
  });

  it('usa a imagem pronta do jogo quando existe', () => {
    const g = { ...EXAMPLE_GAME, shareImage: '/og.png' };
    const d = parse(renderPage(EXAMPLE_TEMPLATE, g, pagesFor(g)[0]!));
    expect(d.querySelector('meta[property="og:image"]')?.getAttribute('content')).toBe('https://exemplo.racolabs.app/og.png');
  });

  it('escapa texto do jogo (nada de HTML solto vindo de descrição)', () => {
    const g = { ...EXAMPLE_GAME, name: { pt: 'A "B" <i>', en: 'A' } };
    const out = renderPage(EXAMPLE_TEMPLATE, g, pagesFor(g)[0]!);
    expect(out).toContain('A &quot;B&quot; &lt;i&gt;');
    expect(out).not.toContain('<i>');
  });

  it('modelo sem raiz ou sem head dá erro claro', () => {
    expect(() => renderPage('<html><head></head><body></body></html>', EXAMPLE_GAME, pages[0]!)).toThrow(/id="root"/);
    expect(() => renderPage('<div id="root"></div>', EXAMPLE_GAME, pages[0]!)).toThrow(/head/);
  });
});

describe('dados estruturados', () => {
  it('todas as páginas geram VideoGame válido', () => {
    for (const p of pages) expect(validateVideoGameJsonLd(videoGameJsonLd(EXAMPLE_GAME, p)), p.path).toEqual([]);
  });

  it('o JSON-LD do HTML é o mesmo objeto, legível por JSON.parse', () => {
    const doc = parse(renderPage(EXAMPLE_TEMPLATE, EXAMPLE_GAME, page('/en/')));
    const scripts = doc.querySelectorAll('script[type="application/ld+json"]');
    expect(scripts).toHaveLength(1);
    const ld = JSON.parse(scripts[0]!.textContent!);
    expect(ld).toMatchObject({ '@type': 'VideoGame', name: 'Example', url: 'https://exemplo.racolabs.app/en/', inLanguage: 'en', genre: 'Puzzle' });
    expect(validateVideoGameJsonLd(ld)).toEqual([]);
  });

  it('variação aponta para o jogo em isPartOf', () => {
    expect(videoGameJsonLd(EXAMPLE_GAME, page('/pt/diario/')).isPartOf).toEqual({ '@type': 'VideoGame', name: 'Exemplo', url: 'https://exemplo.racolabs.app/pt/' });
  });

  it('o validador pega o que falta', () => {
    const ok = videoGameJsonLd(EXAMPLE_GAME, pages[0]!);
    expect(validateVideoGameJsonLd({ ...ok, '@type': 'Game', name: '', url: 'http://x', inLanguage: 'fr', offers: { '@type': 'Offer', price: 'grátis', priceCurrency: 'r' } })).toEqual([
      '@type deve ser VideoGame',
      'name ausente',
      'url deve ser um endereço https',
      'inLanguage deve ser pt ou en',
      'offers.price deve ser número em texto',
      'offers.priceCurrency deve ter 3 letras',
    ]);
    expect(validateVideoGameJsonLd(null)).toEqual(['não é um objeto']);
  });

  it('</script> no texto não fecha a tag', () => {
    expect(jsonForScript({ a: '</script><b>' })).not.toContain('<');
    expect(JSON.parse(jsonForScript({ a: '</script>' }))).toEqual({ a: '</script>' });
  });
});

describe('sitemap e robots', () => {
  const xml = sitemapXml(pages, '2026-10-28');
  const doc = new DOMParser().parseFromString(xml, 'application/xml');

  it('é XML bem formado, com todas as páginas', () => {
    expect(doc.querySelector('parsererror')).toBeNull();
    expect(doc.documentElement.localName).toBe('urlset');
    expect(doc.documentElement.namespaceURI).toBe('http://www.sitemaps.org/schemas/sitemap/0.9');
    const locs = [...doc.getElementsByTagName('loc')].map((l) => l.textContent);
    expect(locs).toEqual(pages.map((p) => p.url));
    expect(new Set(locs).size).toBe(locs.length);
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
  });

  it('cada url lista as versões pt, en e x-default (inclusive a si mesma)', () => {
    const first = doc.getElementsByTagName('url')[0]!;
    const links = [...first.getElementsByTagNameNS('http://www.w3.org/1999/xhtml', 'link')].map((l) => l.getAttribute('hreflang'));
    expect(links).toEqual(['pt', 'en', 'x-default']);
    expect(first.getElementsByTagName('lastmod')[0]?.textContent).toBe('2026-10-28');
  });

  it('lastmod é opcional e precisa ser data', () => {
    expect(sitemapXml(pages)).not.toContain('lastmod');
    expect(() => sitemapXml(pages, '28/10/2026')).toThrow(/AAAA-MM-DD/);
  });

  it('escapa & nos endereços', () => {
    const odd = [{ ...pages[0]!, url: 'https://x.app/a?b=1&c=2', alternates: [{ hreflang: 'pt', url: 'https://x.app/a?b=1&c=2' }] }];
    const d = new DOMParser().parseFromString(sitemapXml(odd), 'application/xml');
    expect(d.querySelector('parsererror')).toBeNull();
    expect(d.getElementsByTagName('loc')[0]?.textContent).toBe('https://x.app/a?b=1&c=2');
  });

  it('robots.txt aponta para o sitemap', () => {
    expect(robotsTxt('https://exemplo.racolabs.app')).toContain('Sitemap: https://exemplo.racolabs.app/sitemap.xml');
  });
});

describe('imagem de compartilhamento', () => {
  it('SVG 1200x630 bem formado, com o título da página', () => {
    const svg = shareImageSvg(page('/en/dificil/'), { name: 'Example', color: '#1B1B3A' });
    const d = new DOMParser().parseFromString(svg, 'image/svg+xml');
    expect(d.querySelector('parsererror')).toBeNull();
    expect(d.documentElement.getAttribute('width')).toBe('1200');
    expect(d.documentElement.getAttribute('height')).toBe('630');
    expect(d.documentElement.textContent).toContain('Hard Example');
  });

  it('quebra o texto sem cortar palavra e põe reticências no excesso', () => {
    expect(wrapText('um dois tres quatro cinco', 10, 5)).toEqual(['um dois', 'tres', 'quatro', 'cinco']);
    expect(wrapText('um dois tres quatro cinco', 10, 2)).toEqual(['um dois', 'tres…']);
  });
});

describe('prerender em disco', () => {
  let dir = '';
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('escreve páginas, sitemap, robots e imagens; o conteúdo bate com renderPage', () => {
    dir = mkdtempSync(join(tmpdir(), 'seo-'));
    const out = prerender({ game: EXAMPLE_GAME, template: EXAMPLE_TEMPLATE, outDir: dir, lastmod: '2026-10-28' });
    expect(out.files.sort()).toEqual(
      [
        'pt/index.html', 'en/index.html', 'pt/dificil/index.html', 'en/dificil/index.html', 'pt/diario/index.html', 'en/diario/index.html',
        'og/pt.svg', 'og/en.svg', 'og/pt-dificil.svg', 'og/en-dificil.svg', 'og/pt-diario.svg', 'og/en-diario.svg',
        'sitemap.xml', 'robots.txt',
      ].sort(),
    );
    expect(readFileSync(join(dir, 'en', 'dificil', 'index.html'), 'utf8')).toBe(renderPage(EXAMPLE_TEMPLATE, EXAMPLE_GAME, page('/en/dificil/')));
    expect(readFileSync(join(dir, 'sitemap.xml'), 'utf8')).toBe(sitemapXml(pages, '2026-10-28'));
  });

  it('com imagem pronta no jogo não gera SVG', () => {
    dir = mkdtempSync(join(tmpdir(), 'seo-'));
    const out = prerender({ game: { ...EXAMPLE_GAME, shareImage: '/og.png' }, template: EXAMPLE_TEMPLATE, outDir: dir });
    expect(out.files.some((f) => f.endsWith('.svg'))).toBe(false);
  });
});
