import { LANGS } from "../i18n/index.js";
/** Trecho da URL: minúsculas, números e hífen; pode ter subpastas (`diario/2026-11-08`). */
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/;
const SUBPATH = (lang) => new RegExp(`^/${lang}/(?:[a-z0-9]+(?:-[a-z0-9]+)*/)+$`);
const DEFAULT_HELP_TITLE = { pt: 'Como jogar', en: 'How to play' };
export const DEFAULT_LANG = 'en';
const BCP47 = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/;
const LINK_HREF = /^(?:\/(?![\/\\])\S*|https:\/\/\S+)$/;
/** Tag BCP 47 do idioma neste jogo: a de `langTags` ou, sem ela, o próprio `pt`/`en`. */
export const langTagOf = (game, lang) => game.langTags?.[lang] ?? lang;
const DEFAULT_CURRENCY = { pt: 'BRL', en: 'USD' };
/** Moeda de `offers.priceCurrency` neste idioma: a de `priceCurrency` ou BRL (pt) / USD (en). */
export const currencyOf = (game, lang) => {
    const c = game.priceCurrency;
    return (typeof c === 'string' ? c : c?.[lang]) ?? DEFAULT_CURRENCY[lang];
};
/** Idioma do x-default: `defaultLocale` ou `en`. */
export const defaultLangOf = (game) => game.defaultLocale ?? DEFAULT_LANG;
/** Confere o que quebraria o SEO sem avisar: origem, slugs repetidos, texto vazio nos dois idiomas. */
export function validateGame(game) {
    const errors = [];
    if (!/^https:\/\/[^/\s]+$/.test(game.origin))
        errors.push('origin deve ser https sem barra no fim');
    if (game.shareImage !== undefined && !/^(?:\/(?!\/)\S*|https:\/\/\S+)$/.test(game.shareImage)) {
        errors.push('shareImage deve começar com / ou ser um endereço https completo');
    }
    if (game.defaultLocale !== undefined && !LANGS.includes(game.defaultLocale)) {
        errors.push(`defaultLocale deve ser ${LANGS.join(' ou ')}`);
    }
    for (const lang of LANGS) {
        if (game.heading?.[lang] !== undefined && !game.heading[lang].trim())
            errors.push(`heading.${lang} vazio`);
        const tag = game.langTags?.[lang];
        if (tag !== undefined && !BCP47.test(tag))
            errors.push(`langTags.${lang} inválido: ${tag}`);
        for (const l of game.links?.[lang] ?? []) {
            if (!l.text?.trim())
                errors.push(`links.${lang}: texto vazio`);
            if (typeof l.href !== 'string' || !LINK_HREF.test(l.href))
                errors.push(`links.${lang}: href deve começar com / ou ser https completo (${l.href})`);
        }
    }
    for (const lang of LANGS) {
        const cur = currencyOf(game, lang);
        if (!/^[A-Z]{3}$/.test(cur))
            errors.push(`priceCurrency.${lang} deve ter 3 letras maiúsculas: ${cur}`);
    }
    const genres = [game.genre].flat();
    if (!genres.length || genres.some((g) => typeof g !== 'string' || !g.trim()))
        errors.push('genre vazio');
    if (game.gamePlatform !== undefined && [game.gamePlatform].flat().some((g) => typeof g !== 'string' || !g.trim()))
        errors.push('gamePlatform com item vazio');
    const seen = new Set();
    for (const v of game.variants ?? []) {
        if (!SLUG.test(v.slug))
            errors.push(`slug inválido: ${v.slug}`);
        if (seen.has(v.slug))
            errors.push(`slug repetido: ${v.slug}`);
        seen.add(v.slug);
    }
    const taken = new Set();
    for (const lang of LANGS)
        for (const v of [null, ...(game.variants ?? [])])
            taken.add(pathOf(lang, v));
    for (const [i, extra] of (game.extraPages ?? []).entries()) {
        for (const lang of LANGS) {
            const path = extra.paths?.[lang];
            if (typeof path !== 'string' || !new RegExp(`^/${lang}/(?:[a-z0-9]+(?:-[a-z0-9]+)*/)+$`).test(path)) {
                errors.push(`extraPages[${i}].paths.${lang} deve ser /${lang}/<nome>/ (minúsculas, com barra no fim)`);
            }
            else if (taken.has(path))
                errors.push(`extraPages[${i}].paths.${lang} repete uma página existente: ${path}`);
            else
                taken.add(path);
        }
    }
    for (const [i, a] of (game.articles ?? []).entries()) {
        for (const lang of LANGS) {
            const path = a.paths?.[lang];
            if (typeof path !== 'string' || !SUBPATH(lang).test(path)) {
                errors.push(`articles[${i}].paths.${lang} deve ser /${lang}/<nome>/ (minúsculas, com barra no fim)`);
            }
            else if (taken.has(path))
                errors.push(`articles[${i}].paths.${lang} repete uma página existente: ${path}`);
            else
                taken.add(path);
            const t = a.text?.[lang];
            if (!t?.title?.trim())
                errors.push(`articles[${i}].text.${lang}.title vazio`);
            if (!t?.description?.trim())
                errors.push(`articles[${i}].text.${lang}.description vazio`);
            if (!t?.sections?.length)
                errors.push(`articles[${i}].text.${lang}.sections vazio`);
            for (const sec of t?.sections ?? []) {
                if (!sec.heading?.trim())
                    errors.push(`articles[${i}].text.${lang}: seção sem título`);
                if (!sec.paragraphs?.length && !sec.list?.length)
                    errors.push(`articles[${i}].text.${lang}: seção "${sec.heading}" vazia`);
            }
            for (const f of t?.faq ?? [])
                if (!f.q?.trim() || !f.a?.trim())
                    errors.push(`articles[${i}].text.${lang}: pergunta ou resposta vazia`);
        }
    }
    for (const o of game.otherGames ?? []) {
        for (const lang of LANGS) {
            if (!o.name?.[lang]?.trim() || !o.blurb?.[lang]?.trim())
                errors.push(`otherGames ${o.id}: nome ou frase vazia em ${lang}`);
            if (typeof o.url?.[lang] !== 'string' || !/^https:\/\/\S+$/.test(o.url[lang]))
                errors.push(`otherGames ${o.id}: url.${lang} deve ser https`);
        }
    }
    if (game.studio) {
        for (const lang of LANGS)
            if (!/^https:\/\/\S+$/.test(game.studio.url?.[lang] ?? ''))
                errors.push(`studio.url.${lang} deve ser https`);
    }
    for (const v of game.variants ?? []) {
        for (const lang of LANGS)
            if (/<script\b/i.test(v.html?.[lang] ?? ''))
                errors.push(`${v.slug}: html.${lang} não pode ter <script>`);
    }
    for (const lang of LANGS) {
        if (!game.name[lang]?.trim())
            errors.push(`name.${lang} vazio`);
        if (!game.description[lang]?.trim())
            errors.push(`description.${lang} vazio`);
        if (!game.help[lang]?.length)
            errors.push(`help.${lang} vazio`);
        for (const v of game.variants ?? []) {
            if (!v.title[lang]?.trim())
                errors.push(`${v.slug}: title.${lang} vazio`);
            if (!v.description[lang]?.trim())
                errors.push(`${v.slug}: description.${lang} vazio`);
        }
    }
    return errors;
}
const pathOf = (lang, variant) => `/${lang}/${variant ? `${variant.slug}/` : ''}`;
const introOf = (game, variant, lang) => {
    const intro = (variant ? variant.intro : game.intro)?.[lang]?.trim();
    return intro ? { intro } : {};
};
const DEFAULT_OTHERS_TITLE = { pt: 'Outros jogos', en: 'More games' };
export const GUIDES_TITLE = { pt: 'Guias', en: 'Guides' };
export const otherGamesTitleOf = (game, lang) => (game.otherGamesTitle ?? DEFAULT_OTHERS_TITLE)[lang];
/** Links para as páginas de conteúdo do jogo num idioma (rótulo curto ou título). */
export const guidesOf = (game, lang) => (game.articles ?? []).map((a) => ({ text: a.text[lang].label?.trim() || a.text[lang].title, href: a.paths[lang] }));
/** Links para os outros jogos num idioma, sem o próprio jogo. */
export const othersOf = (game, lang) => (game.otherGames ?? []).filter((o) => o.id !== game.id).map((o) => ({ text: `${o.name[lang]}: ${o.blurb[lang]}`, href: o.url[lang] }));
/** Primeiros degraus da trilha: estúdio (se houver) e a página inicial do jogo. */
function crumbsOf(game, lang) {
    return [
        ...(game.studio ? [{ name: game.studio.name, url: game.studio.url[lang] }] : []),
        { name: game.name[lang], url: `${game.origin}/${lang}/` },
    ];
}
/** Páginas de conteúdo (`articles`), uma por idioma, cada uma com as versões dos idiomas e o x-default. */
export function articlePagesFor(game) {
    const errors = validateGame(game);
    if (errors.length)
        throw new Error(`SEO inválido (${game.id}): ${errors.join('; ')}`);
    return (game.articles ?? []).flatMap((article) => {
        const alternates = [
            ...LANGS.map((l) => ({ hreflang: langTagOf(game, l), url: game.origin + article.paths[l] })),
            { hreflang: 'x-default', url: game.origin + article.paths[defaultLangOf(game)] },
        ];
        return LANGS.map((lang) => {
            const path = article.paths[lang];
            const text = article.text[lang];
            return {
                lang,
                path,
                url: game.origin + path,
                langTag: langTagOf(game, lang),
                article,
                text,
                alternates,
                image: game.shareImage ?? `/og/${lang}.svg`,
                breadcrumb: [...crumbsOf(game, lang), { name: text.label?.trim() || text.title, url: game.origin + path }],
            };
        });
    });
}
/** Páginas geradas por fora (`extraPages`), prontas para o sitemap, cada uma com as versões dos idiomas e o x-default. */
export function extraEntriesFor(game) {
    const errors = validateGame(game);
    if (errors.length)
        throw new Error(`SEO inválido (${game.id}): ${errors.join('; ')}`);
    return (game.extraPages ?? []).flatMap((extra) => {
        const alternates = [
            ...LANGS.map((l) => ({ hreflang: langTagOf(game, l), url: game.origin + extra.paths[l] })),
            { hreflang: 'x-default', url: game.origin + extra.paths[defaultLangOf(game)] },
        ];
        return LANGS.map((l) => ({ url: game.origin + extra.paths[l], alternates }));
    });
}
/** Uma página por idioma e por variação, cada uma apontando para a sua versão no outro idioma. */
export function pagesFor(game) {
    const errors = validateGame(game);
    if (errors.length)
        throw new Error(`SEO inválido (${game.id}): ${errors.join('; ')}`);
    const variants = [null, ...(game.variants ?? [])];
    const pages = [];
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
                links: (game.links?.[lang] ?? []),
                langTag: langTagOf(game, lang),
                alternates,
                image: game.shareImage ?? `/og/${lang}${variant ? `-${variant.slug.replace(/\//g, '-')}` : ''}.svg`,
                ...(variant?.html?.[lang] ? { html: variant.html[lang] } : {}),
                guides: guidesOf(game, lang),
                others: othersOf(game, lang),
                othersTitle: otherGamesTitleOf(game, lang),
                breadcrumb: variant ? [...crumbsOf(game, lang), { name: variant.title[lang], url: game.origin + path }] : crumbsOf(game, lang),
            });
        }
    }
    return pages;
}
/**
 * Avisos que não impedem o build, mas deixam o compartilhamento pior: imagem em SVG (ou ausente, o que gera SVG)
 * não aparece no WhatsApp, Facebook e X. Cada jogo deve informar um PNG ou JPG de 1200x630.
 */
export function seoWarnings(game) {
    if (!game.shareImage)
        return [`${game.id}: sem shareImage, só há SVG gerado; informe um PNG 1200x630 (WhatsApp, Facebook e X ignoram SVG)`];
    if (/\.svg(?:[?#].*)?$/i.test(game.shareImage))
        return [`${game.id}: shareImage em SVG; use PNG ou JPG 1200x630 (WhatsApp, Facebook e X ignoram SVG)`];
    return [];
}
