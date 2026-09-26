/**
 * Shared pieces of the content pages' schematic figures: an arrowhead marker, a titled box with sub
 * lines, and a language pick. Colours and type come from the shell's diagram classes, so every figure
 * follows the theme; boxes are sized by their authors, and the browser gate fails any figure text that
 * crosses the box holding it or leaves its figure.
 */
import type { Lang } from '../lib/format';

export const pick = (lang: Lang, en: string, es: string) => (lang === 'es' ? es : en);

export function Arrow({ id }: { id: string }) {
  return (
    <defs>
      <marker id={id} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M0,0 L10,5 L0,10 z" className="dg-arrowhead" />
      </marker>
    </defs>
  );
}

/** One box with a title and sub lines; `lines` start 16 px under the title, `step` px apart. */
export function Box({ x, y, w, h, title, lines = [], kind, step = 14 }: { x: number; y: number; w: number; h: number; title: string; lines?: string[]; kind?: 'accent' | 'good' | 'optional'; step?: number }) {
  const cls = kind === 'accent' ? 'dg-box accent' : kind === 'good' ? 'dg-box good' : kind === 'optional' ? 'dg-box of-dg-optional' : 'dg-box';
  return (
    <g>
      <rect className={cls} x={x} y={y} width={w} height={h} rx="7" />
      <text className="dg-box-title" x={x + 12} y={y + 20}>{title}</text>
      {lines.map((line, i) => <text key={i} className="dg-box-sub" x={x + 12} y={y + 36 + step * i}>{line}</text>)}
    </g>
  );
}

