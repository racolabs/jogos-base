/**
 * Exemplo de consumidor: é assim que um jogo usa o guarda, importando pelo nome público do pacote.
 * No jogo, o arquivo é `test/arquitetura.test.ts` e a raiz é `join(__dirname, '..', 'src')`.
 * Aqui a raiz é a própria `src` da base.
 */
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { assertNoPrizeDraw } from 'jogos-base/compliance';

describe('arquitetura (consumidor de jogos-base/compliance)', () => {
  it('o código não sorteia prêmio pago ou por vídeo', () => {
    // allow: o guarda guarda as frases proibidas nele mesmo. Um jogo não precisa de allow.
    expect(() => assertNoPrizeDraw(join(import.meta.dirname, '..'), { allow: ['compliance/prize-draw.ts'] })).not.toThrow();
  });
});
