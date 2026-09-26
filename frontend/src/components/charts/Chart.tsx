/**
 * The themed uPlot host every line chart mounts through, so cursor, palette, zoom, ticks and resize
 * behave the same everywhere and a fix lands once (interactive-visualization rubric, Tier A; shell
 * known defect 3).
 *
 * - Colours come from the shell tokens and are re-read when the theme changes.
 * - The chart sizes itself from its own box, observed, not from a number fixed at authoring time.
 * - Tick labels are formatted in the interface language, with the decimals the tick spacing needs
 *   (PE-35); a logarithmic axis spans the data, not the enclosing decades.
 * - A legend names every series; clicking an entry hides or shows it (on-chart toggle).
 * - Drag across the plot to zoom the x range; the reset button (or Escape) restores it.
 * - The cursor reading is reported upward to the view's readout row instead of uPlot's legend, which a
 *   sized host would clip. Arrow keys move the cursor sample by sample when the chart has focus.
 * - Marks label what the engine computed (a cut, a target, a liberation size) at their x value, and
 *   level marks a limit (a specification, a threshold, the base case) at their y value; labels that
 *   would overprint are stacked.
 * - A categorical axis (inputs, starts, variants) places one tick per category; paired bar series sit
 *   side by side around each tick.
 * - Point labels name the points of the first series (a case on a map of cases); a label that would
 *   overlap one already drawn is left to the cursor reading.
 * - The plot is an image with the chart's summary as its name, and a visually hidden table carries
 *   the data for screen readers.
 */
import { useShellLang, useThemeStore } from '@fasl-work/caos-app-shell';
import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import uPlot from 'uplot';
import 'uplot/dist/uPlot.min.css';
import { formatTick, type Lang } from '../../lib/format';
import { t, UI } from '../../lib/i18n';
import { OverlayInset } from './inset';

export type Colour = 'accent' | 'accent-2' | 'good' | 'warn' | 'bad' | 'magenta' | 'subtle';

export interface Series {
  label: string;
  colour?: Colour;
  points?: boolean;
  dash?: number[];
  width?: number;
  /** Index (1-based, in `data`) of the series this one is filled down to, for a band. */
  fillTo?: number;
  /** Draw as bars (a histogram or a categorical comparison). */
  bars?: boolean;
  /** For paired bars: -1 draws the bar left of its tick, 1 right of it. */
  align?: -1 | 1;
  /** Left out of the legend (a highlight drawn over another series). */
  legend?: false;
}

export interface Mark {
  x: number;
  label: string;
}

export interface LevelMark {
  y: number;
  label: string;
}

export interface CursorReading {
  index: number;
  x: number;
  values: (number | null)[];
}

export interface ChartProps {
  data: uPlot.AlignedData;
  series: Series[];
  xLabel: string;
  yLabel: string;
  /** A short visible title. */
  title?: string;
  /** One sentence for screen readers. */
  summary: string;
  marks?: Mark[];
  levels?: LevelMark[];
  /** Category names; `data[0]` is then 0, 1, ... and each tick is labelled with its name. */
  categories?: string[];
  /** Labels drawn beside the points of the first series, index-aligned with `data[0]`. */
  pointLabels?: (string | null)[];
  /** The point label drawn first, so it is never the one left out. */
  pointLabelFirst?: number;
  logX?: boolean;
  logY?: boolean;
  yRange?: [number, number];
  onCursor?: (reading: CursorReading | null) => void;
  /** Formats x and y values for the screen-reader table. */
  format?: (value: number | null, axis: 'x' | 'y') => string;
}

const TOKEN: Record<Colour, string> = {
  accent: '--color-accent', 'accent-2': '--color-accent-2', good: '--color-good', warn: '--color-warn',
  bad: '--color-bad', magenta: '--color-magenta', subtle: '--color-fg-subtle',
};

function palette(element: HTMLElement) {
  const style = getComputedStyle(element);
  const read = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback;
  return {
    resolve: (key?: Colour) => read(TOKEN[key ?? 'accent'], '#58a6ff'),
    grid: read('--color-border', '#30363d'),
    axis: read('--color-fg-subtle', '#9aa6b2'),
    faint: read('--color-fg-faint', '#6c7785'),
    halo: read('--color-surface', '#161b22'),
    font: style.fontFamily,
  };
}

type Box = { x0: number; y0: number; x1: number; y1: number };
const overlaps = (a: Box, b: Box) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;

export function Chart({ data, series, xLabel, yLabel, title, summary, marks, levels, categories, pointLabels, pointLabelFirst, logX, logY, yRange, onCursor, format }: ChartProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const plotRef = useRef<uPlot | null>(null);
  const cursorRef = useRef<number | null>(null);
  const [zoomed, setZoomed] = useState(false);
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const hiddenRef = useRef(hidden);
  hiddenRef.current = hidden;
  const theme = useThemeStore(state => state.theme);
  const lang = useShellLang() as Lang;
  const inset = useContext(OverlayInset);
  // series, marks and data arrive as fresh literals on every render; rebuild on their value only
  const seriesKey = useMemo(() => JSON.stringify(series), [series]);
  const marksKey = useMemo(() => JSON.stringify([marks ?? null, levels ?? null, categories ?? null, pointLabels ?? null, pointLabelFirst ?? null]),
    [marks, levels, categories, pointLabels, pointLabelFirst]);
  const dataKey = useMemo(() => JSON.stringify(data), [data]);
  const onCursorRef = useRef(onCursor);
  onCursorRef.current = onCursor;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const colours = palette(host);
    const drawMarks = (self: uPlot) => {
      if (!marks?.length && !levels?.length && !pointLabels?.length) return;
      const ctx = self.ctx;
      const { left, top, width, height } = self.bbox;
      const ratio = uPlot.pxRatio;
      const line = 13 * ratio;
      ctx.save();
      ctx.strokeStyle = colours.faint;
      ctx.lineWidth = ratio;
      ctx.setLineDash([4 * ratio, 3 * ratio]);
      ctx.font = `${Math.round(11 * ratio)}px ${colours.font}`;
      // uPlot leaves the alignment of its last axis (right-aligned y ticks) on the context
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      const label = (text: string, x: number, y: number) => {
        ctx.save();
        ctx.setLineDash([]);
        ctx.lineWidth = 3 * ratio;
        ctx.strokeStyle = colours.halo;
        ctx.strokeText(text, x, y);
        ctx.fillStyle = colours.axis;
        ctx.fillText(text, x, y);
        ctx.restore();
      };
      // vertical marks, left to right; a label that would run into the previous one drops a line
      const placed: Box[] = [];
      const vertical = (marks ?? []).map(m => ({ ...m, px: self.valToPos(m.x, 'x', true) }))
        .filter(m => Number.isFinite(m.px) && m.px >= left && m.px <= left + width).sort((a, b) => a.px - b.px);
      for (const mark of vertical) {
        ctx.beginPath();
        ctx.moveTo(mark.px, top);
        ctx.lineTo(mark.px, top + height);
        ctx.stroke();
        const w = ctx.measureText(mark.label).width;
        // right of the mark, else left of it, and never outside the plot: on a phone a long label placed
        // left of its mark ran over the y axis
        const side = mark.px + 4 * ratio + w > left + width ? mark.px - 4 * ratio - w : mark.px + 4 * ratio;
        const x = Math.max(left, Math.min(side, left + width - w));
        let row = 0;
        let box: Box = { x0: x, y0: top + row * line, x1: x + w, y1: top + (row + 1) * line };
        while (placed.some(b => overlaps(b, box)) && row < 6) {
          row += 1;
          box = { x0: x, y0: top + row * line, x1: x + w, y1: top + (row + 1) * line };
        }
        placed.push(box);
        label(mark.label, x, top + (row + 1) * line - 3 * ratio);
      }
      for (const level of levels ?? []) {
        const y = self.valToPos(level.y, 'y', true);
        if (!Number.isFinite(y) || y < top || y > top + height) continue;
        ctx.beginPath();
        ctx.moveTo(left, y);
        ctx.lineTo(left + width, y);
        ctx.stroke();
        if (level.label) label(level.label, left + width - ctx.measureText(level.label).width - 4 * ratio, y - 4 * ratio);
      }
      if (pointLabels?.length && self.series[1]?.show !== false) {
        const xs = self.data[0] as number[];
        const ys = self.data[1] as (number | null)[];
        const order = pointLabels.map((_, i) => i);
        if (pointLabelFirst !== undefined && pointLabelFirst >= 0) order.sort((a, b) => (a === pointLabelFirst ? -1 : b === pointLabelFirst ? 1 : 0));
        const taken: Box[] = [];
        for (const i of order) {
          const text = pointLabels[i];
          const value = ys[i];
          if (!text || value === null || value === undefined) continue;
          const x = self.valToPos(xs[i], 'x', true);
          const y = self.valToPos(value, 'y', true);
          if (x < left || x > left + width || y < top || y > top + height) continue;
          const w = ctx.measureText(text).width;
          // right of the point, or left of it where the label would leave the plot
          const px = x + 7 * ratio + w > left + width ? x - 7 * ratio - w : x + 7 * ratio;
          const box = { x0: px - 2 * ratio, y0: y - 8 * ratio, x1: px + w + 2 * ratio, y1: y + 6 * ratio };
          if (taken.some(b => overlaps(b, box))) continue;
          taken.push(box);
          label(text, px, y + 4 * ratio);
        }
      }
      ctx.restore();
    };
    const ticks = (log: boolean) => (_self: uPlot, splits: number[], _axis: number, _space: number, incr: number) =>
      splits.map(v => formatTick(v, incr, lang, log));
    const axis = (label: string, size: number, log: boolean): uPlot.Axis => ({
      label, labelSize: size, stroke: colours.axis, grid: { stroke: colours.grid, width: 1 }, ticks: { stroke: colours.grid },
      font: `11px ${colours.font}`, labelFont: `600 11px ${colours.font}`, values: ticks(log),
    });
    const xAxis: uPlot.Axis = categories
      ? { ...axis(xLabel, 24, false), splits: () => categories.map((_, i) => i), values: () => categories, grid: { show: false } }
      : axis(xLabel, 24, !!logX);
    const span = (_self: uPlot, min: number, max: number): uPlot.Range.MinMax => [min, max];
    const xScale: uPlot.Scale = categories
      ? { time: false, range: [-0.5, categories.length - 0.5] }
      : { time: false, distr: logX ? 3 : 1, ...(logX ? { range: span } : {}) };
    const yAxis = { ...axis(yLabel, 30, !!logY), size: 56 };
    const options: uPlot.Options = {
      width: Math.max(160, host.clientWidth),
      height: Math.max(120, host.clientHeight),
      padding: [12 + inset[0], 16 + inset[1], inset[2], inset[3]],
      cursor: { drag: { x: !categories, y: false, setScale: !categories }, focus: { prox: 24 } },
      legend: { show: false },
      scales: { x: xScale, y: { ...(logY ? { distr: 3 } : {}), ...(yRange ? { range: yRange } : { auto: true }) } },
      axes: [xAxis, yAxis],
      series: [
        { label: xLabel },
        ...series.map((s): uPlot.Series => {
          const stroke = colours.resolve(s.colour);
          const bars = s.align ? uPlot.paths.bars?.({ size: [0.36, 48], align: s.align }) : uPlot.paths.bars?.({ size: [0.8, 64] });
          return {
            label: s.label, stroke, width: s.width ?? 2, dash: s.dash, show: !hiddenRef.current.has(s.label),
            ...(s.fillTo !== undefined ? { fill: `${stroke}22` } : {}),
            ...(s.bars ? { paths: bars, fill: `${stroke}99`, points: { show: false } }
              : s.points ? { paths: () => null, points: { show: true, size: 7, stroke, fill: stroke } } : { points: { show: false } }),
          };
        }),
      ],
      bands: series.flatMap((s, i) => (s.fillTo !== undefined ? [{ series: [i + 1, s.fillTo] as [number, number] }] : [])),
      hooks: {
        draw: [drawMarks],
        setScale: [(self: uPlot, key: string) => {
          if (key !== 'x') return;
          const xs = self.data[0] as number[];
          const min = self.scales.x.min ?? xs[0];
          const max = self.scales.x.max ?? xs[xs.length - 1];
          setZoomed(min > Math.min(...xs) + 1e-12 || max < Math.max(...xs) - 1e-12);
        }],
        setCursor: [(self: uPlot) => {
          const index = self.cursor.idx;
          cursorRef.current = index ?? null;
          const report = onCursorRef.current;
          if (!report) return;
          if (index === null || index === undefined) { report(null); return; }
          report({ index, x: (self.data[0] as number[])[index], values: self.data.slice(1).map(row => (row as (number | null)[])[index] ?? null) });
        }],
      },
    };
    const plot = new uPlot(options, data, host);
    plotRef.current = plot;
    const observer = new ResizeObserver(() => plot.setSize({ width: Math.max(160, host.clientWidth), height: Math.max(120, host.clientHeight) }));
    observer.observe(host);
    return () => { observer.disconnect(); plot.destroy(); plotRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataKey, seriesKey, marksKey, theme, lang, xLabel, yLabel, logX, logY, yRange?.[0], yRange?.[1], inset[0], inset[1], inset[2], inset[3]]);

  const toggle = (index: number, name: string) => {
    const next = new Set(hidden);
    if (next.has(name)) next.delete(name); else next.add(name);
    setHidden(next);
    plotRef.current?.setSeries(index + 1, { show: !next.has(name) });
  };

  const reset = () => {
    const plot = plotRef.current;
    if (!plot) return;
    const xs = plot.data[0] as number[];
    plot.setScale('x', { min: Math.min(...xs), max: Math.max(...xs) });
  };

  const onKey = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const plot = plotRef.current;
    if (!plot) return;
    if (event.key === 'Escape') { reset(); return; }
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const n = (plot.data[0] as number[]).length;
    const current = cursorRef.current ?? (event.key === 'ArrowRight' ? -1 : n);
    const next = Math.max(0, Math.min(n - 1, current + (event.key === 'ArrowRight' ? 1 : -1)));
    const x = plot.valToPos((plot.data[0] as number[])[next], 'x');
    const firstSeries = plot.data[1] as (number | null)[];
    const yValue = firstSeries?.[next];
    const y = yValue === null || yValue === undefined ? plot.bbox.height / 2 : plot.valToPos(yValue, 'y');
    plot.setCursor({ left: x, top: y });
  };

  const base = format ?? ((value: number | null) => (value === null ? '-' : String(value)));
  const fmt = categories ? (value: number | null, axis: 'x' | 'y') => (axis === 'x' && value !== null ? categories[value] ?? base(value, axis) : base(value, axis)) : base;
  const xs = data[0] as number[];
  const shown = series.map((s, i) => ({ s, i })).filter(({ s }) => s.legend !== false);
  return (
    <figure className="of-plot">
      {(title || shown.length > 1) && (
        <div className="of-plot-head">
          {title && <span className="of-plot-title">{title}</span>}
          {shown.length > 1 && (
            <div className="of-legend" role="group" aria-label={t(UI.legend, lang)}>
              {shown.map(({ s, i }) => (
                <button key={s.label} type="button" aria-pressed={!hidden.has(s.label)} className={hidden.has(s.label) ? 'off' : undefined}
                  onClick={() => toggle(i, s.label)}>
                  <i className={`of-swatch${s.bars ? ' bar' : s.points ? ' dot' : s.dash ? ' dash' : ''}`} style={{ ['--swatch' as string]: `var(${TOKEN[s.colour ?? 'accent']})` }} />
                  {s.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="of-plot-area" ref={hostRef} tabIndex={0} onKeyDown={onKey} role="img" aria-label={summary} />
      {zoomed && <button type="button" className="of-plot-reset" onClick={reset}>{t(UI.resetZoom, lang)}</button>}
      {/* a table ignores the 1 px width of the hidden class and would widen the page's scroll area, so a
          block holds it */}
      <div className="of-sr-only">
        <table>
          <caption>{summary}</caption>
          <thead><tr><th scope="col">{xLabel}</th>{series.map(s => <th scope="col" key={s.label}>{s.label}</th>)}</tr></thead>
          <tbody>
            {xs.map((x, i) => (
              <tr key={i}><th scope="row">{fmt(x, 'x')}</th>{series.map((s, k) => <td key={s.label}>{fmt((data[k + 1] as (number | null)[])[i] ?? null, 'y')}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
