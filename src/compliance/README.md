# compliance

Teste de arquitetura contra sorteio de prêmio pago ou por vídeo (caixa de recompensa, roleta, gacha). O prêmio é sempre fixo e dito antes.

Como o jogo usa (`test/arquitetura.test.ts`), importando pelo nome público do pacote:

```ts
import { join } from 'node:path';
import { assertNoPrizeDraw } from 'jogos-base/compliance';

it('o jogo não sorteia prêmio pago ou por vídeo', () => {
  expect(() => assertNoPrizeDraw(join(__dirname, '..', 'src'))).not.toThrow();
});
```

Usa `node:fs`: importe só em teste, nunca no código que vai para o navegador. `src/compliance/consumer.test.ts` é um consumidor de exemplo.

## O que reprova

- **Texto de tela** (aspas, crases, texto de JSX) com frase de sorteio de prêmio, em português ou inglês: "gire a roleta", "spin the wheel", "prêmio surpresa", "recompensa aleatória", "random reward", "mystery box", "caixa misteriosa", "loot box"... Nome de variável ou função não conta (`openReward`, `RewardSpinner`).
- **Vídeo premiado perto de sorteio**: `showRewarded(`, `watchRewarded(`... a até 30 linhas, no mesmo arquivo, de `Math.random`, `rng(`, `seededRandom`, `dailyRandom`, `shuffle(`, `crypto.getRandomValues`, `weightedPick`...
- **Compra perto de sorteio**: `purchase(`, `requestPurchase(`, `PaymentRequest`, SDKs de compra, com os mesmos sorteios. A base ainda não tem API de compra; são nomes exatos (`buyTime()` não conta).
- Chamada dentro de `${...}` de template literal conta como código.

## Limitações

Heurística por proximidade de linhas, sem seguir o fluxo de dados: sorteio ligado ao vídeo por outro arquivo, ou com nome fora das listas, passa. A revisão do PR (checklist do template) continua sendo a defesa principal. Só lê código (não JSON nem texto de loja); testes ficam de fora.

## Falso positivo legítimo (ex.: Paciência)

Reembaralhar o estoque depois de um vídeo ("embaralhar de novo") usa `rng(` perto de `watchRewarded(`, e o guarda acusa. O prêmio é fixo (a ação, não o resultado, é o que o vídeo libera), então é legítimo. Duas saídas, na ordem de preferência:

1. Mover o embaralhamento para uma função fora do `App.tsx` (por exemplo `reshuffleStock(game, rng)` em `game.ts`), longe do vídeo.
2. `assertNoPrizeDraw(raiz, { allow: ['src/App.tsx'] })`, com a justificativa no PR. Isso desliga o guarda para o arquivo inteiro; use só se a saída 1 não couber.
