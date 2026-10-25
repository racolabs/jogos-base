import { describe, expect, it } from 'vitest';
import { anonymousPlayerId, BrowserStore, createBox, MemoryStore } from './index.ts';

type Stats = { best: number; games: number; bestTile: number };
const defaults = (): Stats => ({ best: 0, games: 0, bestTile: 0 });

describe('createBox', () => {
  it('salva e lê de volta', () => {
    const store = new MemoryStore();
    const box = createBox(store, 'x', { version: 1, defaults });
    box.save({ best: 900, games: 3, bestTile: 128 });
    expect(box.load()).toEqual({ best: 900, games: 3, bestTile: 128 });
  });

  it('JSON quebrado ou formato estranho volta aos padrões', () => {
    const store = new MemoryStore();
    const box = createBox(store, 'x', { version: 1, defaults });
    store.set('x', '{quebrado');
    expect(box.load()).toEqual(defaults());
    store.set('x', JSON.stringify([1, 2, 3]));
    expect(box.load()).toEqual(defaults());
  });

  it('campo novo ganha o valor padrão', () => {
    const store = new MemoryStore();
    store.set('x', JSON.stringify({ v: 1, data: { best: 50 } }));
    expect(createBox(store, 'x', { version: 1, defaults }).load()).toEqual({ best: 50, games: 0, bestTile: 0 });
  });

  it('versão antiga passa pela migração', () => {
    const store = new MemoryStore();
    store.set('x', JSON.stringify({ v: 1, data: { record: 777 } }));
    const box = createBox(store, 'x', {
      version: 2,
      defaults,
      migrate: (data, from) => (from === 1 ? { ...defaults(), best: (data as { record: number }).record } : null),
    });
    expect(box.load().best).toBe(777);
  });

  it('versão mais nova que o código não é lida (volta aos padrões)', () => {
    const store = new MemoryStore();
    store.set('x', JSON.stringify({ v: 9, data: { best: 1 } }));
    expect(createBox(store, 'x', { version: 1, defaults }).load()).toEqual(defaults());
  });

  it('lê o formato antigo do Dobra (dobra:v1) sem perder o recorde', () => {
    const store = new MemoryStore();
    store.set('dobra:v1', JSON.stringify({ game: null, stats: { best: 4096, games: 31, bestTile: 512 }, undosLeft: 2 }));
    const box = createBox(store, 'dobra:stats', {
      version: 1,
      defaults,
      legacy: { key: 'dobra:v1', read: (raw) => ((raw as { stats?: Stats }).stats ? { ...defaults(), ...(raw as { stats: Stats }).stats } : null) },
    });
    expect(box.load()).toEqual({ best: 4096, games: 31, bestTile: 512 });
    expect(store.get('dobra:v1')).not.toBeNull();
  });

  it('a chave nova tem prioridade sobre o formato antigo', () => {
    const store = new MemoryStore();
    store.set('dobra:v1', JSON.stringify({ stats: { best: 10, games: 1, bestTile: 8 } }));
    const box = createBox(store, 'dobra:stats', { version: 1, defaults, legacy: { key: 'dobra:v1', read: () => defaults() } });
    box.save({ best: 20, games: 2, bestTile: 16 });
    expect(box.load().best).toBe(20);
  });
});

describe('BrowserStore', () => {
  it('armazenamento bloqueado não quebra o jogo', () => {
    const blocked = {
      getItem: () => {
        throw new Error('SecurityError');
      },
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
      removeItem: () => {
        throw new Error('SecurityError');
      },
    };
    const store = new BrowserStore(blocked);
    expect(store.get('x')).toBeNull();
    expect(() => store.set('x', '1')).not.toThrow();
    expect(() => store.remove('x')).not.toThrow();
    const box = createBox(store, 'x', { version: 1, defaults });
    expect(() => box.save({ best: 1, games: 1, bestTile: 2 })).not.toThrow();
    expect(box.load()).toEqual(defaults());
  });

  it('sem localStorage (ambiente sem navegador) também funciona', () => {
    const store = new BrowserStore(undefined);
    expect(store.get('x')).toBeNull();
    expect(() => store.set('x', '1')).not.toThrow();
  });
});

describe('anonymousPlayerId', () => {
  it('é criado uma vez e reaproveitado', () => {
    const store = new MemoryStore();
    const id = anonymousPlayerId(store);
    expect(id).toMatch(/^[a-z0-9-]{16,64}$/);
    expect(anonymousPlayerId(store)).toBe(id);
  });

  it('valor estranho salvo é trocado por um id novo', () => {
    const store = new MemoryStore();
    store.set('jogos:pid', 'rafael@exemplo.com');
    const id = anonymousPlayerId(store);
    expect(id).not.toBe('rafael@exemplo.com');
    expect(id).toMatch(/^[a-z0-9-]{16,64}$/);
  });
});
