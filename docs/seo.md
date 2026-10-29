# Módulo `seo`

Gera, no build de cada jogo, o que o Google lê **sem executar JavaScript**: uma página por idioma e por variação, com título, descrição, texto de ajuda, `canonical`, `hreflang`, Open Graph, dados estruturados (`VideoGame`), `sitemap.xml`, `robots.txt` e imagem de compartilhamento.

## Uso no jogo

1. Descreva o jogo uma vez (`SeoGame`: origem, nomes, descrições, passos de ajuda, gênero e variações) num arquivo do jogo.
2. Depois do build do Vite, rode um script de Node:

```ts
import { prerender } from 'jogos-base/seo/node';
import { game } from './seo.config.ts';

prerender({ game, templatePath: 'dist/index.html', outDir: 'dist', lastmod: '2026-10-28' });
```

3. Sirva `dist/<lang>/index.html` nas rotas `/pt/`, `/en/` e `/<lang>/<variação>/` (o servidor estático já faz isso com pasta + `index.html`). O app React monta em `#root` e troca o texto pré-renderizado.

O Vite deve usar `base: '/'` (assets por caminho absoluto), porque as páginas ficam em pastas diferentes.

## O que sai

| Arquivo | Conteúdo |
| --- | --- |
| `/<lang>/index.html`, `/<lang>/<slug>/index.html` | `index.html` do build com `<html lang>`, head completo e `<h1>`, descrição e "Como jogar" dentro de `#root` |
| `sitemap.xml` | Todas as páginas, cada uma com `xhtml:link` para pt, en e `x-default` (inglês) |
| `robots.txt` | Libera tudo e aponta para o sitemap |
| `/og/<lang>[-<slug>].svg` | Imagem 1200x630 por página, só se o jogo não informar `shareImage` |

## Imagem de compartilhamento

Google lê o SVG, mas WhatsApp, Facebook e X não. Para aparecer em conversas, informe `shareImage: '/og.png'` (PNG ou JPG 1200x630 do próprio jogo). O SVG gerado serve de fallback e de base para exportar o PNG.

## Conferir

- `validateGame(game)` recusa origem sem https, slug repetido ou inválido e texto vazio em pt/en (o `prerender` já chama).
- `validateVideoGameJsonLd(ld)` confere o JSON-LD; os testes rodam isso em todas as páginas.
- `pnpm build` neste repo gera um exemplo em `dist/seo-exemplo` para inspeção.
