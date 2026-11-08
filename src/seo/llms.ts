/**
 * `llms.txt` (https://llmstxt.org): resumo em Markdown do jogo para assistentes de IA, com os endereços que valem ler.
 * Sai do mesmo `SeoGame` das páginas, então não desatualiza.
 */
import { LANGS } from '../i18n/index.ts';
import { othersOf } from './pages.ts';
import type { SeoGame } from './types.ts';

const HEAD = {
  pt: { others: 'Outros jogos do estúdio', lang: 'Português (pt-BR)' },
  en: { others: 'More games from the studio', lang: 'English (en-US)' },
} as const;

/** Uma linha só, sem quebra (o formato é uma lista Markdown). */
const one = (s: string) => s.replace(/\s+/g, ' ').trim();

export function llmsTxt(game: SeoGame): string {
  const def = game.defaultLocale ?? 'en';
  const lines: string[] = [`# ${game.name[def]}`, '', `> ${one(game.description[def])}`, ''];
  if (game.intro?.[def]) lines.push(one(game.intro[def]!), '');
  if (game.publisher) lines.push(`${def === 'pt' ? 'Feito por' : 'Made by'} [${game.publisher.name}](${game.publisher.url}).`, '');
  for (const lang of [def, ...LANGS.filter((l) => l !== def)]) {
    const h = HEAD[lang];
    lines.push(`## ${h.lang}`, '');
    lines.push(`- [${one(game.title?.[lang] ?? game.name[lang])}](${game.origin}/${lang}/): ${one(game.description[lang])}`);
    for (const a of game.articles ?? []) lines.push(`- [${one(a.text[lang].title)}](${game.origin}${a.paths[lang]}): ${one(a.text[lang].description)}`);
    for (const v of (game.variants ?? []).filter((x) => x.llms !== false)) lines.push(`- [${one(v.title[lang])}](${game.origin}/${lang}/${v.slug}/): ${one(v.description[lang])}`);
    lines.push('');
  }
  const others = othersOf(game, def);
  if (others.length) {
    lines.push(`## ${HEAD[def].others}`, '');
    for (const o of game.otherGames!.filter((x) => x.id !== game.id)) lines.push(`- [${o.name[def]}](${o.url[def]}): ${one(o.blurb[def])}`);
    lines.push('');
  }
  if (game.links?.[def]?.length) {
    lines.push('## Optional', '');
    for (const l of game.links[def]!) lines.push(`- [${one(l.text)}](${/^https:/.test(l.href) ? l.href : game.origin + l.href})`);
    lines.push('');
  }
  return lines.join('\n');
}
