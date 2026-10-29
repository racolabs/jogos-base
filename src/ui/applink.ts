/**
 * Link para outro jogo do estúdio. Nunca abre dentro da janela deste app instalado:
 * - Android com o app instalado aberto: vai pelo sistema (intent). Se o outro jogo estiver instalado,
 *   abre o app dele; se não, abre o navegador.
 * - Casca Windows (user agent com RacoLabsWindows/): abre a página do outro jogo na Microsoft Store
 *   (ms-windows-store://), que mostra "Obter" ou "Abrir".
 * - iPhone, computador e navegador comum: nova aba do navegador.
 */
import type { MouseEvent } from 'react';
import { GAMES } from './games.tsx';
import { browserEnv, isWindowsShell, type InstallEnv } from './install.tsx';

export const isAndroid = (env: InstallEnv) => /Android/i.test(env.userAgent);

/** Endereço intent:// do Android para uma URL https. */
export function androidIntentUrl(url: string): string {
  const u = new URL(url);
  const scheme = u.protocol.replace(':', '');
  return `intent://${u.host}${u.pathname}${u.search}#Intent;scheme=${scheme};S.browser_fallback_url=${encodeURIComponent(url)};end`;
}

/** Endereço da página do jogo na Microsoft Store, ou null se a URL não for de um jogo do catálogo. */
export function storeUrl(url: string): string | null {
  const game = GAMES.find((g) => new URL(g.url).origin === new URL(url).origin);
  return game ? `ms-windows-store://pdp/?ProductId=${game.storeId}` : null;
}

export interface AppLinkOptions {
  /** Chamado em todo toque (ex.: métrica). */
  onOpen?: () => void;
  env?: InstallEnv;
  /** Só testes: troca a navegação. */
  go?: (href: string) => void;
}

/** Propriedades para um <a>: href, nova aba e o desvio pelo sistema no Android instalado e pela Store na casca Windows. */
export function appLinkProps(url: string, { onOpen, env = browserEnv(), go = (h) => location.assign(h) }: AppLinkOptions = {}) {
  return {
    href: url,
    target: '_blank',
    rel: 'noopener',
    onClick: (e: MouseEvent<HTMLAnchorElement>) => {
      onOpen?.();
      if (isWindowsShell(env)) {
        const store = storeUrl(url);
        if (store) {
          e.preventDefault();
          go(store);
          return;
        }
      }
      if (env.standalone && isAndroid(env)) {
        e.preventDefault();
        go(androidIntentUrl(url));
      }
    },
  };
}
