// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { androidIntentUrl, appLinkProps, storeUrl } from './applink.ts';
import { GAMES } from './games.tsx';
import { isWindowsShell, type InstallEnv } from './install.tsx';

afterEach(cleanup);

const ANDROID: InstallEnv = { userAgent: 'Mozilla/5.0 (Linux; Android 14) Chrome/130', platform: 'Linux armv8l', maxTouchPoints: 5, standalone: true };
const IPHONE: InstallEnv = { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', platform: 'iPhone', maxTouchPoints: 5, standalone: true };
const WINDOWS: InstallEnv = { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Edg/130 WebView2 RacoLabsWindows/1', platform: 'Win32', maxTouchPoints: 0, standalone: false };
const URL_ = 'https://paciencia.racolabs.app/pt/';

describe('link para outro jogo', () => {
  it('monta o intent do Android com a URL de reserva', () => {
    expect(androidIntentUrl(URL_)).toBe(
      'intent://paciencia.racolabs.app/pt/#Intent;scheme=https;S.browser_fallback_url=https%3A%2F%2Fpaciencia.racolabs.app%2Fpt%2F;end',
    );
  });

  it('Android com o app instalado: vai pelo sistema, não navega dentro do app', () => {
    const go = vi.fn();
    const onOpen = vi.fn();
    render(<a {...appLinkProps(URL_, { env: ANDROID, go, onOpen })}>Abrir</a>);
    const ev = fireEvent.click(screen.getByText('Abrir'));
    expect(ev).toBe(false); // preventDefault
    expect(go).toHaveBeenCalledWith(androidIntentUrl(URL_));
    expect(onOpen).toHaveBeenCalled();
  });

  it('iPhone, computador ou navegador: nova aba normal', () => {
    const go = vi.fn();
    for (const env of [IPHONE, { ...ANDROID, standalone: false }]) {
      render(<a {...appLinkProps(URL_, { env, go })}>Abrir</a>);
      const a = screen.getByText('Abrir');
      expect(a.getAttribute('target')).toBe('_blank');
      expect(a.getAttribute('rel')).toBe('noopener');
      fireEvent.click(a);
      cleanup();
    }
    expect(go).not.toHaveBeenCalled();
  });
});

describe('casca Windows', () => {
  it('reconhece o token RacoLabsWindows/ no user agent', () => {
    expect(isWindowsShell(WINDOWS)).toBe(true);
    expect(isWindowsShell({ ...WINDOWS, userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Edg/130' })).toBe(false);
    expect(isWindowsShell({ ...WINDOWS, userAgent: 'Mozilla/5.0 (Windows NT 10.0) NotRacoLabsWindows/1' })).toBe(false);
    expect(isWindowsShell(ANDROID)).toBe(false);
  });

  it('o link de cada jogo vai para a página dele na Microsoft Store', () => {
    const ids: Record<string, string> = { dobra: '9P0D5TJNKXKR', paciencia: '9MV5FVBHZ79Z', sudoku: '9NZ0HS8MVCMR', mahjong: '9NZ2RT13G29P' };
    expect(GAMES.map((g) => g.id).sort()).toEqual(Object.keys(ids).sort());
    for (const g of GAMES) {
      const go = vi.fn();
      const onOpen = vi.fn();
      render(<a {...appLinkProps(`${g.url}/pt/`, { env: WINDOWS, go, onOpen })}>Abrir</a>);
      const ev = fireEvent.click(screen.getByText('Abrir'));
      expect(ev).toBe(false); // preventDefault
      expect(go).toHaveBeenCalledWith(`ms-windows-store://pdp/?ProductId=${ids[g.id]}`);
      expect(onOpen).toHaveBeenCalledTimes(1);
      cleanup();
    }
  });

  it('do Dobra para a Paciência', () => {
    expect(storeUrl('https://paciencia.racolabs.app/en/')).toBe('ms-windows-store://pdp/?ProductId=9MV5FVBHZ79Z');
  });

  it('user agent sem o token: nada muda, mesmo no Windows', () => {
    const go = vi.fn();
    const onOpen = vi.fn();
    const env = { ...WINDOWS, userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Edg/130', standalone: true };
    render(<a {...appLinkProps(URL_, { env, go, onOpen })}>Abrir</a>);
    const a = screen.getByText('Abrir');
    expect(a.getAttribute('href')).toBe(URL_);
    expect(a.getAttribute('target')).toBe('_blank');
    expect(fireEvent.click(a)).toBe(true);
    expect(go).not.toHaveBeenCalled();
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('URL fora do catálogo na casca: segue como link normal', () => {
    const go = vi.fn();
    render(<a {...appLinkProps('https://exemplo.com/', { env: WINDOWS, go })}>Abrir</a>);
    expect(fireEvent.click(screen.getByText('Abrir'))).toBe(true);
    expect(go).not.toHaveBeenCalled();
  });

  it('URL relativa ou inválida na casca: segue como link normal, sem erro', () => {
    expect(storeUrl('/pt/')).toBeNull();
    expect(storeUrl('')).toBeNull();
    for (const href of ['/pt/', 'não é url']) {
      const go = vi.fn();
      const onOpen = vi.fn();
      render(<a {...appLinkProps(href, { env: WINDOWS, go, onOpen })}>Abrir</a>);
      expect(fireEvent.click(screen.getByText('Abrir'))).toBe(true);
      expect(go).not.toHaveBeenCalled();
      expect(onOpen).toHaveBeenCalledTimes(1);
      cleanup();
    }
  });
});
