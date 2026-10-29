# Changelog

## 0.12.0

- Módulo `seo` (`jogos-base/seo`): páginas pré-renderizadas por idioma e variação com título, descrição e "Como jogar" no HTML inicial, `canonical`, `hreflang` pt/en/x-default, Open Graph e Twitter, `sitemap.xml`, `robots.txt` e dados estruturados (JSON-LD `VideoGame` + `WebApplication`, sem avaliação inventada). (#28)
- Imagem de compartilhamento: `shareImage` (PNG/JPG 1200x630) validada; sem ela, gera SVG por página e avisa no build.
- `jogos-base/seo/node` (`prerender`) é entregue como JS compilado em `lib/`, para rodar em `node scripts/prerender.mjs` sem `tsx`. Uso em `docs/seo.md`.

## 0.10.0

- Casca Windows (user agent com `RacoLabsWindows/`): o link para outro jogo abre a página dele na Microsoft Store (`ms-windows-store://pdp/?ProductId=<id>`), em vez de navegar na janela.
- `GameInfo` ganha `storeId` e há `isWindowsShell(env)` e `storeUrl(url)`.
- Fora da casca nada muda. URL relativa, inválida ou fora do catálogo segue como link normal.
