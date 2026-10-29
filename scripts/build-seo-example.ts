/**
 * pnpm build: gera num diretório dist/seo-exemplo o que um jogo recebe do módulo seo (páginas, sitemap, robots, imagens)
 * e confere o resultado. Serve de prova de que o gerador roda de ponta a ponta e de modelo para o script do jogo.
 */
import { rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { EXAMPLE_GAME, EXAMPLE_TEMPLATE } from '../src/seo/fixture.ts';
import { prerender } from '../src/seo/node.ts';

const outDir = fileURLToPath(new URL('../dist/seo-exemplo', import.meta.url));
rmSync(outDir, { recursive: true, force: true });
const { pages, files } = prerender({ game: EXAMPLE_GAME, template: EXAMPLE_TEMPLATE, outDir });
console.log(`seo: ${pages.length} páginas, ${files.length} arquivos em dist/seo-exemplo`);
