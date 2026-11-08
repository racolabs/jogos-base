// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { activatePortal, CRAZYGAMES_PROFILE } from '../ads/portal.ts';
import { HelpMore, helpLinksOf, PRIVACY_PATHS, type HelpGame } from './help.tsx';
import { SHELL_CSS } from './shell-css.ts';

afterEach(() => {
  cleanup();
  activatePortal(null);
  vi.restoreAllMocks();
});

const loc = (pt: string, en: string) => ({ pt, en });
const GAME: HelpGame = {
  id: 'sudoku',
  articles: [
    { paths: loc('/pt/como-jogar/', '/en/how-to-play/'), text: { pt: { title: 'Como jogar Sudoku', description: '', label: 'Como jogar', sections: [] }, en: { title: 'How to play Sudoku', description: '', label: 'How to play', sections: [] } } },
    { paths: loc('/pt/estrategias/', '/en/strategy/'), text: { pt: { title: 'Estratégias de Sudoku', description: '', sections: [] }, en: { title: 'Sudoku strategy', description: '', sections: [] } } },
  ],
};

const setOnline = (v: boolean) => vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(v);

describe('Ajuda e mais', () => {
  it('os links saem dos mesmos articles do SEO, no idioma certo, e não há variações (cada uma é a própria SPA)', () => {
    render(<HelpMore lang="pt" game={GAME} />);
    const guides = within(screen.getByRole('region', { name: 'Guias' })).getAllByRole('link');
    expect(guides.map((a) => a.getAttribute('href'))).toEqual(['/pt/como-jogar/', '/pt/estrategias/']);
    expect(screen.getByRole('link', { name: /^Como jogar/ })).toBeTruthy();
    expect(screen.getByRole('link', { name: /^Estratégias de Sudoku/ })).toBeTruthy(); // sem label: usa o título
    expect(screen.queryByRole('region', { name: 'Modos' })).toBeNull();
    expect(Object.keys(helpLinksOf(GAME, 'pt'))).toEqual(['guides', 'privacy']);
  });

  it('em inglês usa caminhos e textos em inglês; a privacidade fica fora dos Guias', () => {
    render(<HelpMore lang="en" game={GAME} privacy={PRIVACY_PATHS} />);
    expect(screen.getByRole('heading', { name: 'Help and more' })).toBeTruthy();
    const guides = within(screen.getByRole('region', { name: 'Guides' })).getAllByRole('link');
    expect(guides.map((a) => a.getAttribute('href'))).toEqual(['/en/how-to-play/', '/en/strategy/']);
    const priv = within(screen.getByRole('region', { name: 'Privacy' })).getAllByRole('link');
    expect(priv.map((a) => a.getAttribute('href'))).toEqual(['/en/privacy/']);
  });

  it('abre em nova aba, sem perder a partida, e avisa quem usa leitor de tela', () => {
    const onOpen = vi.fn();
    render(<HelpMore lang="pt" game={GAME} onOpen={onOpen} />);
    const link = screen.getByRole('link', { name: /^Como jogar/ });
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener');
    expect(link.textContent).toContain('(abre em nova aba)');
    fireEvent.click(link);
    expect(onOpen).toHaveBeenCalledWith('guide', '/pt/como-jogar/');
  });

  it('mostra os outros jogos sem o próprio, e a privacidade só se pedida', () => {
    render(<HelpMore lang="pt" game={GAME} />);
    const nav = screen.getByRole('navigation', { name: 'Mais jogos da RacoLabs' });
    expect(nav.querySelectorAll('a')).toHaveLength(3);
    expect(screen.queryByRole('link', { name: /^Privacidade/ })).toBeNull();
    cleanup();
    render(<HelpMore lang="pt" game={GAME} otherGames={false} />);
    expect(screen.queryByRole('navigation')).toBeNull();
  });

  it('sem artigos, só os outros jogos; sem nada, nada', () => {
    render(<HelpMore lang="pt" game={{ id: 'dobra' }} />);
    expect(screen.queryByRole('region')).toBeNull();
    expect(screen.getByRole('navigation', { name: 'Mais jogos da RacoLabs' })).toBeTruthy();
    cleanup();
    const { container } = render(<HelpMore lang="pt" game={{ id: 'dobra' }} otherGames={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('segue o tamanho mínimo de toque, o foco visível e o cartão padrão no CSS da casca', () => {
    expect(SHELL_CSS).toMatch(/\.rl-help \{[^}]*background: var\(--surface\)[^}]*border-radius: 20px/);
    expect(SHELL_CSS).toMatch(/\.rl-help__link \{[^}]*min-height: 44px/);
    expect(SHELL_CSS).toMatch(/\.rl-help__link:focus-visible[^{]*\{[^}]*outline: 3px solid/);
  });
});

describe('Ajuda e mais sem internet', () => {
  it('offline: os links das páginas viram texto desabilitado com "precisa de internet", e voltam ao reconectar', () => {
    setOnline(false);
    render(<HelpMore lang="pt" game={GAME} privacy={PRIVACY_PATHS} />);
    const region = screen.getByRole('region', { name: 'Guias' });
    expect(within(region).queryAllByRole('link')).toHaveLength(0);
    expect(region.querySelectorAll('[aria-disabled="true"]')).toHaveLength(2);
    expect(region.textContent).toContain('precisa de internet');
    expect(screen.getByRole('region', { name: 'Privacidade' }).textContent).toContain('precisa de internet');
    // "Outros jogos" é outro site, mas também não abre sem rede: o app instalado já trata o toque; aqui só as páginas do jogo mudam.
    act(() => {
      setOnline(true);
      window.dispatchEvent(new Event('online'));
    });
    expect(within(screen.getByRole('region', { name: 'Guias' })).getAllByRole('link')).toHaveLength(2);
  });

  it('em inglês a nota é "needs internet"; ficar offline com a tela aberta troca na hora', () => {
    render(<HelpMore lang="en" game={GAME} />);
    expect(screen.getAllByRole('link', { name: /^How to play/ })).toHaveLength(1);
    act(() => {
      setOnline(false);
      window.dispatchEvent(new Event('offline'));
    });
    expect(screen.queryByRole('link', { name: /^How to play/ })).toBeNull();
    expect(screen.getByRole('region', { name: 'Guides' }).textContent).toContain('needs internet');
  });
});

describe('Ajuda e mais no portal CrazyGames', () => {
  it('perfil ativo: nenhum link (guias, privacidade, outros jogos) e o componente não renderiza', () => {
    activatePortal(CRAZYGAMES_PROFILE);
    expect(helpLinksOf(GAME, 'pt', PRIVACY_PATHS)).toEqual({ guides: [], privacy: null });
    const { container } = render(<HelpMore lang="pt" game={GAME} privacy={PRIVACY_PATHS} />);
    expect(container.firstChild).toBeNull();
    expect(container.querySelectorAll('a')).toHaveLength(0);
  });

  it('sem portal os links voltam', () => {
    activatePortal(CRAZYGAMES_PROFILE);
    activatePortal(null);
    render(<HelpMore lang="pt" game={GAME} />);
    expect(screen.getAllByRole('link').length).toBeGreaterThan(3);
  });

  it('não coleta dado novo: só âncoras, sem scripts, imagens ou iframes', () => {
    const { container } = render(<HelpMore lang="pt" game={GAME} />);
    expect(container.querySelectorAll('script, img, iframe, link')).toHaveLength(0);
    expect(container.innerHTML).not.toMatch(/gtag|pagead|googlesyndication/i);
  });
});
