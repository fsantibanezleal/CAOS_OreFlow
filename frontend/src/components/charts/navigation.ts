/** Bounds and grid navigation only; never computes process values. */
export type Bounds = [number, number];
export interface GridRegion { i0: number; i1: number; j0: number; j1: number }

/** Fraction of the visible span; log axes translate in log space, preserving the visible ratio. */
export function panRange(view: Bounds, domain: Bounds, fraction: number, log = false): Bounds {
  const valid = ([lo, hi]: Bounds) => Number.isFinite(lo) && Number.isFinite(hi) && hi >= lo && (!log || lo > 0);
  if (!valid(domain)) return [0, 0];
  if (domain[0] === domain[1]) return [...domain];
  if (!valid(view) || !Number.isFinite(fraction)) return [...domain];
  const to = log ? Math.log : (v: number) => v;
  const from = log ? Math.exp : (v: number) => v;
  const [lo, hi] = domain.map(to);
  const [a, b] = view.map(to);
  const width = Math.min(hi - lo, b - a);
  const start = Math.max(lo, Math.min(hi - width, a + fraction * width));
  return [Math.max(domain[0], from(start)), Math.min(domain[1], from(start + width))];
}

export function gridRegion(a: [number, number], b: [number, number], nx: number, ny: number): GridRegion | null {
  if (nx < 1 || ny < 1 || ![...a, ...b].every(Number.isFinite)) return null;
  const clamp = (v: number, n: number) => Math.max(0, Math.min(n - 1, Math.round(v)));
  return { i0: clamp(Math.min(a[0], b[0]), nx), i1: clamp(Math.max(a[0], b[0]), nx),
    j0: clamp(Math.min(a[1], b[1]), ny), j1: clamp(Math.max(a[1], b[1]), ny) };
}

/** Exact row/column through the selection endpoint, cropped to its region. Nulls stay gaps. */
export function gridSlice(xs: number[], ys: number[], z: (number | null)[][], region: GridRegion, cell: [number, number], axis: 'x' | 'y') {
  const r = gridRegion([region.i0, region.j0], [region.i1, region.j1], xs.length, ys.length);
  if (!r) return { coordinates: [], values: [] };
  const i = Math.max(r.i0, Math.min(r.i1, cell[0]));
  const j = Math.max(r.j0, Math.min(r.j1, cell[1]));
  const coordinates = axis === 'x' ? xs.slice(r.i0, r.i1 + 1) : ys.slice(r.j0, r.j1 + 1);
  const values = coordinates.map((_, k) => {
    const value = axis === 'x' ? z[j]?.[r.i0 + k] : z[r.j0 + k]?.[i];
    return value !== null && value !== undefined && Number.isFinite(value) ? value : null;
  });
  return { coordinates, values };
}

/** Preserve the existing robust lower-tail rule, with an explicit reversible full-range mode. */
export function colourBounds(z: (number | null)[][], robust: boolean): { bounds: Bounds; clipped: boolean } | null {
  const values = z.flat().filter((v): v is number => v !== null && Number.isFinite(v)).sort((a, b) => a - b);
  if (!values.length) return null;
  const lo = values[0], hi = values[values.length - 1];
  const tenth = values[Math.floor(0.1 * (values.length - 1))];
  const clipped = robust && values.length > 9 && tenth - lo > 0.25 * (hi - lo);
  return { bounds: [clipped ? tenth : lo, hi], clipped };
}
