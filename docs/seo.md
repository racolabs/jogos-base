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

## Configuração por jogo

Todas opcionais; sem elas o resultado é o da 0.12.0. Os jogos RacoLabs (público principal brasileiro) devem passar `defaultLocale: 'pt'` e `langTags`:

```ts
export const game: SeoGame = {
  // ...origem, nomes, descrições, ajuda, gênero...
  defaultLocale: 'pt',                        // x-default aponta para /pt/ (padrão: 'en')
  langTags: { pt: 'pt-BR', en: 'en-US' },     // <html lang>, hreflang e og:locale (pt_BR, en_US); a URL segue /pt/ e /en/
  heading: { pt: 'Paciência online grátis', en: 'Free online Solitaire' }, // <h1> da página inicial (padrão: o nome)
  intro: { pt: 'Parágrafo de introdução...', en: 'Intro paragraph...' },  // depois da descrição, só na página inicial
  links: {                                    // em todas as páginas do idioma; exigido para o AdSense (privacidade)
    pt: [{ text: 'Política de Privacidade', href: '/pt/privacidade/' }],
    en: [{ text: 'Privacy Policy', href: '/en/privacy/' }],
  },
  priceCurrency: 'BRL',                       // opcional; padrão BRL (pt) e USD (en)
  gamePlatform: ['Web browser', 'Android'],   // opcional
  extraPages: [{ paths: { pt: '/pt/privacidade/', en: '/en/privacy/' } }], // só entram no sitemap
};
```

| Opção | Efeito |
| --- | --- |
| `defaultLocale` | Idioma do `hreflang="x-default"`, na `<head>` e no sitemap. `'pt'` ou `'en'` (padrão `'en'`). |
| `langTags` | Tag BCP 47 por idioma. Vale em `<html lang>`, `hreflang` e `og:locale` (`pt-BR` vira `pt_BR`; tag sem região usa o padrão do idioma). Sem ela: `pt`/`en`. Tag inválida é recusada. |
| `heading` | Texto do `<h1>` pré-renderizado da página inicial. As variações usam o próprio título. Não muda `<title>`, JSON-LD nem Open Graph. Padrão: `name`. |
| `intro` | Parágrafo depois da descrição, escapado. Vale na página inicial; a variação pode ter `intro` própria (`variants[].intro`). |
| `links` | Lista `{ text, href }` por idioma, num `<nav data-seo="links">` no fim do conteúdo de **todas** as páginas do idioma. `href` começa com `/` (não `//` nem `/\`) ou é https completo; texto e `href` são escapados. |
| `priceCurrency` | Moeda (ISO 4217) de `offers.priceCurrency`: texto único (`'BRL'`) ou por idioma (`{ pt: 'BRL', en: 'USD' }`). Padrão: BRL no pt e USD no en (o preço é sempre 0; a 0.12.0 usava USD nos dois). |
| `genre` | Texto ou lista (`['Puzzle', 'Card game']`) nos dados estruturados. |
| `gamePlatform` | Texto ou lista (`['Web browser', 'Android']`) em `gamePlatform` no JSON-LD. Sem ela, o campo não sai. |
| `extraPages` | Páginas que o jogo gera por fora (ex.: `/pt/privacidade/`). O módulo **não** escreve o HTML delas: só as põe no `sitemap.xml`, com `hreflang` das tags e `x-default` do `defaultLocale`. Cada caminho: `/<idioma>/<nome>/`, minúsculas, barra no fim, sem repetir página existente. Quem usa `sitemapXml` direto soma `extraEntriesFor(game)` a `pagesFor(game)`; o `prerender` já faz isso. |

## Conteúdo, links cruzados e IA (0.14.0)

Também opcionais:

| Opção | Efeito |
| --- | --- |
| `articles` | Páginas de conteúdo (regras, estratégias, perguntas), uma por idioma: `{ paths: { pt: '/pt/como-jogar/', en: '/en/how-to-play/' }, text: { pt: { title, label, description, intro, sections: [{ heading, paragraphs, list, ordered }], faq: [{ q, a }] }, en: ... } }`. O módulo escreve o HTML inteiro, **sem o jogo e sem JavaScript**: head completo, trilha visível, botão "Jogar", seções, perguntas visíveis, links para as outras páginas, as variações e os outros jogos. Dados estruturados: `Article`, `BreadcrumbList` e `FAQPage` (só com `faq`). Entram no sitemap e no `llms.txt`, e as páginas do jogo ganham a lista "Guias". O caminho pode mudar por idioma; não pode repetir outra página. |
| `otherGames` | Outros jogos (`{ id, url: { pt, en }, name, blurb }`), linkados em todas as páginas ("Outros jogos"). O próprio `id` sai da lista. Os jogos RacoLabs passam `RACOLABS_GAMES` (de `jogos-base/seo/node`). |
| `otherGamesTitle` | Título dessa lista. Padrão: "Outros jogos" / "More games". |
| `studio` | Primeiro degrau do `BreadcrumbList` (`RACOLABS_STUDIO`: RacoLabs, `https://racolabs.app/` e `/en/`). Com ele, toda página ganha trilha estúdio › jogo › página. |
| `articleTheme` | Cores das páginas de conteúdo (`accent`, `accentDark`, opcionais `onAccent`, `onAccentDark`) e `icon`. Padrão: a casca comum. |
| `variants[].slug` | Pode ter subpastas: `diario/2026-11-08` vira `/pt/diario/2026-11-08/`. |
| `variants[].html` | HTML extra depois da ajuda, por idioma (ex.: a grade do Sudoku do dia). **Não é escapado**: só texto gerado pelo jogo no build; `<script>` é recusado. |
| `variants[].llms` | `false` tira a variação do `llms.txt` e dos links das páginas de conteúdo (ex.: cada dia do arquivo). Continua no sitemap. |

Toda página do jogo leva `BreadcrumbList` num segundo `<script type="application/ld+json">`, depois do `VideoGame` (sem `studio` e na página inicial, não há trilha: um degrau só não vale).

### Service worker

O `navigateFallback` do Workbox (padrão do `vite-plugin-pwa`) troca **qualquer** navegação pelo `index.html` do jogo, o que esconde as páginas de conteúdo e a privacidade de quem já tem o jogo instalado. Passe a lista do módulo:

```ts
import { navigateFallbackDenylist } from 'jogos-base/seo/node';
import { game } from './scripts/seo.config.mjs';
VitePWA({ workbox: { navigateFallbackDenylist: navigateFallbackDenylist(game) } });
```

### Desafio do dia no build

`jogos-base/daily/node` é o mesmo `jogos-base/daily` compilado em JS, para o script de prerender gerar no Node o mesmo desafio que o navegador gera (`dailyRandom(jogo, dia)`).

## O que sai

| Arquivo | Conteúdo |
| --- | --- |
| `/<lang>/index.html`, `/<lang>/<slug>/index.html` | `index.html` do build com `<html lang>`, head completo e `<h1>`, descrição, introdução, "Como jogar" e links dentro de `#root` |
| `sitemap.xml` | Todas as páginas, cada uma com `xhtml:link` para pt, en e `x-default` (inglês, ou o `defaultLocale`); mais as `extraPages` |
| `/<lang>/<artigo>/index.html` | Páginas de conteúdo (`articles`), HTML puro |
| `robots.txt` | Libera tudo, nomeia os robôs de busca e de IA (Googlebot, Bingbot, GPTBot, OAI-SearchBot, ChatGPT-User, PerplexityBot, ClaudeBot, Claude-SearchBot, Google-Extended, Applebot-Extended) e aponta para o sitemap |
| `llms.txt` | Resumo em Markdown (llmstxt.org): o jogo nos dois idiomas, páginas de conteúdo, variações, outros jogos e links fixos |
| `/og/<lang>[-<slug>].svg` | Imagem 1200x630 por página, só se o jogo não informar `shareImage` (com aviso) |

## Imagem de compartilhamento

Cada jogo precisa de um **PNG (ou JPG) 1200x630** e deve informá-lo em `shareImage`: caminho com `/` no início (`'/og.png'`, o arquivo vai em `public/`) ou endereço https completo. Outro formato de caminho é recusado.

O Google lê SVG, mas WhatsApp, Facebook e X ignoram. Por isso o build **avisa** (`seo: aviso: ...` no console e em `warnings` do resultado) quando `shareImage` falta ou é `.svg`. Sem `shareImage`, o build gera um SVG 1200x630 por página, que serve de base para exportar o PNG.

## Dados estruturados

`@type: ["VideoGame", "WebApplication"]` com `applicationCategory: "Game"`, `operatingSystem`, `genre`, `gamePlatform` (se informado), `inLanguage` (a tag de `langTags`, ex.: `pt-BR`; sem ela, `pt`/`en`) e `offers` (preço 0, moeda de `priceCurrency`). Não há `aggregateRating` nem `review` e não deve haver: nota inventada é proibida. Os dados ficam válidos, mas sem avaliação real o jogo pode não ganhar resultado rico no Google.

## `theme-color`

O que o modelo do jogo já tem (inclusive as variantes `media` de claro e escuro) é mantido. Se o jogo informar `themeColor`, só o `theme-color` sem `media` é substituído.

## `seo/node` é JavaScript compilado

O Node 22 não executa `.ts` dentro de `node_modules`, e os jogos rodam `node scripts/prerender.mjs` sem `tsx`. Por isso `jogos-base/seo/node` aponta para `lib/` (JS + `.d.ts`), gerado por `pnpm build` (`tsconfig.node.json`) e **versionado**. Mexeu em `src/seo/*`? Rode `pnpm build` e commite `lib/`; um teste falha se `lib/` estiver desatualizado.

## Conferir

- `validateGame(game)` recusa origem sem https, slug repetido ou inválido e texto vazio em pt/en (o `prerender` já chama).
- `validateVideoGameJsonLd(ld)` confere o JSON-LD; os testes rodam isso em todas as páginas.
- `pnpm build` neste repo gera um exemplo em `dist/seo-exemplo` para inspeção.
