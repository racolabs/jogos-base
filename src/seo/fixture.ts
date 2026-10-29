import type { SeoGame } from './types.ts';

/** Jogo de exemplo para testes e para o build de demonstração. Nada aqui é de um jogo real. */
export const EXAMPLE_GAME: SeoGame = {
  origin: 'https://exemplo.racolabs.app',
  id: 'exemplo',
  name: { pt: 'Exemplo', en: 'Example' },
  title: { pt: 'Exemplo: jogo de lógica grátis', en: 'Example: free logic game' },
  description: {
    pt: 'Jogo de lógica para jogar de graça no celular, sem cadastro. Rápido de aprender, difícil de largar.',
    en: 'A free logic game for your phone, no sign-up. Quick to learn, hard to put down.',
  },
  help: {
    pt: ['Toque numa peça para escolher.', 'Ligue peças iguais.', 'Limpe o tabuleiro para vencer.'],
    en: ['Tap a piece to pick it.', 'Match equal pieces.', 'Clear the board to win.'],
  },
  genre: 'Puzzle',
  themeColor: '#1B1B3A',
  publisher: { name: 'RacoLabs', url: 'https://racolabs.app' },
  variants: [
    {
      slug: 'dificil',
      title: { pt: 'Exemplo difícil', en: 'Hard Example' },
      description: { pt: 'A versão difícil do Exemplo: menos dicas e tabuleiro maior.', en: 'The hard Example: fewer hints and a bigger board.' },
      help: { pt: ['Sem dicas: confie na lógica.'], en: ['No hints: trust your logic.'] },
    },
    {
      slug: 'diario',
      title: { pt: 'Exemplo do dia', en: 'Daily Example' },
      description: { pt: 'Um desafio novo por dia, igual para todo mundo.', en: 'One new challenge a day, the same for everyone.' },
    },
  ],
};

/** index.html típico de um build Vite: título e descrição genéricos, raiz vazia, bundle por caminho absoluto. */
export const EXAMPLE_TEMPLATE = `<!doctype html>
<html lang="pt-BR" class="no-js">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>App</title>
    <meta name="description" content="velha">
    <link rel="canonical" href="https://velho.example/">
    <link rel="icon" href="/favicon.svg">
    <link rel="alternate" hreflang="fr" href="https://velho.example/fr/">
    <meta property="og:title" content="velho">
    <script type="module" crossorigin src="/assets/index-abc.js"></script>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
`;
