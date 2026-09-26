/**
 * A decision surface: a metric over two operating inputs, drawn as cells in a perceptually uniform
 * colour map (viridis; the rubric forbids jet and rainbow), with the zero-slack boundary of each
 * constraint traced as a labelled line and marked points (the baked optimum, the current state).
 * Hover or arrow keys report the cell under the pointer to the view's readout; rejected states are
 * hatched grey. The grid values come from the worker sweep; nothing here computes an engine quantity.
 */
import { useThemeStore } from '@fasl-work/caos-app-shell';
import { useContext, useEffect, useRef, useState } from 'react';
import { OverlayInset } from './inset';

// viridis at ten equal steps (matplotlib; R viridisLite::viridis(10)); linear in between
const VIRIDIS = ['#440154', '#482878', '#3e4a89', '#31688e', '#26828e', '#1f9e89', '#35b779', '#6dcd59', '#b4de2c', '#fde725']
  .map(hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)));

export function viridis(t: number): string {
  const u = Math.min(1, Math.max(0, t)) * (VIRIDIS.length - 1);
  const i = Math.min(VIRIDIS.length - 2, Math.floor(u));
  const f = u - i;
  const c = VIRIDIS[i].map((v, k) => Math.round(v + f * (VIRIDIS[i + 1][k] - v)));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

export interface Contour { field: (number | null)[][]; label: string; colour: string }
export interface Point { x: number; y: number; label: string }
export interface Cell { i: number; j: number; x: number; y: number; z: number | null }

export interface HeatmapProps {
  /** A short visible title. */
  title?: string;
  xs: number[];
  ys: number[];
  /** z[j][i]: row j (y), column i (x); null for a rejected state. */
  z: (number | null)[][];
  xLabel: string;
  yLabel: string;
  zLabel: string;
  summary: string;
  contours?: Contour[];
  points?: Point[];
  format: (value: number | null, axis: 'x' | 'y' | 'z') => string;
  onCell?: (cell: Cell | null) => void;
}

const BASE_MARGIN = { left: 72, right: 16, top: 12, bottom: 44 };

/** Segments of the zero level of a field over the cell centres (marching squares). */
function zeroLevel(field: (number | null)[][]): Array<[[number, number], [number, number]]> {
  const out: Array<[[number, number], [number, number]]> = [];
  for (let j = 0; j + 1 < field.length; j += 1) {
    for (let i = 0; i + 1 < field[j].length; i += 1) {
      const v = [field[j][i], field[j][i + 1], field[j + 1][i + 1], field[j + 1][i]];
      if (v.some(x => x === null)) continue;
      const corners: Array<[number, number]> = [[i, j], [i + 1, j], [i + 1, j + 1], [i, j + 1]];
      const crossings: Array<[number, number]> = [];
      for (let k = 0; k < 4; k += 1) {
        const a = v[k] as number;
        const b = v[(k + 1) % 4] as number;
        if ((a < 0) !== (b < 0)) {
          const t = a / (a - b);
          const [x0, y0] = corners[k];
          const [x1, y1] = corners[(k + 1) % 4];
          crossings.push([x0 + t * (x1 - x0), y0 + t * (y1 - y0)]);
        }
      }
      if (crossings.length === 2) out.push([crossings[0], crossings[1]]);
      if (crossings.length === 4) { out.push([crossings[0], crossings[1]]); out.push([crossings[2], crossings[3]]); }
    }
  }
  return out;
}

export function Heatmap({ title, xs, ys, z, xLabel, yLabel, zLabel, summary, contours = [], points = [], format, onCell }: HeatmapProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [focus, setFocus] = useState<[number, number] | null>(null);
  const theme = useThemeStore(state => state.theme);
  const inset = useContext(OverlayInset);
  const MARGIN = { left: BASE_MARGIN.left + inset[3], right: BASE_MARGIN.right + inset[1], top: BASE_MARGIN.top + inset[0], bottom: BASE_MARGIN.bottom + inset[2] };
  const [size, setSize] = useState({ width: 480, height: 320 });

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const observer = new ResizeObserver(() => setSize({ width: Math.max(240, host.clientWidth), height: Math.max(200, host.clientHeight) }));
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  const values = z.flat().filter((v): v is number => v !== null && Number.isFinite(v));
  const zMin = values.length ? Math.min(...values) : 0;
  const zMax = values.length ? Math.max(...values) : 1;

  useEffect(() => {
    const canvas = canvasRef.current;
    const host = hostRef.current;
    if (!canvas || !host) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size.width * dpr;
    canvas.height = size.height * dpr;
    canvas.style.width = `${size.width}px`;
    canvas.style.height = `${size.height}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const style = getComputedStyle(host);
    const fg = style.getPropertyValue('--color-fg-subtle').trim() || '#9aa6b2';
    const strong = style.getPropertyValue('--color-fg').trim() || '#e6edf3';
    const halo = style.getPropertyValue('--color-surface').trim() || '#161b22';
    const grid = style.getPropertyValue('--color-border').trim() || '#30363d';
    const font = style.fontFamily;
    // a colour given as a shell token (--color-...) follows the theme
    const colourOf = (c: string) => (c.startsWith('--') ? style.getPropertyValue(c).trim() || strong : c);
    // text over the colour map carries a halo, so it reads on any cell
    const label = (text: string, x: number, y: number, colour: string) => {
      ctx.save();
      ctx.lineWidth = 3;
      ctx.strokeStyle = halo;
      ctx.lineJoin = 'round';
      ctx.strokeText(text, x, y);
      ctx.fillStyle = colour;
      ctx.fillText(text, x, y);
      ctx.restore();
    };
    ctx.clearRect(0, 0, size.width, size.height);
    const w = size.width - MARGIN.left - MARGIN.right;
    const h = size.height - MARGIN.top - MARGIN.bottom;
    const cw = w / xs.length;
    const ch = h / ys.length;
    for (let j = 0; j < ys.length; j += 1) {
      for (let i = 0; i < xs.length; i += 1) {
        const v = z[j]?.[i] ?? null;
        const px = MARGIN.left + i * cw;
        const py = MARGIN.top + (ys.length - 1 - j) * ch;
        if (v === null) {
          ctx.fillStyle = grid;
          ctx.fillRect(px, py, cw + 0.5, ch + 0.5);
          ctx.strokeStyle = fg;
          ctx.beginPath(); ctx.moveTo(px, py + ch); ctx.lineTo(px + cw, py); ctx.stroke();
        } else {
          ctx.fillStyle = viridis(zMax > zMin ? (v - zMin) / (zMax - zMin) : 0.5);
          ctx.fillRect(px, py, cw + 0.5, ch + 0.5);
        }
      }
    }
    const toPx = (gi: number, gj: number): [number, number] => [MARGIN.left + (gi + 0.5) * cw, MARGIN.top + (ys.length - 1 - gj + 0.5) * ch];
    for (const contour of contours) {
      ctx.strokeStyle = colourOf(contour.colour);
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 3]);
      const segments = zeroLevel(contour.field);
      for (const [[ai, aj], [bi, bj]] of segments) {
        const [x0, y0] = toPx(ai, aj);
        const [x1, y1] = toPx(bi, bj);
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      }
      ctx.setLineDash([]);
      if (segments.length) {
        const [[li, lj]] = segments[Math.floor(segments.length / 2)];
        const [lx, ly] = toPx(li, lj);
        ctx.font = `600 11px ${font}`;
        label(contour.label, lx + 4, ly - 4, colourOf(contour.colour));
      }
    }
    const index = (values2: number[], v: number) => {
      // fractional grid index of a value (the grid is monotone)
      for (let k = 0; k + 1 < values2.length; k += 1) {
        const a = values2[k]; const b = values2[k + 1];
        if ((v >= a && v <= b) || (v <= a && v >= b)) return k + (v - a) / (b - a);
      }
      return v <= values2[0] ? 0 : values2.length - 1;
    };
    for (const point of points) {
      const [px, py] = toPx(index(xs, point.x), index(ys, point.y));
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(px, py, 5, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
      ctx.font = `600 11px ${font}`;
      label(point.label, px + 8, py + 4, strong);
    }
    if (focus) {
      const [fi, fj] = focus;
      ctx.strokeStyle = strong;
      ctx.lineWidth = 2;
      ctx.strokeRect(MARGIN.left + fi * cw, MARGIN.top + (ys.length - 1 - fj) * ch, cw, ch);
    }
    ctx.fillStyle = fg;
    ctx.font = `11px ${font}`;
    const step = Math.max(1, Math.ceil(xs.length / 8));
    // ticks at the cell centres: x centred below, y right-aligned against the plot
    ctx.textAlign = 'center';
    xs.forEach((x, i) => { if (i % step === 0) ctx.fillText(format(x, 'x'), MARGIN.left + (i + 0.5) * cw, size.height - MARGIN.bottom + 16); });
    const ystep = Math.max(1, Math.ceil(ys.length / 8));
    ctx.textAlign = 'right';
    ys.forEach((y, j) => { if (j % ystep === 0) ctx.fillText(format(y, 'y'), MARGIN.left - 6, MARGIN.top + (ys.length - 1 - j + 0.5) * ch + 4); });
    ctx.font = `600 11px ${font}`;
    ctx.textAlign = 'center';
    ctx.fillText(xLabel, MARGIN.left + w / 2, size.height - 8);
    ctx.save(); ctx.translate(14 + inset[3], MARGIN.top + h / 2); ctx.rotate(-Math.PI / 2); ctx.fillText(yLabel, 0, 0); ctx.restore();
    ctx.textAlign = 'left';
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [xs, ys, z, contours, points, size, theme, focus, zMin, zMax, xLabel, yLabel, format, inset[0], inset[1], inset[2], inset[3]]);

  const cellAt = (i: number, j: number): Cell => ({ i, j, x: xs[i], y: ys[j], z: z[j]?.[i] ?? null });
  const onMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const w = size.width - MARGIN.left - MARGIN.right;
    const h = size.height - MARGIN.top - MARGIN.bottom;
    const i = Math.floor((event.clientX - rect.left - MARGIN.left) / (w / xs.length));
    const jFromTop = Math.floor((event.clientY - rect.top - MARGIN.top) / (h / ys.length));
    const j = ys.length - 1 - jFromTop;
    if (i < 0 || j < 0 || i >= xs.length || j >= ys.length) { setFocus(null); onCell?.(null); return; }
    setFocus([i, j]);
    onCell?.(cellAt(i, j));
  };
  const onKey = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const moves: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    const [fi, fj] = focus ?? [0, 0];
    const next: [number, number] = [Math.max(0, Math.min(xs.length - 1, fi + move[0])), Math.max(0, Math.min(ys.length - 1, fj + move[1]))];
    setFocus(next);
    onCell?.(cellAt(next[0], next[1]));
  };

  return (
    <figure className="of-heatmap" aria-label={summary}>
      {title && <div className="of-plot-head"><span className="of-plot-title">{title}</span></div>}
      <div className="of-heatmap-plot" ref={hostRef} tabIndex={0} onKeyDown={onKey}>
        <canvas ref={canvasRef} aria-hidden="true" onMouseMove={onMove} onMouseLeave={() => { setFocus(null); onCell?.(null); }} />
      </div>
      <div className="of-heatmap-scale" aria-hidden="true">
        <span>{format(zMin, 'z')}</span>
        <span className="of-heatmap-ramp" style={{ background: `linear-gradient(90deg, ${Array.from({ length: 10 }, (_, k) => viridis(k / 9)).join(',')})` }} />
        <span>{format(zMax, 'z')}</span>
        <span className="of-heatmap-zlabel">{zLabel}</span>
      </div>
      <figcaption className="of-sr-only">{summary}</figcaption>
      <table className="of-sr-only">
        <caption>{summary}</caption>
        <thead><tr><th scope="col">{`${yLabel} / ${xLabel}`}</th>{xs.map((x, i) => <th scope="col" key={i}>{format(x, 'x')}</th>)}</tr></thead>
        <tbody>{ys.map((y, j) => <tr key={j}><th scope="row">{format(y, 'y')}</th>{xs.map((_, i) => <td key={i}>{format(z[j]?.[i] ?? null, 'z')}</td>)}</tr>)}</tbody>
      </table>
    </figure>
  );
}
