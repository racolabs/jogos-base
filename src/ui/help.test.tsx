// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { activatePortal, CRAZYGAMES_PROFILE } from '../ads/portal.ts';
import { HelpMore, helpLinksOf, PRIVACY_PATHS, type HelpGame } from './help.tsx';
import { SHELL_CSS } from './shell-css.ts';

afterEach(() => {
  cleanup();
  activatePortal(null);
});

const loc = (pt: string, en: string) => ({ pt, en });
const GAME: HelpGame = {
  id: 'sudoku',
  articles: [
    { paths: loc('/pt/como-jogar/', '/en/how-to-play/'), text: { pt: { title: 'Como jogar Sudoku', description: '', label: 'Como jogar', sections: [] }, en: { title: 'How to play Sudoku', description: '', label: 'How to play', sections: [] } } },
    { paths: loc('/pt/estrategias/', '/en/strategy/'), text: { pt: { title: 'Estratégias de Sudoku', description: '', sections: [] }, en: { title: 'Sudoku strategy', description: '', sections: [] } } },
  ],
  variants: [
    { slug: 'facil', title: loc('Sudoku fácil online grátis para aprender', 'Easy Sudoku for beginners'), label: loc('Fácil', 'Easy') },
    { slug: 'dificil', title: loc('Sudoku difícil', 'Hard Sudoku') },
    { slug: 'diario/2026-11-08', title: loc('Dia 08/11', 'Nov 8'), llms: false },
  ],
};

describe('Ajuda e mais', () => {
  it('os links saem dos mesmos articles e variants do SEO, no idioma certo', () => {
    render(<HelpMore lang="pt" game={GAME} />);
    const hrefs = (name: string) => within(screen.getByRole('region', { name })).getAllByRole('link').map((a) => a.getAttribute('href'));
    expect(hrefs('Guias')).toEqual(['/pt/como-jogar/', '/pt/estrategias/']);
    expect(hrefs('Modos')).toEqual(['/pt/facil/', '/pt/dificil/']); // dias do arquivo (llms: false) ficam de fora
    expect(screen.getByRole('link', { name: /^Como jogar/ })).toBeTruthy();
    expect(screen.getByRole('link', { name: /^Estratégias de Sudoku/ })).toBeTruthy(); // sem label: usa o título
    expect(screen.getByRole('link', { name: /^Fácil/ })).toBeTruthy();
    expect(screen.getByRole('link', { name: /^Sudoku difícil/ })).toBeTruthy(); // sem label: usa o título
  });

  it('em inglês usa os caminhos e textos em inglês', () => {
    render(<HelpMore lang="en" game={GAME} privacy={PRIVACY_PATHS} />);
    expect(screen.getByRole('heading', { name: 'Help and more' })).toBeTruthy();
    const guides = within(screen.getByRole('region', { name: 'Guides' })).getAllByRole('link');
    expect(guides.map((a) => a.getAttribute('href'))).toEqual(['/en/how-to-play/', '/en/strategy/', '/en/privacy/']);
    expect(screen.getByRole('link', { name: /^Privacy/ })).toBeTruthy();
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

  it('sem artigos nem variações, só os outros jogos; sem nada, nada', () => {
    render(<HelpMore lang="pt" game={{ id: 'dobra' }} />);
    expect(screen.queryByRole('region')).toBeNull();
    expect(screen.getByRole('navigation', { name: 'Mais jogos da RacoLabs' })).toBeTruthy();
    cleanup();
    const { container } = render(<HelpMore lang="pt" game={{ id: 'dobra' }} otherGames={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('segue o tamanho mínimo de toque e o foco visível no CSS da casca', () => {
    expect(SHELL_CSS).toMatch(/\.rl-help__link \{[^}]*min-height: 44px/);
    expect(SHELL_CSS).toMatch(/\.rl-help__link:focus-visible[^{]*\{[^}]*outline: 3px solid/);
  });
});

describe('Ajuda e mais no portal CrazyGames', () => {
  it('perfil ativo: nenhum link (guias, modos, privacidade, outros jogos) e o componente não renderiza', () => {
    activatePortal(CRAZYGAMES_PROFILE);
    expect(helpLinksOf(GAME, 'pt', PRIVACY_PATHS)).toEqual({ guides: [], variants: [], privacy: null });
    const { container } = render(<HelpMore lang="pt" game={GAME} privacy={PRIVACY_PATHS} />);
    expect(container.firstChild).toBeNull();
    expect(container.querySelectorAll('a')).toHaveLength(0);
  });

  it('sem portal os links voltam', () => {
    activatePortal(CRAZYGAMES_PROFILE);
    activatePortal(null);
    render(<HelpMore lang="pt" game={GAME} />);
    expect(screen.getAllByRole('link').length).toBeGreaterThan(4);
  });

  it('não coleta dado novo: só âncoras, sem scripts, imagens ou iframes', () => {
    const { container } = render(<HelpMore lang="pt" game={GAME} />);
    expect(container.querySelectorAll('script, img, iframe, link')).toHaveLength(0);
    expect(container.innerHTML).not.toMatch(/gtag|pagead|googlesyndication/i);
  });
});
