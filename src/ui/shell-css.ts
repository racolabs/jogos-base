/**
 * Estilo dos componentes da casca, igual aos protótipos aprovados. Usa só variáveis de themeCss().
 * O jogo injeta uma vez: <style>{themeCss(TEMA) + SHELL_CSS}</style>.
 */
export const SHELL_CSS = `
.rl-btn { min-height: 56px; padding: 0 20px; border: 0; border-radius: 16px; display: inline-flex; align-items: center; justify-content: center; gap: 10px;
  font: 800 calc(19px * var(--fs)) var(--font-ui); cursor: pointer; width: 100%; background: var(--surface-2); color: var(--ink);
  box-shadow: inset 0 -4px 0 rgba(0, 0, 0, .14); transition: transform 90ms ease-out, box-shadow 90ms ease-out; }
.rl-btn:active:not(:disabled) { transform: translateY(2px); box-shadow: inset 0 -2px 0 rgba(0, 0, 0, .14); }
.rl-btn:disabled { opacity: .45; cursor: default; }
.rl-btn:focus-visible { outline: 3px solid var(--focus); outline-offset: 2px; }
.rl-btn--primary { background: var(--ink); color: var(--ground); }
.rl-btn--reward { background: var(--gold); color: #1C1D2B; box-shadow: inset 0 -4px 0 rgba(120, 70, 0, .3); }
.rl-btn--quiet { background: transparent; box-shadow: none; min-height: 48px; font-weight: 700; color: var(--muted); }
.rl-btn svg { width: 22px; height: 22px; flex: 0 0 auto; }
.rl-btn__badge { white-space: nowrap; font-size: calc(14px * var(--fs)); font-weight: 700; padding: 3px 8px; border-radius: 8px; background: var(--gold-soft); color: var(--gold-ink); }
.rl-scrim { position: absolute; inset: 0; z-index: 1000; background: rgba(18, 19, 32, .46); display: flex; align-items: flex-end; animation: rl-fade .2s ease-out; }
.rl-sheet { width: 100%; background: var(--surface); color: var(--ink); border-radius: 26px 26px 0 0; display: flex; flex-direction: column; gap: 14px;
  padding-block: 10px max(20px, env(safe-area-inset-bottom, 0px)); padding-left: max(20px, env(safe-area-inset-left, 0px)); padding-right: max(20px, env(safe-area-inset-right, 0px));
  animation: rl-sheet .3s cubic-bezier(.34, 1.56, .64, 1); }
.rl-sheet__grab { width: 40px; height: 5px; border-radius: 3px; background: var(--line); align-self: center; }
.rl-sheet__title { margin: 0; font: 800 calc(26px * var(--fs)) var(--font-ui); text-wrap: balance; }
.rl-toast { position: absolute; z-index: 1200; left: 50%; transform: translateX(-50%); max-width: calc(100% - 32px); padding: 12px 18px; border-radius: 16px;
  background: var(--ink); color: var(--ground); font: 800 calc(17px * var(--fs)) var(--font-ui); pointer-events: none; }
.rl-toast--bottom { bottom: max(24px, env(safe-area-inset-bottom, 0px)); animation: rl-up .3s cubic-bezier(.34, 1.56, .64, 1); }
.rl-toast--top { top: max(8px, env(safe-area-inset-top, 0px)); padding: 8px 14px; font-size: calc(15px * var(--fs)); animation: rl-down .3s cubic-bezier(.34, 1.56, .64, 1); }
.rl-toast--reward { background: var(--gold); color: #1C1D2B; }
.rl-set { display: flex; align-items: center; gap: 12px; min-height: 60px; padding: 8px 16px; flex-wrap: wrap; }
.rl-set__label { flex: 1 1 auto; display: flex; flex-direction: column; font-weight: 700; }
.rl-set__sub { font-weight: 500; color: var(--muted); font-size: calc(14px * var(--fs)); }
.rl-switch { position: relative; width: 56px; height: 34px; flex: 0 0 auto; }
.rl-switch input { position: absolute; inset: 0; opacity: 0; margin: 0; cursor: pointer; z-index: 1; }
.rl-switch span { position: absolute; inset: 0; border-radius: 17px; background: var(--line); transition: background .15s; }
.rl-switch span::after { content: ""; position: absolute; top: 3px; left: 3px; width: 28px; height: 28px; border-radius: 50%; background: #FFFFFF; transition: transform .18s cubic-bezier(.34, 1.56, .64, 1); }
.rl-switch input:checked + span { background: var(--accent, var(--good)); }
.rl-switch input:checked + span::after { transform: translateX(22px); }
.rl-switch input:focus-visible + span { outline: 3px solid var(--focus); outline-offset: 2px; }
.rl-seg { display: inline-flex; padding: 3px; border-radius: 12px; background: var(--surface-2); gap: 2px; flex-wrap: wrap; }
.rl-seg button { border: 0; background: transparent; color: var(--ink); padding: 8px 12px; border-radius: 9px; font: 700 calc(15px * var(--fs)) var(--font-ui); cursor: pointer; min-height: 40px; }
.rl-seg button[aria-pressed="true"] { background: var(--surface); }
.rl-install { position: relative; display: flex; align-items: center; gap: 12px; padding: 12px 44px 12px 12px; border-radius: 20px; background: var(--surface); color: var(--ink); }
.rl-install__icon { width: 48px; height: 48px; border-radius: 12px; flex: 0 0 auto; }
.rl-install__text { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; }
.rl-install__text strong { font-weight: 800; }
.rl-install__text span { color: var(--muted); font-size: calc(14px * var(--fs)); }
.rl-install__go { flex: 0 0 auto; border: 0; border-radius: 12px; padding: 10px 14px; min-height: 44px; background: var(--ink); color: var(--ground); font: 800 calc(15px * var(--fs)) var(--font-ui); cursor: pointer; box-shadow: inset 0 -3px 0 rgba(0, 0, 0, .2); }
.rl-install__go:active { transform: translateY(2px); }
.rl-install__close { position: absolute; top: 6px; right: 6px; width: 32px; height: 32px; border: 0; border-radius: 10px; background: transparent; color: var(--muted); display: grid; place-items: center; cursor: pointer; }
.rl-install__close svg { width: 18px; height: 18px; }
.rl-mcard { width: 100%; border: 0; background: var(--surface); color: var(--ink); border-radius: 20px; padding: 14px; display: flex; flex-direction: column; gap: 10px; cursor: pointer; text-align: left; font: inherit; }
.rl-mcard:active { transform: translateY(2px); }
.rl-mcard__top { display: flex; align-items: center; gap: 10px; }
.rl-flame { width: 38px; height: 38px; border-radius: 12px; background: var(--gold-soft); display: grid; place-items: center; flex: 0 0 auto; }
.rl-flame svg { width: 22px; height: 22px; fill: var(--gold); }
.rl-mcard__ttl { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; }
.rl-mcard__ttl strong { font-size: calc(16px * var(--fs)); font-weight: 800; }
.rl-mcard__ttl span { color: var(--muted); font-size: calc(13px * var(--fs)); font-weight: 600; }
.rl-mcard__count { font: 700 calc(18px * var(--fs)) var(--font-display); color: var(--gold); }
.rl-mcard__bars { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; }
.rl-mcard__bars i, .rl-mlist__bar { height: 8px; border-radius: 999px; background: var(--surface-2); overflow: hidden; display: block; }
.rl-mcard__bars b, .rl-mlist__bar b { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg, var(--accent, var(--gold)), var(--gold)); animation: rl-fill .9s cubic-bezier(.2, .8, .3, 1) .2s backwards; }
.rl-mcard__bars i.done b { background: var(--gold); }
@keyframes rl-fill { from { width: 0; } }
.rl-msheet__sub { margin: -6px 0 0; color: var(--muted); font-size: calc(13px * var(--fs)); font-weight: 600; }
.rl-mlist { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.rl-mlist li { display: grid; grid-template-columns: 42px 1fr auto; gap: 10px; align-items: center; background: var(--surface-2); border-radius: 16px; padding: 10px 12px; }
.rl-mlist__lvl { width: 42px; height: 42px; border-radius: 12px; display: grid; place-items: center; font-size: 10px; font-weight: 800; text-transform: uppercase; background: var(--ground); color: var(--muted); }
.rl-mlist__txt { min-width: 0; display: flex; flex-direction: column; gap: 6px; }
.rl-mlist__txt strong { font-size: calc(15px * var(--fs)); line-height: 1.25; }
.rl-mlist__bar { height: 6px; background: var(--ground); }
.rl-mlist__num { font: 700 calc(14px * var(--fs)) var(--font-display); color: var(--muted); text-align: right; white-space: nowrap; }
.rl-mlist li.done { background: var(--gold-soft); }
.rl-mlist li.done .rl-mlist__lvl { background: var(--gold); color: #1C1D2B; }
.rl-mlist li.done .rl-mlist__lvl svg { width: 22px; height: 22px; animation: rl-pop .45s cubic-bezier(.2, 1.4, .4, 1) .3s backwards; }
.rl-mlist li.done .rl-mlist__num { color: var(--gold-ink); }
@keyframes rl-pop { from { transform: scale(0); } }
.rl-prize { margin: 0; display: flex; align-items: center; gap: 10px; border: 2px dashed var(--surface-2); border-radius: 16px; padding: 10px 12px; font-size: calc(14px * var(--fs)); font-weight: 600; color: var(--muted); }
.rl-prize b { color: var(--ink); }
.rl-prize svg { width: 26px; height: 26px; flex: 0 0 auto; color: var(--gold); }
.rl-prize.got { border-style: solid; border-color: var(--gold); }
.rl-week { display: flex; justify-content: space-between; }
.rl-week span { display: flex; flex-direction: column; align-items: center; gap: 4px; font-size: 11px; font-weight: 700; color: var(--muted); }
.rl-week i { width: 28px; height: 28px; border-radius: 50%; background: var(--surface-2); display: grid; place-items: center; }
.rl-week i.on { background: var(--gold); }
.rl-week i.on svg { width: 16px; height: 16px; fill: #1C1D2B; }
.rl-week i.today { box-shadow: 0 0 0 2px var(--gold); background: transparent; }
.rl-mpill { display: flex; align-items: center; gap: 8px; background: var(--surface); color: var(--ink); border-radius: 999px; padding: 5px 12px 5px 5px; font-size: calc(13px * var(--fs)); font-weight: 700; min-width: 0; }
.rl-mpill__ring { width: 26px; height: 26px; flex: 0 0 auto; }
.rl-mpill__ring circle { fill: none; stroke-width: 4; }
.rl-mpill__ring .bg { stroke: var(--surface-2); }
.rl-mpill__ring .fg { stroke: var(--gold); stroke-linecap: round; transform: rotate(-90deg); transform-origin: center; transition: stroke-dashoffset .6s; }
.rl-mpill__txt { flex: 1 1 auto; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.rl-mpill em { font-style: normal; color: var(--muted); font-family: var(--font-display); white-space: nowrap; }
.rl-steps { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 12px; counter-reset: step; }
.rl-steps li { display: flex; align-items: center; gap: 14px; font-weight: 600; }
.rl-steps__icon { width: 44px; height: 44px; flex: 0 0 auto; border-radius: 12px; background: var(--surface-2); color: var(--focus); display: grid; place-items: center; }
.rl-steps__icon svg { width: 24px; height: 24px; }
@keyframes rl-fade { from { opacity: 0; } }
@keyframes rl-sheet { from { transform: translateY(100%); } }
@keyframes rl-up { from { transform: translate(-50%, 30px); opacity: 0; } }
@keyframes rl-down { from { transform: translate(-50%, -30px); opacity: 0; } }
@media (prefers-reduced-motion: reduce) { .rl-scrim, .rl-sheet, .rl-toast, .rl-btn, .rl-switch span, .rl-switch span::after { animation: none; transition: none; } }
:root[data-reduce] .rl-scrim, :root[data-reduce] .rl-sheet, :root[data-reduce] .rl-toast { animation: none; }
`;
