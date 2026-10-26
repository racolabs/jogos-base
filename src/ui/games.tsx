/**
 * Catálogo dos jogos da RacoLabs e a faixa "Mais jogos" do início: cada jogo mostra os outros.
 * Jogo novo entra aqui uma vez e aparece em todos (depois de atualizar o jogos-base em cada um).
 */
import type { CSSProperties, ReactNode } from 'react';
import { appLinkProps } from './applink.ts';

type Lang = 'pt' | 'en';

export interface GameInfo {
  id: string;
  url: string;
  name: { pt: string; en: string };
}

export const GAMES: readonly GameInfo[] = [
  { id: 'dobra', url: 'https://dobra.racolabs.app', name: { pt: 'Dobra', en: 'Dobra' } },
  { id: 'paciencia', url: 'https://paciencia.racolabs.app', name: { pt: 'Paciência', en: 'Solitaire' } },
  { id: 'sudoku', url: 'https://sudoku.racolabs.app', name: { pt: 'Sudoku', en: 'Sudoku' } },
  { id: 'mahjong', url: 'https://mahjong.racolabs.app', name: { pt: 'Mahjong', en: 'Mahjong' } },
];

/** Miniatura de cada jogo, desenhada aqui (sem imagem de outro site: a CSP só aceita o próprio). As cores são do próprio jogo. */
function Art({ id }: { id: string }): ReactNode {
  const box: CSSProperties = { width: 40, height: 40, borderRadius: 11, flex: '0 0 auto', display: 'grid', placeItems: 'center', overflow: 'hidden' };
  if (id === 'dobra') {
    const t = (bg: string): CSSProperties => ({ width: 14, height: 14, borderRadius: 3, background: bg });
    return (
      <span style={{ ...box, background: '#1B1B3A' }}>
        <span style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 14px)', gap: 3 }}>
          <i style={t('#FFE8B8')} />
          <i style={t('#FFB547')} />
          <i style={t('#FF8A5C')} />
          <i style={t('#C93A83')} />
        </span>
      </span>
    );
  }
  if (id === 'paciencia') {
    return (
      <span style={{ ...box, background: '#1E5A4C' }}>
        <b style={{ width: 20, height: 28, borderRadius: 4, background: '#FBF8F1', color: '#C42F3A', font: '700 12px/1 Georgia, serif', display: 'grid', placeItems: 'center' }}>A♥</b>
      </span>
    );
  }
  if (id === 'mahjong') {
    const tile = (x: number, y: number, ch: string, color: string): ReactNode => (
      <b style={{ position: 'absolute', left: x, top: y, width: 16, height: 21, borderRadius: 3, background: '#FBF7EC', boxShadow: '1.5px 2px 0 #B9A983', color, font: '700 12px/21px serif', textAlign: 'center' }}>{ch}</b>
    );
    return (
      <span style={{ ...box, background: '#165B57', position: 'relative' }}>
        {tile(5, 11, '發', '#13805B')}
        {tile(18, 7, '中', '#C4302B')}
      </span>
    );
  }
  return (
    <span style={{ ...box, background: '#FFFDF7', boxShadow: 'inset 0 0 0 2px #2A2B38' }}>
      <span style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 10px)', gridTemplateRows: 'repeat(3, 10px)', font: '800 9px/10px system-ui', color: '#1C1D2B', textAlign: 'center' }}>
        {['5', '', '3', '', '7', '', '', '', '9'].map((d, k) => (
          <i key={k} style={{ fontStyle: 'normal', color: k === 4 ? '#2F5BEA' : undefined, background: k === 4 ? '#CFE0FF' : undefined, borderRadius: 2 }}>
            {d}
          </i>
        ))}
      </span>
    </span>
  );
}

const TEXT = { pt: { title: 'Mais jogos da RacoLabs' }, en: { title: 'More RacoLabs games' } } as const;

/** Faixa compacta com os outros jogos. Abre fora do app instalado (ver appLinkProps). */
export function MoreGames({ lang, current, onOpen }: { lang: Lang; current: string; onOpen?: (id: string) => void }) {
  const others = GAMES.filter((g) => g.id !== current);
  return (
    <nav className="rl-more" aria-label={TEXT[lang].title}>
      <span className="rl-more__title">{TEXT[lang].title}</span>
      <span className="rl-more__list">
        {others.map((g) => (
          <a key={g.id} className="rl-more__game" {...appLinkProps(`${g.url}/${lang}/`, { onOpen: () => onOpen?.(g.id) })}>
            <span aria-hidden="true" style={{ display: 'contents' }}>
              <Art id={g.id} />
            </span>
            <span className="rl-more__name">{g.name[lang]}</span>
          </a>
        ))}
      </span>
    </nav>
  );
}
