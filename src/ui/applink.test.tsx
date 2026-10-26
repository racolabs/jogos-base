// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { androidIntentUrl, appLinkProps } from './applink.ts';
import type { InstallEnv } from './install.tsx';

afterEach(cleanup);

const ANDROID: InstallEnv = { userAgent: 'Mozilla/5.0 (Linux; Android 14) Chrome/130', platform: 'Linux armv8l', maxTouchPoints: 5, standalone: true };
const IPHONE: InstallEnv = { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', platform: 'iPhone', maxTouchPoints: 5, standalone: true };
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
