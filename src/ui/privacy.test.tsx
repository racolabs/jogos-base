// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { FakeConsentProvider, NoCmpConsentProvider } from '../ads/consent.ts';
import { openPrivacyChoices, PrivacyChoicesButton } from './privacy.tsx';

afterEach(cleanup);

describe('PrivacyChoicesButton', () => {
  it('um toque reabre o formulário; recusar e aceitar custam uma resposta cada', async () => {
    const consent = new FakeConsentProvider('personalized');
    render(<PrivacyChoicesButton consent={consent} />);
    await act(async () => void fireEvent.click(screen.getByRole('button', { name: 'Escolhas de privacidade' })));
    expect(consent.calls).toEqual(['showPrivacyOptions']);
    expect(consent.formOpen).toBe(true);
    act(() => consent.respond('decline'));
    expect(consent.state()).toBe('non-personalized');
    await act(async () => void fireEvent.click(screen.getByRole('button')));
    act(() => consent.respond('accept'));
    expect(consent.state()).toBe('personalized');
    expect(consent.responses).toBe(2);
  });

  it('em inglês, ou com texto próprio', () => {
    const consent = new FakeConsentProvider();
    const { rerender } = render(<PrivacyChoicesButton consent={consent} lang="en" />);
    expect(screen.getByRole('button').textContent).toBe('Privacy choices');
    rerender(<PrivacyChoicesButton consent={consent} label="Privacidade" />);
    expect(screen.getByRole('button').textContent).toBe('Privacidade');
  });

  it('sem o que rever (sem CMP), o botão não aparece', () => {
    const { container } = render(<PrivacyChoicesButton consent={new NoCmpConsentProvider()} />);
    expect(container.innerHTML).toBe('');
  });

  it('openPrivacyChoices (sem React) devolve false quando não há o que abrir', async () => {
    expect(await openPrivacyChoices(new NoCmpConsentProvider())).toBe(false);
    expect(await openPrivacyChoices(new FakeConsentProvider())).toBe(true);
  });
});
