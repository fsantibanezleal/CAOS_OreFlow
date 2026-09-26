/**
 * Benchmark (ADR-0016 section 9.C), the engine's numbers: the published-example oracles, the kinetic
 * lumping errors, the optimizer outcomes, the uncertainty record and the learned lane's protocol
 * results, every one read from the committed benchmark and learning record; the prose states each
 * result with the numbers a test holds equal to those records.
 */
import { useState } from 'react';
import type uPlot from 'uplot';
import { Chart } from '../components/charts/Chart';
import { loadBenchmark, loadContract, loadIndex, loadLearning } from '../lib/artifacts';
import type { Benchmark, CaseIndex } from '../lib/artifacts.types';
import { formatFixed, formatFraction, formatSignificant, formatValue, formatWithUnit, unitLabel, type Lang } from '../lib/format';
import { CATEGORY } from '../lib/i18n';
import { Loaded, useArtifact } from './data';
import { VARIANT_KINDS } from './design';
import type { Bi, Topic } from './doc';

const r = String.raw;
const t = (text: Bi, lang: Lang) => text[lang];

/** Catalog codes (L1, C2, F3, ...) in index order, as the workbench's case selector shows them. */
function codes(index: CaseIndex): Record<string, string> {
  const counts: Record<string, number> = {};
  return Object.fromEntries(index.cases.map(c => {
    counts[c.category] = (counts[c.category] ?? 0) + 1;
    return [c.case_id, `${CATEGORY[c.category]?.code ?? '?'}${counts[c.category]}`];
  }));
}

const MODEL: Record<string, Bi> = {
  first_order: { en: 'First order', es: 'Primer orden' },
  kelsall: { en: 'Kelsall', es: 'Kelsall' },
  klimpel: { en: 'Klimpel', es: 'Klimpel' },
  gamma: { en: 'Gamma', es: 'Gamma' },
  stretched_exponential: { en: 'Stretched exponential', es: 'Exponencial estirada' },
  ridge: { en: 'Ridge', es: 'Ridge' },
  random_forest: { en: 'Random forest', es: 'Bosque aleatorio' },
  hist_gradient_boosting: { en: 'Gradient boosting', es: 'Gradient boosting' },
  gaussian_process: { en: 'Gaussian process', es: 'Proceso gaussiano' },
  mlp: { en: 'MLP', es: 'MLP' },
};
/** Short names for a chart's category axis, where full names would collide. */
const SHORT: Record<string, Bi> = {
  first_order: { en: 'First order', es: 'Primer orden' },
  stretched_exponential: { en: 'Stretched', es: 'Estirada' },
  random_forest: { en: 'Forest', es: 'Bosque' },
  hist_gradient_boosting: { en: 'Boosting', es: 'Boosting' },
  gaussian_process: { en: 'Gauss. process', es: 'Proc. gaussiano' },
};
const short = (id: string, lang: Lang) => (SHORT[id] ?? MODEL[id])[lang];
const TARGET: Record<string, Bi> = {
  recovery_pct: { en: 'Recovery', es: 'Recuperación' },
  log_upgrade: { en: 'Log upgrade ratio', es: 'Log de la razón de enriquecimiento' },
  specific_energy_total_kwh_t: { en: 'Specific energy', es: 'Energía específica' },
};
const INPUT: Record<string, Bi> = {
  floatability: { en: 'floatability', es: 'flotabilidad' },
  liberation_size: { en: 'liberation size', es: 'tamaño de liberación' },
  work_index: { en: 'work index', es: 'índice de trabajo' },
  head_grade: { en: 'head grade', es: 'ley de cabeza' },
};

const TEXT = {
  quantity: { en: 'Quantity', es: 'Magnitud' },
  published: { en: 'Published', es: 'Publicado' },
  engine: { en: 'Engine', es: 'Motor' },
  error: { en: 'Relative error', es: 'Error relativo' },
  tolerance: { en: 'Tolerance', es: 'Tolerancia' },
  within: { en: 'Within', es: 'Dentro' },
  yes: { en: 'yes', es: 'sí' },
  no: { en: 'no', es: 'no' },
  p80: { en: 'Overflow P80 (µm)', es: 'P80 del rebose (µm)' },
  cl: { en: 'Circulating load', es: 'Carga circulante' },
  energy: { en: 'Specific energy (kWh/t)', es: 'Energía específica (kWh/t)' },
  molycopCaption: { en: 'Moly-Cop BallSim_Direct base case with its default breakage parameters, re-solved by the engine.', es: 'Caso base BallSim_Direct de Moly-Cop con sus parámetros de fractura por defecto, resuelto de nuevo por el motor.' },
  example: { en: 'Worked example', es: 'Ejemplo resuelto' },
  reduction: { en: 'Reduction (µm)', es: 'Reducción (µm)' },
  wio: { en: 'Operating work index (kWh/t)', es: 'Índice de trabajo operacional (kWh/t)' },
  difference: { en: 'Difference (kWh/t)', es: 'Diferencia (kWh/t)' },
  gmgCaption: { en: 'The GMG worked examples of the Bond operating work index; tolerance {tol} kWh/t.', es: 'Los ejemplos resueltos de GMG del índice de trabajo operacional de Bond; tolerancia {tol} kWh/t.' },
  grind: { en: 'Grind P80 (µm)', es: 'Molienda P80 (µm)' },
  fePub: { en: 'Concentrate Fe, published (%)', es: 'Fe del concentrado, publicado (%)' },
  feEng: { en: 'Concentrate Fe, engine (%)', es: 'Fe del concentrado, motor (%)' },
  magRec: { en: 'Magnetite recovery, engine (%)', es: 'Recuperación de magnetita, motor (%)' },
  zandCaption: { en: 'Zandrivierspoort magnetite: a finer grind raises the concentrate grade by {pub} points in the published tests and by {eng} in the engine\'s case.', es: 'Magnetita de Zandrivierspoort: una molienda más fina sube la ley del concentrado en {pub} puntos en los ensayos publicados y en {eng} en el caso del motor.' },
  bleed: { en: 'Gravity bleed (% of the underflow)', es: 'Purga gravimétrica (% de la descarga)' },
  recovery: { en: 'Recovery (%)', es: 'Recuperación (%)' },
  pubGold: { en: 'Published plant gold recovery', es: 'Recuperación de oro de la planta publicada' },
  engGravity: { en: 'Engine gravity recovery', es: 'Recuperación gravimétrica del motor' },
  laplanteTitle: { en: 'Gold recovery against the gravity bleed', es: 'Recuperación de oro contra la purga gravimétrica' },
  laplanteSummary: { en: 'The published plant\'s gold recovery and the engine\'s gravity recovery, both rising with the bleed with diminishing returns.', es: 'La recuperación de oro de la planta publicada y la recuperación gravimétrica del motor, ambas subiendo con la purga con rendimientos decrecientes.' },
  cload: { en: 'Circulating load (%)', es: 'Carga circulante (%)' },
  pubGrg: { en: 'Published gravity-recoverable gold', es: 'Oro recuperable por gravedad publicado' },
  engGold: { en: 'Engine gold', es: 'Oro del motor' },
  engOre: { en: 'Engine ore', es: 'Mineral del motor' },
  cloadTitle: { en: 'Circulating loads against the bleed', es: 'Cargas circulantes contra la purga' },
  cloadSummary: { en: 'Gold circulates far above the ore in both the published plant and the engine, and less as the bleed grows.', es: 'El oro circula muy por encima del mineral en la planta publicada y en el motor, y menos a medida que crece la purga.' },
  reading: { en: 'Point at the chart to read it', es: 'Apunte al gráfico para leerlo' },
  model: { en: 'Model', es: 'Modelo' },
  fits: { en: 'Fits', es: 'Ajustes' },
  rmse: { en: 'Mean fit RMSE (points)', es: 'RMSE medio del ajuste (puntos)' },
  meanLump: { en: 'Mean |lumping error| (points)', es: 'Error de agregación medio (puntos)' },
  worstLump: { en: 'Worst |lumping error| (points)', es: 'Peor error de agregación (puntos)' },
  converged: { en: 'Converged', es: 'Convergidos' },
  kineticsTitle: { en: 'Lumping error of each kinetic model', es: 'Error de agregación de cada modelo cinético' },
  kineticsSummary: { en: 'Mean and worst absolute lumping error of the five lumped models over the 66 baked flotation variants.', es: 'Error de agregación absoluto medio y peor de los cinco modelos agrupados sobre las 66 variantes de flotación horneadas.' },
  mean: { en: 'mean', es: 'medio' },
  worst: { en: 'worst', es: 'peor' },
  points: { en: 'points of recovery', es: 'puntos de recuperación' },
  gain: { en: 'Gain in recovered metal (%)', es: 'Ganancia en metal recuperado (%)' },
  baseMet: { en: 'the variant met every constraint', es: 'la variante cumplía cada restricción' },
  baseBroke: { en: 'the variant broke a constraint', es: 'la variante violaba una restricción' },
  optTitle: { en: 'The optimum against each variant, every case', es: 'El óptimo frente a cada variante, cada caso' },
  optSummary: { en: 'The optimizer\'s gain in recovered metal over each variant\'s own state, marked by whether that state met every constraint.', es: 'La ganancia del optimizador en metal recuperado sobre el estado propio de cada variante, marcada según si ese estado cumplía cada restricción.' },
  case: { en: 'Case', es: 'Caso' },
  infeasible: { en: 'infeasible', es: 'infactible' },
  variant: { en: 'Variant', es: 'Variante' },
  gainShort: { en: 'Gain of the optimum', es: 'Ganancia del óptimo' },
  ownCaption: { en: 'The optimum against the families\' own levers, with the same marks.', es: 'El óptimo frente a las palancas propias de las familias, con las mismas marcas.' },
  optCaption: { en: 'The gain of the optimum over each variant, and the constraints active at it: {codes}; * the variant\'s own state broke a constraint.', es: 'La ganancia del óptimo sobre cada variante, y las restricciones activas en él: {codes}; * el estado propio de la variante violaba una restricción.' },
  activeCodes: { en: 'P power, G grade, W water', es: 'P potencia, L ley, A agua' },
  p05: { en: 'P05', es: 'P05' },
  p50: { en: 'P50', es: 'P50' },
  p95: { en: 'P95', es: 'P95' },
  uncTitle: { en: 'Recovery quantiles under ore uncertainty', es: 'Cuantiles de recuperación bajo incertidumbre del mineral' },
  uncSummary: { en: 'The P05, P50 and P95 of recovery for every case, from 128 draws of the ore properties at the nominal operating point.', es: 'P05, P50 y P95 de la recuperación de cada caso, desde 128 sorteos de las propiedades del mineral en el punto nominal de operación.' },
  recShort: { en: 'Recovery P05 / P50 / P95 (%)', es: 'Recuperación P05 / P50 / P95 (%)' },
  gradeShort: { en: 'Grade P05 / P50 / P95', es: 'Ley P05 / P50 / P95' },
  probGrade: { en: 'P(grade)', es: 'P(ley)' },
  probPower: { en: 'P(power)', es: 'P(potencia)' },
  probWater: { en: 'P(water)', es: 'P(agua)' },
  probAll: { en: 'P(all)', es: 'P(todas)' },
  domRec: { en: 'Drives recovery', es: 'Domina la recuperación' },
  domGrade: { en: 'Drives grade', es: 'Domina la ley' },
  uncCaption: { en: 'The uncertainty record of every nominal state: quantiles, the probability of meeting each constraint and all of them, and the ore input with the largest total Sobol index.', es: 'El registro de incertidumbre de cada estado nominal: cuantiles, la probabilidad de cumplir cada restricción y todas, y la entrada del mineral con el mayor índice total de Sobol.' },
  target: { en: 'Target', es: 'Objetivo' },
  interp: { en: 'interpolation R²', es: 'R² de interpolación' },
  loco: { en: 'leave-one-case-out median R²', es: 'R² mediano dejando un caso fuera' },
  locoRmse: { en: 'Leave-one-case-out mean RMSE', es: 'RMSE medio dejando un caso fuera' },
  learnTitle: { en: 'Interpolation against transfer', es: 'Interpolación frente a transferencia' },
  learnSummary: { en: 'The interpolation R² and the median leave-one-case-out R² of the five models for the chosen target.', es: 'El R² de interpolación y el R² mediano dejando un caso fuera de los cinco modelos para el objetivo elegido.' },
  learnCaption: { en: 'The two protocols of the learned lane for every model and target, from the learning record; the Gaussian process\'s 95% intervals cover {cov} of the held-out states.', es: 'Los dos protocolos de la vía aprendida para cada modelo y objetivo, desde el registro de aprendizaje; los intervalos del 95% del proceso gaussiano cubren {cov} de los estados reservados.' },
  heldOut: { en: 'Held-out case', es: 'Caso reservado' },
  flagRate: { en: 'Guard flags', es: 'Marcas del guardia' },
  foldCaption: { en: 'Each leave-one-case-out fold: the share of the held-out plant\'s states the guard flags, and each model\'s recovery R² on that plant.', es: 'Cada partición dejando un caso fuera: la fracción de estados de la planta reservada que marca el guardia, y el R² de recuperación de cada modelo en esa planta.' },
};

const fill = (template: string, values: Record<string, string>) => template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? key);
const signed = (value: number, lang: Lang, decimals: number) => `${value > 0 ? '+' : ''}${formatFixed(value, lang, decimals)}`;

function Reading({ text, lang }: { text: string | null; lang: Lang }) {
  return <p className="of-doc-reading" aria-live="polite">{text ?? TEXT.reading[lang]}</p>;
}

type Oracles = {
  molycop: { published: Record<string, number>; engine: Record<string, number>; relative_error: Record<string, number>; tolerance: Record<string, number>; within_tolerance: boolean };
  gmg: { examples: Array<Record<string, number>>; tolerance_abs_kwh_t: number; within_tolerance: boolean };
  laplante: { published: { bleed: number[]; gold_recovery_pct: number[]; grg_circulating_load_pct: number[] }; engine: { bleed: number[]; gravity_recovery_pct: number[]; gold_circulating_load_pct: number[]; ore_circulating_load_pct: number[] } };
  zandrivierspoort: { published: { grind_p80_um: number[]; concentrate_fe_pct: number[] }; engine: { grind_p80_um: number[]; concentrate_fe_pct: number[]; magnetite_recovery_pct: number[] }; grade_difference_pct_points: { engine: number; published: number } };
};
const oracles = (b: Benchmark) => b.oracles as unknown as Oracles;

function LaplanteChart({ lang }: { lang: Lang }) {
  const benchmark = useArtifact(loadBenchmark);
  const [reading, setReading] = useState<string | null>(null);
  return (
    <Loaded lang={lang} errors={[benchmark.error]} ready={Boolean(benchmark.value)}>
      {() => {
        const l = oracles(benchmark.value!).laplante;
        const x = l.published.bleed.map(v => 100 * v); // not-engine: a fraction shown in percent
        return (
          <div className="of-doc-panel">
            <div className="of-doc-chart of-doc-chart-narrow">
              <Chart data={[x, l.published.gold_recovery_pct, l.engine.gravity_recovery_pct] as uPlot.AlignedData}
                xLabel={TEXT.bleed[lang]} yLabel={TEXT.recovery[lang]} title={TEXT.laplanteTitle[lang]} summary={TEXT.laplanteSummary[lang]}
                series={[{ label: TEXT.pubGold[lang], colour: 'subtle', points: true }, { label: TEXT.engGravity[lang], colour: 'accent', points: true }]}
                format={(v, axis) => (v === null ? '-' : axis === 'x' ? `${formatFixed(v, lang, 0)}%` : `${formatFixed(v, lang, 1)}%`)}
                onCursor={c => setReading(c ? `${formatFixed(c.x, lang, 0)}%: ${TEXT.pubGold[lang]} ${formatFixed(c.values[0], lang, 1)}%, ${TEXT.engGravity[lang]} ${formatFixed(c.values[1], lang, 1)}%` : null)} />
            </div>
            <Reading text={reading} lang={lang} />
          </div>
        );
      }}
    </Loaded>
  );
}

function OracleTables({ lang }: { lang: Lang }) {
  const benchmark = useArtifact(loadBenchmark);
  const [reading, setReading] = useState<string | null>(null);
  return (
    <Loaded lang={lang} errors={[benchmark.error]} ready={Boolean(benchmark.value)}>
      {() => {
        const o = oracles(benchmark.value!);
        const m = o.molycop;
        const rows: Array<[Bi, string, (v: number) => string]> = [
          [TEXT.p80, 'p80_um', v => formatFixed(v, lang, 1)],
          [TEXT.cl, 'circulating_load', v => formatFraction(v, lang, 0)],
          [TEXT.energy, 'gross_specific_energy_kwh_t', v => formatFixed(v, lang, 2)],
        ];
        const z = o.zandrivierspoort;
        const l = o.laplante;
        const x = l.engine.bleed.map(v => 100 * v); // not-engine: a fraction shown in percent
        return (
          <div className="of-doc-panel">
            <table className="of-doc-table of-doc-table-data">
              <caption>{TEXT.molycopCaption[lang]}</caption>
              <thead><tr>{[TEXT.quantity, TEXT.published, TEXT.engine, TEXT.error, TEXT.tolerance, TEXT.within].map(h => <th scope="col" key={h.en}>{h[lang]}</th>)}</tr></thead>
              <tbody>{rows.map(([label, key, show]) => (
                <tr key={key}>
                  <th scope="row">{label[lang]}</th>
                  <td>{show(m.published[key])}</td>
                  <td>{show(m.engine[key])}</td>
                  <td>{Math.abs(m.relative_error[key]) < 1e-9 ? '< 1e-9' : `${formatSignificant(100 * m.relative_error[key], lang, 2)}%`}</td>
                  <td>{formatFraction(m.tolerance[key], lang, 1)}</td>
                  <td>{Math.abs(m.relative_error[key]) <= m.tolerance[key] ? TEXT.yes[lang] : TEXT.no[lang]}</td>
                </tr>
              ))}</tbody>
            </table>
            <table className="of-doc-table of-doc-table-data">
              <caption>{fill(TEXT.gmgCaption[lang], { tol: formatFixed(o.gmg.tolerance_abs_kwh_t, lang, 2) })}</caption>
              <thead><tr>{[TEXT.example, TEXT.reduction, TEXT.energy, TEXT.published, TEXT.engine, TEXT.difference].map(h => <th scope="col" key={h.en}>{h[lang]}</th>)}</tr></thead>
              <tbody>{o.gmg.examples.map((e, i) => (
                <tr key={i}>
                  <th scope="row">{i + 1}</th>
                  <td>{`${formatFixed(e.f80_um, lang, 0)} - ${formatFixed(e.p80_um, lang, 0)}`}</td>
                  <td>{formatFixed(e.specific_energy_kwh_t, lang, 2)}</td>
                  <td>{formatFixed(e.operating_work_index_kwh_t, lang, 1)}</td>
                  <td>{formatFixed(e.engine_operating_work_index_kwh_t, lang, 2)}</td>
                  <td>{signed(e.error_kwh_t, lang, 3)}</td>
                </tr>
              ))}</tbody>
            </table>
            <table className="of-doc-table of-doc-table-data">
              <caption>{fill(TEXT.zandCaption[lang], { pub: formatFixed(z.grade_difference_pct_points.published, lang, 1), eng: formatFixed(z.grade_difference_pct_points.engine, lang, 1) })}</caption>
              <thead><tr>{[TEXT.grind, TEXT.fePub, TEXT.feEng, TEXT.magRec].map(h => <th scope="col" key={h.en}>{h[lang]}</th>)}</tr></thead>
              <tbody>{z.published.grind_p80_um.map((g, i) => (
                <tr key={g}>
                  <th scope="row">{formatFixed(g, lang, 0)}</th>
                  <td>{formatFixed(z.published.concentrate_fe_pct[i], lang, 1)}</td>
                  <td>{formatFixed(z.engine.concentrate_fe_pct[i], lang, 1)}</td>
                  <td>{formatFixed(z.engine.magnetite_recovery_pct[i], lang, 1)}</td>
                </tr>
              ))}</tbody>
            </table>
            <div className="of-doc-chart">
              <Chart data={[x, l.published.grg_circulating_load_pct, l.engine.gold_circulating_load_pct, l.engine.ore_circulating_load_pct] as uPlot.AlignedData}
                xLabel={TEXT.bleed[lang]} yLabel={TEXT.cload[lang]} title={TEXT.cloadTitle[lang]} summary={TEXT.cloadSummary[lang]}
                series={[{ label: TEXT.pubGrg[lang], colour: 'subtle', points: true }, { label: TEXT.engGold[lang], colour: 'warn', points: true }, { label: TEXT.engOre[lang], colour: 'accent', dash: [5, 4] }]}
                format={(v, axis) => (v === null ? '-' : `${formatFixed(v, lang, 0)}%`)}
                onCursor={c => setReading(c ? `${formatFixed(c.x, lang, 0)}%: ${TEXT.pubGrg[lang]} ${formatFixed(c.values[0], lang, 0)}%, ${TEXT.engGold[lang]} ${formatFixed(c.values[1], lang, 0)}%, ${TEXT.engOre[lang]} ${formatFixed(c.values[2], lang, 0)}%` : null)} />
            </div>
            <Reading text={reading} lang={lang} />
          </div>
        );
      }}
    </Loaded>
  );
}

const KINETIC_MODELS = ['first_order', 'kelsall', 'klimpel', 'gamma', 'stretched_exponential'];

function KineticsChart({ lang }: { lang: Lang }) {
  const benchmark = useArtifact(loadBenchmark);
  const [reading, setReading] = useState<string | null>(null);
  return (
    <Loaded lang={lang} errors={[benchmark.error]} ready={Boolean(benchmark.value)}>
      {() => {
        const k = benchmark.value!.kinetics;
        const mean = KINETIC_MODELS.map(id => k[id].mean_abs_lumping_error_pct), worst = KINETIC_MODELS.map(id => k[id].worst_abs_lumping_error_pct);
        return (
          <div className="of-doc-panel">
            <div className="of-doc-chart of-doc-chart-narrow">
              <Chart data={[KINETIC_MODELS.map((_, i) => i), mean, worst] as uPlot.AlignedData} categories={KINETIC_MODELS.map(id => short(id, lang))}
                xLabel={TEXT.model[lang]} yLabel={TEXT.points[lang]} title={TEXT.kineticsTitle[lang]} summary={TEXT.kineticsSummary[lang]}
                series={[{ label: TEXT.mean[lang], colour: 'accent', bars: true, align: -1 }, { label: TEXT.worst[lang], colour: 'warn', bars: true, align: 1 }]}
                format={(v, axis) => (axis === 'x' ? '' : formatFixed(v, lang, 2))}
                onCursor={c => setReading(c ? `${t(MODEL[KINETIC_MODELS[c.index]], lang)}: ${TEXT.mean[lang]} ${formatFixed(mean[c.index], lang, 2)}, ${TEXT.worst[lang]} ${formatFixed(worst[c.index], lang, 2)}` : null)} />
            </div>
            <Reading text={reading} lang={lang} />
          </div>
        );
      }}
    </Loaded>
  );
}

function KineticsTable({ lang }: { lang: Lang }) {
  const benchmark = useArtifact(loadBenchmark);
  return (
    <Loaded lang={lang} errors={[benchmark.error]} ready={Boolean(benchmark.value)}>
      {() => (
        <table className="of-doc-table of-doc-table-data">
          <thead><tr>{[TEXT.model, TEXT.fits, TEXT.rmse, TEXT.meanLump, TEXT.worstLump, TEXT.converged].map(h => <th scope="col" key={h.en}>{h[lang]}</th>)}</tr></thead>
          <tbody>{KINETIC_MODELS.map(id => {
            const k = benchmark.value!.kinetics[id];
            return (
              <tr key={id}>
                <th scope="row">{t(MODEL[id], lang)}</th>
                <td>{k.fits}</td>
                <td>{formatFixed(k.mean_rmse_pct, lang, 3)}</td>
                <td>{formatFixed(k.mean_abs_lumping_error_pct, lang, 2)}</td>
                <td>{formatFixed(k.worst_abs_lumping_error_pct, lang, 2)}</td>
                <td>{formatFraction(k.converged_share, lang, 0)}</td>
              </tr>
            );
          })}</tbody>
        </table>
      )}
    </Loaded>
  );
}

const ACTIVE: Record<string, Bi> = { power: { en: 'P', es: 'P' }, grade: { en: 'G', es: 'L' }, water: { en: 'W', es: 'A' } };

function OptimizerChart({ lang }: { lang: Lang }) {
  const index = useArtifact(loadIndex);
  const benchmark = useArtifact(loadBenchmark);
  const [reading, setReading] = useState<string | null>(null);
  return (
    <Loaded lang={lang} errors={[index.error, benchmark.error]} ready={Boolean(index.value && benchmark.value)}>
      {() => {
        const bench = benchmark.value!, code = codes(index.value!);
        const title = (id: string) => index.value!.cases.find(c => c.case_id === id)?.title[lang] ?? id;
        const kinds = VARIANT_KINDS.filter(k => bench.cases.some(c => c.variants[k.id])).map(k => k.id);
        const all = ['nominal', ...kinds];
        const cases = bench.cases.map(c => c.case_id);
        // one point per variant, spread across its case's tick; feasible and infeasible bases as two series
        const points = cases.flatMap((id, k) => all.filter(v => bench.optimization[id][v]).map((v, j, list) => ({ id, v, x: k - 0.3 + (0.6 * j) / Math.max(1, list.length - 1), rec: bench.optimization[id][v] })))
          .filter(p => p.rec.gain_pct !== null).sort((a, b) => a.x - b.x);
        const met = points.map(p => (p.rec.base_feasible ? p.rec.gain_pct : null)), broke = points.map(p => (p.rec.base_feasible ? null : p.rec.gain_pct));
        const label = (v: string) => (v === 'nominal' ? 'nominal' : VARIANT_KINDS.find(k => k.id === v)?.label[lang] ?? v);
        return (
          <div className="of-doc-panel">
            <div className="of-doc-chart">
              <Chart data={[points.map(p => p.x), met, broke] as uPlot.AlignedData} categories={cases.map(id => code[id])}
                xLabel={TEXT.case[lang]} yLabel={TEXT.gain[lang]} title={TEXT.optTitle[lang]} summary={TEXT.optSummary[lang]}
                series={[{ label: TEXT.baseMet[lang], colour: 'accent', points: true }, { label: TEXT.baseBroke[lang], colour: 'warn', points: true }]}
                levels={[{ y: 0, label: '0' }]} format={(v, axis) => (axis === 'x' ? '' : v === null ? '-' : `${signed(v, lang, 2)}%`)}
                onCursor={c => setReading(c ? `${title(points[c.index].id)}, ${label(points[c.index].v)}: ${signed(points[c.index].rec.gain_pct as number, lang, 2)}%` : null)} />
            </div>
            <Reading text={reading} lang={lang} />
          </div>
        );
      }}
    </Loaded>
  );
}

function OptimizerTable({ lang }: { lang: Lang }) {
  const index = useArtifact(loadIndex);
  const benchmark = useArtifact(loadBenchmark);
  return (
    <Loaded lang={lang} errors={[index.error, benchmark.error]} ready={Boolean(index.value && benchmark.value)}>
      {() => {
        const bench = benchmark.value!, code = codes(index.value!);
        const title = (id: string) => index.value!.cases.find(c => c.case_id === id)?.title[lang] ?? id;
        const label = (v: string) => (v === 'nominal' ? 'nominal' : VARIANT_KINDS.find(k => k.id === v)?.label[lang] ?? v);
        const cases = bench.cases.map(c => c.case_id);
        // the nominal and the five common variants in one table; the families' own levers in a second
        const common = ['nominal', ...VARIANT_KINDS.slice(0, 5).map(k => k.id)];
        const own = VARIANT_KINDS.slice(5).flatMap(k => cases.filter(id => bench.optimization[id][k.id]).map(id => ({ id, v: k.id })));
        const cell = (id: string, v: string) => {
          const rec = bench.optimization[id][v];
          if (!rec) return <td key={v}>-</td>;
          if (rec.gain_pct === null) return <td key={v}>{TEXT.infeasible[lang]}</td>;
          const active = rec.active.map(a => ACTIVE[a]?.[lang] ?? a).join(', ');
          return <td key={v} className={rec.gain_pct < 0 ? 'of-down' : undefined}>{`${signed(rec.gain_pct, lang, 2)}%${active ? ` [${active}]` : ''}${rec.base_feasible ? '' : ' *'}`}</td>;
        };
        return (
          <div className="of-doc-panel">
            <div className="of-doc-scroll">
              <table className="of-doc-table of-doc-table-data">
                <caption>{fill(TEXT.optCaption[lang], { codes: TEXT.activeCodes[lang] })}</caption>
                <thead><tr><th scope="col">{TEXT.case[lang]}</th>{common.map(v => <th scope="col" key={v}>{label(v)}</th>)}</tr></thead>
                <tbody>{cases.map(id => <tr key={id}><th scope="row">{`${code[id]} ${title(id)}`}</th>{common.map(v => cell(id, v))}</tr>)}</tbody>
              </table>
            </div>
            <table className="of-doc-table of-doc-table-data">
              <caption>{TEXT.ownCaption[lang]}</caption>
              <thead><tr>{[TEXT.case, TEXT.variant, TEXT.gainShort].map(h => <th scope="col" key={h.en}>{h[lang]}</th>)}</tr></thead>
              <tbody>{own.map(({ id, v }) => <tr key={`${id}-${v}`}><th scope="row">{`${code[id]} ${title(id)}`}</th><td>{label(v)}</td>{cell(id, v)}</tr>)}</tbody>
            </table>
          </div>
        );
      }}
    </Loaded>
  );
}

function UncertaintyChart({ lang }: { lang: Lang }) {
  const index = useArtifact(loadIndex);
  const benchmark = useArtifact(loadBenchmark);
  const [reading, setReading] = useState<string | null>(null);
  return (
    <Loaded lang={lang} errors={[index.error, benchmark.error]} ready={Boolean(index.value && benchmark.value)}>
      {() => {
        const code = codes(index.value!), u = benchmark.value!.uncertainty;
        const cases = benchmark.value!.cases.map(c => c.case_id);
        const q = (key: string) => cases.map(id => u[id].recovery_pct[key]);
        return (
          <div className="of-doc-panel">
            <div className="of-doc-chart of-doc-chart-narrow">
              <Chart data={[cases.map((_, i) => i), q('p05'), q('p50'), q('p95')] as uPlot.AlignedData} categories={cases.map(id => code[id])}
                xLabel={TEXT.case[lang]} yLabel={TEXT.recovery[lang]} title={TEXT.uncTitle[lang]} summary={TEXT.uncSummary[lang]}
                series={[{ label: 'P05', colour: 'warn', points: true }, { label: 'P50', colour: 'accent', points: true }, { label: 'P95', colour: 'good', points: true }]}
                format={(v, axis) => (axis === 'x' ? '' : `${formatFixed(v, lang, 1)}%`)}
                onCursor={c => setReading(c ? `${index.value!.cases.find(e => e.case_id === cases[c.index])?.title[lang]}: P05 ${formatFixed(c.values[0], lang, 1)}%, P50 ${formatFixed(c.values[1], lang, 1)}%, P95 ${formatFixed(c.values[2], lang, 1)}%` : null)} />
            </div>
            <Reading text={reading} lang={lang} />
          </div>
        );
      }}
    </Loaded>
  );
}

function UncertaintyTable({ lang }: { lang: Lang }) {
  const index = useArtifact(loadIndex);
  const contract = useArtifact(loadContract);
  const benchmark = useArtifact(loadBenchmark);
  return (
    <Loaded lang={lang} errors={[index.error, contract.error, benchmark.error]} ready={Boolean(index.value && contract.value && benchmark.value)}>
      {() => {
        const u = benchmark.value!.uncertainty;
        const three = (q: Record<string, number>, unit: string) => ['p05', 'p50', 'p95'].map(k => formatValue(q[k], unit, lang)).join(' / ');
        return (
          <div className="of-doc-scroll">
            <table className="of-doc-table of-doc-table-data">
              <caption>{TEXT.uncCaption[lang]}</caption>
              <thead><tr>{[TEXT.case, TEXT.recShort, TEXT.gradeShort, TEXT.probGrade, TEXT.probPower, TEXT.probWater, TEXT.probAll, TEXT.domRec, TEXT.domGrade].map(h => <th scope="col" key={h.en}>{h[lang]}</th>)}</tr></thead>
              <tbody>{benchmark.value!.cases.map(c => {
                const r0 = u[c.case_id], unit = contract.value!.cases[c.case_id].primary.unit;
                return (
                  <tr key={c.case_id}>
                    <th scope="row">{index.value!.cases.find(e => e.case_id === c.case_id)?.title[lang]}</th>
                    <td>{three(r0.recovery_pct, '%')}</td>
                    <td>{`${three(r0.concentrate_grade, unit)} ${unitLabel(unit)}`}</td>
                    {['grade_meets_spec', 'power_within_installed', 'water_within_capacity', 'all_constraints'].map(k => <td key={k}>{formatFraction(r0.probabilities[k], lang, 0)}</td>)}
                    <td>{INPUT[r0.dominant_input.recovery_pct]?.[lang] ?? r0.dominant_input.recovery_pct}</td>
                    <td>{INPUT[r0.dominant_input.concentrate_grade]?.[lang] ?? r0.dominant_input.concentrate_grade}</td>
                  </tr>
                );
              })}</tbody>
            </table>
          </div>
        );
      }}
    </Loaded>
  );
}

const LEARN_MODELS = ['ridge', 'random_forest', 'hist_gradient_boosting', 'gaussian_process', 'mlp'];
const TARGETS = ['recovery_pct', 'log_upgrade', 'specific_energy_total_kwh_t'];

function LearnedChart({ lang }: { lang: Lang }) {
  const learning = useArtifact(loadLearning);
  const [target, setTarget] = useState('recovery_pct');
  const [reading, setReading] = useState<string | null>(null);
  return (
    <Loaded lang={lang} errors={[learning.error]} ready={Boolean(learning.value)}>
      {() => {
        const s = learning.value!.summary;
        const interp = LEARN_MODELS.map(m => s[m][target].interpolation_r2), loco = LEARN_MODELS.map(m => s[m][target].loco_r2_median);
        return (
          <div className="of-doc-panel">
            <label className="of-doc-control"><span>{TEXT.target[lang]}</span>
              <select value={target} onChange={e => setTarget(e.target.value)}>{TARGETS.map(id => <option key={id} value={id}>{t(TARGET[id], lang)}</option>)}</select></label>
            <div className="of-doc-chart of-doc-chart-narrow">
              <Chart data={[LEARN_MODELS.map((_, i) => i), interp, loco] as uPlot.AlignedData} categories={LEARN_MODELS.map(m => short(m, lang))}
                xLabel={TEXT.model[lang]} yLabel="R²" title={TEXT.learnTitle[lang]} summary={TEXT.learnSummary[lang]}
                series={[{ label: TEXT.interp[lang], colour: 'accent', bars: true, align: -1 }, { label: TEXT.loco[lang], colour: 'warn', bars: true, align: 1 }]}
                levels={[{ y: 0, label: '0' }]} format={(v, axis) => (axis === 'x' ? '' : formatFixed(v, lang, 3))}
                onCursor={c => setReading(c ? `${t(MODEL[LEARN_MODELS[c.index]], lang)}: ${TEXT.interp[lang]} ${formatFixed(interp[c.index], lang, 3)}, ${TEXT.loco[lang]} ${formatFixed(loco[c.index], lang, 3)}` : null)} />
            </div>
            <Reading text={reading} lang={lang} />
          </div>
        );
      }}
    </Loaded>
  );
}

function LearnedTables({ lang }: { lang: Lang }) {
  const index = useArtifact(loadIndex);
  const learning = useArtifact(loadLearning);
  return (
    <Loaded lang={lang} errors={[index.error, learning.error]} ready={Boolean(index.value && learning.value)}>
      {() => {
        const l = learning.value!;
        const gp = l.interpolation.models.gaussian_process as Record<string, Record<string, number>>;
        const coverage = TARGETS.map(id => formatFraction(gp[id].coverage_95, lang, 1)).join(', ');
        return (
          <div className="of-doc-panel">
            <div className="of-doc-scroll">
              <table className="of-doc-table of-doc-table-data">
                <caption>{fill(TEXT.learnCaption[lang], { cov: coverage })}</caption>
                <thead>
                  <tr><th scope="col" rowSpan={2}>{TEXT.model[lang]}</th>{TARGETS.map(id => <th scope="colgroup" colSpan={3} key={id}>{t(TARGET[id], lang)}</th>)}</tr>
                  <tr>{TARGETS.flatMap(id => [<th scope="col" key={`${id}-i`}>{TEXT.interp[lang]}</th>, <th scope="col" key={`${id}-l`}>{TEXT.loco[lang]}</th>, <th scope="col" key={`${id}-r`}>{TEXT.locoRmse[lang]}</th>])}</tr>
                </thead>
                <tbody>{LEARN_MODELS.map(m => (
                  <tr key={m}>
                    <th scope="row">{t(MODEL[m], lang)}</th>
                    {TARGETS.flatMap(id => {
                      const v = l.summary[m][id];
                      return [<td key={`${id}-i`}>{formatFixed(v.interpolation_r2, lang, 3)}</td>, <td key={`${id}-l`} className={v.loco_r2_median < 0 ? 'of-down' : undefined}>{formatFixed(v.loco_r2_median, lang, 3)}</td>, <td key={`${id}-r`}>{formatSignificant(v.loco_rmse_mean, lang, 3)}</td>];
                    })}
                  </tr>
                ))}</tbody>
              </table>
            </div>
            <div className="of-doc-scroll">
              <table className="of-doc-table of-doc-table-data">
                <caption>{TEXT.foldCaption[lang]}</caption>
                <thead><tr>{[TEXT.heldOut, TEXT.flagRate].map(h => <th scope="col" key={h.en}>{h[lang]}</th>)}{LEARN_MODELS.map(m => <th scope="col" key={m}>{t(MODEL[m], lang)}</th>)}</tr></thead>
                <tbody>{l.leave_one_case_out.map(f => (
                  <tr key={f.held_out}>
                    <th scope="row">{index.value!.cases.find(c => c.case_id === f.held_out)?.title[lang] ?? f.held_out}</th>
                    <td>{formatFraction(f.held_out_flag_rate, lang, 0)}</td>
                    {LEARN_MODELS.map(m => {
                      const v = f.models[m].recovery_pct.r2;
                      return <td key={m} className={v < 0 ? 'of-down' : undefined}>{formatSignificant(v, lang, 3)}</td>;
                    })}
                  </tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        );
      }}
    </Loaded>
  );
}

const ORACLES: Topic = {
  id: 'oracles',
  title: { en: 'Published examples the engine reproduces', es: 'Ejemplos publicados que reproduce el motor' },
  paragraphs: [
    { en: 'No open plant campaign joins operating states with measured metallurgy, so the engine is checked against published examples, each labelled as a published example and not as plant data. The Moly-Cop BallSim base case is re-solved with its default breakage parameters: the closed-circuit solver meets the published overflow P80 and circulating load to round-off, and its specific energy is 9.13 kWh/t against the published 8.56, 6.7% above it and inside the 20% tolerance the requirement sets. The difference is expected: the example\'s feed shape and cyclone geometry are not stated, and it uses a different cut model.',
      es: 'Ninguna campaña de planta abierta une estados de operación con metalurgia medida, así que el motor se contrasta con ejemplos publicados, cada uno rotulado como ejemplo publicado y no como datos de planta. El caso base BallSim de Moly-Cop se resuelve de nuevo con sus parámetros de fractura por defecto: el solucionador de circuito cerrado cumple el P80 del rebose y la carga circulante publicados al redondeo, y su energía específica es 9,13 kWh/t frente a 8,56 publicados, 6,7% sobre ellos y dentro de la tolerancia de 20% que fija el requisito. La diferencia es esperable: la forma de la alimentación y la geometría del ciclón del ejemplo no se indican, y usa otro modelo de corte.' },
    { en: 'The GMG guideline\'s two worked examples of the Bond operating work index are reproduced within 0.03 kWh/t (14.38 against 14.4 and 11.71 against 11.7), inside the 0.05 kWh/t tolerance.',
      es: 'Los dos ejemplos resueltos de la guía GMG del índice de trabajo operacional de Bond se reproducen dentro de 0,03 kWh/t (14,38 frente a 14,4 y 11,71 frente a 11,7), dentro de la tolerancia de 0,05 kWh/t.' },
    { en: 'Two oracles are trends, because the published plant is not the engine\'s case. In the Laplante and Staunton gravity example, treating 10 to 60% of the underflow raises the plant\'s gold recovery from 64.1 to 77.1% with diminishing returns; in the engine\'s gold case the gravity recovery rises from 13.7 to 31.7% over the same bleeds, also with diminishing returns, and gold circulates at 555 to 271% against the ore\'s 250%, falling as the bleed grows, as the published gravity-recoverable gold does (2016 to 413%).',
      es: 'Dos oráculos son tendencias, porque la planta publicada no es el caso del motor. En el ejemplo gravimétrico de Laplante y Staunton, tratar de 10 a 60% de la descarga sube la recuperación de oro de la planta de 64,1 a 77,1% con rendimientos decrecientes; en el caso de oro del motor la recuperación gravimétrica sube de 13,7 a 31,7% sobre las mismas purgas, también con rendimientos decrecientes, y el oro circula entre 555 y 271% frente al 250% del mineral, bajando a medida que crece la purga, como el oro recuperable por gravedad publicado (2016 a 413%).' },
    { en: 'At Zandrivierspoort a grind from 75 to 45 µm raised the magnetite concentrate from 64.9 to 69.0% Fe; the engine\'s magnetite case, a different ore, rises from 63.8 to 67.8%, a difference of 4.0 points against the published 4.1. Its magnetite recovery, 94.9 and 93.5% over the rougher and cleaner drums, is not comparable with the published rougher recovery above 98%.',
      es: 'En Zandrivierspoort una molienda de 75 a 45 µm subió el concentrado de magnetita de 64,9 a 69,0% Fe; el caso de magnetita del motor, un mineral distinto, sube de 63,8 a 67,8%, una diferencia de 4,0 puntos frente a los 4,1 publicados. Su recuperación de magnetita, 94,9 y 93,5% sobre los tambores rougher y cleaner, no es comparable con la recuperación rougher publicada sobre 98%.' },
  ],
  equations: [
    { tex: r`\epsilon = \frac{y_{E} - y_{P}}{y_{P}}`, caption: { en: 'The relative error of an engine result y_E against the published value y_P.', es: 'El error relativo de un resultado del motor y_E frente al valor publicado y_P.' } },
    { tex: r`R(b_{k+1}) > R(b_k),\qquad R(b_{k+1}) - R(b_k) < R(b_k) - R(b_{k-1})`, caption: { en: 'The trend oracle of the gravity bleed b: recovery rises with the bleed, with diminishing returns.', es: 'El oráculo de tendencia de la purga gravimétrica b: la recuperación sube con la purga, con rendimientos decrecientes.' } },
  ],
  limits: [
    { en: 'Published examples test that the engine reproduces documented behaviour; they are not measurements of the authored plants.', es: 'Los ejemplos publicados prueban que el motor reproduce comportamientos documentados; no son mediciones de las plantas de autor.' },
    { en: 'The trend oracles check directions and proportions, not levels, because their plants are not the engine\'s cases.', es: 'Los oráculos de tendencia verifican direcciones y proporciones, no niveles, porque sus plantas no son los casos del motor.' },
  ],
  figure: { caption: { en: 'The published plant\'s gold recovery and the engine\'s gravity recovery against the bleed: different levels, the same diminishing trend.', es: 'La recuperación de oro de la planta publicada y la recuperación gravimétrica del motor contra la purga: niveles distintos, la misma tendencia decreciente.' }, render: lang => <LaplanteChart lang={lang} /> },
  data: lang => <OracleTables lang={lang} />,
  refs: ['molycop', 'gmg2021', 'laplante-staunton', 'laplante2005', 'muthaphuli2014'],
};

const KINETICS: Topic = {
  id: 'kinetics',
  title: { en: 'Kinetic lumping', es: 'Agregación cinética' },
  paragraphs: [
    { en: 'The five lumped kinetic models were fitted to the engine\'s virtual batch test of the rougher feed on all 66 baked variants with flotation, and every fit converged. Their lumping errors say how much a lumped model loses when it predicts the plant bank from a batch curve of this kind.',
      es: 'Los cinco modelos cinéticos agrupados se ajustaron a la prueba batch virtual de la alimentación rougher del motor en las 66 variantes horneadas con flotación, y cada ajuste convergió. Sus errores de agregación dicen cuánto pierde un modelo agrupado al predecir el banco de planta desde una curva batch de este tipo.' },
    { en: 'The first-order model loses most: 5.3 points of recovery on average and 8.4 at worst, because it caps the bank at the plateau of the batch test while the bank\'s residence (20 to 30 minutes at the nominal states) reaches past the test\'s 16 minutes; it underestimates the bank at every nominal state. The Kelsall and gamma forms, which carry a distribution of rates, stay within 0.9 and 0.7 points on average and 2.0 and 1.9 at worst; the Klimpel form loses 2.0 points on average and the stretched exponential 3.0.',
      es: 'El modelo de primer orden pierde más: 5,3 puntos de recuperación en promedio y 8,4 en el peor caso, porque limita el banco a la meseta de la prueba batch mientras la residencia del banco (20 a 30 minutos en los estados nominales) llega más allá de los 16 minutos de la prueba; subestima el banco en cada estado nominal. Las formas de Kelsall y gamma, que llevan una distribución de tasas, quedan dentro de 0,9 y 0,7 puntos en promedio y 2,0 y 1,9 en el peor caso; la forma de Klimpel pierde 2,0 puntos en promedio y la exponencial estirada 3,0.' },
  ],
  equations: [
    { tex: r`\bar\varepsilon = \frac{1}{n}\sum_{v} \left|\hat R_N^{(v)} - R_N^{(v)}\right|`, caption: { en: 'The mean absolute lumping error of a model over the n baked variants with flotation.', es: 'El error de agregación absoluto medio de un modelo sobre las n variantes horneadas con flotación.' } },
  ],
  limits: [
    { en: 'The batch test is virtual, without the froth or entrainment effects a laboratory test includes; the errors describe this engine\'s rate distributions, not any particular ore.', es: 'La prueba batch es virtual, sin los efectos de espuma ni de arrastre que incluye una prueba de laboratorio; los errores describen las distribuciones de tasas de este motor, no un mineral particular.' },
  ],
  figure: { caption: { en: 'Mean and worst absolute lumping error of each model over the 66 baked variants with flotation.', es: 'Error de agregación absoluto medio y peor de cada modelo sobre las 66 variantes horneadas con flotación.' }, render: lang => <KineticsChart lang={lang} /> },
  data: lang => <KineticsTable lang={lang} />,
  refs: ['marquardt1963', 'polat2000', 'bu2017', 'vinnett2025'],
};

const OPTIMIZATION: Topic = {
  id: 'optimization',
  title: { en: 'Constrained optimization', es: 'Optimización con restricciones' },
  paragraphs: [
    { en: 'The optimizer found a point within every constraint for 70 of the 72 variants. The two it could not are the magnetite case\'s harder ore and higher throughput: with the grind as its only decision and the mill already at installed power, no grind target meets every constraint.',
      es: 'El optimizador encontró un punto dentro de todas las restricciones en 70 de las 72 variantes. Las dos que no son las de mineral más duro y más tonelaje del caso de magnetita: con la molienda como única decisión y el molino ya a potencia instalada, ningún objetivo de molienda cumple todas las restricciones.' },
    { en: 'Forty of the 72 variants break at least one constraint as they are run, which is the point of the variants: they push the plant. The gain of the optimum over the variant\'s own state ranges from -10.8% (the zinc case with harder ore) to +24.0% (oxide copper with a coarser grind), and every loss comes from a state that broke a constraint: meeting the constraints is worth recovering less metal. At the nominal states the gains run from 0.3% (magnetite) to 11.0% (oxide copper).',
      es: 'Cuarenta de las 72 variantes violan al menos una restricción tal como se ejecutan, que es el sentido de las variantes: exigen a la planta. La ganancia del óptimo sobre el estado propio de la variante va de -10,8% (el caso de zinc con mineral más duro) a +24,0% (cobre oxidado con molienda más gruesa), y cada pérdida viene de un estado que violaba una restricción: cumplir las restricciones vale recuperar menos metal. En los estados nominales las ganancias van de 0,3% (magnetita) a 11,0% (cobre oxidado).' },
    { en: 'Installed power is the constraint that shapes the answer most often, active at 58 of the optima, then the grade specification at 34 and the water capacity at 12: the objective is recovered metal alone, so the optimizer spends every kilowatt the mill has.',
      es: 'La potencia instalada es la restricción que más a menudo da forma a la respuesta, activa en 58 de los óptimos, luego la especificación de ley en 34 y la capacidad de agua en 12: el objetivo es solo el metal recuperado, así que el optimizador gasta cada kilowatt que tiene el molino.' },
  ],
  equations: [
    { tex: r`g = \frac{\dot m(u^{*}) - \dot m(u_v)}{\dot m(u_v)}`, caption: { en: 'The gain of the optimum u* over the variant\'s own point u_v in recovered metal.', es: 'La ganancia del óptimo u* sobre el punto propio de la variante u_v en metal recuperado.' } },
  ],
  limits: [
    { en: 'A steady-state optimum of an authored plant with recovered metal as the only objective: no reagent cost, payability or value of energy, and no froth-stability penalty on air.', es: 'Un óptimo de estado estacionario de una planta de autor con el metal recuperado como único objetivo: sin costo de reactivos, condiciones comerciales ni valor de la energía, y sin penalización de estabilidad de espuma al aire.' },
  ],
  figure: { caption: { en: 'The optimizer\'s gain over every variant of every case, by whether the variant\'s own state met every constraint.', es: 'La ganancia del optimizador sobre cada variante de cada caso, según si el estado propio de la variante cumplía cada restricción.' }, render: lang => <OptimizerChart lang={lang} /> },
  data: lang => <OptimizerTable lang={lang} />,
  refs: ['powell1994', 'prima2023', 'scipy2020'],
};

const UNCERTAINTY: Topic = {
  id: 'uncertainty',
  title: { en: 'Uncertainty and sensitivity', es: 'Incertidumbre y sensibilidad' },
  paragraphs: [
    { en: 'With the operating point held at nominal, 128 draws of the work index, head grade, liberation size and floatability spread recovery between P05 and P95 by 3.7 points in the free-milling gold and up to 12.8 points in the zinc case. The chance of meeting every constraint at once ranges from 3% (zinc, whose grade meets its specification in 5% of the draws) to 100% (oxide copper).',
      es: 'Con el punto de operación fijo en el nominal, 128 sorteos del índice de trabajo, la ley de cabeza, el tamaño de liberación y la flotabilidad separan la recuperación entre P05 y P95 en 3,7 puntos en el oro de molienda libre y hasta 12,8 puntos en el caso de zinc. La probabilidad de cumplir todas las restricciones a la vez va de 3% (zinc, cuya ley cumple su especificación en 5% de los sorteos) a 100% (cobre oxidado).' },
    { en: 'The Sobol indices at the nominal states name the input behind each output. Floatability drives recovery in ten cases (the work index in the hard porphyry, the head grade in the magnetite); liberation size drives concentrate grade in nine (the head grade in the two gold cases and the nickel); the work index drives grinding energy and the head grade drives recovered metal in all twelve.',
      es: 'Los índices de Sobol en los estados nominales nombran la entrada detrás de cada salida. La flotabilidad domina la recuperación en diez casos (el índice de trabajo en el pórfido duro, la ley de cabeza en la magnetita); el tamaño de liberación domina la ley del concentrado en nueve (la ley de cabeza en los dos casos de oro y en el níquel); el índice de trabajo domina la energía de molienda y la ley de cabeza el metal recuperado en los doce.' },
  ],
  equations: [
    { tex: r`\Pr[c] \approx \frac{1}{128}\sum_{s=1}^{128} \mathbb{1}\left[c(x_s)\right]`, caption: { en: 'The probability of meeting a constraint c: the share of the 128 draws x_s whose state meets it.', es: 'La probabilidad de cumplir una restricción c: la fracción de los 128 sorteos x_s cuyo estado la cumple.' } },
  ],
  limits: [
    { en: 'The spreads are authored and the inputs independent by construction; real ore properties co-vary, and the indices are only as meaningful as that assumption.', es: 'Los rangos son de autor y las entradas independientes por construcción; las propiedades reales del mineral covarían, y los índices valen lo que ese supuesto.' },
  ],
  figure: { caption: { en: 'The recovery quantiles of every case under the ore\'s uncertainty, at its nominal operating point.', es: 'Los cuantiles de recuperación de cada caso bajo la incertidumbre del mineral, en su punto nominal de operación.' }, render: lang => <UncertaintyChart lang={lang} /> },
  data: lang => <UncertaintyTable lang={lang} />,
  refs: ['saltelli2010', 'salib2017'],
};

const LEARNED: Topic = {
  id: 'learned',
  title: { en: 'The learned lane', es: 'La vía aprendida' },
  paragraphs: [
    { en: 'Interpolation and transfer rank the models differently. The MLP interpolates recovery best (R² 0.968) and transfers worst: its median leave-one-case-out R² is 0.216 and its mean RMSE 42.1 points; on the held-out magnetite plant its RMSE is 259 points, which only predictions far outside 0 to 100% can produce. Gradient boosting transfers best on recovery, with a median R² of 0.749 and a mean RMSE of 11.8 points.',
      es: 'La interpolación y la transferencia ordenan los modelos de forma distinta. El MLP interpola mejor la recuperación (R² 0,968) y transfiere peor: su R² mediano dejando un caso fuera es 0,216 y su RMSE medio 42,1 puntos; en la planta de magnetita reservada su RMSE es 259 puntos, que solo pueden producir predicciones muy fuera de 0 a 100%. Gradient boosting transfiere mejor en recuperación, con un R² mediano de 0,749 y un RMSE medio de 11,8 puntos.' },
    { en: 'Specific energy transfers well (median R² of 0.887 and 0.858 for gradient boosting and the random forest), since hardness and grind govern it in every case. The upgrade ratio does not transfer at all: its median leave-one-case-out R² is negative for every model, because it depends on the mineralogy the other eleven plants do not share. The Gaussian process\'s 95% intervals cover 89.2, 92.0 and 95.6% of the held-out states for the three targets.',
      es: 'La energía específica transfiere bien (R² mediano de 0,887 y 0,858 para gradient boosting y el bosque aleatorio), porque la dureza y la molienda la gobiernan en cada caso. La razón de enriquecimiento no transfiere: su R² mediano dejando un caso fuera es negativo para cada modelo, porque depende de la mineralogía que las otras once plantas no comparten. Los intervalos del 95% del proceso gaussiano cubren 89,2, 92,0 y 95,6% de los estados reservados para los tres objetivos.' },
    { en: 'The guard raises a false alarm on 1.3% of the envelope\'s held-out states and accepts 17.0% of the out-of-envelope probes; almost all of those step out along the circulating load, the overflow water or the crusher setting (91 to 97% of those probes accepted): the guard barely notices a state that is unusual only in those inputs. Held out, the gold, magnetite, phosphate, oxide copper and refractory gold plants are flagged in every state, and the other seven plants in at most 11% of theirs: the guard says when the surrogate is outside what it knows, and the fold table shows why that matters.',
      es: 'El guardia levanta una falsa alarma en 1,3% de los estados reservados de la envolvente y acepta 17,0% de las sondas fuera de ella; casi todas salen a lo largo de la carga circulante, el agua del rebose o la abertura del chancador (91 a 97% de esas sondas aceptadas): el guardia apenas nota un estado que solo es inusual en esas entradas. Reservadas, las plantas de oro, magnetita, fosfato, cobre oxidado y oro refractario se marcan en cada estado, y las otras siete plantas en a lo más 11% de los suyos: el guardia dice cuándo el sustituto está fuera de lo que conoce, y la tabla de particiones muestra por qué importa.' },
  ],
  equations: [
    { tex: r`\tilde R^2 = \operatorname{median}_{c}\ R^2_{c}`, caption: { en: 'The transfer score: the median over the twelve folds of the R² on the held-out case c.', es: 'El puntaje de transferencia: la mediana sobre las doce particiones del R² en el caso reservado c.' } },
  ],
  limits: [
    { en: 'The surrogates learn this engine on these twelve authored plants; leave one case out bounds their transfer to a thirteenth authored plant, not to a real one.', es: 'Los sustitutos aprenden este motor en estas doce plantas de autor; dejar un caso fuera acota su transferencia a una decimotercera planta de autor, no a una real.' },
  ],
  figure: { caption: { en: 'Interpolation R² against the median leave-one-case-out R² of every model, for the chosen target.', es: 'R² de interpolación frente al R² mediano dejando un caso fuera de cada modelo, para el objetivo elegido.' }, render: lang => <LearnedChart lang={lang} /> },
  data: lang => <LearnedTables lang={lang} />,
  refs: ['sklearn2011', 'breiman2001', 'friedman2001', 'rasmussen2006', 'pytorch2019'],
};

export const ENGINE_BENCHMARK = { ORACLES, KINETICS, OPTIMIZATION, UNCERTAINTY, LEARNED };
