// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { activatePortal, CRAZYGAMES_PROFILE } from '../ads/portal.ts';
import { GAMES, MoreGames } from './games.tsx';

afterEach(cleanup);

describe('Mais jogos', () => {
  it('cada jogo mostra os outros, no idioma certo, abrindo em outra aba', () => {
    const onOpen = vi.fn();
    render(<MoreGames lang="en" current="sudoku" onOpen={onOpen} />);
    const nav = screen.getByRole('navigation', { name: 'More RacoLabs games' });
    const links = [...nav.querySelectorAll('a')];
    expect(links.map((a) => a.querySelector('.rl-more__name')?.textContent)).toEqual(['Dobra', 'Solitaire', 'Mahjong']);
    expect(screen.getByRole('link', { name: 'Solitaire' })).toBeTruthy();
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['https://dobra.racolabs.app/en/', 'https://paciencia.racolabs.app/en/', 'https://mahjong.racolabs.app/en/']);
    expect(links.every((a) => a.getAttribute('target') === '_blank')).toBe(true);
    fireEvent.click(links[1]!);
    expect(onOpen).toHaveBeenCalledWith('paciencia');
  });

  it('o catálogo tem os jogos no ar', () => {
    expect(GAMES.map((g) => g.id)).toEqual(['dobra', 'paciencia', 'sudoku', 'mahjong']);
    for (const g of GAMES) {
      render(<MoreGames lang="pt" current={g.id} />);
      expect(screen.getByRole('navigation', { name: 'Mais jogos da RacoLabs' }).querySelectorAll('a')).toHaveLength(GAMES.length - 1);
      cleanup();
    }
  });
});

describe('Mais jogos em portal', () => {
  afterEach(() => activatePortal(null));

  it('portal que proíbe divulgação: a faixa some e, sem portal, volta', () => {
    activatePortal(CRAZYGAMES_PROFILE);
    const { container } = render(<MoreGames lang="pt" current="paciencia" />);
    expect(container.querySelector('nav')).toBeNull();
    cleanup();
    activatePortal(null);
    render(<MoreGames lang="pt" current="paciencia" />);
    expect(screen.getByRole('navigation', { name: 'Mais jogos da RacoLabs' })).toBeTruthy();
  });
});
