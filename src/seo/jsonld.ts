import { LANGS } from '../i18n/index.ts';
import { currencyOf } from './pages.ts';
import type { SeoGame, SeoPage } from './types.ts';

const abs = (origin: string, pathOrUrl: string) => (/^https?:\/\//.test(pathOrUrl) ? pathOrUrl : origin + pathOrUrl);

/**
 * Dados estruturados `VideoGame` + `WebApplication` (schema.org) da página. A variação aponta para o jogo em `isPartOf`.
 * Sem `aggregateRating` nem `review`: avaliação só entra se for real e vier de dados reais, nunca inventada.
 */
export function videoGameJsonLd(game: SeoGame, page: SeoPage): Record<string, unknown> {
  const ld: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': ['VideoGame', 'WebApplication'],
    name: page.heading,
    description: page.description,
    url: page.url,
    image: abs(game.origin, page.image),
    inLanguage: page.langTag,
    genre: game.genre,
    applicationCategory: 'Game',
    operatingSystem: 'Any',
    playMode: 'SinglePlayer',
    isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: '0', priceCurrency: currencyOf(game, page.lang), availability: 'https://schema.org/InStock' },
  };
  if (game.gamePlatform !== undefined) ld.gamePlatform = game.gamePlatform;
  if (game.publisher) ld.publisher = { '@type': 'Organization', name: game.publisher.name, url: game.publisher.url };
  if (page.variant) {
    ld.isPartOf = { '@type': 'VideoGame', name: game.name[page.lang], url: `${game.origin}/${page.lang}/` };
  }
  return ld;
}

/**
 * Confere o que `VideoGame` + `WebApplication` precisam para o validador do schema.org e os leitores do Google:
 * contexto, tipo, textos, endereços https e idioma conhecido. Vazio = válido.
 * (Dados válidos não garantem resultado rico: o Google só mostra o de app com avaliação real, que não inventamos.)
 */
export function validateVideoGameJsonLd(ld: unknown): string[] {
  const errors: string[] = [];
  if (typeof ld !== 'object' || ld === null) return ['não é um objeto'];
  const o = ld as Record<string, unknown>;
  if (o['@context'] !== 'https://schema.org') errors.push('@context deve ser https://schema.org');
  const types = Array.isArray(o['@type']) ? o['@type'] : [o['@type']];
  if (!types.includes('VideoGame') || !types.includes('WebApplication')) errors.push('@type deve ser [VideoGame, WebApplication]');
  if (o.aggregateRating !== undefined || o.review !== undefined) errors.push('aggregateRating/review só com avaliação real');
  for (const key of ['name', 'description', 'applicationCategory', 'operatingSystem']) {
    if (typeof o[key] !== 'string' || !(o[key] as string).trim()) errors.push(`${key} ausente`);
  }
  const listOk = (v: unknown) => (Array.isArray(v) ? v.length > 0 : true) && [v].flat().every((x) => typeof x === 'string' && x.trim());
  if (!listOk(o.genre)) errors.push('genre ausente');
  if (o.gamePlatform !== undefined && !listOk(o.gamePlatform)) errors.push('gamePlatform inválido');
  for (const key of ['url', 'image']) {
    if (typeof o[key] !== 'string' || !/^https:\/\/\S+$/.test(o[key] as string)) errors.push(`${key} deve ser um endereço https`);
  }
  const primary = typeof o.inLanguage === 'string' && /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(o.inLanguage) ? o.inLanguage.split('-')[0]!.toLowerCase() : '';
  if (!(LANGS as readonly string[]).includes(primary)) errors.push('inLanguage deve ser pt ou en');
  const offers = o.offers as Record<string, unknown> | undefined;
  if (!offers || offers['@type'] !== 'Offer') errors.push('offers deve ser um Offer');
  else {
    if (typeof offers.price !== 'string' || Number.isNaN(Number(offers.price))) errors.push('offers.price deve ser número em texto');
    if (typeof offers.priceCurrency !== 'string' || !/^[A-Z]{3}$/.test(offers.priceCurrency)) errors.push('offers.priceCurrency deve ter 3 letras');
  }
  if (o.publisher !== undefined) {
    const p = o.publisher as Record<string, unknown>;
    if (p['@type'] !== 'Organization' || typeof p.name !== 'string' || !p.name) errors.push('publisher inválido');
  }
  return errors;
}

/** JSON seguro para dentro de <script>: o caractere menor-que vira o escape unicode, então nada fecha a tag antes da hora. */
export function jsonForScript(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(new RegExp(String.fromCharCode(0x2028), 'g'), '\\u2028')
    .replace(new RegExp(String.fromCharCode(0x2029), 'g'), '\\u2029');
}
