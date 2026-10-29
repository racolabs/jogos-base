export const LANGS = ['pt', 'en'];
const LOCALES = { pt: 'pt-BR', en: 'en-US' };
export const localeOf = (lang) => LOCALES[lang];
/**
 * Junta os dois idiomas. O tipo exige as mesmas chaves e o mesmo formato em pt e en,
 * então esquecer uma tradução não compila; missingKeys cobre o que vier de JSON.
 */
export function defineMessages(pt, en) {
    return { pt, en: en };
}
/** Chaves que existem num idioma e faltam no outro. Vazio = completo. */
export function missingKeys(dicts) {
    const all = new Set(LANGS.flatMap((l) => Object.keys(dicts[l])));
    const out = [];
    for (const key of all)
        for (const l of LANGS)
            if (!(key in dicts[l]))
                out.push(`${l}.${key}`);
    return out.sort();
}
export function langFromPath(pathname) {
    const first = pathname.split('/')[1]?.toLowerCase();
    return first === 'pt' || first === 'en' ? first : null;
}
export function langFromBrowser(languages) {
    return languages.some((l) => l.toLowerCase().startsWith('pt')) ? 'pt' : 'en';
}
/** URL na outra língua mantendo o resto do caminho: /pt/como-jogar → /en/como-jogar. */
export function pathFor(lang, pathname) {
    const rest = langFromPath(pathname) ? pathname.replace(/^\/[^/]+/, '') : pathname;
    return `/${lang}${rest === '' || rest === '/' ? '/' : rest}`;
}
export function initialLang(ctx) {
    const fromPath = langFromPath(ctx.pathname);
    if (fromPath)
        return fromPath;
    if (ctx.saved === 'pt' || ctx.saved === 'en')
        return ctx.saved;
    return langFromBrowser(ctx.languages);
}
export function createI18n(dicts, lang) {
    const dict = dicts[lang];
    const locale = localeOf(lang);
    const numbers = new Intl.NumberFormat(locale);
    return {
        lang,
        locale,
        t(key, ...args) {
            const msg = dict[key];
            if (msg === undefined)
                return String(key);
            return typeof msg === 'function' ? msg(...args) : msg;
        },
        number: (n) => numbers.format(n),
        date: (d, opts) => new Intl.DateTimeFormat(locale, opts).format(d),
    };
}
