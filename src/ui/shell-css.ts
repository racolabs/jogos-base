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
.rl-btn__badge { font-size: calc(14px * var(--fs)); font-weight: 700; padding: 3px 8px; border-radius: 8px; background: var(--gold-soft); color: var(--gold-ink); }
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
@keyframes rl-fade { from { opacity: 0; } }
@keyframes rl-sheet { from { transform: translateY(100%); } }
@keyframes rl-up { from { transform: translate(-50%, 30px); opacity: 0; } }
@keyframes rl-down { from { transform: translate(-50%, -30px); opacity: 0; } }
@media (prefers-reduced-motion: reduce) { .rl-scrim, .rl-sheet, .rl-toast, .rl-btn, .rl-switch span, .rl-switch span::after { animation: none; transition: none; } }
:root[data-reduce] .rl-scrim, :root[data-reduce] .rl-sheet, :root[data-reduce] .rl-toast { animation: none; }
`;
