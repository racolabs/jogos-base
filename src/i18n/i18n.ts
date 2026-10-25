/**
 * Português e inglês desde o primeiro dia. O idioma vem da URL (/pt, /en) para o Google indexar os dois;
 * sem idioma na URL, vale a escolha salva e depois o idioma do navegador.
 */
export type Lang = 'pt' | 'en';
export const LANGS: readonly Lang[] = ['pt', 'en'];

const LOCALES: Record<Lang, string> = { pt: 'pt-BR', en: 'en-US' };
export const localeOf = (lang: Lang): string => LOCALES[lang];

export type Message = string | ((...args: any[]) => string);
export type Dictionary = Record<string, Message>;

/**
 * Junta os dois idiomas. O tipo exige as mesmas chaves e o mesmo formato em pt e en,
 * então esquecer uma tradução não compila; missingKeys cobre o que vier de JSON.
 */
export function defineMessages<T extends Dictionary>(pt: T, en: { [K in keyof T]: T[K] }): Record<Lang, T> {
  return { pt, en: en as T };
}

/** Chaves que existem num idioma e faltam no outro. Vazio = completo. */
export function missingKeys(dicts: Record<Lang, Dictionary>): string[] {
  const all = new Set(LANGS.flatMap((l) => Object.keys(dicts[l])));
  const out: string[] = [];
  for (const key of all) for (const l of LANGS) if (!(key in dicts[l])) out.push(`${l}.${key}`);
  return out.sort();
}

export function langFromPath(pathname: string): Lang | null {
  const first = pathname.split('/')[1]?.toLowerCase();
  return first === 'pt' || first === 'en' ? first : null;
}

export function langFromBrowser(languages: readonly string[]): Lang {
  return languages.some((l) => l.toLowerCase().startsWith('pt')) ? 'pt' : 'en';
}

/** URL na outra língua mantendo o resto do caminho: /pt/como-jogar → /en/como-jogar. */
export function pathFor(lang: Lang, pathname: string): string {
  const rest = langFromPath(pathname) ? pathname.replace(/^\/[^/]+/, '') : pathname;
  return `/${lang}${rest === '' || rest === '/' ? '/' : rest}`;
}

export function initialLang(ctx: { pathname: string; saved?: string | null; languages: readonly string[] }): Lang {
  const fromPath = langFromPath(ctx.pathname);
  if (fromPath) return fromPath;
  if (ctx.saved === 'pt' || ctx.saved === 'en') return ctx.saved;
  return langFromBrowser(ctx.languages);
}

export interface I18n<T extends Dictionary> {
  readonly lang: Lang;
  readonly locale: string;
  t<K extends keyof T>(key: K, ...args: T[K] extends (...a: infer A) => string ? A : []): string;
  number(n: number): string;
  date(d: Date, opts?: Intl.DateTimeFormatOptions): string;
}

export function createI18n<T extends Dictionary>(dicts: Record<Lang, T>, lang: Lang): I18n<T> {
  const dict = dicts[lang];
  const locale = localeOf(lang);
  const numbers = new Intl.NumberFormat(locale);
  return {
    lang,
    locale,
    t(key, ...args) {
      const msg = dict[key];
      if (msg === undefined) return String(key);
      return typeof msg === 'function' ? msg(...args) : msg;
    },
    number: (n) => numbers.format(n),
    date: (d, opts) => new Intl.DateTimeFormat(locale, opts).format(d),
  };
}
