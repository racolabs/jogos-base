/**
 * "Ajuda e mais" do menu/configurações: leva o jogador às páginas de conteúdo do jogo (Como jogar, Estratégias), às
 * variações com página própria, à privacidade (opcional) e aos outros jogos da RacoLabs. Esses links existem só no
 * HTML pré-renderizado, que some quando o jogo (SPA) carrega; aqui eles voltam para dentro do jogo.
 *
 * Fonte única: os caminhos vêm dos mesmos `articles` e `variants` que o módulo `seo` usa no build (passe os mesmos
 * objetos; não escreva slug à mão). Nenhum dado novo é coletado: são só `<a href>`; o `onOpen` é opcional e do jogo.
 *
 * Nova aba, sempre: as páginas de conteúdo são documentos estáticos fora do app, e abrir na mesma aba descartaria a
 * partida em andamento (estado em memória, animação, anúncio). Na nova aba o jogo continua como estava, e `rel="noopener"`
 * corta o vínculo com ele.
 *
 * Perfil de portal (CrazyGames): o pacote do portal não leva as páginas e não aceita links para fora nem divulgação.
 * Com `externalLinks` bloqueado o componente inteiro some; com `crossPromo` bloqueado, só "Outros jogos" some.
 */
import type { ReactNode } from 'react';
import { portalBlocks } from '../ads/portal.ts';
import type { Localized, SeoArticle, SeoVariant } from '../seo/types.ts';
import { MoreGames } from './games.tsx';

type Lang = 'pt' | 'en';

/** Privacidade dos jogos RacoLabs, no mesmo caminho em todos. Passe em `privacy` se o menu ainda não tiver o link. */
export const PRIVACY_PATHS: Localized = { pt: '/pt/privacidade/', en: '/en/privacy/' };

/** O que o componente lê do `SeoGame` do jogo. */
export interface HelpGame {
  /** Id do catálogo (`GAMES`): o jogo some de "Outros jogos". */
  id: string;
  articles?: readonly Pick<SeoArticle, 'paths' | 'text'>[];
  variants?: readonly Pick<SeoVariant, 'slug' | 'title' | 'label' | 'llms'>[];
}

export type HelpKind = 'guide' | 'variant' | 'privacy' | 'game';

export interface HelpLink {
  text: string;
  href: string;
  kind: HelpKind;
}

const TEXT = {
  pt: { title: 'Ajuda e mais', guides: 'Guias', variants: 'Modos', privacy: 'Privacidade', newTab: '(abre em nova aba)' },
  en: { title: 'Help and more', guides: 'Guides', variants: 'Modes', privacy: 'Privacy', newTab: '(opens in a new tab)' },
} as const;

/** Os links de ajuda de um jogo num idioma (sem "Outros jogos"); tudo vazio com `externalLinks` bloqueado pelo portal. */
export function helpLinksOf(game: HelpGame, lang: Lang, privacy?: Localized): { guides: HelpLink[]; variants: HelpLink[]; privacy: HelpLink | null } {
  if (portalBlocks('externalLinks')) return { guides: [], variants: [], privacy: null };
  return {
    guides: (game.articles ?? []).map((a) => ({ text: a.text[lang].label?.trim() || a.text[lang].title, href: a.paths[lang], kind: 'guide' as const })),
    // Como no módulo seo: variações com `llms: false` (os dias do arquivo) não são link de menu.
    variants: (game.variants ?? []).filter((v) => v.llms !== false).map((v) => ({ text: (v.label ?? v.title)[lang], href: `/${lang}/${v.slug}/`, kind: 'variant' as const })),
    privacy: privacy ? { text: TEXT[lang].privacy, href: privacy[lang], kind: 'privacy' as const } : null,
  };
}

export interface HelpMoreProps {
  lang: Lang;
  game: HelpGame;
  /** Caminho da privacidade por idioma; sem ele o link não aparece (o menu do jogo costuma já ter o seu). */
  privacy?: Localized;
  /** Chamado em todo toque (ex.: métrica do jogo). Recebe o tipo e o endereço (ou o id do jogo). */
  onOpen?: (kind: HelpKind, target: string) => void;
  /** Mostra "Outros jogos" (com `crossPromo` bloqueado pelo portal some de qualquer jeito). Padrão: sim. */
  otherGames?: boolean;
  className?: string;
}

function LinkList({ links, label, onOpen, lang }: { links: readonly HelpLink[]; label: string; onOpen?: HelpMoreProps['onOpen']; lang: Lang }): ReactNode {
  if (!links.length) return null;
  return (
    <section className="rl-help__group" aria-label={label}>
      <h3 className="rl-help__label">{label}</h3>
      <ul className="rl-help__list">
        {links.map((l) => (
          <li key={l.href}>
            <a className="rl-help__link" href={l.href} target="_blank" rel="noopener" onClick={() => onOpen?.(l.kind, l.href)}>
              <span>{l.text}</span>
              <span className="rl-help__ext" aria-hidden="true">
                ↗
              </span>
              <span className="rl-sr">{TEXT[lang].newTab}</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function HelpMore({ lang, game, privacy, onOpen, otherGames = true, className }: HelpMoreProps) {
  const links = helpLinksOf(game, lang, privacy);
  const showGames = otherGames && !portalBlocks('crossPromo');
  const mine = [...links.guides, ...(links.privacy ? [links.privacy] : [])];
  if (!mine.length && !links.variants.length && !showGames) return null;
  return (
    <div className={['rl-help', className].filter(Boolean).join(' ')}>
      <h2 className="rl-help__title">{TEXT[lang].title}</h2>
      <LinkList links={mine} label={TEXT[lang].guides} onOpen={onOpen} lang={lang} />
      <LinkList links={links.variants} label={TEXT[lang].variants} onOpen={onOpen} lang={lang} />
      {showGames ? <MoreGames lang={lang} current={game.id} onOpen={(id) => onOpen?.('game', id)} /> : null}
    </div>
  );
}
