import { escapeHtml } from "./render.js";
export const SHARE_IMAGE_SIZE = { width: 1200, height: 630 };
/** Quebra o texto em linhas de até `max` caracteres, sem cortar palavra. */
export function wrapText(text, max, maxLines) {
    const lines = [];
    let line = '';
    for (const word of text.split(/\s+/).filter(Boolean)) {
        if (line && `${line} ${word}`.length > max) {
            lines.push(line);
            line = word;
        }
        else
            line = line ? `${line} ${word}` : word;
    }
    if (line)
        lines.push(line);
    if (lines.length > maxLines) {
        const kept = lines.slice(0, maxLines);
        kept[maxLines - 1] = `${kept[maxLines - 1].replace(/[\s.,;:!?]+$/, '')}…`;
        return kept;
    }
    return lines;
}
/** Imagem 1200x630 da página, em SVG puro (sem fonte nem imagem de fora). Cores vêm do `themeColor` do jogo. */
export function shareImageSvg(page, brand) {
    const { width, height } = SHARE_IMAGE_SIZE;
    const title = wrapText(page.heading, 22, 2);
    const desc = wrapText(page.description, 54, 3);
    const titleLines = title.map((l, i) => `<tspan x="80" dy="${i === 0 ? 0 : 96}">${escapeHtml(l)}</tspan>`).join('');
    const descY = 250 + (title.length - 1) * 96 + 90;
    const descLines = desc.map((l, i) => `<tspan x="80" dy="${i === 0 ? 0 : 52}">${escapeHtml(l)}</tspan>`).join('');
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeHtml(page.heading)}">
  <rect width="${width}" height="${height}" fill="${escapeHtml(brand.color)}"/>
  <text x="80" y="250" font-family="system-ui, 'Segoe UI', Arial, sans-serif" font-size="88" font-weight="800" fill="#ffffff">${titleLines}</text>
  <text x="80" y="${descY}" font-family="system-ui, 'Segoe UI', Arial, sans-serif" font-size="38" fill="#ffffff" fill-opacity="0.88">${descLines}</text>
  <text x="80" y="${height - 60}" font-family="system-ui, 'Segoe UI', Arial, sans-serif" font-size="32" font-weight="700" fill="#ffffff" fill-opacity="0.7">${escapeHtml(brand.name)}</text>
</svg>
`;
}
