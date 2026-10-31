// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { activatePortal, CRAZYGAMES_PROFILE } from '../ads/portal.ts';
import { InstallCard, initialInstallState, installSnoozed, INSTALL_SNOOZE_MS, isIOS, useInstall, type InstallEnv } from './install.tsx';

afterEach(cleanup);

const env = (patch: Partial<InstallEnv> = {}): InstallEnv => ({
  userAgent: 'Mozilla/5.0 (Linux; Android 14) Chrome/130',
  platform: 'Linux armv8l',
  maxTouchPoints: 5,
  standalone: false,
  ...patch,
});
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1';

describe('detecção', () => {
  it('iPhone e iPad (inclusive o que se diz Mac) contam como iOS', () => {
    expect(isIOS(env({ userAgent: IPHONE }))).toBe(true);
    expect(isIOS(env({ userAgent: 'Mozilla/5.0 (Macintosh)', platform: 'MacIntel', maxTouchPoints: 5 }))).toBe(true);
    expect(isIOS(env({ userAgent: 'Mozilla/5.0 (Macintosh)', platform: 'MacIntel', maxTouchPoints: 0 }))).toBe(false);
    expect(isIOS(env())).toBe(false);
  });

  it('estado inicial: instalado, iOS ou sem pedido ainda', () => {
    expect(initialInstallState(env({ standalone: true, userAgent: IPHONE }))).toBe('installed');
    expect(initialInstallState(env({ userAgent: IPHONE }))).toBe('ios');
    expect(initialInstallState(env())).toBe('unsupported');
  });
});

describe('useInstall', () => {
  function promptEvent(outcome: 'accepted' | 'dismissed') {
    const e = new Event('beforeinstallprompt', { cancelable: true }) as Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
    e.prompt = vi.fn(async () => {});
    e.userChoice = Promise.resolve({ outcome });
    return e;
  }

  it('guarda o pedido do navegador e instala com um toque', async () => {
    const { result } = renderHook(() => useInstall(env()));
    expect(result.current.state).toBe('unsupported');
    const e = promptEvent('accepted');
    act(() => void window.dispatchEvent(e));
    expect(e.defaultPrevented).toBe(true);
    expect(result.current.state).toBe('prompt');
    let outcome = '';
    await act(async () => void (outcome = await result.current.install()));
    expect(e.prompt).toHaveBeenCalled();
    expect(outcome).toBe('accepted');
    expect(result.current.state).toBe('installed');
  });

  it('recusar mantém o cartão; appinstalled esconde', async () => {
    const { result } = renderHook(() => useInstall(env()));
    act(() => void window.dispatchEvent(promptEvent('dismissed')));
    await act(async () => void (await result.current.install()));
    expect(result.current.state).toBe('prompt');
    expect(await result.current.install()).toBe('unavailable');
    act(() => void window.dispatchEvent(new Event('appinstalled')));
    expect(result.current.state).toBe('installed');
  });
});

describe('InstallCard', () => {
  it('Android: botão Instalar chama a instalação', () => {
    const onInstall = vi.fn();
    render(<InstallCard lang="pt" state="prompt" icon="/i.png" onInstall={onInstall} onDismiss={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Instalar' }));
    expect(onInstall).toHaveBeenCalled();
  });

  it('iPhone: abre os 3 passos e fecha com Entendi', () => {
    render(<InstallCard lang="pt" state="ios" icon="/i.png" onInstall={() => {}} onDismiss={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: 'Como instalar' }));
    const dialog = screen.getByRole('dialog', { name: 'Instalar no iPhone' });
    expect(dialog.querySelectorAll('li')).toHaveLength(3);
    expect(dialog.textContent).toContain('Adicionar à Tela de Início');
    fireEvent.click(screen.getByRole('button', { name: 'Entendi' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('some quando já instalado ou sem suporte; Agora não chama onDismiss', () => {
    const { container, rerender } = render(<InstallCard lang="en" state="installed" icon="/i.png" onInstall={() => {}} onDismiss={() => {}} />);
    expect(container.innerHTML).toBe('');
    rerender(<InstallCard lang="en" state="unsupported" icon="/i.png" onInstall={() => {}} onDismiss={() => {}} />);
    expect(container.innerHTML).toBe('');
    const onDismiss = vi.fn();
    rerender(<InstallCard lang="en" state="prompt" icon="/i.png" onInstall={() => {}} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }));
    expect(onDismiss).toHaveBeenCalled();
  });

  it('adiar por 7 dias', () => {
    expect(installSnoozed(null, 1000)).toBe(false);
    expect(installSnoozed(1000, 1000 + INSTALL_SNOOZE_MS - 1)).toBe(true);
    expect(installSnoozed(1000, 1000 + INSTALL_SNOOZE_MS)).toBe(false);
  });
});

describe('instalação em portal', () => {
  afterEach(() => activatePortal(null));

  it('portal que proíbe instalar: nunca oferece, nem no iPhone nem com o pedido do navegador', () => {
    activatePortal(CRAZYGAMES_PROFILE);
    expect(initialInstallState(env({ userAgent: IPHONE }))).toBe('unsupported');
    const { result } = renderHook(() => useInstall(env()));
    const e = new Event('beforeinstallprompt', { cancelable: true });
    act(() => void window.dispatchEvent(e));
    expect(e.defaultPrevented).toBe(false);
    expect(result.current.state).toBe('unsupported');
  });
});
