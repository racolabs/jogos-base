import { describe, expect, it } from 'vitest';
import { completeDay, dailyKey, dailyRandom, emptyStreak, isoWeek, msUntilNextDaily, seededRandom, visibleStreak } from './index.ts';

const take = (rng: () => number, n: number) => Array.from({ length: n }, rng);

describe('semente do dia', () => {
  it('o dia vira à 0 h UTC, igual para todo mundo', () => {
    expect(dailyKey(Date.UTC(2026, 9, 25, 23, 59))).toBe('2026-10-25');
    expect(dailyKey(Date.UTC(2026, 9, 26, 0, 0))).toBe('2026-10-26');
  });

  it('mesma semente, mesma sequência; outra semente, outra sequência', () => {
    expect(take(seededRandom('dobra:2026-10-25'), 50)).toEqual(take(seededRandom('dobra:2026-10-25'), 50));
    expect(take(dailyRandom('dobra', '2026-10-25'), 5)).not.toEqual(take(dailyRandom('dobra', '2026-10-26'), 5));
    expect(take(dailyRandom('dobra', '2026-10-25'), 5)).not.toEqual(take(dailyRandom('paciencia', '2026-10-25'), 5));
  });

  it('valores sempre entre 0 e 1, bem espalhados', () => {
    const xs = take(seededRandom('x'), 10_000);
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true);
    const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(Math.abs(mean - 0.5)).toBeLessThan(0.02);
  });

  it('conta o tempo até o próximo desafio', () => {
    expect(msUntilNextDaily(Date.UTC(2026, 9, 25, 23, 0))).toBe(3_600_000);
  });
});

describe('dias seguidos', () => {
  it('dia seguido soma; mesmo dia não conta duas vezes', () => {
    let s = completeDay(emptyStreak(), '2026-10-20');
    s = completeDay(s, '2026-10-21');
    expect(completeDay(s, '2026-10-21')).toBe(s);
    expect(s).toMatchObject({ streak: 2, best: 2 });
  });

  it('faltou um dia: a folga da semana segura a sequência', () => {
    let s = completeDay(completeDay(emptyStreak(), '2026-10-19'), '2026-10-20');
    expect(visibleStreak(s, '2026-10-22')).toBe(2);
    s = completeDay(s, '2026-10-22');
    expect(s).toMatchObject({ streak: 3, freezeWeek: '2026-W43' });
  });

  it('segunda falta na mesma semana recomeça, mas o recorde fica', () => {
    let s = emptyStreak();
    for (const d of ['2026-10-19', '2026-10-20', '2026-10-22', '2026-10-24']) s = completeDay(s, d);
    expect(s).toMatchObject({ streak: 1, best: 3 });
  });

  it('a folga renova na semana seguinte', () => {
    let s = emptyStreak();
    for (const d of ['2026-10-19', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25', '2026-10-27']) s = completeDay(s, d);
    expect(s.streak).toBe(7);
  });

  it('dois dias sem jogar zeram o que a tela mostra', () => {
    const s = completeDay(emptyStreak(), '2026-10-20');
    expect(visibleStreak(s, '2026-10-21')).toBe(1);
    expect(visibleStreak(s, '2026-10-23')).toBe(0);
  });

  it('semana ISO certa, inclusive na virada do ano', () => {
    expect(isoWeek('2026-10-25')).toBe('2026-W43');
    expect(isoWeek('2026-12-31')).toBe('2026-W53');
    expect(isoWeek('2027-01-04')).toBe('2027-W01');
  });
});
