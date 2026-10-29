/**
 * Português e inglês desde o primeiro dia. O idioma vem da URL (/pt, /en) para o Google indexar os dois;
 * sem idioma na URL, vale a escolha salva e depois o idioma do navegador.
 */
export type Lang = 'pt' | 'en';
export declare const LANGS: readonly Lang[];
export declare const localeOf: (lang: Lang) => string;
export type Message = string | ((...args: any[]) => string);
export type Dictionary = Record<string, Message>;
/**
 * Junta os dois idiomas. O tipo exige as mesmas chaves e o mesmo formato em pt e en,
 * então esquecer uma tradução não compila; missingKeys cobre o que vier de JSON.
 */
export declare function defineMessages<T extends Dictionary>(pt: T, en: {
    [K in keyof T]: T[K];
}): Record<Lang, T>;
/** Chaves que existem num idioma e faltam no outro. Vazio = completo. */
export declare function missingKeys(dicts: Record<Lang, Dictionary>): string[];
export declare function langFromPath(pathname: string): Lang | null;
export declare function langFromBrowser(languages: readonly string[]): Lang;
/** URL na outra língua mantendo o resto do caminho: /pt/como-jogar → /en/como-jogar. */
export declare function pathFor(lang: Lang, pathname: string): string;
export declare function initialLang(ctx: {
    pathname: string;
    saved?: string | null;
    languages: readonly string[];
}): Lang;
export interface I18n<T extends Dictionary> {
    readonly lang: Lang;
    readonly locale: string;
    t<K extends keyof T>(key: K, ...args: T[K] extends (...a: infer A) => string ? A : []): string;
    number(n: number): string;
    date(d: Date, opts?: Intl.DateTimeFormatOptions): string;
}
export declare function createI18n<T extends Dictionary>(dicts: Record<Lang, T>, lang: Lang): I18n<T>;
