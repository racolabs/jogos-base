# Changelog

## 0.10.0

- Casca Windows (user agent com `RacoLabsWindows/`): o link para outro jogo abre a página dele na Microsoft Store (`ms-windows-store://pdp/?ProductId=<id>`), em vez de navegar na janela.
- `GameInfo` ganha `storeId` e há `isWindowsShell(env)` e `storeUrl(url)`.
- Fora da casca nada muda. URL relativa, inválida ou fora do catálogo segue como link normal.
