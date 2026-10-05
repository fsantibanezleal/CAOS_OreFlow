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
  size_um: number[]; psd: Record<string, number[]>; partition: Record<string, Array<number | null>>;
  liberation: Record<string, number[]>; composite_scale: number[];
};

const STREAMS: Array<{ key: string; en: string; es: string; colour: Series['colour']; dash?: number[] }> = [
  { key: 'new_feed', en: 'Mill new feed', es: 'Alimentación fresca', colour: 'subtle' },
  // U-10: magenta, not accent-2: the teal sat 0.098 from the overflow's blue in OKLab (dark theme)
  { key: 'mill_discharge', en: 'Mill discharge', es: 'Descarga del molino', colour: 'magenta' },
  { key: 'cyclone_underflow', en: 'Cyclone underflow', es: 'Descarga del ciclón', colour: 'warn' },
  { key: 'final_concentrate', en: 'Concentrate', es: 'Concentrado', colour: 'good' },
  { key: 'final_tail', en: 'Tail', es: 'Relave', colour: 'bad', dash: [5, 4] },
  // U-10: last, so the tail, within 0.007 of it at every size, no longer covers it
  { key: 'cyclone_overflow', en: 'Cyclone overflow', es: 'Rebose del ciclón', colour: 'accent' },
];

const TEXT = {
  size: { en: 'Particle size (µm)', es: 'Tamaño de partícula (µm)' },
  passing: { en: 'Cumulative passing', es: 'Pasante acumulado' },
  partition: { en: 'Fraction to underflow', es: 'Fracción a la descarga' },
  liberated: { en: 'Liberated fraction', es: 'Fracción liberada' },
  scale: { en: 'Composite scale', es: 'Escala de mixtos' },
  target: { en: 'target P80', es: 'P80 objetivo' },
  cutSet: { en: 'cut set', es: 'corte fijado' },
  modeTarget: { en: 'Set: the target P80 and the circulating load; the cut and the energy follow', es: 'Fijados: el P80 objetivo y la carga circulante; el corte y la energía resultan' },
  modeCut: { en: 'Set: the classifier cut and the installed power; the P80 and the circulating load follow', es: 'Fijados: el corte del clasificador y la potencia instalada; el P80 y la carga circulante resultan' },
  mode: { en: 'Grind control', es: 'Control de la molienda' },
  achieved: { en: 'P80', es: 'P80' },
  targetMet: { en: 'P80 at target', es: 'P80 en el objetivo' },
  cut: { en: 'cut', es: 'corte' },
  host: { en: 'Host gangue', es: 'Ganga huésped' },
  xl: { en: 'liberation size', es: 'tamaño de liberación de' },
  psdSummary: { en: 'Cumulative size distributions of the grinding circuit streams, with the target and achieved P80.', es: 'Distribuciones granulométricas acumuladas de las corrientes de molienda, con el P80 objetivo y logrado.' },
  partSummary: { en: 'Share of each size class of the cyclone feed that reports to the underflow, for the host gangue and each valuable mineral (liberated grains and composites together, with the bypass), with the host cut.', es: 'Fracción de cada clase de tamaño de la alimentación al ciclón que reporta a la descarga, para la ganga huésped y cada mineral valioso (granos liberados y mixtos juntos, con el cortocircuito), con el corte de la ganga.' },
  libSummary: { en: 'Liberated fraction of each valuable mineral by size, with its liberation size and the target P80.', es: 'Fracción liberada de cada mineral valioso por tamaño, con su tamaño de liberación y el P80 objetivo.' },
  scaleSummary: { en: 'Share of the declared composites the host gangue can supply in each size class (1 everywhere unless a class is valuable-rich).', es: 'Fracción de los mixtos declarados que la ganga huésped puede aportar en cada clase de tamaño (1 salvo en clases ricas en mineral valioso).' },
};

/** The trace lists sizes from coarse to fine; uPlot needs x ascending. */
function ascending(x: number[], ...ys: Array<Array<number | null>>): uPlot.AlignedData {
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
  // CM-07: in the cut mode nothing targets the P80, so only the achieved one is marked, and the cut is the set value
  const cutMode = m.cut_mode === 1;
  // one mark where the achieved P80 meets the target: two at one place drew their labels over each other (0.08 gate)
  const met = Math.abs(m.p80_um / m.target_p80_um - 1) < 0.005;
  const p80Marks = cutMode ? [{ x: m.p80_um, label: `${TEXT.achieved[lang]} ${formatWithUnit(m.p80_um, 'um', lang)}` }]
    : met ? [{ x: m.target_p80_um, label: `${TEXT.targetMet[lang]} ${formatWithUnit(m.target_p80_um, 'um', lang)}` }]
    : [{ x: m.target_p80_um, label: `${TEXT.target[lang]} ${formatWithUnit(m.target_p80_um, 'um', lang)}` }, { x: m.p80_um, label: `${TEXT.achieved[lang]} ${formatWithUnit(m.p80_um, 'um', lang)}` }];
  // minerals that share a liberation size share one mark: bornite takes chalcopyrite's in a GeoMet sample, and two
  // marks at one place named the same line twice
  const bySize = new Map<number, string[]>();
  for (const v of valuable.filter(v => liberationSize(v) > 0)) bySize.set(liberationSize(v), [...(bySize.get(liberationSize(v)) ?? []), v]);
  const liberationMarks = [...bySize.entries()].map(([x, minerals]) => ({ x, label: `${lang === 'es'
    ? `${TEXT.xl.es} ${minerals.map(v => mineralName(v, lang).toLowerCase()).join(' y ')}`
    : `${minerals.map(v => mineralName(v, lang)).join(' and ')} ${TEXT.xl.en}`} ${formatWithUnit(x, 'um', lang)}` }));
  return {
    psd: (
      <Chart key="psd" title={GRINDING_CHARTS.psd[lang]} data={ascending(size, ...present.map(s => curves.psd[s.key]))} logX xLabel={TEXT.size[lang]} yLabel={TEXT.passing[lang]}
        series={present.map(s => ({ label: s[lang], colour: s.colour, ...(s.dash ? { dash: s.dash } : {}) }))} summary={TEXT.psdSummary[lang]} format={fmt} yRange={[0, 1]}
        marks={p80Marks}
        onCursor={report(present.map(s => s[lang]))} />
    ),
    partition: (
      <Chart key="partition" title={GRINDING_CHARTS.partition[lang]} data={ascending(size, ...Object.values(curves.partition))} logX xLabel={TEXT.size[lang]} yLabel={TEXT.partition[lang]}
        series={Object.keys(curves.partition).map((k, i) => ({ label: k === 'host' ? TEXT.host[lang] : mineralName(k, lang), colour: (['accent', 'warn', 'good', 'magenta'] as const)[i % 4] }))}
        summary={TEXT.partSummary[lang]} format={fmt} yRange={[0, 1]}
        marks={[{ x: m.cyclone_cut_um, label: `${cutMode ? TEXT.cutSet[lang] : TEXT.cut[lang]} ${formatWithUnit(m.cyclone_cut_um, 'um', lang)}` }]}
        onCursor={report(Object.keys(curves.partition).map(k => (k === 'host' ? TEXT.host[lang] : mineralName(k, lang))))} />
    ),
    liberation: (
      <Chart key="liberation" title={GRINDING_CHARTS.liberation[lang]} data={ascending(size, ...valuable.map(v => curves.liberation[v]))} logX xLabel={TEXT.size[lang]} yLabel={TEXT.liberated[lang]}
        series={valuable.map((v, i) => ({ label: mineralName(v, lang), colour: (['good', 'accent', 'magenta', 'warn'] as const)[i % 4] }))}
        summary={TEXT.libSummary[lang]} format={fmt} yRange={[0, 1]}
        marks={[...liberationMarks,
          { x: cutMode ? m.p80_um : m.target_p80_um, label: `${cutMode ? TEXT.achieved[lang] : TEXT.target[lang]} ${formatWithUnit(cutMode ? m.p80_um : m.target_p80_um, 'um', lang)}` }]}
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

/** U-11: the facts each engine flag speaks about, so a value outside its window never reads as a plain fact. */
export const FLAGGED_FACTS: Record<string, string[]> = {
  power_limited: ['p80_um', 'mill_power_kw', 'specific_energy_grinding_kwh_t'],
  target_unreachable: ['p80_um'],
  circulating_load_unreachable: ['circulating_load_pct'],
  circulating_load_out_of_range: ['circulating_load_pct', 'cyclone_cut_um'],
  cut_mode_load_not_converged: ['circulating_load_pct'],
};
export const flaggedFacts = (trace: Trace) => new Set(trace.flags.flatMap(f => FLAGGED_FACTS[f.code] ?? []));

export function GrindingView({ trace, ore, lang, onCursor }: { trace: Trace; ore: Ore; lang: Lang; onCursor: (text: string | null) => void }) {
  const charts = grindingCharts(trace, ore, lang, onCursor);
  const m = trace.metrics;
  const flagged = flaggedFacts(trace);
  return (
    // a fourth chart when the composite scale departs from 1, else the facts, which on a large screen
    // become a strip under the charts (of-grid-strip)
    <div className={`of-view of-grid-2x2${charts.scale ? '' : ' of-grid-strip'}`}>
      {charts.psd}
      {charts.partition}
      {charts.liberation}
      {charts.scale ?? (
        <dl className="of-facts of-grid-facts">
          <div className="of-facts-wide"><dt>{TEXT.mode[lang]}</dt><dd>{m.cut_mode === 1 ? TEXT.modeCut[lang] : TEXT.modeTarget[lang]}</dd></div>
          {['crusher_feed_f80_um', 'crusher_p80_um', 'p80_um', 'circulating_load_pct', 'cyclone_cut_um', 'cyclone_bypass_pct', 'cyclones_required', 'cyclone_pressure_kpa', 'specific_energy_grinding_kwh_t', 'operating_work_index_kwh_t']
            .filter(k => k in m).map(k => <div key={k} className={flagged.has(k) ? 'of-fact-warn' : undefined}><dt>{metricLabel(k, lang)}</dt><dd>{formatWithUnit(m[k], trace.metric_units[k], lang)}</dd></div>)}
        </dl>
      )}
    </div>
  );
}
