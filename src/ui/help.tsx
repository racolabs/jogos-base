/**
 * "Ajuda e mais" do menu/configurações: leva o jogador às páginas de conteúdo do jogo (Como jogar, Estratégias), à
 * privacidade (opcional) e aos outros jogos da RacoLabs. Esses links existem só no
 * HTML pré-renderizado, que some quando o jogo (SPA) carrega; aqui eles voltam para dentro do jogo.
 *
 * Fonte única: os caminhos vêm dos mesmos `articles` que o módulo `seo` usa no build (passe o mesmo objeto; não escreva
 * slug à mão). Nenhum dado novo é coletado: são só `<a href>`; o `onOpen` é opcional e do jogo.
 *
 * Nova aba, sempre: as páginas de conteúdo são documentos estáticos fora do app, e abrir na mesma aba descartaria a
 * partida em andamento (estado em memória, animação, anúncio). Na nova aba o jogo continua como estava, e `rel="noopener"`
 * corta o vínculo com ele.
 *
 * Variações (/pt/dificil/, /pt/flor/...) NÃO entram aqui de propósito: cada uma é a própria SPA, e abri-la noutra aba deixaria duas
 * abas gravando o mesmo perfil no localStorage (a última sobrescreve estatísticas, sequência e partida salva). O jogo já tem seu
 * seletor de modo/dificuldade; as páginas de variação seguem no SEO e no site do estúdio.
 *
 * Sem internet: as páginas de conteúdo ficam fora do fallback do service worker, então offline abririam a tela de erro do
 * navegador. Com `navigator.onLine === false` os links dessas páginas aparecem desabilitados, com a nota "precisa de internet".
 *
 * Perfil de portal (CrazyGames): o pacote do portal não leva as páginas e não aceita links para fora nem divulgação.
 * Com `externalLinks` bloqueado o componente inteiro some; com `crossPromo` bloqueado, só "Outros jogos" some.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { portalBlocks } from '../ads/portal.ts';
import type { Localized, SeoArticle } from '../seo/types.ts';
import { MoreGames } from './games.tsx';

type Lang = 'pt' | 'en';

/** Privacidade dos jogos RacoLabs, no mesmo caminho em todos. Passe em `privacy` se o menu ainda não tiver o link. */
export const PRIVACY_PATHS: Localized = { pt: '/pt/privacidade/', en: '/en/privacy/' };

/** O que o componente lê do `SeoGame` do jogo. */
export interface HelpGame {
  /** Id do catálogo (`GAMES`): o jogo some de "Outros jogos". */
  id: string;
  articles?: readonly Pick<SeoArticle, 'paths' | 'text'>[];
}

export type HelpKind = 'guide' | 'privacy' | 'game';

export interface HelpLink {
  text: string;
  href: string;
  kind: HelpKind;
}

const TEXT = {
  pt: { title: 'Ajuda e mais', guides: 'Guias', privacy: 'Privacidade', newTab: '(abre em nova aba)', offline: 'precisa de internet' },
  en: { title: 'Help and more', guides: 'Guides', privacy: 'Privacy', newTab: '(opens in a new tab)', offline: 'needs internet' },
} as const;

/** Os links de ajuda de um jogo num idioma (sem "Outros jogos"); tudo vazio com `externalLinks` bloqueado pelo portal. */
export function helpLinksOf(game: HelpGame, lang: Lang, privacy?: Localized): { guides: HelpLink[]; privacy: HelpLink | null } {
  if (portalBlocks('externalLinks')) return { guides: [], privacy: null };
  return {
    guides: (game.articles ?? []).map((a) => ({ text: a.text[lang].label?.trim() || a.text[lang].title, href: a.paths[lang], kind: 'guide' as const })),
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

/** Sem internet? Escuta online/offline (o navegador só sabe com certeza quando está offline). */
function useOnline(): boolean {
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine !== false));
  useEffect(() => {
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener('online', up);
    window.addEventListener('offline', down);
    return () => {
      window.removeEventListener('online', up);
      window.removeEventListener('offline', down);
    };
  }, []);
  return online;
}

function LinkList({ links, label, showLabel = true, online, onOpen, lang }: { links: readonly HelpLink[]; label: string; showLabel?: boolean; online: boolean; onOpen?: HelpMoreProps['onOpen']; lang: Lang }): ReactNode {
  if (!links.length) return null;
  return (
    <section className="rl-help__group" aria-label={label}>
      {showLabel ? <h3 className="rl-help__label">{label}</h3> : null}
      <ul className="rl-help__list">
        {links.map((l) => (
          <li key={l.href}>
            {online ? (
              <a className="rl-help__link" href={l.href} target="_blank" rel="noopener" onClick={() => onOpen?.(l.kind, l.href)}>
                <span>{l.text}</span>
                <span className="rl-help__ext" aria-hidden="true">
                  ↗
                </span>
                <span className="rl-sr">{TEXT[lang].newTab}</span>
              </a>
            ) : (
              // Sem link: a página não está no cache do app e abriria o erro do navegador.
              <span className="rl-help__link rl-help__link--off" aria-disabled="true">
                <span>{l.text}</span>
                <small className="rl-help__note">{TEXT[lang].offline}</small>
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function HelpMore({ lang, game, privacy, onOpen, otherGames = true, className }: HelpMoreProps) {
  const online = useOnline();
  const links = helpLinksOf(game, lang, privacy);
  const showGames = otherGames && !portalBlocks('crossPromo');
  if (!links.guides.length && !links.privacy && !showGames) return null;
  return (
    <div className={['rl-help', className].filter(Boolean).join(' ')}>
      <h2 className="rl-help__title">{TEXT[lang].title}</h2>
      <LinkList links={links.guides} label={TEXT[lang].guides} online={online} onOpen={onOpen} lang={lang} />
      <LinkList links={links.privacy ? [links.privacy] : []} label={TEXT[lang].privacy} showLabel={false} online={online} onOpen={onOpen} lang={lang} />
      {showGames ? <MoreGames lang={lang} current={game.id} onOpen={(id) => onOpen?.('game', id)} /> : null}
    </div>
  );
}
