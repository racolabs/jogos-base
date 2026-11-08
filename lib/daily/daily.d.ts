/**
 * Desafio do dia: a mesma semente para todo mundo no mesmo dia (UTC), dias seguidos sem punição pesada
 * e nada de sorteio ou moeda (decisão de 2026-10-25).
 */
/** Dia do desafio em UTC (AAAA-MM-DD): vira à 0 h UTC, igual no mundo todo. */
export declare function dailyKey(now: Date | number): string;
/** Número aleatório reproduzível: mesma semente, mesma sequência, em qualquer aparelho. */
export declare function seededRandom(seed: string): () => number;
/** Gerador do desafio de um jogo num dia: "dobra" e "paciencia" não compartilham sequência. */
export declare function dailyRandom(game: string, day: string): () => number;
export interface StreakState {
    /** Último dia (dailyKey) com desafio concluído. */
    lastDay: string | null;
    streak: number;
    best: number;
    /** Semana ISO (AAAA-Www) em que a folga foi usada. */
    freezeWeek: string | null;
}
export declare const emptyStreak: () => StreakState;
/** Semana ISO 8601 do dia, ex.: 2026-W44. */
export declare function isoWeek(day: string): string;
/** Registra o desafio concluído hoje. Concluir de novo no mesmo dia não muda nada. */
export declare function completeDay(state: StreakState, today: string): StreakState;
/** Sequência que a tela mostra hoje: continua viva enquanto o jogador ainda pode emendar. */
export declare function visibleStreak(state: StreakState, today: string): number;
/** Próximo desafio: milissegundos até a 0 h UTC seguinte. */
export declare function msUntilNextDaily(now: Date | number): number;
