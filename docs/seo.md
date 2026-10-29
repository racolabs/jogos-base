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
  extraPages: [{ paths: { pt: '/pt/privacidade/', en: '/en/privacy/' } }], // só entram no sitemap
};
```

| Opção | Efeito |
| --- | --- |
| `defaultLocale` | Idioma do `hreflang="x-default"`, na `<head>` e no sitemap. `'pt'` ou `'en'` (padrão `'en'`). |
| `langTags` | Tag BCP 47 por idioma. Vale em `<html lang>`, `hreflang` e `og:locale` (`pt-BR` vira `pt_BR`; tag sem região usa o padrão do idioma). Sem ela: `pt`/`en`. Tag inválida é recusada. |
| `heading` | Texto do `<h1>` pré-renderizado da página inicial. As variações usam o próprio título. Não muda `<title>`, JSON-LD nem Open Graph. Padrão: `name`. |
| `intro` | Parágrafo depois da descrição, escapado. Vale na página inicial; a variação pode ter `intro` própria (`variants[].intro`). |
| `links` | Lista `{ text, href }` por idioma, num `<nav data-seo="links">` no fim do conteúdo de **todas** as páginas do idioma. `href` começa com `/` (não `//`) ou é https completo; texto e `href` são escapados. |
| `extraPages` | Páginas que o jogo gera por fora (ex.: `/pt/privacidade/`). O módulo **não** escreve o HTML delas: só as põe no `sitemap.xml`, com `hreflang` das tags e `x-default` do `defaultLocale`. Cada caminho: `/<idioma>/<nome>/`, minúsculas, barra no fim, sem repetir página existente. Quem usa `sitemapXml` direto soma `extraEntriesFor(game)` a `pagesFor(game)`; o `prerender` já faz isso. |

## O que sai

| Arquivo | Conteúdo |
| --- | --- |
| `/<lang>/index.html`, `/<lang>/<slug>/index.html` | `index.html` do build com `<html lang>`, head completo e `<h1>`, descrição, introdução, "Como jogar" e links dentro de `#root` |
| `sitemap.xml` | Todas as páginas, cada uma com `xhtml:link` para pt, en e `x-default` (inglês, ou o `defaultLocale`); mais as `extraPages` |
| `robots.txt` | Libera tudo e aponta para o sitemap |
| `/og/<lang>[-<slug>].svg` | Imagem 1200x630 por página, só se o jogo não informar `shareImage` (com aviso) |

## Imagem de compartilhamento

Cada jogo precisa de um **PNG (ou JPG) 1200x630** e deve informá-lo em `shareImage`: caminho com `/` no início (`'/og.png'`, o arquivo vai em `public/`) ou endereço https completo. Outro formato de caminho é recusado.

O Google lê SVG, mas WhatsApp, Facebook e X ignoram. Por isso o build **avisa** (`seo: aviso: ...` no console e em `warnings` do resultado) quando `shareImage` falta ou é `.svg`. Sem `shareImage`, o build gera um SVG 1200x630 por página, que serve de base para exportar o PNG.

## Dados estruturados

`@type: ["VideoGame", "WebApplication"]` com `applicationCategory: "Game"`, `operatingSystem`, `genre` e `offers` (preço 0). Não há `aggregateRating` nem `review` e não deve haver: nota inventada é proibida. Os dados ficam válidos, mas sem avaliação real o jogo pode não ganhar resultado rico no Google.

## `theme-color`

O que o modelo do jogo já tem (inclusive as variantes `media` de claro e escuro) é mantido. Se o jogo informar `themeColor`, só o `theme-color` sem `media` é substituído.

## `seo/node` é JavaScript compilado

O Node 22 não executa `.ts` dentro de `node_modules`, e os jogos rodam `node scripts/prerender.mjs` sem `tsx`. Por isso `jogos-base/seo/node` aponta para `lib/` (JS + `.d.ts`), gerado por `pnpm build` (`tsconfig.node.json`) e **versionado**. Mexeu em `src/seo/*`? Rode `pnpm build` e commite `lib/`; um teste falha se `lib/` estiver desatualizado.

## Conferir

- `validateGame(game)` recusa origem sem https, slug repetido ou inválido e texto vazio em pt/en (o `prerender` já chama).
- `validateVideoGameJsonLd(ld)` confere o JSON-LD; os testes rodam isso em todas as páginas.
- `pnpm build` neste repo gera um exemplo em `dist/seo-exemplo` para inspeção.
