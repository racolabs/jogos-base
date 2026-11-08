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

Os links para "Como jogar" e "Estratégias" só existem no HTML pré-renderizado, que some quando o jogo carrega. `HelpMore` (`jogos-base/ui`) os traz para o menu/configurações, com a privacidade (opcional) e os outros jogos:

```tsx
import { articles } from "../scripts/seo-conteudo.mjs"; // o mesmo objeto que o prerender usa
<HelpMore lang={lang} game={{ id: "sudoku", articles }} onOpen={(kind) => metrics.track("setting", { key: "help", value: kind })} />
```

- **Fonte única**: caminhos de `articles[].paths`; nada de slug à mão. Rótulo: `text.label` do artigo (opcional, cai no título).
- **Nova aba, sempre** (`target="_blank" rel="noopener"`): a página de conteúdo é um documento fora do app; na mesma aba a partida em andamento seria descartada.
- **Sem variações**: cada uma (/pt/dificil/...) é a própria SPA; noutra aba, duas abas gravariam o mesmo perfil e a última sobrescreveria stats e partida salva. Use o seletor de modo do jogo.
- **Offline**: com `navigator.onLine === false` os links das páginas aparecem desabilitados com "precisa de internet" (elas não estão no cache do service worker).
- **Portal**: `externalLinks` bloqueado (CrazyGames) esconde tudo; `crossPromo` bloqueado esconde só "Outros jogos" (`otherGames={false}` também esconde).
- **Sem dado novo**: só `<a href>` do mesmo site (CSP e anúncios intactos); `onOpen` é opcional e fica com o jogo.
- O cartão (`.rl-help`) já vem estilizado; não precisa de classe nem CSS no jogo. `privacy={PRIVACY_PATHS}` inclui a privacidade; omita se o menu já tem o seu link.
