# Changelog

## 0.12.0

- Módulo `seo` (`jogos-base/seo`): páginas pré-renderizadas por idioma e variação com título, descrição e "Como jogar" no HTML inicial, `canonical`, `hreflang` pt/en/x-default, Open Graph e Twitter, `sitemap.xml`, `robots.txt` e dados estruturados (JSON-LD `VideoGame` + `WebApplication`, sem avaliação inventada). (#28)
- Imagem de compartilhamento: `shareImage` (PNG/JPG 1200x630) validada; sem ela, gera SVG por página e avisa no build.
- `jogos-base/seo/node` (`prerender`) é entregue como JS compilado em `lib/`, para rodar em `node scripts/prerender.mjs` sem `tsx`. Uso em `docs/seo.md`.
- `jogos-base/compliance` (`assertNoPrizeDraw`): reprova sorteio de prêmio pago ou por vídeo no código do jogo. (#111)
- `ConsentProvider` (Google TCF, sem CMP, falso) ligado ao `AdSenseProvider` pela opção `consent`; anúncio personalizado só com consentimento explícito. `PrivacyChoicesButton` em `jogos-base/ui`. (#113)
- Contrato de anúncio não personalizado por padrão, testado contra todas as implementações de `AdProvider`. (#114)

## 0.11.0

- Casca Windows (user agent com `RacoLabsWindows/`): o link para outro jogo abre a página dele na Microsoft Store (`ms-windows-store://pdp/?ProductId=<id>`), em vez de navegar na janela.
- `GameInfo` ganha `storeId` e há `isWindowsShell(env)` e `storeUrl(url)`.
- Fora da casca nada muda. URL relativa, inválida ou fora do catálogo segue como link normal.

## 0.10.0

- Teste de arquitetura de anúncios (`jogos-base/ads/guard`, `assertNoDirectAdSdk`): reprova um jogo que importe SDK de anúncio ou carregue script de rede de anúncio direto. Só `src/ads` da base pode usar SDK. (#20, #105)
- Banner de tamanho fixo no AdSense: nova opção `bannerSize: { width, height }` no `AdSenseProvider`. Sem a opção, o banner responsivo continua igual. Tamanho inválido cai no responsivo. (#107)
