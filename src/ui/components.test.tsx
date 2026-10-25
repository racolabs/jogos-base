// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Button, Segmented, Sheet, Switch, Toast } from './components.tsx';
import { SHELL_CSS } from './shell-css.ts';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('Button', () => {
  it('mostra variante e selo, e chama onClick', () => {
    const onClick = vi.fn();
    render(
      <Button variant="reward" badge="1 grátis" onClick={onClick}>
        Assistir e continuar
      </Button>,
    );
    const btn = screen.getByRole('button', { name: /Assistir e continuar/ });
    expect(btn.className).toContain('rl-btn--reward');
    expect(btn.textContent).toContain('1 grátis');
    expect(btn.getAttribute('type')).toBe('button');
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

describe('Sheet', () => {
  it('é um diálogo com título, foca o primeiro botão e fecha com Esc e com toque fora', () => {
    const onClose = vi.fn();
    const { container } = render(
      <Sheet open title="Mais uma chance" onClose={onClose}>
        <Button variant="reward">Assistir vídeo</Button>
      </Sheet>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Mais uma chance' });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Assistir vídeo' }));
    fireEvent.keyDown(window, { key: 'Escape' });
    fireEvent.click(container.querySelector('.rl-scrim')!);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('tocar dentro da folha não fecha', () => {
    const onClose = vi.fn();
    render(
      <Sheet open title="Ajuda" onClose={onClose}>
        <p>texto</p>
      </Sheet>,
    );
    fireEvent.click(screen.getByText('texto'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('fechada não desenha nada', () => {
    render(
      <Sheet open={false} title="x" onClose={() => {}}>
        <p>oculto</p>
      </Sheet>,
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('Toast', () => {
  it('no topo durante a partida, some sozinho em 1,8 s', () => {
    vi.useFakeTimers();
    const onDone = vi.fn();
    render(<Toast message="Prêmio entregue" tone="reward" placement="top" onDone={onDone} />);
    const toast = screen.getByRole('status');
    expect(toast.className).toContain('rl-toast--top');
    expect(toast.className).toContain('rl-toast--reward');
    act(() => vi.advanceTimersByTime(1799));
    expect(onDone).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});

describe('Switch e Segmented', () => {
  it('Switch é uma chave rotulada', () => {
    const onChange = vi.fn();
    render(<Switch label="Letra grande" description="Aumenta todos os textos" checked={false} onChange={onChange} />);
    fireEvent.click(screen.getByRole('switch', { name: /Letra grande/ }));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('Segmented marca a opção atual com aria-pressed', () => {
    const onChange = vi.fn();
    render(
      <Segmented label="Idioma" value="pt" onChange={onChange} options={[{ value: 'pt', label: 'Português' }, { value: 'en', label: 'English' }]} />,
    );
    expect(screen.getByRole('button', { name: 'Português' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'English' }));
    expect(onChange).toHaveBeenCalledWith('en');
  });
});

describe('SHELL_CSS', () => {
  it('só usa as variáveis do tema, e respeita reduzir movimento', () => {
    const colors = SHELL_CSS.match(/#[0-9A-Fa-f]{6}/g) ?? [];
    expect(new Set(colors)).toEqual(new Set(['#1C1D2B', '#FFFFFF']));
    expect(SHELL_CSS).toContain('prefers-reduced-motion');
  });
});
