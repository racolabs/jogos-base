import type { SeoGame, SeoPage } from './types.ts';
/**
 * Dados estruturados `VideoGame` + `WebApplication` (schema.org) da página. A variação aponta para o jogo em `isPartOf`.
 * Sem `aggregateRating` nem `review`: avaliação só entra se for real e vier de dados reais, nunca inventada.
 */
export declare function videoGameJsonLd(game: SeoGame, page: SeoPage): Record<string, unknown>;
/**
 * Confere o que `VideoGame` + `WebApplication` precisam para o validador do schema.org e os leitores do Google:
 * contexto, tipo, textos, endereços https e idioma conhecido. Vazio = válido.
 * (Dados válidos não garantem resultado rico: o Google só mostra o de app com avaliação real, que não inventamos.)
 */
export declare function validateVideoGameJsonLd(ld: unknown): string[];
/** JSON seguro para dentro de <script>: o caractere menor-que vira o escape unicode, então nada fecha a tag antes da hora. */
export declare function jsonForScript(value: unknown): string;
