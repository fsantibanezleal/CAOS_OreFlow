/**
 * A decision surface: a metric over two operating inputs, drawn as cells in a perceptually uniform
 * colour map (viridis; the rubric forbids jet and rainbow), with the zero-slack boundary of each
 * constraint traced as a labelled line and marked points (the baked optimum, the current state).
 * Hover or arrow keys report the cell under the pointer to the view's readout; rejected states are
 * hatched grey. The grid values come from the worker sweep; nothing here computes an engine quantity.
 */
import { useShellLang, useThemeStore } from '@fasl-work/caos-app-shell';
import { useContext, useEffect, useId, useRef, useState } from 'react';
import type { Lang } from '../../lib/format';
import { colourBounds, gridRegion, type Bounds, type GridRegion } from './navigation';
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

export interface HeatmapSelection {
  region: GridRegion;
  cell: Cell;
  xBounds: Bounds;
  yBounds: Bounds;
}

const TEXT = {
  navigation: { en: 'Inspect', es: 'Inspeccionar' },
  scale: { en: 'Colour scale', es: 'Escala de color' },
  robust: { en: 'Robust range', es: 'Rango robusto' },
  full: { en: 'Full range', es: 'Rango completo' },
  gesture: { en: 'Drag action', es: 'Acción al arrastrar' },
  select: { en: 'Select region', es: 'Seleccionar región' },
  pan: { en: 'Pan view', es: 'Desplazar vista' },
  zoom: { en: 'Zoom to selection', es: 'Ampliar selección' },
  in: { en: 'Zoom in', es: 'Acercar' },
  out: { en: 'Zoom out', es: 'Alejar' },
  reset: { en: 'Reset inspection', es: 'Restablecer inspección' },
  selected: { en: 'Selected region', es: 'Región seleccionada' },
  rejected: { en: 'Rejected / unavailable', es: 'Rechazado / no disponible' },
  empty: { en: 'No accepted sweep values to inspect.', es: 'No hay valores aceptados del barrido para inspeccionar.' },
  hint: { en: 'Drag: select · Arrows: cursor · Enter: select cell · Shift+arrows: extend · Alt+arrows: pan · Esc: reset',
    es: 'Arrastre: seleccionar · Flechas: cursor · Intro: seleccionar celda · Mayús+flechas: extender · Alt+flechas: desplazar · Esc: restablecer' },
};

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
  onSelection?: (selection: HeatmapSelection | null) => void;
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

export function Heatmap({ title, xs, ys, z, xLabel, yLabel, zLabel, summary, contours = [], points = [], format, onCell, onSelection }: HeatmapProps) {
  const lang = useShellLang() as Lang;
  const hintId = `heatmap-nav-${useId().replace(/:/g, '')}`;
  const tableId = `heatmap-data-${useId().replace(/:/g, '')}`;
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [focus, setFocus] = useState<[number, number] | null>(null);
  const [selection, setSelection] = useState<HeatmapSelection | null>(null);
  const [view, setView] = useState<GridRegion | null>(null);
  const [scale, setScale] = useState<'robust' | 'full'>('robust');
  const [gesture, setGesture] = useState<'select' | 'pan'>('select');
  const dataKey = JSON.stringify([xs, ys, z]);
  const callbackRef = useRef({ onCell, onSelection });
  callbackRef.current = { onCell, onSelection };
  const drag = useRef<{ pointer: number; start: [number, number]; end: [number, number]; x: number; y: number; view: GridRegion; pan: boolean; previous: HeatmapSelection | null } | null>(null);
  const anchor = useRef<[number, number] | null>(null);
  // Incoming values invalidate inspection even when a parent reuses this component across cases or metrics.
  useEffect(() => {
    setFocus(null); setSelection(null); setView(null); setScale('robust'); setGesture('select');
    anchor.current = null; drag.current = null;
    callbackRef.current.onCell?.(null); callbackRef.current.onSelection?.(null);
  }, [dataKey]);
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

  const colours = colourBounds(z, scale === 'robust');
  const [zMin, zMax] = colours?.bounds ?? [0, 1];
  const clipped = colours?.clipped ?? false;
  const available = !!colours && xs.length > 0 && ys.length > 0;
  const fullView = { i0: 0, i1: xs.length - 1, j0: 0, j1: ys.length - 1 };
  const viewport = view ?? fullView;
  const { i0, i1, j0, j1 } = viewport;
  const nx = i1 - i0 + 1, ny = j1 - j0 + 1;

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
    const accent = style.getPropertyValue('--color-accent').trim();
    const strong = style.getPropertyValue('--color-fg').trim() || '#e6edf3';
    const halo = style.getPropertyValue('--color-surface').trim() || '#161b22';
    const grid = style.getPropertyValue('--color-border').trim() || '#30363d';
    const font = style.fontFamily;
    // a colour given as a shell token (--color-...) follows the theme
    const colourOf = (c: string) => (c.startsWith('--') ? style.getPropertyValue(c).trim() || strong : c);
    // text over the colour map sits on a chip of the surface colour, so it reads on any cell: a 3 px halo stroke
    // left the colour map showing through the letters in the dark theme (0.08 gate captures)
    const label = (text: string, x: number, y: number, colour: string) => {
      ctx.save();
      const m = ctx.measureText(text);
      const ascent = m.actualBoundingBoxAscent || 9;
      const descent = m.actualBoundingBoxDescent || 3;
      const left = Math.min(x, size.width - MARGIN.right - m.width - 4);
      ctx.fillStyle = halo;
      ctx.fillRect(left - 3, y - ascent - 2, m.width + 6, ascent + descent + 4);
      ctx.fillStyle = colour;
      ctx.fillText(text, left, y);
      ctx.restore();
    };
    ctx.clearRect(0, 0, size.width, size.height);
    const w = size.width - MARGIN.left - MARGIN.right;
    const h = size.height - MARGIN.top - MARGIN.bottom;
    if (!available || w <= 0 || h <= 0) return;
    const cw = w / nx;
    const ch = h / ny;
    ctx.save();
    ctx.beginPath(); ctx.rect(MARGIN.left, MARGIN.top, w, h); ctx.clip();
    for (let j = j0; j <= j1; j += 1) {
      for (let i = i0; i <= i1; i += 1) {
        const v = z[j]?.[i] ?? null;
        const px = MARGIN.left + (i - i0) * cw;
        const py = MARGIN.top + (j1 - j) * ch;
        if (v === null || !Number.isFinite(v)) {
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
    const toPx = (gi: number, gj: number): [number, number] => [MARGIN.left + (gi - i0 + 0.5) * cw, MARGIN.top + (j1 - gj + 0.5) * ch];
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
      ctx.fillStyle = halo;
      ctx.strokeStyle = strong;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(px, py, 5, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
      ctx.font = `600 11px ${font}`;
      label(point.label, px + 8, py + 4, strong);
    }
    if (selection) {
      const r = selection.region;
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(MARGIN.left + (r.i0 - i0) * cw + 1, MARGIN.top + (j1 - r.j1) * ch + 1,
        (r.i1 - r.i0 + 1) * cw - 2, (r.j1 - r.j0 + 1) * ch - 2);
      ctx.setLineDash([]);
      // A solid ring distinguishes the slice's endpoint from the region boundary.
      const [sx, sy] = toPx(selection.cell.i, selection.cell.j);
      ctx.beginPath(); ctx.arc(sx, sy, Math.max(3, Math.min(7, cw / 4, ch / 4)), 0, 2 * Math.PI); ctx.stroke();
    }
    if (focus) {
      const [fi, fj] = focus;
      ctx.strokeStyle = strong;
      ctx.lineWidth = 2;
      ctx.strokeRect(MARGIN.left + (fi - i0) * cw, MARGIN.top + (j1 - fj) * ch, cw, ch);
    }
    ctx.restore();
    ctx.fillStyle = fg;
    ctx.font = `11px ${font}`;
    const longest = Math.max(1, ...xs.slice(i0, i1 + 1).map(x => ctx.measureText(format(x, 'x')).width));
    const step = Math.max(1, Math.ceil(nx / Math.max(1, Math.floor(w / (longest + 14)))));
    // ticks at the cell centres: x centred below, y right-aligned against the plot
    ctx.textAlign = 'center';
    xs.forEach((x, i) => { if (i >= i0 && i <= i1 && (i - i0) % step === 0) ctx.fillText(format(x, 'x'), MARGIN.left + (i - i0 + 0.5) * cw, size.height - MARGIN.bottom + 16); });
    const ystep = Math.max(1, Math.ceil(ny / Math.max(1, Math.floor(h / 24))));
    ctx.textAlign = 'right';
    ys.forEach((y, j) => { if (j >= j0 && j <= j1 && (j - j0) % ystep === 0) ctx.fillText(format(y, 'y'), MARGIN.left - 6, MARGIN.top + (j1 - j + 0.5) * ch + 4); });
    ctx.font = `600 11px ${font}`;
    ctx.textAlign = 'center';
    ctx.fillText(xLabel, MARGIN.left + w / 2, size.height - 8, w);
    ctx.save(); ctx.translate(14 + inset[3], MARGIN.top + h / 2); ctx.rotate(-Math.PI / 2); ctx.fillText(yLabel, 0, 0, h); ctx.restore();
    ctx.textAlign = 'left';
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [xs, ys, z, contours, points, size, theme, focus, selection, i0, i1, j0, j1, nx, ny, available, zMin, zMax, xLabel, yLabel, format, inset[0], inset[1], inset[2], inset[3]]);

  const cellAt = (i: number, j: number): Cell => {
    const value = z[j]?.[i];
    return { i, j, x: xs[i], y: ys[j], z: value !== null && value !== undefined && Number.isFinite(value) ? value : null };
  };
  const inspect = (a: [number, number], b: [number, number], notify = true) => {
    const region = gridRegion(a, b, xs.length, ys.length);
    if (!available || !region) return;
    const cell = cellAt(b[0], b[1]);
    const next: HeatmapSelection = { region, cell, xBounds: [xs[region.i0], xs[region.i1]], yBounds: [ys[region.j0], ys[region.j1]] };
    setSelection(next); if (notify) onSelection?.(next);
  };
  const reset = () => {
    setView(null); setFocus(null); setSelection(null); setScale('robust'); setGesture('select');
    anchor.current = null; drag.current = null; onSelection?.(null); onCell?.(null);
  };
  const cellUnder = (event: React.PointerEvent<HTMLCanvasElement>, clamp = false): [number, number] | null => {
    if (!available) return null;
    const rect = event.currentTarget.getBoundingClientRect();
    const w = size.width - MARGIN.left - MARGIN.right, h = size.height - MARGIN.top - MARGIN.bottom;
    const i = i0 + Math.floor((event.clientX - rect.left - MARGIN.left) / (w / nx));
    const j = j1 - Math.floor((event.clientY - rect.top - MARGIN.top) / (h / ny));
    if (clamp) return [Math.max(i0, Math.min(i1, i)), Math.max(j0, Math.min(j1, j))];
    return i < i0 || i > i1 || j < j0 || j > j1 ? null : [i, j];
  };
  const onDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const cell = cellUnder(event);
    if (!cell || event.button !== 0) return;
    event.preventDefault(); hostRef.current?.focus({ preventScroll: true });
    event.currentTarget.setPointerCapture(event.pointerId);
    const pan = gesture === 'pan' || event.altKey;
    drag.current = { pointer: event.pointerId, start: cell, end: cell, x: event.clientX, y: event.clientY, view: viewport, pan, previous: selection };
    if (!pan) { anchor.current = cell; setFocus(cell); inspect(cell, cell, false); onCell?.(cellAt(...cell)); }
  };
  const shiftView = (r: GridRegion, di: number, dj: number) => {
    const dx = Math.max(-r.i0, Math.min(xs.length - 1 - r.i1, di));
    const dy = Math.max(-r.j0, Math.min(ys.length - 1 - r.j1, dj));
    setView({ i0: r.i0 + dx, i1: r.i1 + dx, j0: r.j0 + dy, j1: r.j1 + dy });
  };
  const onMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const active = drag.current;
    if (active?.pan) {
      const w = size.width - MARGIN.left - MARGIN.right, h = size.height - MARGIN.top - MARGIN.bottom;
      shiftView(active.view, Math.round((active.x - event.clientX) * nx / w), Math.round((event.clientY - active.y) * ny / h));
      return;
    }
    const cell = cellUnder(event, !!active);
    setFocus(cell); onCell?.(cell ? cellAt(...cell) : null);
    if (active && cell) { active.end = cell; inspect(active.start, cell, false); }
  };
  const finishDrag = (event: React.PointerEvent<HTMLCanvasElement>, commit: boolean) => {
    if (!drag.current) return;
    const active = drag.current;
    // Commit the last pointer sample, not a new hit test after the readout resized the canvas.
    // A stationary touch consequently selects exactly its down cell.
    if (commit && !active.pan) inspect(active.start, active.end);
    else if (!commit && !active.pan) setSelection(active.previous);
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const zoom = (factor: number) => {
    const cx = focus?.[0] ?? (i0 + i1) / 2, cy = focus?.[1] ?? (j0 + j1) / 2;
    const width = Math.max(1, Math.min(xs.length, Math.round(nx * factor)));
    const height = Math.max(1, Math.min(ys.length, Math.round(ny * factor)));
    const left = Math.max(0, Math.min(xs.length - width, Math.round(cx - (width - 1) / 2)));
    const bottom = Math.max(0, Math.min(ys.length - height, Math.round(cy - (height - 1) / 2)));
    setView({ i0: left, i1: left + width - 1, j0: bottom, j1: bottom + height - 1 });
  };
  const onKey = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') { event.preventDefault(); reset(); return; }
    if (!available) return;
    if (event.key === '+' || event.key === '=') { event.preventDefault(); zoom(0.5); return; }
    if (event.key === '-') { event.preventDefault(); zoom(2); return; }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault(); const cell = focus ?? [i0, j0]; anchor.current = cell; inspect(cell, cell); return;
    }
    const moves: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    if (event.altKey) { shiftView(viewport, move[0] * Math.max(1, Math.floor(nx / 5)), move[1] * Math.max(1, Math.floor(ny / 5))); return; }
    const from: [number, number] = focus ?? [i0, j0];
    const next: [number, number] = [Math.max(0, Math.min(xs.length - 1, from[0] + move[0])), Math.max(0, Math.min(ys.length - 1, from[1] + move[1]))];
    if (event.shiftKey) { anchor.current ??= from; inspect(anchor.current, next); }
    else anchor.current = null;
    if (next[0] < i0 || next[0] > i1 || next[1] < j0 || next[1] > j1) shiftView(viewport, next[0] < i0 ? -1 : next[0] > i1 ? 1 : 0, next[1] < j0 ? -1 : next[1] > j1 ? 1 : 0);
    setFocus(next); onCell?.(cellAt(...next));
  };

  return (
    <figure className="of-heatmap" aria-label={summary} data-grid-key={dataKey} data-margins={JSON.stringify(MARGIN)}
      data-selection={selection ? JSON.stringify(selection) : ''} data-view={JSON.stringify(viewport)} data-scale={scale}>
      {title && <div className="of-plot-head" style={{ paddingLeft: inset[3] || undefined }}><span className="of-plot-title">{title}</span></div>}
      <details className="of-heatmap-tools">
        <summary>{TEXT.navigation[lang]}</summary>
      <div className="of-chart-tools" role="group" aria-label={summary}>
        <label>{TEXT.scale[lang]} <select value={scale} disabled={!available} onChange={e => setScale(e.target.value as 'robust' | 'full')}>
          <option value="robust">{TEXT.robust[lang]}</option><option value="full">{TEXT.full[lang]}</option>
        </select></label>
        <label>{TEXT.gesture[lang]} <select value={gesture} disabled={!available} onChange={e => setGesture(e.target.value as 'select' | 'pan')}>
          <option value="select">{TEXT.select[lang]}</option><option value="pan">{TEXT.pan[lang]}</option>
        </select></label>
        <button type="button" disabled={!selection} onClick={() => selection && setView(selection.region)}>{TEXT.zoom[lang]}</button>
        <button type="button" disabled={!available || (nx === 1 && ny === 1)} onClick={() => zoom(0.5)} aria-label={TEXT.in[lang]}>+</button>
        <button type="button" disabled={!available || (nx === xs.length && ny === ys.length)} onClick={() => zoom(2)} aria-label={TEXT.out[lang]}>−</button>
        <button type="button" onClick={reset} disabled={!available}>{TEXT.reset[lang]}</button>
      </div>
      </details>
      <div className="of-heatmap-plot" ref={hostRef} tabIndex={0} onKeyDown={onKey} role="group" aria-label={summary} aria-describedby={hintId} aria-details={tableId}>
        <canvas ref={canvasRef} aria-hidden="true" onPointerDown={onDown} onPointerMove={onMove}
          onPointerUp={e => finishDrag(e, true)} onPointerCancel={e => finishDrag(e, false)} onLostPointerCapture={() => { drag.current = null; }}
          onDoubleClick={reset} onPointerLeave={() => { if (!drag.current) { setFocus(null); onCell?.(null); } }} />
        {!available && <p className="of-heatmap-empty" role="status">{TEXT.empty[lang]}</p>}
      </div>
      <div className="of-heatmap-scale" data-z-min={available ? zMin : undefined} data-z-max={available ? zMax : undefined} data-z-clipped={clipped ? '1' : '0'}>
        <span>{available ? (clipped ? `≤ ${format(zMin, 'z')}` : format(zMin, 'z')) : '-'}</span>
        <span className="of-heatmap-ramp" style={{ background: `linear-gradient(90deg, ${Array.from({ length: 10 }, (_, k) => viridis(k / 9)).join(',')})` }} />
        <span>{available ? format(zMax, 'z') : '-'}</span>
        <span className="of-heatmap-zlabel">{zLabel}</span>
      </div>
      <output className="of-heatmap-selection" aria-live="polite">{selection ? <>{TEXT.selected[lang]}: {xLabel} {format(selection.xBounds[0], 'x')}–{format(selection.xBounds[1], 'x')}; {yLabel} {format(selection.yBounds[0], 'y')}–{format(selection.yBounds[1], 'y')}. {zLabel}: {selection.cell.z === null ? TEXT.rejected[lang] : format(selection.cell.z, 'z')}</> : TEXT.select[lang]}</output>
      <span id={hintId} className="of-chart-nav-hint">{TEXT.hint[lang]}</span>
      <figcaption className="of-sr-only">{summary}</figcaption>
      <div className="of-sr-only">
        <table id={tableId}>
          <caption>{summary}</caption>
          <thead><tr><th scope="col">{`${yLabel} / ${xLabel}`}</th>{xs.map((x, i) => <th scope="col" key={i}>{format(x, 'x')}</th>)}</tr></thead>
          <tbody>{ys.map((y, j) => <tr key={j}><th scope="row">{format(y, 'y')}</th>{xs.map((_, i) => <td key={i}>{z[j]?.[i] == null || !Number.isFinite(z[j][i]) ? TEXT.rejected[lang] : format(z[j][i], 'z')}</td>)}</tr>)}</tbody>
        </table>
      </div>
    </figure>
  );
}
