import { LANGS, type Lang } from '../i18n/index.ts';
import type { SeoGame, SeoLink, SeoPage, SeoVariant, SitemapEntry } from './types.ts';

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DEFAULT_HELP_TITLE = { pt: 'Como jogar', en: 'How to play' } as const;
export const DEFAULT_LANG: Lang = 'en';
const BCP47 = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/;
const LINK_HREF = /^(?:\/(?![\/\\])\S*|https:\/\/\S+)$/;

/** Tag BCP 47 do idioma neste jogo: a de `langTags` ou, sem ela, o próprio `pt`/`en`. */
export const langTagOf = (game: SeoGame, lang: Lang): string => game.langTags?.[lang] ?? lang;
const DEFAULT_CURRENCY: Record<Lang, string> = { pt: 'BRL', en: 'USD' };
/** Moeda de `offers.priceCurrency` neste idioma: a de `priceCurrency` ou BRL (pt) / USD (en). */
export const currencyOf = (game: SeoGame, lang: Lang): string => {
  const c = game.priceCurrency;
  return (typeof c === 'string' ? c : c?.[lang]) ?? DEFAULT_CURRENCY[lang];
};
/** Idioma do x-default: `defaultLocale` ou `en`. */
export const defaultLangOf = (game: SeoGame): Lang => game.defaultLocale ?? DEFAULT_LANG;

/** Confere o que quebraria o SEO sem avisar: origem, slugs repetidos, texto vazio nos dois idiomas. */
export function validateGame(game: SeoGame): string[] {
  const errors: string[] = [];
  if (!/^https:\/\/[^/\s]+$/.test(game.origin)) errors.push('origin deve ser https sem barra no fim');
  if (game.shareImage !== undefined && !/^(?:\/(?!\/)\S*|https:\/\/\S+)$/.test(game.shareImage)) {
    errors.push('shareImage deve começar com / ou ser um endereço https completo');
  }
  if (game.defaultLocale !== undefined && !(LANGS as readonly string[]).includes(game.defaultLocale)) {
    errors.push(`defaultLocale deve ser ${LANGS.join(' ou ')}`);
  }
  for (const lang of LANGS) {
    if (game.heading?.[lang] !== undefined && !game.heading[lang]!.trim()) errors.push(`heading.${lang} vazio`);
    const tag = game.langTags?.[lang];
    if (tag !== undefined && !BCP47.test(tag)) errors.push(`langTags.${lang} inválido: ${tag}`);
    for (const l of game.links?.[lang] ?? []) {
      if (!l.text?.trim()) errors.push(`links.${lang}: texto vazio`);
      if (typeof l.href !== 'string' || !LINK_HREF.test(l.href)) errors.push(`links.${lang}: href deve começar com / ou ser https completo (${l.href})`);
    }
  }
  for (const lang of LANGS) {
    const cur = currencyOf(game, lang);
    if (!/^[A-Z]{3}$/.test(cur)) errors.push(`priceCurrency.${lang} deve ter 3 letras maiúsculas: ${cur}`);
  }
  const genres = [game.genre].flat();
  if (!genres.length || genres.some((g) => typeof g !== 'string' || !g.trim())) errors.push('genre vazio');
  if (game.gamePlatform !== undefined && [game.gamePlatform].flat().some((g) => typeof g !== 'string' || !g.trim())) errors.push('gamePlatform com item vazio');
  const seen = new Set<string>();
  for (const v of game.variants ?? []) {
    if (!SLUG.test(v.slug)) errors.push(`slug inválido: ${v.slug}`);
    if (seen.has(v.slug)) errors.push(`slug repetido: ${v.slug}`);
    seen.add(v.slug);
  }
  const taken = new Set<string>();
  for (const lang of LANGS) for (const v of [null, ...(game.variants ?? [])]) taken.add(pathOf(lang, v));
  for (const [i, extra] of (game.extraPages ?? []).entries()) {
    for (const lang of LANGS) {
      const path = extra.paths?.[lang];
      if (typeof path !== 'string' || !new RegExp(`^/${lang}/(?:[a-z0-9]+(?:-[a-z0-9]+)*/)+$`).test(path)) {
        errors.push(`extraPages[${i}].paths.${lang} deve ser /${lang}/<nome>/ (minúsculas, com barra no fim)`);
      } else if (taken.has(path)) errors.push(`extraPages[${i}].paths.${lang} repete uma página existente: ${path}`);
      else taken.add(path);
    }
  }
  for (const lang of LANGS) {
    if (!game.name[lang]?.trim()) errors.push(`name.${lang} vazio`);
    if (!game.description[lang]?.trim()) errors.push(`description.${lang} vazio`);
    if (!game.help[lang]?.length) errors.push(`help.${lang} vazio`);
    for (const v of game.variants ?? []) {
      if (!v.title[lang]?.trim()) errors.push(`${v.slug}: title.${lang} vazio`);
      if (!v.description[lang]?.trim()) errors.push(`${v.slug}: description.${lang} vazio`);
    }
  }
  return errors;
}

const pathOf = (lang: Lang, variant: SeoVariant | null) => `/${lang}/${variant ? `${variant.slug}/` : ''}`;

const introOf = (game: SeoGame, variant: SeoVariant | null, lang: Lang): { intro?: string } => {
  const intro = (variant ? variant.intro : game.intro)?.[lang]?.trim();
  return intro ? { intro } : {};
};

/** Páginas geradas por fora (`extraPages`), prontas para o sitemap, cada uma com as versões dos idiomas e o x-default. */
export function extraEntriesFor(game: SeoGame): SitemapEntry[] {
  const errors = validateGame(game);
  if (errors.length) throw new Error(`SEO inválido (${game.id}): ${errors.join('; ')}`);
  return (game.extraPages ?? []).flatMap((extra) => {
    const alternates = [
      ...LANGS.map((l) => ({ hreflang: langTagOf(game, l), url: game.origin + extra.paths[l] })),
      { hreflang: 'x-default', url: game.origin + extra.paths[defaultLangOf(game)] },
    ];
    return LANGS.map((l) => ({ url: game.origin + extra.paths[l], alternates }));
  });
}

/** Uma página por idioma e por variação, cada uma apontando para a sua versão no outro idioma. */
export function pagesFor(game: SeoGame): SeoPage[] {
  const errors = validateGame(game);
  if (errors.length) throw new Error(`SEO inválido (${game.id}): ${errors.join('; ')}`);
  const variants: (SeoVariant | null)[] = [null, ...(game.variants ?? [])];
  const pages: SeoPage[] = [];
  for (const variant of variants) {
    const alternates = [
      ...LANGS.map((l) => ({ hreflang: langTagOf(game, l), url: game.origin + pathOf(l, variant) })),
      { hreflang: 'x-default', url: game.origin + pathOf(defaultLangOf(game), variant) },
    ];
    for (const lang of LANGS) {
      const path = pathOf(lang, variant);
      pages.push({
        lang,
        path,
        url: game.origin + path,
        variant,
        title: variant ? `${variant.title[lang]} | ${game.name[lang]}` : game.title?.[lang] ?? game.name[lang],
        description: variant ? variant.description[lang] : game.description[lang],
        heading: variant ? variant.title[lang] : game.name[lang],
        h1: variant ? variant.title[lang] : game.heading?.[lang]?.trim() || game.name[lang],
        helpTitle: (game.helpTitle ?? DEFAULT_HELP_TITLE)[lang],
        help: variant?.help?.[lang] ?? game.help[lang],
        ...introOf(game, variant, lang),
        links: (game.links?.[lang] ?? []) as readonly SeoLink[],
        langTag: langTagOf(game, lang),
        alternates,
        image: game.shareImage ?? `/og/${lang}${variant ? `-${variant.slug}` : ''}.svg`,
      });
    }
  }
  return pages;
}

/**
 * Avisos que não impedem o build, mas deixam o compartilhamento pior: imagem em SVG (ou ausente, o que gera SVG)
 * não aparece no WhatsApp, Facebook e X. Cada jogo deve informar um PNG ou JPG de 1200x630.
 */
export function seoWarnings(game: SeoGame): string[] {
  if (!game.shareImage) return [`${game.id}: sem shareImage, só há SVG gerado; informe um PNG 1200x630 (WhatsApp, Facebook e X ignoram SVG)`];
  if (/\.svg(?:[?#].*)?$/i.test(game.shareImage)) return [`${game.id}: shareImage em SVG; use PNG ou JPG 1200x630 (WhatsApp, Facebook e X ignoram SVG)`];
  return [];
}
