# jogos-base

Código comum dos jogos casuais, publicado como pacote versionado. Cada jogo depende de uma versão fixa e só escreve as próprias regras e o próprio visual.

| Módulo | O que faz |
| --- | --- |
| `ads` | Interface `AdProvider` com implementações trocáveis (AdMob, AdSense/H5, portais, sem anúncio), travas de intersticial e controle do premiado; `jogos-base/ads/guard` (`assertNoDirectAdSdk`) falha o teste do jogo que importar SDK de anúncio direto |
| `config` | Configuração remota em JSON servida pelo próprio jogo, com sorteio de grupos para teste A/B |
| `metrics` | Eventos sem cookie (sessão, partida, anúncio, compra) |
| `i18n` | Português e inglês, idioma pela URL (`/pt`, `/en`) |
| `seo` | Páginas pré-renderizadas por variação e idioma, `hreflang`, sitemap, dados estruturados, imagem de compartilhamento ([docs/seo.md](docs/seo.md)) |
| `daily` | Desafio do dia com semente comum, dias seguidos e resultado compartilhável |
| `ui` | Botões, folhas, animações, sons, vibração, modo escuro e letra grande; `HelpMore` ([Ajuda e mais](#ajuda-e-mais-helpmore)) |
| `shell` | Casca Capacitor para Android e iOS |
| `cross-promo` | Espaço que mostra os outros jogos |

Toda dependência de terceiros fica atrás de uma interface nossa, para trocar de fornecedor sem reescrever os jogos.

## Ajuda e mais (`HelpMore`)

Os links para "Como jogar", "Estratégias", variações e outros jogos só existem no HTML pré-renderizado, que some quando o jogo carrega. `HelpMore` (`jogos-base/ui`) os traz para o menu/configurações:

```tsx
import { articles } from "../scripts/seo-conteudo.mjs"; // os mesmos objetos que o prerender usa
import { variants } from "../scripts/seo-variantes.mjs";
<HelpMore lang={lang} game={{ id: "sudoku", articles, variants }} onOpen={(kind, alvo) => metrics.track("setting", { key: "help", value: kind })} />
```

- **Fonte única**: caminhos de `articles[].paths` e `variants[].slug`; nada de slug à mão. Rótulo: `text.label` do artigo e `SeoVariant.label` (ambos opcionais, caem no título).
- **Nova aba, sempre** (`target="_blank" rel="noopener"`): a página de conteúdo é um documento fora do app; na mesma aba a partida em andamento seria descartada.
- **Portal**: `externalLinks` bloqueado (CrazyGames) esconde tudo; `crossPromo` bloqueado esconde só "Outros jogos" (`otherGames={false}` também esconde).
- **Sem dado novo**: só `<a href>` do mesmo site (CSP e anúncios intactos); `onOpen` é opcional e fica com o jogo.
- `privacy={PRIVACY_PATHS}` inclui a privacidade; omita se o menu já tem o seu link.
