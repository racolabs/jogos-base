/**
 * Componentes da casca comum, iguais aos protótipos aprovados.
 * Só usam as variáveis de themeCss(); o estilo vem de SHELL_CSS.
 */
import { useEffect, useId, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'reward' | 'quiet';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  icon?: ReactNode;
  /** Selo pequeno ao lado do texto (ex.: "1 grátis", "▶ vídeo"). */
  badge?: ReactNode;
}

/** Botão tátil: borda de baixo e afunda 2 px no toque. O dourado ("reward") só para prêmio. */
export function Button({ variant = 'secondary', icon, badge, className, children, type = 'button', ...rest }: ButtonProps) {
  return (
    <button type={type} className={['rl-btn', `rl-btn--${variant}`, className].filter(Boolean).join(' ')} {...rest}>
      {icon}
      {children}
      {badge !== undefined ? <small className="rl-btn__badge">{badge}</small> : null}
    </button>
  );
}

export interface SheetProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/** Folha que sobe de baixo. Fecha com Esc, com toque fora e pelos botões do conteúdo. */
export function Sheet({ open, title, onClose, children }: SheetProps) {
  const titleId = useId();
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    ref.current?.querySelector<HTMLElement>('button, [href], input, [tabindex]:not([tabindex="-1"])')?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="rl-scrim" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} className="rl-sheet" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <span className="rl-sheet__grab" aria-hidden="true" />
        <h2 id={titleId} className="rl-sheet__title">
          {title}
        </h2>
        {children}
      </div>
    </div>
  );
}

export interface ToastProps {
  message: string;
  /** Dourado para prêmio entregue. */
  tone?: 'default' | 'reward';
  /** Durante a partida o aviso fica no topo, nunca sobre a área de jogo. */
  placement?: 'top' | 'bottom';
  /** Tempo na tela; padrão 1,8 s no topo e 2,4 s embaixo. */
  durationMs?: number;
  onDone: () => void;
}

export function Toast({ message, tone = 'default', placement = 'bottom', durationMs, onDone }: ToastProps) {
  const ms = durationMs ?? (placement === 'top' ? 1800 : 2400);
  // onDone costuma ser uma função nova a cada render (ex.: jogo com relógio): guardar numa ref
  // evita reiniciar o tempo e deixar o aviso preso na tela.
  const done = useRef(onDone);
  done.current = onDone;
  useEffect(() => {
    const t = setTimeout(() => done.current(), ms);
    return () => clearTimeout(t);
  }, [ms, message]);
  return (
    <div role="status" className={['rl-toast', `rl-toast--${placement}`, tone === 'reward' ? 'rl-toast--reward' : ''].join(' ').trim()}>
      {message}
    </div>
  );
}

export interface SwitchProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export function Switch({ label, description, checked, onChange }: SwitchProps) {
  const id = useId();
  return (
    <div className="rl-set">
      <label htmlFor={id} className="rl-set__label">
        <span>{label}</span>
        {description ? <span className="rl-set__sub">{description}</span> : null}
      </label>
      <span className="rl-switch">
        <input id={id} type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span aria-hidden="true" />
      </span>
    </div>
  );
}

export interface SegmentedProps<T extends string> {
  label: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

/** Escolha entre poucas opções (idioma, tema, 1 ou 3 cartas). */
export function Segmented<T extends string>({ label, options, value, onChange }: SegmentedProps<T>) {
  return (
    <div className="rl-set">
      <span className="rl-set__label">{label}</span>
      <div className="rl-seg" role="group" aria-label={label}>
        {options.map((o) => (
          <button key={o.value} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
