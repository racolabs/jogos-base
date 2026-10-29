// @vitest-environment jsdom
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { EXAMPLE_GAME, EXAMPLE_TEMPLATE } from './fixture.ts';
import { prerender } from './node.ts';
import { extraEntriesFor, pagesFor, renderPage, sitemapXml, validateGame, videoGameJsonLd } from './index.ts';

/** Opções da 0.12.1: defaultLocale, langTags, intro, links, extraPages e heading. */
const parse = (html: string) => new DOMParser().parseFromString(html, 'text/html');
const XHTML = 'http://www.w3.org/1999/xhtml';
const pages = pagesFor(EXAMPLE_GAME);
const page = (path: string) => pages.find((p) => p.path === path)!;
const br = { ...EXAMPLE_GAME, defaultLocale: 'pt' as const, langTags: { pt: 'pt-BR', en: 'en-US' } };
const brPages = pagesFor(br);
const brPage = (path: string) => brPages.find((p) => p.path === path)!;

describe('defaultLocale (x-default)', () => {
  it('sem a opção, o x-default segue em inglês (igual à 0.12.0)', () => {
    expect(page('/pt/').alternates.at(-1)).toEqual({ hreflang: 'x-default', url: 'https://exemplo.racolabs.app/en/' });
  });

  it('com pt, o x-default aponta para a versão em português, no head e no sitemap', () => {
    expect(brPage('/en/dificil/').alternates.at(-1)).toEqual({ hreflang: 'x-default', url: 'https://exemplo.racolabs.app/pt/dificil/' });
    const doc = parse(renderPage(EXAMPLE_TEMPLATE, br, brPage('/en/')));
    expect(doc.querySelector('link[hreflang=x-default]')?.getAttribute('href')).toBe('https://exemplo.racolabs.app/pt/');
    expect(sitemapXml(brPages)).toContain('hreflang="x-default" href="https://exemplo.racolabs.app/pt/"');
  });

  it('recusa idioma desconhecido', () => {
    expect(validateGame({ ...EXAMPLE_GAME, defaultLocale: 'fr' as never })).toEqual(['defaultLocale deve ser pt ou en']);
  });
});

describe('langTags (BCP 47)', () => {
  it('sem a opção, hreflang e html lang saem pt/en e og:locale pt_BR/en_US (igual à 0.12.0)', () => {
    const doc = parse(renderPage(EXAMPLE_TEMPLATE, EXAMPLE_GAME, page('/en/')));
    expect(doc.documentElement.lang).toBe('en');
    expect([...doc.querySelectorAll('link[rel=alternate]')].map((l) => l.getAttribute('hreflang'))).toEqual(['pt', 'en', 'x-default']);
    expect(doc.querySelector('meta[property="og:locale"]')?.getAttribute('content')).toBe('en_US');
  });

  it('usa a tag em html lang, hreflang (head e sitemap) e og:locale; a URL continua /pt/ e /en/', () => {
    const p = brPage('/pt/dificil/');
    expect(p.url).toBe('https://exemplo.racolabs.app/pt/dificil/');
    expect(p.alternates.map((a) => a.hreflang)).toEqual(['pt-BR', 'en-US', 'x-default']);
    const doc = parse(renderPage(EXAMPLE_TEMPLATE, br, p));
    expect(doc.documentElement.lang).toBe('pt-BR');
    expect([...doc.querySelectorAll('link[rel=alternate]')].map((l) => l.getAttribute('hreflang'))).toEqual(['pt-BR', 'en-US', 'x-default']);
    expect(doc.querySelector('meta[property="og:locale"]')?.getAttribute('content')).toBe('pt_BR');
    expect(doc.querySelector('meta[property="og:locale:alternate"]')?.getAttribute('content')).toBe('en_US');
    const xml = new DOMParser().parseFromString(sitemapXml(brPages), 'application/xml');
    const first = xml.getElementsByTagName('url')[0]!;
    expect([...first.getElementsByTagNameNS(XHTML, 'link')].map((l) => l.getAttribute('hreflang'))).toEqual(['pt-BR', 'en-US', 'x-default']);
  });

  it('tag diferente muda o og:locale (sem região, vale o padrão do idioma) e tag inválida é recusada', () => {
    const g = { ...EXAMPLE_GAME, langTags: { pt: 'pt-PT', en: 'en' } };
    const doc = parse(renderPage(EXAMPLE_TEMPLATE, g, pagesFor(g)[0]!));
    expect(doc.documentElement.lang).toBe('pt-PT');
    expect(doc.querySelector('meta[property="og:locale"]')?.getAttribute('content')).toBe('pt_PT');
    expect(doc.querySelector('meta[property="og:locale:alternate"]')?.getAttribute('content')).toBe('en_US');
    expect(validateGame({ ...EXAMPLE_GAME, langTags: { pt: 'pt_BR' } })).toEqual(['langTags.pt inválido: pt_BR']);
    expect(validateGame({ ...EXAMPLE_GAME, langTags: { en: '"><x' } })).toHaveLength(1);
  });
});

describe('intro e links no HTML pré-renderizado', () => {
  const g = {
    ...EXAMPLE_GAME,
    intro: { pt: 'Jogue "Exemplo" <b>agora</b> & divirta-se.' },
    links: {
      pt: [{ text: 'Política de <Privacidade>', href: '/pt/privacidade/' }],
      en: [{ text: 'Privacy', href: 'https://exemplo.racolabs.app/en/privacy/' }],
    },
  };
  const gp = pagesFor(g);
  const gpage = (path: string) => gp.find((p) => p.path === path)!;

  it('intro vem depois da descrição, escapada; só na página inicial e só nos idiomas informados', () => {
    const doc = parse(renderPage(EXAMPLE_TEMPLATE, g, gpage('/pt/')));
    expect([...doc.querySelectorAll('#root p')].map((p) => p.textContent)).toEqual([g.description.pt, 'Jogue "Exemplo" <b>agora</b> & divirta-se.']);
    expect(doc.querySelector('#root b')).toBeNull();
    expect(doc.querySelector('#root h2')?.previousElementSibling?.textContent).toContain('divirta-se');
    expect(gpage('/en/').intro).toBeUndefined();
    expect(gpage('/pt/dificil/').intro).toBeUndefined();
    expect(parse(renderPage(EXAMPLE_TEMPLATE, g, gpage('/en/'))).querySelectorAll('#root p')).toHaveLength(1);
  });

  it('variação pode ter intro própria', () => {
    const v = { ...g, variants: [{ ...g.variants![0]!, intro: { pt: 'Intro difícil.' } }] };
    const doc = parse(renderPage(EXAMPLE_TEMPLATE, v, pagesFor(v).find((p) => p.path === '/pt/dificil/')!));
    expect([...doc.querySelectorAll('#root p')].map((p) => p.textContent)).toContain('Intro difícil.');
  });

  it('links entram em todas as páginas do idioma, com texto escapado', () => {
    for (const path of ['/pt/', '/pt/dificil/']) {
      const html = renderPage(EXAMPLE_TEMPLATE, g, gpage(path));
      const a = parse(html).querySelector('#root a')!;
      expect(a.getAttribute('href')).toBe('/pt/privacidade/');
      expect(a.textContent).toBe('Política de <Privacidade>');
      expect(html).toContain('Política de &lt;Privacidade&gt;');
    }
    expect(parse(renderPage(EXAMPLE_TEMPLATE, g, gpage('/en/'))).querySelector('#root a')?.getAttribute('href')).toBe('https://exemplo.racolabs.app/en/privacy/');
    expect(parse(renderPage(EXAMPLE_TEMPLATE, EXAMPLE_GAME, page('/pt/'))).querySelector('#root a')).toBeNull();
  });

  it('recusa link com texto vazio ou href perigoso', () => {
    const bad = (href: string, text = 'x') => validateGame({ ...EXAMPLE_GAME, links: { pt: [{ text, href }] } });
    expect(bad('javascript:alert(1)')).toHaveLength(1);
    expect(bad('//evil.com')).toHaveLength(1);
    expect(bad('http://x.app/')).toHaveLength(1);
    expect(bad('/pt/privacidade/', ' ')).toEqual(['links.pt: texto vazio']);
    expect(bad('/pt/privacidade/')).toEqual([]);
  });
});

describe('extraPages (sitemap)', () => {
  const g = { ...br, extraPages: [{ paths: { pt: '/pt/privacidade/', en: '/en/privacy/' } }] };

  it('entram no sitemap com hreflang das tags e x-default do defaultLocale', () => {
    const xml = new DOMParser().parseFromString(sitemapXml([...pagesFor(g), ...extraEntriesFor(g)]), 'application/xml');
    expect(xml.querySelector('parsererror')).toBeNull();
    const urls = [...xml.getElementsByTagName('url')];
    expect(urls.map((u) => u.getElementsByTagName('loc')[0]!.textContent).slice(-2)).toEqual([
      'https://exemplo.racolabs.app/pt/privacidade/',
      'https://exemplo.racolabs.app/en/privacy/',
    ]);
    const alts = [...urls.at(-1)!.getElementsByTagNameNS(XHTML, 'link')].map((l) => [l.getAttribute('hreflang'), l.getAttribute('href')]);
    expect(alts).toEqual([
      ['pt-BR', 'https://exemplo.racolabs.app/pt/privacidade/'],
      ['en-US', 'https://exemplo.racolabs.app/en/privacy/'],
      ['x-default', 'https://exemplo.racolabs.app/pt/privacidade/'],
    ]);
  });

  it('não viram páginas pré-renderizadas', () => {
    expect(pagesFor(g)).toHaveLength(6);
  });

  it('prerender grava as páginas extras no sitemap.xml e não cria arquivos para elas', () => {
    const dir = mkdtempSync(join(tmpdir(), 'seo-'));
    try {
      const out = prerender({ game: { ...g, shareImage: '/og.png' }, template: EXAMPLE_TEMPLATE, outDir: dir });
      expect(readFileSync(join(dir, 'sitemap.xml'), 'utf8')).toContain('<loc>https://exemplo.racolabs.app/en/privacy/</loc>');
      expect(out.files.some((f) => f.includes('priva'))).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('recusa caminho fora do padrão, de outro idioma ou repetido', () => {
    const bad = (paths: { pt: string; en: string }) => validateGame({ ...EXAMPLE_GAME, extraPages: [{ paths }] });
    expect(bad({ pt: '/pt/privacidade', en: '/en/privacy/' })).toHaveLength(1);
    expect(bad({ pt: '/en/privacidade/', en: '/en/privacy/' })).toHaveLength(1);
    expect(bad({ pt: '/pt/dificil/', en: '/en/privacy/' })[0]).toContain('repete');
    expect(bad({ pt: '/pt/privacidade/', en: '/en/privacy/' })).toEqual([]);
  });
});

describe('heading (h1 visível)', () => {
  it('sem a opção, o h1 é o nome do jogo (igual à 0.12.0)', () => {
    expect(parse(renderPage(EXAMPLE_TEMPLATE, EXAMPLE_GAME, page('/pt/'))).querySelector('#root h1')?.textContent).toBe('Exemplo');
  });

  it('com a opção, o h1 da página inicial muda por idioma, escapado; nome, JSON-LD e variações ficam como estavam', () => {
    const g = { ...EXAMPLE_GAME, heading: { pt: 'Exemplo online <grátis>', en: 'Example online free' } };
    const gp = pagesFor(g);
    const pt = gp.find((p) => p.path === '/pt/')!;
    const html = renderPage(EXAMPLE_TEMPLATE, g, pt);
    expect(parse(html).querySelector('#root h1')?.textContent).toBe('Exemplo online <grátis>');
    expect(html).toContain('Exemplo online &lt;grátis&gt;');
    expect(parse(renderPage(EXAMPLE_TEMPLATE, g, gp.find((p) => p.path === '/en/')!)).querySelector('#root h1')?.textContent).toBe('Example online free');
    expect(videoGameJsonLd(g, pt).name).toBe('Exemplo');
    expect(parse(renderPage(EXAMPLE_TEMPLATE, g, gp.find((p) => p.path === '/pt/dificil/')!)).querySelector('#root h1')?.textContent).toBe('Exemplo difícil');
  });

  it('idioma sem heading cai no nome; heading em branco é recusado', () => {
    const g = { ...EXAMPLE_GAME, heading: { pt: 'Só em pt' } };
    expect(pagesFor(g).find((p) => p.path === '/en/')!.h1).toBe('Example');
    expect(validateGame({ ...EXAMPLE_GAME, heading: { en: '  ' } })).toEqual(['heading.en vazio']);
  });
});
