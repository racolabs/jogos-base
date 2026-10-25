/**
 * Instalar o jogo na tela inicial (PWA).
 * - Android, Chrome e Edge: o navegador entrega o pedido de instalação (beforeinstallprompt) e um toque instala.
 * - iPhone e iPad: o iOS não deixa o site pedir; mostramos os 3 passos do menu Compartilhar.
 * - Já instalado ou navegador sem suporte: nada aparece.
 */
import { useCallback, useEffect, useState } from 'react';
import { Button, Sheet } from './components.tsx';

export type InstallState = 'installed' | 'prompt' | 'ios' | 'unsupported';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export interface InstallEnv {
  userAgent: string;
  platform: string;
  maxTouchPoints: number;
  /** Aberto como app instalado (display-mode standalone ou navigator.standalone no iOS). */
  standalone: boolean;
}

export function browserEnv(): InstallEnv {
  const nav = typeof navigator !== 'undefined' ? navigator : ({} as Navigator);
  const mm = typeof matchMedia === 'function' ? matchMedia('(display-mode: standalone)').matches : false;
  return {
    userAgent: nav.userAgent ?? '',
    platform: nav.platform ?? '',
    maxTouchPoints: nav.maxTouchPoints ?? 0,
    standalone: mm || (nav as Navigator & { standalone?: boolean }).standalone === true,
  };
}

/** iPhone, iPod ou iPad (o iPad novo se apresenta como Mac com tela de toque). */
export function isIOS(env: InstallEnv): boolean {
  return /iPhone|iPad|iPod/i.test(env.userAgent) || (env.platform === 'MacIntel' && env.maxTouchPoints > 1);
}

/** Estado inicial, antes de o navegador mandar (ou não) o pedido de instalação. */
export function initialInstallState(env: InstallEnv): InstallState {
  if (env.standalone) return 'installed';
  if (isIOS(env)) return 'ios';
  return 'unsupported';
}

export function useInstall(env: InstallEnv = browserEnv()) {
  const [state, setState] = useState<InstallState>(() => initialInstallState(env));
  const [event, setEvent] = useState<BeforeInstallPromptEvent | null>(null);
  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvent(e as BeforeInstallPromptEvent);
      setState('prompt');
    };
    const onInstalled = () => {
      setEvent(null);
      setState('installed');
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);
  /** Abre a instalação nativa (Android/Chrome). Só funciona dentro de um toque do jogador. */
  const install = useCallback(async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
    if (!event) return 'unavailable';
    await event.prompt();
    const { outcome } = await event.userChoice;
    setEvent(null);
    if (outcome === 'accepted') setState('installed');
    return outcome;
  }, [event]);
  return { state, install };
}

const TEXT = {
  pt: {
    title: 'Instale o jogo',
    sub: 'Abra direto da tela inicial, até sem internet.',
    install: 'Instalar',
    how: 'Como instalar',
    later: 'Agora não',
    iosTitle: 'Instalar no iPhone',
    steps: ['Toque no botão Compartilhar do navegador.', 'Role e toque em "Adicionar à Tela de Início".', 'Toque em "Adicionar". Pronto: o jogo fica na tela inicial.'],
    ok: 'Entendi',
  },
  en: {
    title: 'Install the game',
    sub: 'Open it straight from your home screen, even offline.',
    install: 'Install',
    how: 'How to install',
    later: 'Not now',
    iosTitle: 'Install on iPhone',
    steps: ['Tap the browser’s Share button.', 'Scroll and tap "Add to Home Screen".', 'Tap "Add". Done: the game is on your home screen.'],
    ok: 'Got it',
  },
} as const;

export interface InstallCardProps {
  lang: 'pt' | 'en';
  state: InstallState;
  onInstall: () => void;
  /** "Agora não": o jogo guarda e esconde o cartão por um tempo. */
  onDismiss: () => void;
  /** Ícone do jogo (ex.: /icon-192.png). */
  icon: string;
}

/** Cartão do início. Não aparece quando já está instalado ou o navegador não permite. */
export function InstallCard({ lang, state, onInstall, onDismiss, icon }: InstallCardProps) {
  const [iosOpen, setIosOpen] = useState(false);
  if (state === 'installed' || state === 'unsupported') return null;
  const t = TEXT[lang];
  return (
    <>
      <div className="rl-install" role="region" aria-label={t.title}>
        <img src={icon} alt="" width={48} height={48} className="rl-install__icon" />
        <span className="rl-install__text">
          <strong>{t.title}</strong>
          <span>{t.sub}</span>
        </span>
        <button type="button" className="rl-install__go" onClick={() => (state === 'ios' ? setIosOpen(true) : onInstall())}>
          {state === 'ios' ? t.how : t.install}
        </button>
        <button type="button" className="rl-install__close" aria-label={t.later} onClick={onDismiss}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
      <IosInstallSheet lang={lang} open={iosOpen} onClose={() => setIosOpen(false)} />
    </>
  );
}

/** Os 3 passos do iPhone, com o desenho de cada botão. */
export function IosInstallSheet({ lang, open, onClose }: { lang: 'pt' | 'en'; open: boolean; onClose: () => void }) {
  const t = TEXT[lang];
  const icons = [
    <path key="share" d="M12 3v12M7 8l5-5 5 5M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />,
    <path key="add" d="M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM12 8v8M8 12h8" />,
    <path key="ok" d="M5 12.5l4.5 4.5L19 7.5" />,
  ];
  return (
    <Sheet open={open} title={t.iosTitle} onClose={onClose}>
      <ol className="rl-steps">
        {t.steps.map((s, k) => (
          <li key={k}>
            <span className="rl-steps__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                {icons[k]}
              </svg>
            </span>
            <span>{s}</span>
          </li>
        ))}
      </ol>
      <Button variant="primary" onClick={onClose}>
        {t.ok}
      </Button>
    </Sheet>
  );
}

/** Esconder o cartão por 7 dias depois do "Agora não". */
export const INSTALL_SNOOZE_MS = 7 * 86_400_000;
export const installSnoozed = (dismissedAt: number | null | undefined, now: number) =>
  !!dismissedAt && now - dismissedAt < INSTALL_SNOOZE_MS;
