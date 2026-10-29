import { LANGS, type Lang } from '../i18n/index.ts';
import type { SeoGame, SeoPage, SeoVariant } from './types.ts';

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const DEFAULT_HELP_TITLE = { pt: 'Como jogar', en: 'How to play' } as const;
export const DEFAULT_LANG: Lang = 'en';

/** Confere o que quebraria o SEO sem avisar: origem, slugs repetidos, texto vazio nos dois idiomas. */
export function validateGame(game: SeoGame): string[] {
  const errors: string[] = [];
  if (!/^https:\/\/[^/\s]+$/.test(game.origin)) errors.push('origin deve ser https sem barra no fim');
  if (game.shareImage !== undefined && !/^(?:\/(?!\/)\S*|https:\/\/\S+)$/.test(game.shareImage)) {
    errors.push('shareImage deve começar com / ou ser um endereço https completo');
  }
  const seen = new Set<string>();
  for (const v of game.variants ?? []) {
    if (!SLUG.test(v.slug)) errors.push(`slug inválido: ${v.slug}`);
    if (seen.has(v.slug)) errors.push(`slug repetido: ${v.slug}`);
    seen.add(v.slug);
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

/** Uma página por idioma e por variação, cada uma apontando para a sua versão no outro idioma. */
export function pagesFor(game: SeoGame): SeoPage[] {
  const errors = validateGame(game);
  if (errors.length) throw new Error(`SEO inválido (${game.id}): ${errors.join('; ')}`);
  const variants: (SeoVariant | null)[] = [null, ...(game.variants ?? [])];
  const pages: SeoPage[] = [];
  for (const variant of variants) {
    const alternates = [
      ...LANGS.map((l) => ({ hreflang: l, url: game.origin + pathOf(l, variant) })),
      { hreflang: 'x-default', url: game.origin + pathOf(DEFAULT_LANG, variant) },
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
        helpTitle: (game.helpTitle ?? DEFAULT_HELP_TITLE)[lang],
        help: variant?.help?.[lang] ?? game.help[lang],
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
