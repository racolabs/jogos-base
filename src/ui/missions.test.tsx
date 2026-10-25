// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MissionView } from '../missions/missions.ts';
import { MissionPill, MissionsCard, MissionsSheet } from './missions.tsx';

afterEach(cleanup);

const VIEWS: MissionView[] = [
  { id: 'a', level: 0, text: 'Junte 60 peças', progress: 60, target: 60, done: true },
  { id: 'b', level: 1, text: 'Faça a peça 256', progress: 0, target: 1, done: false },
  { id: 'c', level: 2, text: '2.500 pontos numa partida', progress: 1840, target: 2500, done: false },
];

describe('metas na tela', () => {
  it('cartão mostra 1/3, sequência e abre a lista', () => {
    const onOpen = vi.fn();
    render(<MissionsCard lang="pt" missions={VIEWS} streak={4} onOpen={onOpen} />);
    const btn = screen.getByRole('button', { name: /Metas do dia: 1\/3/ });
    expect(btn.textContent).toContain('4 dias seguidos · faltam 2 metas');
    fireEvent.click(btn);
    expect(onOpen).toHaveBeenCalled();
  });

  it('lista mostra feita, a fazer, contagem e o prêmio', () => {
    render(<MissionsSheet lang="pt" open missions={VIEWS} prize="+1 desfazer grátis" streak={4} doneToday={false} msLeft={5 * 3_600_000 + 27 * 60_000} onClose={() => {}} />);
    const dialog = screen.getByRole('dialog', { name: 'Metas do dia' });
    expect(dialog.textContent).toContain('Novas metas em 5h 27min');
    expect(dialog.textContent).toContain('Feita');
    expect(dialog.textContent).toContain('A fazer');
    expect(dialog.textContent).toContain('1.840/2.500');
    expect(dialog.textContent).toContain('+1 desfazer grátis');
    expect(dialog.querySelectorAll('.rl-week i.on')).toHaveLength(4);
  });

  it('etiqueta some sem meta e mostra o progresso quando há', () => {
    const { container, rerender } = render(<MissionPill lang="en" mission={null} />);
    expect(container.innerHTML).toBe('');
    rerender(<MissionPill lang="pt" mission={VIEWS[2]!} />);
    // Sem região "ao vivo": a etiqueta muda a cada jogada e não deve ser anunciada sempre.
    expect(screen.queryByRole('status')).toBeNull();
    expect(container.textContent).toContain('Meta: 2.500 pontos numa partida1.840/2.500');
  });
});
