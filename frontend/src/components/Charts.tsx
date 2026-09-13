import { useState } from 'react';

export type Series = { name: string; color: string; values: number[] };
type Props = { title: string; subtitle?: string; series: Series[]; labels?: string[]; height?: number; format?: (v: number) => string };

export function Chart({ title, subtitle, series, labels = [], height = 240, format = (v) => v.toFixed(2) }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const width = 720;
  const all = series.flatMap(s => s.values);
  const max = Math.max(...all, 1e-6); const min = Math.min(...all, 0); const span = Math.max(max - min, 1e-6);
  const x = (i: number, n: number) => 56 + i / Math.max(n - 1, 1) * (width - 78);
  const y = (v: number) => 18 + (1 - (v - min) / span) * (height - 52);
  const points = (values: number[]) => values.map((v, i) => `${x(i, values.length).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const index = hover ?? Math.max(0, Math.round((series[0]?.values.length ?? 1) / 2));
  return <div className="of-chart" onMouseLeave={() => setHover(null)}>
    <div className="of-chart-head"><div><h3>{title}</h3>{subtitle && <p>{subtitle}</p>}</div><div className="of-legend">{series.map(s => <span key={s.name}><i style={{ background: s.color }} />{s.name}</span>)}</div></div>
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title} onMouseMove={(event) => { const rect = event.currentTarget.getBoundingClientRect(); const raw = (event.clientX - rect.left) / rect.width * (series[0]?.values.length ?? 1); setHover(Math.max(0, Math.min((series[0]?.values.length ?? 1) - 1, Math.round(raw)))); }}>
      {[0, .25, .5, .75, 1].map(t => <g key={t}><line x1="56" x2={width - 22} y1={18 + t * (height - 52)} y2={18 + t * (height - 52)} className="of-grid" /><text x="48" y={22 + t * (height - 52)} textAnchor="end" className="of-axis">{format(max - t * span)}</text></g>)}
      <line x1={x(index, series[0]?.values.length ?? 1)} x2={x(index, series[0]?.values.length ?? 1)} y1="16" y2={height - 34} className="of-hover-line" />
      {series.map(s => <polyline key={s.name} points={points(s.values)} fill="none" stroke={s.color} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />)}
      {series.map(s => <circle key={`${s.name}-dot`} cx={x(index, s.values.length)} cy={y(s.values[index] ?? 0)} r="5" fill={s.color} stroke="var(--of-bg)" strokeWidth="3" />)}
      <text x="56" y={height - 12} className="of-axis">{labels[0] ?? ''}</text><text x={width - 22} y={height - 12} textAnchor="end" className="of-axis">{labels[labels.length - 1] ?? ''}</text>
    </svg>
    <div className="of-tooltip-row"><span>{labels[index] ?? `sample ${index + 1}`}</span>{series.map(s => <span key={s.name} style={{ color: s.color }}>{s.name} {format(s.values[index] ?? 0)}</span>)}</div>
  </div>;
}

export function MetricCard({ label, value, unit, tone = 'teal', detail }: { label: string; value: string; unit?: string; tone?: string; detail?: string }) {
  return <div className={`of-metric of-${tone}`}><span>{label}</span><strong>{value}<small>{unit}</small></strong>{detail && <em>{detail}</em>}</div>;
}
