/**
 * Jogos da RacoLabs para os links cruzados das páginas pré-renderizadas ("Outros jogos da RacoLabs") e o estúdio,
 * primeiro degrau da trilha (`BreadcrumbList`). Mesmos ids e endereços do `GAMES` de `jogos-base/ui` (um teste confere).
 * Fica aqui, sem React, porque o `seo/node` roda no build em Node.
 */
import type { SeoOtherGame } from './types.ts';
export declare const RACOLABS_STUDIO: {
    readonly name: "RacoLabs";
    readonly url: {
        readonly pt: "https://racolabs.app/";
        readonly en: "https://racolabs.app/en/";
    };
};
export declare const RACOLABS_GAMES: readonly SeoOtherGame[];
