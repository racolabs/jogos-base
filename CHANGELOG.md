# Changelog

## 0.13.0

Adaptador do CrazyGames atrás do `AdProvider`, para gerar o build do portal sem mudar o jogo. (#44)

- `CrazyGamesProvider` (`jogos-base/ads`): SDK HTML5 v3 do portal só por aqui, atrás da interface. Intersticial = `midgame`, premiado = `rewarded` (prêmio só no `adFinished`; `adError` nunca premia), banner responsivo no espaço que o jogo reserva. Carrega `sdk.crazygames.com/crazygames-sdk-v3.js`, espera o `init()` e só usa o SDK nos ambientes `crazygames` e `local`. Sem o SDK (script bloqueado, domínio fora do portal, tempo esgotado) tudo vira no-op seguro. Um anúncio por vez; `adsDisabled` (Basic Launch, modo infantil) e bloqueador de anúncio escondem os formatos desligados; `onPause`/`onResume` saem quando o anúncio de fato começa e termina.
- `AdProvider.portal` (opcional) e `portalOf(provider)`: `loadingStart/Stop`, `gameplayStart/Stop`, `happyTime`, `audioMuted()` e `onAudioMutedChange`. Providers sem portal seguem iguais; `portalOf` devolve um objeto que não faz nada.
- Perfil do portal: `CRAZYGAMES_PROFILE`, `activatePortal`, `portalBlocks`, `portalProfileFromEnv` e `crazyGamesFromEnv` (`VITE_PORTAL=crazygames`). Com o perfil ativo, `MoreGames` some, `useInstall` fica `unsupported` e o `Feedback` cala o som quando o portal pede silêncio, sem o código das telas mudar.
- Contrato de anúncio: harness do CrazyGames. O SDK não tem flag de personalização, então o pedido leva só o formato e funções de retorno; qualquer dado a mais reprova. `assertNoDirectAdSdk` passa a barrar também o global `CrazyGames` fora de `src/ads`.
- Novos exports: `CRAZYGAMES_SCRIPT`, tipos `CrazyGamesSdk`, `CrazyGamesOptions`, `PortalEvents`, `PortalProfile`, `PortalFeature`.

## 0.12.1

Ajuste do módulo `seo` para os jogos que adotaram a 0.12.0 sem regressão de SEO. Tudo é opção de `SeoGame`; sem elas o resultado é o mesmo da 0.12.0. (Refs #28)

- `defaultLocale`: idioma do `hreflang="x-default"` (padrão `'en'`). Os jogos RacoLabs devem passar `'pt'`.
- `langTags`: tag BCP 47 por idioma (`{ pt: 'pt-BR', en: 'en-US' }`), usada em `<html lang>`, `hreflang` (head e sitemap) e `og:locale` (`pt_BR`/`en_US`). A URL continua `/pt/` e `/en/`.
- `intro` (parágrafo de introdução) e `links` (`{ text, href }`, ex.: privacidade, exigida para o AdSense) por idioma, no HTML pré-renderizado, escapados. `href` só aceita `/caminho` (sem `//` nem `/\` no começo) ou https. A variação pode ter `intro` própria.
- `heading`: título visível (`<h1>`) da página inicial por idioma (ex.: "Paciência online grátis"); padrão é o nome do jogo. O nome em JSON-LD e Open Graph não muda.
- JSON-LD: `priceCurrency` (uma moeda ou por idioma; padrão BRL no pt e USD no en, em vez de USD fixo), `genre` como texto ou lista, `gamePlatform` (ex.: `['Web browser', 'Android']`, só sai se informado) e `inLanguage` seguindo `langTags`.
- `extraPages` (`{ paths: { pt, en } }`): páginas geradas por fora (ex.: `/pt/privacidade/`) entram no `sitemap.xml` com `hreflang` e `x-default` corretos. Novas funções `extraEntriesFor` e `langTagOf`; `sitemapXml` aceita qualquer `SitemapEntry`.

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
