import type { SeoPage } from './types.ts';
export declare const SHARE_IMAGE_SIZE: {
    readonly width: 1200;
    readonly height: 630;
};
/** Quebra o texto em linhas de até `max` caracteres, sem cortar palavra. */
export declare function wrapText(text: string, max: number, maxLines: number): string[];
/** Imagem 1200x630 da página, em SVG puro (sem fonte nem imagem de fora). Cores vêm do `themeColor` do jogo. */
export declare function shareImageSvg(page: SeoPage, brand: {
    name: string;
    color: string;
}): string;
