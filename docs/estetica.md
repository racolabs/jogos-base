# Direção estética: Mesa Viva

> Proposta v1, **aguardando aprovação do Rafael**. Nada de tela de produção sai antes disso.
> Canvas: https://claude.ai/artifact/WXzWD1e3qjQJzizdJ8CcBs
> Protótipos: [Dobra](https://claude.ai/artifact/DpZU8LTyohQHMhqDCQN3Fh) · [Paciência](https://claude.ai/artifact/CAK4kpqPTEBG54m23xu8hG)

Cada jogo é um objeto de mesa que dá vontade de tocar: peças com peso, cartas que estalam, botões que afundam.
A casca (cabeçalho, folhas, configurações, desafio do dia) é igual em todos os jogos. A personalidade fica na
superfície de jogo, na letra de destaque e no som.

## Princípios

1. **Tátil**: tudo que se toca tem borda de baixo e afunda 2 px. Sombra macia em camadas, sem contorno preto.
2. **Calmo por fora**: telas quietas e poucas cores. A festa acontece só na jogada.
3. **Legível primeiro**: corpo de 17 px, nada abaixo de 14 px, AA nos dois temas, letra grande a 1 toque.
4. **Um toque**: do ícone à partida em 1 toque. Ação principal sempre num botão grande na metade de baixo.
5. **Dourado é presente**: o dourado só aparece em recompensa (vídeo premiado, bônus, dias seguidos) e sempre diz o que se ganha.

## Cores

Tema segue o aparelho, com troca manual (Automático, Claro, Escuro). Escuro é azul-noite, nunca preto puro.

| Token comum | Claro | Escuro |
| --- | --- | --- |
| Chão | `#F4F5F9` | `#12131D` |
| Superfície | `#FFFFFF` | `#1C1E2C` |
| Tinta | `#1C1D2B` | `#EDEEF5` |
| Apoio | `#5E6075` | `#A3A6BC` |
| Linha | `#D9DBE6` | `#34364A` |
| Ouro (prêmio) | `#F2B33D` | `#F2B33D` |
| Foco | `#2F6BFF` | `#7EA2FF` |

| Dobra | Claro | Escuro |
| --- | --- | --- |
| Chão | `#ECEEF6` | `#121320` |
| Tabuleiro | `#D5D9EA` | `#242639` |
| Casa vazia | `#E6E9F4` | `#2E3148` |
| Tangerina | `#FF6A3D` | `#FF8458` |

Peças (iguais nos dois temas): `#FFF6E6` `#FFE8B8` `#FFD84D` `#FFB547` `#FF8A5C` `#E8434F` `#C93A83` `#8F4AD8`
`#4D5EE8` `#2FB5FF` `#3DD6A3` (com brilho) `#1B1B3A` (2048+, número dourado).

| Paciência | Claro | Escuro |
| --- | --- | --- |
| Feltro | `#1E5A4C` | `#0F2F28` |
| Carta | `#FBF8F1` | `#ECE7DA` |
| Copas e ouros | `#C42F3A` | `#B52A35` |
| Espadas e paus | `#1C1D2B` | `#1C1D2B` |
| Seleção | `#7FD1FF` | `#7FD1FF` |
| Verso | `#2B3A8C` | `#24306F` |

## Tipografia

- **Figtree** (casca de todos os jogos, placar com algarismos de mesma largura).
- **Fredoka** (destaque do Dobra: logo, peças, celebração).
- **Fraunces** (destaque da Paciência: logo, índice das cartas, vitória).
- Todas OFL e servidas pelo próprio site (sem Google Fonts em produção).

| Papel | Normal | Letra grande (×1,3) |
| --- | --- | --- |
| Título de tela | 34 | 44 |
| Título de folha | 26 | 34 |
| Botão | 19 | 24 |
| Corpo | 17 | 22 |
| Rótulo | 15 | 19 |
| Legenda (mínimo) | 14 | 18 |

## Movimento

- Toque responde em menos de 100 ms. Nada que trava a próxima jogada passa de 300 ms. Celebração some com um toque.
- Curvas: saída `cubic-bezier(.22, 1, .36, 1)`, mola `cubic-bezier(.34, 1.56, .64, 1)`, vai e volta `cubic-bezier(.65, 0, .35, 1)`.
- Durações: toque 90, deslize 120, nascer 180, junção 220, carta voando 220, folha 300, número rolando 400, celebração 600 a 1.200 ms.
- Com "reduzir movimento" (do aparelho ou do jogo), tudo vira esmaecer curto e não há confete nem cascata.
- **Nada treme**: nem tabuleiro nem tela, nem na jogada que não vale nem no fim de jogo (decisão do Rafael no teste v1).
- Junção do Dobra: só o "pop" da peça. A partir de 128, um brilho suave que se abre em volta dela (sem faíscas).
- Aviso de prêmio durante a partida aparece no topo, compacto, por 1,8 s, e nunca cobre a área de jogo.
- Dica fica marcada (anel dourado) até a próxima jogada.

## Som (v2, depois do teste)

Sintetizado no jogo (Web Audio), sem arquivo para baixar. Só senoide, volume baixo, registro médio. Chave própria.
Nada toca no deslize nem na jogada que não vale.

| Momento | Som |
| --- | --- |
| Toque de botão | toque quase mudo, 880 Hz, 50 ms |
| Junção (Dobra) | nota suave a partir de 392 Hz que sobe a pentatônica com a peça |
| Fim de jogo (Dobra) | duas notas que descem |
| Pegar e pousar carta | estalo de papel e toque no feltro (a revisar no mesmo tom do Dobra) |
| Carta na pilha final | sino que sobe com o valor da carta |
| Prêmio entregue (todos) | dim-dom suave |
| Vitória e recorde | arpejo curto e baixo |

## Vibração (v2)

Só no prêmio entregue (16 · 40 · 24 ms). Nunca durante a jogada. Só Android no site; no app, motor tátil do sistema.
