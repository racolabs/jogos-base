/**
 * Metas do dia na tela: cartão do início, lista (folha) e etiqueta da partida.
 * Cores vêm dos tokens do tema (--surface, --gold, --accent...), então servem para qualquer jogo.
 */
import type { MissionView } from '../missions/missions.ts';
import { Sheet } from './components.tsx';

type Lang = 'pt' | 'en';

const TEXT = {
  pt: {
    title: 'Metas do dia',
    levels: ['Fácil', 'Média', 'Difícil'],
    done: 'Feita',
    todo: 'A fazer',
    streak: (n: number) => (n === 1 ? '1 dia seguido' : `${n} dias seguidos`),
    allDone: 'Todas cumpridas hoje',
    left: (n: number) => (n === 1 ? 'falta 1 meta' : `faltam ${n} metas`),
    sub: (t: string) => `Novas metas em ${t} · cumpra jogando normalmente`,
    prize: (p: string) => ['Cumpra as 3: ', p, ' e o foguinho segue aceso.'],
    prizeDone: (p: string) => ['Feito! Você ganhou ', p, '. Volte amanhã para manter o foguinho.'],
    goal: 'Meta',
    week: ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'],
  },
  en: {
    title: 'Daily goals',
    levels: ['Easy', 'Medium', 'Hard'],
    done: 'Done',
    todo: 'To do',
    streak: (n: number) => (n === 1 ? '1-day streak' : `${n}-day streak`),
    allDone: 'All done today',
    left: (n: number) => (n === 1 ? '1 goal left' : `${n} goals left`),
    sub: (t: string) => `New goals in ${t} · complete them in regular games`,
    prize: (p: string) => ['Complete all 3: ', p, ' and keep your streak alive.'],
    prizeDone: (p: string) => ['Done! You earned ', p, '. Come back tomorrow to keep your streak.'],
    goal: 'Goal',
    week: ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
  },
} as const;

const fmt = (lang: Lang, n: number) => n.toLocaleString(lang === 'pt' ? 'pt-BR' : 'en-US');
const pct = (v: MissionView) => `${Math.round((v.progress / v.target) * 100)}%`;

const Flame = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 2c1 3.5 5 5.6 5 10.5A5 5 0 0 1 12 18a5 5 0 0 1-5-5.5c0-2 1-3.4 2-4.5.2 1.6 1 2.7 2 3 0-3 .3-6 1-9z" />
  </svg>
);
const Check = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);
const Gift = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 11h16v9H4zM3 7h18v4H3zM12 7v13M12 7c-2-4-6-3-5 0M12 7c2-4 6-3 5 0" />
  </svg>
);

/** Cartão do início: título, sequência e uma barrinha por meta. Toque abre a lista. */
export function MissionsCard({ lang, missions, streak, onOpen }: { lang: Lang; missions: MissionView[]; streak: number; onOpen: () => void }) {
  const t = TEXT[lang];
  const done = missions.filter((m) => m.done).length;
  const sub = [streak > 0 ? t.streak(streak) : null, done === missions.length ? t.allDone : t.left(missions.length - done)].filter(Boolean).join(' · ');
  return (
    <button type="button" className="rl-mcard" onClick={onOpen} aria-label={`${t.title}: ${done}/${missions.length}. ${sub}`}>
      <span className="rl-mcard__top">
        <span className="rl-flame">
          <Flame />
        </span>
        <span className="rl-mcard__ttl">
          <strong>{t.title}</strong>
          <span>{sub}</span>
        </span>
        <span className="rl-mcard__count">
          {done}/{missions.length}
        </span>
      </span>
      <span className="rl-mcard__bars" aria-hidden="true">
        {missions.map((m) => (
          <i key={m.id} className={m.done ? 'done' : ''}>
            <b style={{ width: pct(m) }} />
          </i>
        ))}
      </span>
    </button>
  );
}

/** Lista das 3 metas, prêmio fixo e a semana do foguinho. */
export function MissionsSheet({
  lang,
  open,
  onClose,
  missions,
  prize,
  streak,
  doneToday,
  msLeft,
  now = Date.now(),
}: {
  lang: Lang;
  open: boolean;
  onClose: () => void;
  missions: MissionView[];
  /** Ex.: "+1 desfazer grátis". */
  prize: string;
  streak: number;
  doneToday: boolean;
  msLeft: number;
  now?: number;
}) {
  const t = TEXT[lang];
  const h = Math.floor(msLeft / 3_600_000);
  const m = Math.floor((msLeft % 3_600_000) / 60_000);
  const left = h > 0 ? `${h}h ${m}min` : `${m}min`;
  const [a, b, c] = doneToday ? t.prizeDone(prize) : t.prize(prize);
  // Últimos 7 dias até hoje; acesos os da sequência (que inclui hoje só depois de cumprir as 3).
  const days = Array.from({ length: 7 }, (_, k) => {
    const back = 6 - k;
    const d = new Date(now - back * 86_400_000);
    const on = doneToday ? back < streak : back >= 1 && back <= streak;
    return { key: k, label: t.week[d.getDay()]!, on, today: back === 0 };
  });
  return (
    <Sheet open={open} title={t.title} onClose={onClose}>
      <p className="rl-msheet__sub">{t.sub(left)}</p>
      <ul className="rl-mlist">
        {missions.map((v) => (
          <li key={v.id} className={v.done ? 'done' : ''}>
            <span className="rl-mlist__lvl">{v.done ? <Check /> : t.levels[v.level]}</span>
            <span className="rl-mlist__txt">
              <strong>{v.text}</strong>
              {v.done ? null : (
                <span className="rl-mlist__bar" aria-hidden="true">
                  <b style={{ width: pct(v) }} />
                </span>
              )}
            </span>
            <span className="rl-mlist__num">{v.done ? t.done : v.target === 1 ? t.todo : `${fmt(lang, v.progress)}/${fmt(lang, v.target)}`}</span>
          </li>
        ))}
      </ul>
      <p className={`rl-prize${doneToday ? ' got' : ''}`}>
        <Gift />
        <span>
          {a}
          <b>{b}</b>
          {c}
        </span>
      </p>
      <div className="rl-week" aria-hidden="true">
        {days.map((d) => (
          <span key={d.key}>
            <i className={d.on ? 'on' : d.today ? 'today' : ''}>{d.on ? <Flame /> : null}</i>
            {d.label}
          </span>
        ))}
      </div>
    </Sheet>
  );
}

/** Etiqueta da partida: a meta mais perto de acabar, com anel de progresso. */
export function MissionPill({ lang, mission }: { lang: Lang; mission: MissionView | null }) {
  if (!mission) return null;
  const t = TEXT[lang];
  const r = 10;
  const c = 2 * Math.PI * r;
  return (
    <div className="rl-mpill">
      <svg className="rl-mpill__ring" viewBox="0 0 26 26" aria-hidden="true">
        <circle className="bg" cx="13" cy="13" r={r} />
        <circle className="fg" cx="13" cy="13" r={r} strokeDasharray={c} strokeDashoffset={c * (1 - mission.progress / mission.target)} />
      </svg>
      <span className="rl-mpill__txt">
        {t.goal}: {mission.text}
      </span>
      {mission.target > 1 ? (
        <em>
          {fmt(lang, mission.progress)}/{fmt(lang, mission.target)}
        </em>
      ) : null}
    </div>
  );
}
