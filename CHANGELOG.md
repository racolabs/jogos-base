# Changelog

## 0.11.0

- Casca Windows (user agent com `RacoLabsWindows/`): o link para outro jogo abre a página dele na Microsoft Store (`ms-windows-store://pdp/?ProductId=<id>`), em vez de navegar na janela.
- `GameInfo` ganha `storeId` e há `isWindowsShell(env)` e `storeUrl(url)`.
- Fora da casca nada muda. URL relativa, inválida ou fora do catálogo segue como link normal.

## 0.10.0

- Teste de arquitetura de anúncios (`jogos-base/ads/guard`, `assertNoDirectAdSdk`): reprova um jogo que importe SDK de anúncio ou carregue script de rede de anúncio direto. Só `src/ads` da base pode usar SDK. (#20, #105)
- Banner de tamanho fixo no AdSense: nova opção `bannerSize: { width, height }` no `AdSenseProvider`. Sem a opção, o banner responsivo continua igual. Tamanho inválido cai no responsivo. (#107)
