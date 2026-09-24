import { useMemo, useState, type ReactNode } from 'react';
import { Chart, type Series } from './Charts';
import { alternativeKinetics, simulateLive } from '../live/engine';
import type { Params } from '../lib/contract.types';

const reference: Params = {
  feed_tph: 640, feed_grade_pct: 0.74, feed_p80_um: 14000,
  hardness_kwh_t: 11, density_t_m3: 2.65, grind_p80_um: 150,
  classifier_cut_um: 110, flotation_time_min: 40, air_rate_m3_min: 2.4,
  reagent_gpt: 210, water_m3_t: 2.2,
};

function FigureFrame({ title, note, children }: { title: string; note: string; children: ReactNode }) {
  return <figure className="of-method-figure">
    <div className="of-method-figure-heading"><strong>{title}</strong><span>{note}</span></div>
    {children}
  </figure>;
}

export default function MethodFigure({ name, es }: { name: string; es: boolean }) {
  const [feedP80, setFeedP80] = useState(reference.feed_p80_um);
  const [classifierCut, setClassifierCut] = useState(reference.classifier_cut_um);
  const [collector, setCollector] = useState(reference.reagent_gpt);
  const [candidate, setCandidate] = useState(12);
  const sizes = useMemo(() => Array.from({ length: 46 }, (_, i) => 50 + i * 10), []);

  if (name === 'energy-laws') {
    const laws = (p: number) => [
      0.028 * Math.max(0, 1000000 / p - 1000000 / feedP80),
      1.85 * Math.max(0, Math.log(feedP80 / p)),
      10 * reference.hardness_kwh_t * Math.max(0, 1 / Math.sqrt(p) - 1 / Math.sqrt(feedP80)),
    ];
    const atNominal = laws(150);
    const series: Series[] = [
      { name: 'Rittinger', color: 'var(--color-accent)', values: sizes.map(p => laws(p)[0] / atNominal[0]) },
      { name: 'Kick', color: 'var(--color-accent-2)', values: sizes.map(p => laws(p)[1] / atNominal[1]) },
      { name: 'Bond', color: 'var(--color-warn)', values: sizes.map(p => laws(p)[2] / atNominal[2]) },
    ];
    return <FigureFrame title={es ? 'Sensibilidad al tamaño de producto' : 'Product-size sensitivity'} note={es ? 'Índice = 1 a P80 150 µm' : 'Index = 1 at P80 150 µm'}>
      <Chart title={es ? 'Tres leyes, tres pendientes' : 'Three laws, three slopes'} subtitle={es ? 'Escalas normalizadas; no equivalen a tres mediciones de kWh/t.' : 'Normalized scales; not three comparable kWh/t measurements.'} labels={sizes.map(v => `${v} µm`)} series={series} height={190} format={v => v.toFixed(1)} />
      <label className="of-method-figure-control">{es ? 'P80 de alimentación' : 'Feed P80'} <output>{(feedP80 / 1000).toFixed(0)} mm</output><input type="range" min="5000" max="25000" step="500" value={feedP80} onChange={e => setFeedP80(Number(e.target.value))} /></label>
    </FigureFrame>;
  }

  if (name === 'classification-curve') {
    const trace = simulateLive({ ...reference, classifier_cut_um: classifierCut }, 'method-figure');
    const d50 = trace.metrics.cyclone_d50_um;
    const diameters = Array.from({ length: 61 }, (_, i) => i * 5);
    const series: Series[] = [{ name: es ? 'A finos' : 'To overflow', color: 'var(--color-accent)', values: diameters.map(d => 100 / (1 + Math.exp(Math.min(60, Math.max(-60, (d - d50) / Math.max(d50 * 0.16, 1)))))) }];
    return <FigureFrame title={es ? 'Probabilidad por clase de tamaño' : 'Size-class partition probability'} note={`d50 = ${d50.toFixed(1)} µm`}>
      <Chart title={es ? 'Partición logística' : 'Logistic partition'} subtitle={es ? 'Probabilidad condicional por tamaño; no distribución de masa.' : 'Conditional probability by size; not a mass distribution.'} labels={diameters.map(v => `${v} µm`)} series={series} height={190} format={v => `${v.toFixed(0)}%`} />
      <label className="of-method-figure-control">{es ? 'Corte nominal' : 'Nominal cut'} <output>{classifierCut} µm</output><input type="range" min="40" max="300" step="5" value={classifierCut} onChange={e => setClassifierCut(Number(e.target.value))} /></label>
    </FigureFrame>;
  }

  if (name === 'flotation-kinetics') {
    const params = { ...reference, reagent_gpt: collector };
    const trace = simulateLive(params, 'method-figure');
    const series: Series[] = [
      { name: es ? 'Primer orden' : 'First order', color: 'var(--color-accent)', values: trace.flotation_recovery.map(v => 100 * v) },
      { name: 'Kelsall', color: 'var(--color-accent-2)', values: alternativeKinetics(params, trace.metrics.overflow_fraction, 'kelsall').map(v => 100 * v) },
      { name: es ? 'Exponencial' : 'Compressed exponential', color: 'var(--color-warn)', values: alternativeKinetics(params, trace.metrics.overflow_fraction, 'compressed_exponential').map(v => 100 * v) },
    ];
    return <FigureFrame title={es ? 'Recuperación de circuito frente a tiempo' : 'Circuit recovery versus residence'} note={es ? 'Incluye partición de sólidos' : 'Includes solids partition'}>
      <Chart title={es ? 'Tres hipótesis cinéticas' : 'Three kinetic hypotheses'} subtitle={es ? 'Mismo escenario ilustrativo; sin ajuste a ensayos.' : 'Same illustrative scenario; not fitted to tests.'} labels={trace.flotation_recovery.map((_, i) => `${(40 * i / 95).toFixed(0)} min`)} series={series} height={190} format={v => `${v.toFixed(0)}%`} />
      <label className="of-method-figure-control">{es ? 'Dosis de colector' : 'Collector dose'} <output>{collector} g/t</output><input type="range" min="20" max="500" step="5" value={collector} onChange={e => setCollector(Number(e.target.value))} /></label>
    </FigureFrame>;
  }
  if (name === 'optimization-grid') {
    const grinds = [0.72, 0.86, 1, 1.14, 1.28];
    const reagents = [0.72, 0.9, 1, 1.15, 1.3];
    const points = grinds.flatMap((gf, y) => reagents.map((rf, x) => {
      const grind = reference.grind_p80_um * gf;
      const reagent = reference.reagent_gpt * rf;
      const cut = Math.min(reference.feed_p80_um * 0.7, Math.max(grind * 0.55, reference.classifier_cut_um * (0.84 + 0.22 * gf)));
      const trace = simulateLive({ ...reference, grind_p80_um: grind, classifier_cut_um: cut, reagent_gpt: reagent }, 'method-figure');
      const m = trace.metrics;
      return { x, y, grind, reagent, recovery: m.recovery_pct, grade: m.concentrate_grade_pct, energy: m.specific_energy_kwh_t, score: m.recovery_pct + 0.35 * m.concentrate_grade_pct - 0.18 * m.specific_energy_kwh_t - 0.006 * reagent };
    }));
    const min = Math.min(...points.map(p => p.score));
    const max = Math.max(...points.map(p => p.score));
    const best = points.reduce((winner, p) => p.score > winner.score ? p : winner);
    const focus = points[candidate];
    return <FigureFrame title={es ? 'Búsqueda acotada: 25 candidatos' : 'Bounded search: 25 candidates'} note={es ? 'Simulador · objetivo ponderado' : 'Simulator · weighted objective'}>
      <div className="of-optimum-summary"><strong>{es ? 'Mejor punto' : 'Best point'} {best.score.toFixed(2)}</strong><span>P80 {best.grind.toFixed(0)} µm · {es ? 'colector' : 'collector'} {best.reagent.toFixed(0)} g/t</span></div>
      <div className="of-optimum-grid" role="group" aria-label={es ? 'Matriz de candidatos' : 'Candidate matrix'}>
        {points.map((point, i) => <button key={i} type="button" className={`${i === candidate ? 'active' : ''} ${point === best ? 'best' : ''}`} style={{ background: `color-mix(in srgb, var(--color-accent) ${Math.round(18 + 64 * (point.score - min) / Math.max(max - min, 1e-8))}%, var(--color-surface-2))` }} onClick={() => setCandidate(i)} aria-label={`P80 ${point.grind.toFixed(0)} µm, collector ${point.reagent.toFixed(0)} g/t, score ${point.score.toFixed(2)}`} />)}
      </div>
      <div className="of-optimum-readout"><strong>{es ? 'Candidato' : 'Candidate'} {candidate + 1}/25</strong><span>J {focus.score.toFixed(2)}</span><span>R {focus.recovery.toFixed(1)}%</span><span>G {focus.grade.toFixed(2)}%</span><span>E {focus.energy.toFixed(1)} kWh/t</span></div>
      <p className="of-optimum-boundary">{es ? 'El color representa el objetivo J; no una predicción de beneficio ni un óptimo de planta.' : 'Color encodes objective J, not profit or a plant optimum.'}</p>
    </FigureFrame>;
  }
  return null;
}
