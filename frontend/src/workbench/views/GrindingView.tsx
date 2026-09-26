/**
 * Grinding view: size distributions of the circuit streams, the cyclone partition, the liberation of
 * each valuable mineral and the host-limited composite scale, each from the trace, with the engine's
 * target, cut and liberation sizes marked where they sit. The charts are built by `grindingCharts`, so
 * the focus route can put any one of them on its stage.
 */
import type { ReactNode } from 'react';
import type uPlot from 'uplot';
import type { Ore } from '../../engine/model';
import type { Trace } from '../../engine/trace';
import { formatSignificant, formatWithUnit, type Lang } from '../../lib/format';
import { metricLabel, mineralName } from '../../lib/i18n';
import { Chart, type CursorReading, type Series } from '../../components/charts/Chart';

type Curves = {
  size_um: number[]; psd: Record<string, number[]>; partition: Record<string, number[]>;
  liberation: Record<string, number[]>; composite_scale: number[];
};

const STREAMS: Array<{ key: string; en: string; es: string; colour: Series['colour'] }> = [
  { key: 'new_feed', en: 'Mill new feed', es: 'Alimentación fresca', colour: 'subtle' },
  { key: 'mill_discharge', en: 'Mill discharge', es: 'Descarga del molino', colour: 'accent-2' },
  { key: 'cyclone_underflow', en: 'Cyclone underflow', es: 'Descarga del ciclón', colour: 'warn' },
  { key: 'cyclone_overflow', en: 'Cyclone overflow', es: 'Rebose del ciclón', colour: 'accent' },
  { key: 'final_concentrate', en: 'Concentrate', es: 'Concentrado', colour: 'good' },
  { key: 'final_tail', en: 'Tail', es: 'Relave', colour: 'bad' },
];

const TEXT = {
  size: { en: 'Particle size (µm)', es: 'Tamaño de partícula (µm)' },
  passing: { en: 'Cumulative passing', es: 'Pasante acumulado' },
  partition: { en: 'Fraction to underflow', es: 'Fracción a la descarga' },
  liberated: { en: 'Liberated fraction', es: 'Fracción liberada' },
  scale: { en: 'Composite scale', es: 'Escala de mixtos' },
  target: { en: 'target P80', es: 'P80 objetivo' },
  achieved: { en: 'P80', es: 'P80' },
  cut: { en: 'cut', es: 'corte' },
  host: { en: 'Host gangue', es: 'Ganga huésped' },
  xl: { en: 'liberation size', es: 'tamaño de liberación' },
  psdSummary: { en: 'Cumulative size distributions of the grinding circuit streams, with the target and achieved P80.', es: 'Distribuciones granulométricas acumuladas de las corrientes de molienda, con el P80 objetivo y logrado.' },
  partSummary: { en: 'Cyclone partition to underflow by size for the host gangue and each valuable mineral, with the host cut.', es: 'Partición del ciclón a la descarga por tamaño para la ganga huésped y cada mineral valioso, con el corte de la ganga.' },
  libSummary: { en: 'Liberated fraction of each valuable mineral by size, with its liberation size and the target P80.', es: 'Fracción liberada de cada mineral valioso por tamaño, con su tamaño de liberación y el P80 objetivo.' },
  scaleSummary: { en: 'Share of the declared composites the host gangue can supply in each size class (1 everywhere unless a class is valuable-rich).', es: 'Fracción de los mixtos declarados que la ganga huésped puede aportar en cada clase de tamaño (1 salvo en clases ricas en mineral valioso).' },
};

/** The trace lists sizes from coarse to fine; uPlot needs x ascending. */
function ascending(x: number[], ...ys: number[][]): uPlot.AlignedData {
  const order = x.map((_, i) => i).reverse();
  return [order.map(i => x[i]), ...ys.map(y => order.map(i => y[i]))] as uPlot.AlignedData;
}

export type GrindingChart = 'psd' | 'partition' | 'liberation' | 'scale';
export const GRINDING_CHARTS: Record<GrindingChart, { en: string; es: string }> = {
  psd: { en: 'Size distributions', es: 'Distribuciones granulométricas' },
  partition: { en: 'Cyclone partition', es: 'Partición del ciclón' },
  liberation: { en: 'Liberation', es: 'Liberación' },
  scale: { en: 'Composite scale', es: 'Escala de mixtos' },
};

/** The grinding charts of a trace; the composite scale only where it departs from 1. */
export function grindingCharts(trace: Trace, ore: Ore, lang: Lang, onCursor: (text: string | null) => void): Partial<Record<GrindingChart, ReactNode>> {
  const curves = trace.curves as unknown as Curves;
  const m = trace.metrics;
  const size = curves.size_um;
  const present = STREAMS.filter(s => s.key in curves.psd);
  const fmt = (v: number | null, axis: 'x' | 'y') => (axis === 'x' ? formatWithUnit(v, 'um', lang) : formatSignificant(v, lang, 3));
  const report = (labels: string[]) => (reading: CursorReading | null) => {
    if (!reading) { onCursor(null); return; }
    onCursor(`${formatWithUnit(reading.x, 'um', lang)}: ${reading.values.map((v, i) => `${labels[i]} ${formatSignificant(v, lang, 3)}`).join(', ')}`);
  };
  const valuable = Object.keys(curves.liberation);
  const liberationSize = (mineral: string) => ore.minerals.find(x => x.id === mineral)?.liberation_size_um ?? 0;
  const scaled = curves.composite_scale.some(v => v < 0.999999);
  return {
    psd: (
      <Chart key="psd" title={GRINDING_CHARTS.psd[lang]} data={ascending(size, ...present.map(s => curves.psd[s.key]))} logX xLabel={TEXT.size[lang]} yLabel={TEXT.passing[lang]}
        series={present.map(s => ({ label: s[lang], colour: s.colour }))} summary={TEXT.psdSummary[lang]} format={fmt} yRange={[0, 1]}
        marks={[{ x: m.target_p80_um, label: TEXT.target[lang] }, { x: m.p80_um, label: `${TEXT.achieved[lang]} ${formatWithUnit(m.p80_um, 'um', lang)}` }]}
        onCursor={report(present.map(s => s[lang]))} />
    ),
    partition: (
      <Chart key="partition" title={GRINDING_CHARTS.partition[lang]} data={ascending(size, ...Object.values(curves.partition))} logX xLabel={TEXT.size[lang]} yLabel={TEXT.partition[lang]}
        series={Object.keys(curves.partition).map((k, i) => ({ label: k === 'host' ? TEXT.host[lang] : mineralName(k, lang), colour: (['accent', 'warn', 'good', 'magenta'] as const)[i % 4] }))}
        summary={TEXT.partSummary[lang]} format={fmt} yRange={[0, 1]}
        marks={[{ x: m.cyclone_cut_um, label: `${TEXT.cut[lang]} ${formatWithUnit(m.cyclone_cut_um, 'um', lang)}` }]}
        onCursor={report(Object.keys(curves.partition).map(k => (k === 'host' ? TEXT.host[lang] : mineralName(k, lang))))} />
    ),
    liberation: (
      <Chart key="liberation" title={GRINDING_CHARTS.liberation[lang]} data={ascending(size, ...valuable.map(v => curves.liberation[v]))} logX xLabel={TEXT.size[lang]} yLabel={TEXT.liberated[lang]}
        series={valuable.map((v, i) => ({ label: mineralName(v, lang), colour: (['good', 'accent', 'magenta', 'warn'] as const)[i % 4] }))}
        summary={TEXT.libSummary[lang]} format={fmt} yRange={[0, 1]}
        marks={[...valuable.filter(v => liberationSize(v) > 0).map(v => ({ x: liberationSize(v), label: lang === 'es' ? `${TEXT.xl.es} ${mineralName(v, lang).toLowerCase()}` : `${mineralName(v, lang)} ${TEXT.xl.en}` })), { x: m.target_p80_um, label: TEXT.target[lang] }]}
        onCursor={report(valuable.map(v => mineralName(v, lang)))} />
    ),
    ...(scaled ? {
      scale: (
        <Chart key="scale" title={GRINDING_CHARTS.scale[lang]} data={ascending(size, curves.composite_scale)} logX xLabel={TEXT.size[lang]} yLabel={TEXT.scale[lang]}
          series={[{ label: TEXT.scale[lang], colour: 'warn' }]} summary={TEXT.scaleSummary[lang]} format={fmt} yRange={[0, 1.05]} onCursor={report([TEXT.scale[lang]])} />
      ),
    } : {}),
  };
}

export function GrindingView({ trace, ore, lang, onCursor }: { trace: Trace; ore: Ore; lang: Lang; onCursor: (text: string | null) => void }) {
  const charts = grindingCharts(trace, ore, lang, onCursor);
  const m = trace.metrics;
  return (
    // a fourth chart when the composite scale departs from 1, else the facts, which on a large screen
    // become a strip under the charts (of-grid-strip)
    <div className={`of-view of-grid-2x2${charts.scale ? '' : ' of-grid-strip'}`}>
      {charts.psd}
      {charts.partition}
      {charts.liberation}
      {charts.scale ?? (
        <dl className="of-facts of-grid-facts">
          {['crusher_feed_f80_um', 'crusher_p80_um', 'p80_um', 'circulating_load_pct', 'cyclone_cut_um', 'cyclone_bypass_pct', 'cyclones_required', 'cyclone_pressure_kpa', 'specific_energy_grinding_kwh_t', 'operating_work_index_kwh_t']
            .filter(k => k in m).map(k => <div key={k}><dt>{metricLabel(k, lang)}</dt><dd>{formatWithUnit(m[k], trace.metric_units[k], lang)}</dd></div>)}
        </dl>
      )}
    </div>
  );
}
