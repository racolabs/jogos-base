/**
 * Portais de jogos (CrazyGames e semelhantes) pedem mais que anúncio: avisar quando o jogo carrega e quando o jogador
 * está jogando, obedecer ao "silenciar" do portal e não mostrar o que o portal proíbe (divulgação de outros jogos,
 * instalar o app). Este arquivo é o lado neutro: o jogo e a interface falam só com estes tipos, nunca com o SDK do portal.
 *
 * - `PortalEvents`: o provider de um portal os implementa (`AdProvider.portal`); sem portal, `portalOf` devolve um objeto que não faz nada.
 * - `PortalProfile`: o que o portal não aceita. O ponto de composição do jogo ativa (`activatePortal`) e a interface (`MoreGames`,
 *   `useInstall`, `Feedback`) obedece sozinha, sem o código das telas mudar.
 */
import type { AdProvider } from './types.ts';

/** Eventos de ciclo de vida que o portal mede. Todos são seguros de chamar sempre: sem portal, não fazem nada. */
export interface PortalEvents {
  /** Começou a carregar (opcional no portal; mede carregamento dentro do jogo). */
  loadingStart(): void;
  loadingStop(): void;
  /** O jogador começou ou voltou a jogar (iniciar partida, retomar, próxima fase). O primeiro evento mede o tamanho do download. */
  gameplayStart(): void;
  /** Parou de jogar (menu, fim de partida, pausa). Não chame ao trocar de aba: o portal cuida disso. */
  gameplayStop(): void;
  /** Conquista rara (recorde, desafio do dia). O portal comemora; use pouco. */
  happyTime(): void;
  /** O portal pediu silêncio. Vale mais que a configuração de som do jogo. */
  audioMuted(): boolean;
  /** Avisa mudanças do pedido de silêncio. Devolve a função que cancela. */
  onAudioMutedChange(listener: (muted: boolean) => void): () => void;
}

/** Sem portal: nada acontece, nada é lido. */
export const NO_PORTAL_EVENTS: PortalEvents = Object.freeze({
  loadingStart() {},
  loadingStop() {},
  gameplayStart() {},
  gameplayStop() {},
  happyTime() {},
  audioMuted: () => false,
  onAudioMutedChange: () => () => {},
});

/** Eventos do portal do provider, ou um objeto que não faz nada. É o que o jogo chama. */
export function portalOf(provider: AdProvider): PortalEvents {
  return provider.portal ?? NO_PORTAL_EVENTS;
}

/**
 * O que um portal não aceita dentro do jogo.
 * - `crossPromo`: faixa "Mais jogos" e qualquer divulgação de outros jogos ou lojas (`MoreGames` some).
 * - `install`: instalar o app / PWA (`useInstall` fica `unsupported`, o cartão some).
 * - `externalLinks`: links para fora do jogo (o jogo e o build decidem; a interface só informa por `portalBlocks`).
 * - `serviceWorker`: service worker e manifesto (decisão do build: o jogo pergunta por `portalBlocks`).
 */
export type PortalFeature = 'crossPromo' | 'install' | 'externalLinks' | 'serviceWorker';

export interface PortalProfile {
  readonly id: string;
  readonly blocks: readonly PortalFeature[];
}

/** CrazyGames: sem divulgação cruzada, sem instalação, sem links para fora e sem service worker (o portal serve o pacote). */
export const CRAZYGAMES_PROFILE: PortalProfile = Object.freeze({
  id: 'crazygames',
  blocks: Object.freeze(['crossPromo', 'install', 'externalLinks', 'serviceWorker'] as PortalFeature[]),
});

let active: { profile: PortalProfile; events: PortalEvents } | null = null;

/** Liga o perfil de um portal (uma vez, no ponto de composição do jogo). `null` desliga. */
export function activatePortal(profile: PortalProfile | null, events: PortalEvents = NO_PORTAL_EVENTS): void {
  active = profile ? { profile, events } : null;
}

export function activePortal(): PortalProfile | null {
  return active?.profile ?? null;
}

/** O portal ativo proíbe isto? Sem portal ativo, nada é proibido. */
export function portalBlocks(feature: PortalFeature): boolean {
  return active?.profile.blocks.includes(feature) ?? false;
}

/** O portal ativo pediu silêncio? (usado pelo `Feedback` para calar efeitos e vibração). */
export function portalAudioMuted(): boolean {
  return active?.events.audioMuted() ?? false;
}

/** Escolhe o perfil pelo ambiente do build (`VITE_PORTAL=crazygames`). Valor desconhecido ou vazio: sem portal. */
export function portalProfileFromEnv(env: Record<string, string | boolean | undefined>): PortalProfile | null {
  const id = typeof env.VITE_PORTAL === 'string' ? env.VITE_PORTAL.trim().toLowerCase() : '';
  return id === CRAZYGAMES_PROFILE.id ? CRAZYGAMES_PROFILE : null;
}
