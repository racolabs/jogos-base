# jogos-base

Código comum dos jogos casuais, publicado como pacote versionado. Cada jogo depende de uma versão fixa e só escreve as próprias regras e o próprio visual.

| Módulo | O que faz |
| --- | --- |
| `ads` | Interface `AdProvider` com implementações trocáveis (AdMob, AdSense/H5, portais, sem anúncio), travas de intersticial e controle do premiado |
| `config` | Configuração remota em JSON servida pelo próprio jogo, com sorteio de grupos para teste A/B |
| `metrics` | Eventos sem cookie (sessão, partida, anúncio, compra) |
| `i18n` | Português e inglês, idioma pela URL (`/pt`, `/en`) |
| `seo` | Páginas pré-renderizadas por variação e idioma, `hreflang`, sitemap, dados estruturados, imagem de compartilhamento ([docs/seo.md](docs/seo.md)) |
| `daily` | Desafio do dia com semente comum, dias seguidos e resultado compartilhável |
| `ui` | Botões, folhas, animações, sons, vibração, modo escuro e letra grande |
| `shell` | Casca Capacitor para Android e iOS |
| `cross-promo` | Espaço que mostra os outros jogos |

Toda dependência de terceiros fica atrás de uma interface nossa, para trocar de fornecedor sem reescrever os jogos.
