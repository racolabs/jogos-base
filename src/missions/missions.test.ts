import { describe, expect, it } from 'vitest';
import { closestMission, dailyMissions, emptyMissions, ensureDay, localDayKey, msUntilLocalMidnight, report, viewMissions, type MissionDef } from './missions.ts';

const m = (id: string, level: 0 | 1 | 2, metric: string, mode: 'sum' | 'max', target: number): MissionDef => ({ id, level, metric, mode, target, text: { pt: id, en: id } });
const POOL = [
  m('merges60', 0, 'merges', 'sum', 60),
  m('games2', 0, 'games', 'sum', 2),
  m('tile256', 1, 'tile', 'max', 256),
  m('score2500', 1, 'score', 'max', 2500),
  m('tile512', 2, 'tile', 'max', 512),
  m('win', 2, 'wins', 'sum', 1),
];

describe('metas do dia', () => {
  it('uma de cada nível, iguais no mesmo dia e diferentes entre jogos/dias ao longo do tempo', () => {
    const a = dailyMissions(POOL, '2026-10-25', 'dobra');
    expect(a.map((x) => x.level)).toEqual([0, 1, 2]);
    expect(dailyMissions(POOL, '2026-10-25', 'dobra')).toEqual(a);
    const seen = new Set(Array.from({ length: 30 }, (_, d) => dailyMissions(POOL, `2026-11-${String(d + 1).padStart(2, '0')}`, 'dobra')[0]!.id));
    expect(seen.size).toBe(2);
  });

  it('soma ao longo do dia, guarda o melhor e avisa quando cumpre', () => {
    const ms = [POOL[0]!, POOL[2]!, POOL[5]!];
    let st = emptyMissions('d');
    let r = report(st, ms, [['merges', 30], ['tile', 128]]);
    expect(r.completed).toEqual([]);
    r = report(r.state, ms, [['merges', 35], ['tile', 64]]);
    expect(r.completed.map((x) => x.id)).toEqual(['merges60']);
    expect(r.state.progress).toMatchObject({ merges60: 60, tile256: 128 });
    r = report(r.state, ms, [['merges', 5]]);
    expect(r.completed).toEqual([]);
    r = report(r.state, ms, [['tile', 256]]);
    expect(r.allDone).toBe(false);
    r = report(r.state, ms, [['wins', 1]]);
    expect(r.completed.map((x) => x.id)).toEqual(['win']);
    expect(r.allDone).toBe(true);
    expect(report(r.state, ms, [['wins', 1]]).allDone).toBe(false);
    st = r.state;
    expect(viewMissions(st, ms, 'pt').every((v) => v.done)).toBe(true);
  });

  it('o dia novo zera; a etiqueta mostra a meta mais perto do fim', () => {
    const st = { ...emptyMissions('ontem'), progress: { merges60: 50 }, rewarded: true };
    expect(ensureDay(st, 'ontem')).toBe(st);
    expect(ensureDay(st, 'hoje')).toEqual(emptyMissions('hoje'));
    const ms = [POOL[0]!, POOL[2]!, POOL[4]!];
    const views = viewMissions({ ...emptyMissions('d'), progress: { merges60: 30, tile256: 200 } }, ms, 'pt');
    expect(closestMission(views)?.id).toBe('tile256');
  });

  it('dia local e tempo até a meia-noite local', () => {
    const t = new Date(2026, 9, 25, 22, 30).getTime();
    expect(localDayKey(t)).toBe('2026-10-25');
    expect(msUntilLocalMidnight(t)).toBe(90 * 60_000);
  });
});
