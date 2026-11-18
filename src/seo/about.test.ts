// @vitest-environment jsdom
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { EXAMPLE_GAME, EXAMPLE_TEMPLATE } from './fixture.ts';
import { prerender } from './node.ts';
import { pagesFor, renderPage, validateGame, type SeoGame } from './index.ts';

const parse = (html: string) => new DOMParser().parseFromString(html, 'text/html');
const ld = (doc: Document) => [...doc.querySelectorAll('script[type="application/ld+json"]')].map((s) => JSON.parse(s.textContent!) as Record<string, any>);

const GAME: SeoGame = {
  ...EXAMPLE_GAME,
  defaultLocale: 'pt',
  about: {
    pt: {
      title: 'Sobre o Exemplo',
      sections: [
        { heading: 'De onde vem', paragraphs: ['Um clássico <antigo>.'] },
        { heading: 'O que tem aqui', list: ['Metas do dia', 'Modo escuro'] },
      ],
      faq: [{ q: 'É grátis?', a: 'Sim.' }],
    },
    en: { sections: [{ heading: 'Where it comes from', paragraphs: ['A classic.'] }] },
  },
};

describe('about (Sobre o jogo)', () => {
  const pages = pagesFor(GAME);
  const home = (lang: 'pt' | 'en') => pages.find((p) => p.lang === lang && !p.variant)!;

  it('só na página inicial de cada idioma', () => {
    expect(home('pt').about?.title).toBe('Sobre o Exemplo');
    expect(pages.filter((p) => p.variant).every((p) => !p.about)).toBe(true);
  });

  it('fica fora do #root (não some quando o app monta), escapado, com FAQPage e estilo', () => {
    const doc = parse(renderPage(EXAMPLE_TEMPLATE, GAME, home('pt')));
    const about = doc.querySelector('section[data-seo="about"]')!;
    expect(about).not.toBeNull();
    expect(doc.getElementById('root')!.contains(about)).toBe(false);
    expect(doc.getElementById('root')!.nextElementSibling).toBe(about);
    expect(about.querySelector('h2')!.textContent).toBe('Sobre o Exemplo');
    expect(about.textContent).toContain('Um clássico <antigo>.');
    expect(about.querySelectorAll('li')).toHaveLength(2);
    expect(about.querySelector('dt')!.textContent).toBe('É grátis?');
    expect(ld(doc).find((x) => x['@type'] === 'FAQPage')?.mainEntity).toHaveLength(1);
    expect(doc.querySelector('style[data-seo="about"]')).not.toBeNull();
  });

  it('título padrão e sem perguntas, sem FAQPage', () => {
    const doc = parse(renderPage(EXAMPLE_TEMPLATE, GAME, home('en')));
    expect(doc.querySelector('section[data-seo="about"] h2')!.textContent).toBe('About the game');
    expect(ld(doc).some((x) => x['@type'] === 'FAQPage')).toBe(false);
  });

  it('sem about, nada muda', () => {
    const doc = parse(renderPage(EXAMPLE_TEMPLATE, EXAMPLE_GAME, pagesFor(EXAMPLE_GAME)[0]!));
    expect(doc.querySelector('[data-seo="about"]')).toBeNull();
  });

  it('recusa seção vazia, título vazio e pergunta sem resposta', () => {
    const bad: SeoGame = { ...GAME, about: { pt: { title: ' ', sections: [{ heading: 'X' }], faq: [{ q: 'a', a: '' }] } } };
    const errors = validateGame(bad).join('\n');
    expect(errors).toContain('about.pt.title vazio');
    expect(errors).toContain('seção "X" vazia');
    expect(errors).toContain('pergunta ou resposta vazia');
    expect(validateGame({ ...GAME, about: { en: { sections: [] } } }).join()).toContain('about.en.sections vazio');
  });
});

describe('prerender rootIndex', () => {
  it('reescreve o index.html da raiz com o texto do idioma padrão, canonical para ele e sem o Sobre', () => {
    const out = mkdtempSync(join(tmpdir(), 'seo-root-'));
    try {
      prerender({ game: GAME, template: EXAMPLE_TEMPLATE, outDir: out, rootIndex: true });
      const doc = parse(readFileSync(join(out, 'index.html'), 'utf8'));
      expect(doc.querySelector('link[rel="canonical"]')!.getAttribute('href')).toBe(`${GAME.origin}/pt/`);
      expect(doc.documentElement.lang).toBe('pt');
      expect(doc.querySelector('#root h1')).not.toBeNull();
      expect(doc.querySelector('[data-seo="about"]')).toBeNull();
      expect(readFileSync(join(out, 'sitemap.xml'), 'utf8')).not.toContain(`<loc>${GAME.origin}/</loc>`);
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  });

  it('sem a opção, não escreve index.html na raiz', () => {
    const out = mkdtempSync(join(tmpdir(), 'seo-root-'));
    try {
      const r = prerender({ game: GAME, template: EXAMPLE_TEMPLATE, outDir: out });
      expect(r.files).not.toContain('index.html');
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  });
});
