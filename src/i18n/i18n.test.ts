import { describe, expect, it } from 'vitest';
import { createI18n, defineMessages, initialLang, langFromBrowser, langFromPath, missingKeys, pathFor } from './index.ts';

const messages = defineMessages(
  { play: 'Jogar', best: (n: number) => `Recorde: ${n}` },
  { play: 'Play', best: (n: number) => `Best: ${n}` },
);

describe('textos', () => {
  it('traduz texto fixo e com valores', () => {
    expect(createI18n(messages, 'pt').t('play')).toBe('Jogar');
    expect(createI18n(messages, 'en').t('best', 900)).toBe('Best: 900');
  });

  it('missingKeys acusa tradução faltando vinda de JSON', () => {
    expect(missingKeys(messages)).toEqual([]);
    expect(missingKeys({ pt: { a: 'A', b: 'B' }, en: { a: 'A', c: 'C' } })).toEqual(['en.b', 'pt.c']);
  });

  it('números e datas no formato de cada idioma', () => {
    expect(createI18n(messages, 'pt').number(12480)).toBe('12.480');
    expect(createI18n(messages, 'en').number(12480)).toBe('12,480');
    const d = new Date(2026, 9, 25);
    expect(createI18n(messages, 'pt').date(d, { day: 'numeric', month: 'long' })).toBe('25 de outubro');
    expect(createI18n(messages, 'en').date(d, { day: 'numeric', month: 'long' })).toBe('October 25');
  });
});

describe('idioma pela URL', () => {
  it('lê /pt e /en no começo do caminho', () => {
    expect(langFromPath('/pt')).toBe('pt');
    expect(langFromPath('/en/como-jogar')).toBe('en');
    expect(langFromPath('/PT/')).toBe('pt');
    expect(langFromPath('/')).toBeNull();
    expect(langFromPath('/portugal')).toBeNull();
  });

  it('troca de idioma mantendo a página', () => {
    expect(pathFor('en', '/pt/como-jogar')).toBe('/en/como-jogar');
    expect(pathFor('pt', '/en')).toBe('/pt/');
    expect(pathFor('pt', '/')).toBe('/pt/');
  });

  it('URL vence a escolha salva, que vence o navegador', () => {
    expect(initialLang({ pathname: '/en', saved: 'pt', languages: ['pt-BR'] })).toBe('en');
    expect(initialLang({ pathname: '/', saved: 'en', languages: ['pt-BR'] })).toBe('en');
    expect(initialLang({ pathname: '/', saved: null, languages: ['en-US', 'pt-PT'] })).toBe('pt');
    expect(initialLang({ pathname: '/', saved: 'xx', languages: ['fr-FR'] })).toBe('en');
  });

  it('qualquer português no navegador vira pt', () => {
    expect(langFromBrowser(['pt-BR'])).toBe('pt');
    expect(langFromBrowser(['es-ES', 'en-GB'])).toBe('en');
  });
});
