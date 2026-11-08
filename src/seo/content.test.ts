// @vitest-environment jsdom
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GAMES } from '../ui/games.tsx';
import { EXAMPLE_GAME, EXAMPLE_TEMPLATE } from './fixture.ts';
import { navigateFallbackDenylist, prerender } from './node.ts';
import { ALLOWED_BOTS, articlePagesFor, llmsTxt, pagesFor, RACOLABS_GAMES, RACOLABS_STUDIO, renderArticle, renderPage, robotsTxt, validateGame, type SeoGame } from './index.ts';

const parse = (html: string) => new DOMParser().parseFromString(html, 'text/html');
const ld = (doc: Document) => [...doc.querySelectorAll('script[type="application/ld+json"]')].map((s) => JSON.parse(s.textContent!) as Record<string, any>);

const GAME: SeoGame = {
  ...EXAMPLE_GAME,
  defaultLocale: 'pt',
  langTags: { pt: 'pt-BR', en: 'en-US' },
  intro: { pt: 'Introdução do exemplo.', en: 'Example intro.' },
  links: { pt: [{ text: 'Privacidade', href: '/pt/privacidade/' }], en: [{ text: 'Privacy', href: '/en/privacy/' }] },
  studio: RACOLABS_STUDIO,
  otherGames: [...RACOLABS_GAMES, { id: 'exemplo', url: { pt: 'https://exemplo.racolabs.app/pt/', en: 'https://exemplo.racolabs.app/en/' }, name: { pt: 'Exemplo', en: 'Example' }, blurb: { pt: 'eu mesmo', en: 'myself' } }],
  variants: [
    ...EXAMPLE_GAME.variants!,
    {
      slug: 'diario/2026-11-08',
      title: { pt: 'Exemplo do dia 8/11', en: 'Daily Example Nov 8' },
      description: { pt: 'O desafio de 8 de novembro.', en: 'The November 8 challenge.' },
      html: { pt: '<table class="grade"><tr><td>1</td></tr></table>', en: '<table class="grade"><tr><td>1</td></tr></table>' },
      llms: false,
    },
  ],
  articles: [
    {
      paths: { pt: '/pt/como-jogar/', en: '/en/how-to-play/' },
      text: {
        pt: {
          title: 'Como jogar Exemplo: regras completas',
          label: 'Como jogar',
          description: 'Regras do Exemplo, passo a passo.',
          intro: 'Tudo o que você precisa saber.',
          sections: [
            { heading: 'Objetivo', paragraphs: ['Limpar o tabuleiro.'] },
            { heading: 'Passo a passo', list: ['Toque.', 'Ligue.'], ordered: true },
          ],
          faq: [
            { q: 'É grátis?', a: 'Sim, sem cadastro.' },
            { q: 'Funciona sem internet?', a: 'Sim, depois de aberto uma vez.' },
          ],
        },
        en: {
          title: 'How to play Example: full rules',
          label: 'How to play',
          description: 'Example rules, step by step.',
          sections: [{ heading: 'Goal', paragraphs: ['Clear the board.'] }],
          faq: [{ q: 'Is it free?', a: 'Yes, no sign-up.' }],
        },
      },
    },
    {
      paths: { pt: '/pt/estrategias/', en: '/en/strategy/' },
      text: {
        pt: { title: 'Estratégias do Exemplo', label: 'Estratégias', description: 'Dicas para vencer.', sections: [{ heading: 'Comece pelas pontas', list: ['Olhe as pontas.'] }] },
        en: { title: 'Example strategy', label: 'Strategy', description: 'Tips to win.', sections: [{ heading: 'Start at the edges', list: ['Look at the edges.'] }] },
      },
    },
  ],
};

describe('páginas de conteúdo', () => {
  const pages = articlePagesFor(GAME);
  const pt = pages.find((p) => p.path === '/pt/como-jogar/')!;
  const doc = parse(renderArticle(GAME, pt, { lastmod: '2026-11-08' }));

  it('uma por idioma, com canonical, hreflang recíproco e x-default no idioma padrão', () => {
    expect(pages.map((p) => p.path)).toEqual(['/pt/como-jogar/', '/en/how-to-play/', '/pt/estrategias/', '/en/strategy/']);
    expect(doc.documentElement.lang).toBe('pt-BR');
    expect(doc.querySelector('link[rel=canonical]')?.getAttribute('href')).toBe('https://exemplo.racolabs.app/pt/como-jogar/');
    const alt = [...doc.querySelectorAll('link[rel=alternate]')].map((l) => [l.getAttribute('hreflang'), l.getAttribute('href')]);
    expect(alt).toEqual([
      ['pt-BR', 'https://exemplo.racolabs.app/pt/como-jogar/'],
      ['en-US', 'https://exemplo.racolabs.app/en/how-to-play/'],
      ['x-default', 'https://exemplo.racolabs.app/pt/como-jogar/'],
    ]);
    expect(doc.title).toBe('Como jogar Exemplo: regras completas | Exemplo');
  });

  it('texto, seções, perguntas visíveis e botão para jogar, sem script de app', () => {
    expect(doc.querySelector('h1')?.textContent).toBe('Como jogar Exemplo: regras completas');
    expect([...doc.querySelectorAll('main h2')].map((h) => h.textContent)).toEqual(['Objetivo', 'Passo a passo', 'Perguntas frequentes', 'Guias', 'Jogue também', 'Outros jogos']);
    expect(doc.querySelector('main ol li')?.textContent).toBe('Toque.');
    expect([...doc.querySelectorAll('#faq h3')].map((h) => h.textContent)).toEqual(['É grátis?', 'Funciona sem internet?']);
    expect(doc.querySelector('a.btn')?.getAttribute('href')).toBe('/pt/');
    expect(doc.querySelectorAll('script:not([type="application/ld+json"])')).toHaveLength(0);
  });

  it('links para as outras páginas do jogo, as variações (sem os dias do arquivo) e os outros jogos, sem o próprio', () => {
    const hrefs = [...doc.querySelectorAll('nav.more a')].map((a) => a.getAttribute('href'));
    expect(hrefs).toContain('/pt/estrategias/');
    expect(hrefs).not.toContain('/pt/como-jogar/');
    expect(hrefs).toContain('/pt/dificil/');
    expect(hrefs).not.toContain('/pt/diario/2026-11-08/');
    expect(hrefs).toContain('https://sudoku.racolabs.app/pt/');
    expect(hrefs).not.toContain('https://exemplo.racolabs.app/pt/');
    expect(doc.querySelector('header a[hreflang]')?.getAttribute('href')).toBe('/en/how-to-play/');
    expect(doc.querySelector('footer a[href="/pt/privacidade/"]')?.textContent).toBe('Privacidade');
  });

  it('dados estruturados: Article, BreadcrumbList do estúdio até a página e FAQPage igual ao texto', () => {
    const [article, crumbs, faq] = ld(doc);
    expect(article).toMatchObject({ '@type': 'Article', headline: 'Como jogar Exemplo: regras completas', inLanguage: 'pt-BR', dateModified: '2026-11-08' });
    expect(crumbs!.itemListElement.map((c: any) => [c.position, c.name, c.item])).toEqual([
      [1, 'RacoLabs', 'https://racolabs.app/'],
      [2, 'Exemplo', 'https://exemplo.racolabs.app/pt/'],
      [3, 'Como jogar', 'https://exemplo.racolabs.app/pt/como-jogar/'],
    ]);
    expect(faq).toMatchObject({ '@type': 'FAQPage', mainEntity: [{ '@type': 'Question', name: 'É grátis?', acceptedAnswer: { '@type': 'Answer', text: 'Sim, sem cadastro.' } }, { name: 'Funciona sem internet?' }] });
  });

  it('sem perguntas, sem FAQPage', () => {
    const d = parse(renderArticle(GAME, pages.find((p) => p.path === '/en/strategy/')!));
    expect(ld(d).map((x) => x['@type'])).toEqual(['Article', 'BreadcrumbList']);
  });

  it('escapa o texto', () => {
    const evil: SeoGame = { ...GAME, articles: [{ ...GAME.articles![1]!, text: { ...GAME.articles![1]!.text, pt: { ...GAME.articles![1]!.text.pt, title: '<img src=x onerror=alert(1)>' } } }] };
    const html = renderArticle(evil, articlePagesFor(evil)[0]!);
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img src=x');
  });

  it('recusa caminho fora do idioma, repetido ou seção vazia', () => {
    const a = GAME.articles![1]!;
    expect(validateGame({ ...GAME, articles: [{ ...a, paths: { pt: '/en/x/', en: '/en/y/' } }] })).toContain('articles[0].paths.pt deve ser /pt/<nome>/ (minúsculas, com barra no fim)');
    expect(validateGame({ ...GAME, articles: [{ ...a, paths: { pt: '/pt/privacidade/', en: '/en/y/' } }], extraPages: [{ paths: { pt: '/pt/privacidade/', en: '/en/privacy/' } }] })).toContain(
      'articles[0].paths.pt repete uma página existente: /pt/privacidade/',
    );
    expect(validateGame({ ...GAME, articles: [{ ...a, text: { ...a.text, en: { ...a.text.en, sections: [{ heading: 'Vazia' }] } } }] })).toContain('articles[0].text.en: seção "Vazia" vazia');
    expect(validateGame({ ...GAME, variants: [{ ...GAME.variants![0]!, html: { pt: '<script>x</script>' } }] })).toContain('dificil: html.pt não pode ter <script>');
  });
});

describe('páginas do jogo com guias, outros jogos e trilha', () => {
  const pages = pagesFor(GAME);
  const home = parse(renderPage(EXAMPLE_TEMPLATE, GAME, pages.find((p) => p.path === '/pt/')!));
  const daily = pages.find((p) => p.path === '/pt/diario/2026-11-08/')!;

  it('guias e outros jogos no HTML pré-renderizado, antes dos links fixos', () => {
    const navs = [...home.querySelectorAll('#root nav')].map((n) => n.getAttribute('data-seo'));
    expect(navs).toEqual(['guides', 'others', 'links']);
    expect([...home.querySelectorAll('nav[data-seo=guides] a')].map((a) => a.textContent)).toEqual(['Como jogar', 'Estratégias']);
    expect(home.querySelectorAll('nav[data-seo=others] a')).toHaveLength(4);
  });

  it('BreadcrumbList depois do VideoGame; variação ganha mais um degrau', () => {
    const [game, crumbs] = ld(home);
    expect(game!['@type']).toEqual(['VideoGame', 'WebApplication']);
    expect(crumbs!.itemListElement).toHaveLength(2);
    const v = parse(renderPage(EXAMPLE_TEMPLATE, GAME, pages.find((p) => p.path === '/pt/dificil/')!));
    expect(ld(v)[1]!.itemListElement.map((c: any) => c.name)).toEqual(['RacoLabs', 'Exemplo', 'Exemplo difícil']);
    const plain = parse(renderPage(EXAMPLE_TEMPLATE, EXAMPLE_GAME, pagesFor(EXAMPLE_GAME)[0]!));
    expect(ld(plain)).toHaveLength(1);
  });

  it('variação com subpasta e HTML próprio', () => {
    expect(daily.url).toBe('https://exemplo.racolabs.app/pt/diario/2026-11-08/');
    expect(daily.image).toBe('/og/pt-diario-2026-11-08.svg');
    const d = parse(renderPage(EXAMPLE_TEMPLATE, GAME, daily));
    expect(d.querySelector('#root table.grade td')?.textContent).toBe('1');
  });
});

describe('robots.txt, llms.txt, sitemap e service worker', () => {
  it('robots libera os robôs de busca e de IA pelo nome', () => {
    const r = robotsTxt('https://x.racolabs.app');
    for (const bot of ['GPTBot', 'PerplexityBot', 'ClaudeBot', 'Google-Extended', 'Bingbot']) expect(r).toContain(`User-agent: ${bot}\nAllow: /`);
    expect(ALLOWED_BOTS.length).toBeGreaterThanOrEqual(5);
    expect(r).not.toMatch(/Disallow/);
    expect(r).toContain('Sitemap: https://x.racolabs.app/sitemap.xml');
  });

  it('llms.txt com o jogo nos dois idiomas, guias, variações (sem os dias) e outros jogos', () => {
    const t = llmsTxt(GAME);
    expect(t.startsWith('# Exemplo\n\n> Jogo de lógica')).toBe(true);
    expect(t).toContain('## Português (pt-BR)');
    expect(t).toContain('## English (en-US)');
    expect(t).toContain('- [Como jogar Exemplo: regras completas](https://exemplo.racolabs.app/pt/como-jogar/): Regras do Exemplo, passo a passo.');
    expect(t).toContain('(https://exemplo.racolabs.app/en/dificil/)');
    expect(t).not.toContain('2026-11-08');
    expect(t).toContain('- [Sudoku](https://sudoku.racolabs.app/pt/)');
    expect(t).not.toContain('[Exemplo](https://exemplo.racolabs.app/pt/)');
    expect(t).toContain('- [Privacidade](https://exemplo.racolabs.app/pt/privacidade/)');
  });

  it('prerender escreve artigos, llms.txt e sitemap com tudo', () => {
    const dir = mkdtempSync(join(tmpdir(), 'seo-conteudo-'));
    try {
      const r = prerender({ game: GAME, template: EXAMPLE_TEMPLATE, outDir: dir });
      expect(r.articles).toHaveLength(4);
      for (const f of ['pt/como-jogar/index.html', 'en/strategy/index.html', 'llms.txt', 'pt/diario/2026-11-08/index.html']) expect(existsSync(join(dir, f)), f).toBe(true);
      const sitemap = readFileSync(join(dir, 'sitemap.xml'), 'utf8');
      expect(sitemap).toContain('<loc>https://exemplo.racolabs.app/en/how-to-play/</loc>');
      expect(sitemap).toContain('<loc>https://exemplo.racolabs.app/pt/diario/2026-11-08/</loc>');
      expect(sitemap.match(/<loc>/g)).toHaveLength(pagesFor(GAME).length + 4);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('o service worker não troca artigos e privacidade pelo jogo', () => {
    const deny = navigateFallbackDenylist({ ...GAME, extraPages: [{ paths: { pt: '/pt/privacidade/', en: '/en/privacy/' } }] });
    const blocked = (p: string) => deny.some((r) => r.test(p));
    expect(blocked('/pt/como-jogar/')).toBe(true);
    expect(blocked('/en/how-to-play')).toBe(true);
    expect(blocked('/pt/privacidade/')).toBe(true);
    expect(blocked('/pt/como-jogar/?utm_source=x')).toBe(true);
    expect(blocked('/pt/')).toBe(false);
    expect(blocked('/pt/dificil/')).toBe(false);
    expect(blocked('/pt/como-jogar/x/')).toBe(false);
  });
});

describe('catálogo do seo', () => {
  it('mesmos jogos e endereços do GAMES de jogos-base/ui', () => {
    expect(RACOLABS_GAMES.map((g) => g.id)).toEqual(GAMES.map((g) => g.id));
    for (const g of RACOLABS_GAMES) {
      const ui = GAMES.find((x) => x.id === g.id)!;
      expect(g.url.pt).toBe(`${ui.url}/pt/`);
      expect(g.url.en).toBe(`${ui.url}/en/`);
    }
  });
});
