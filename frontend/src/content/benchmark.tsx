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
export function codes(index: CaseIndex): Record<string, string> {
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
  netEnergy: { en: 'Net specific energy (kWh/t)', es: 'Energía específica neta (kWh/t)' },
  grossEnergy: { en: 'Gross specific energy at the published losses (kWh/t)', es: 'Energía específica bruta con las pérdidas publicadas (kWh/t)' },
  cutRow: { en: 'Corrected cut d50c (µm)', es: 'Corte corregido d50c (µm)' },
  bypassRow: { en: 'Water bypass', es: 'Cortocircuito de agua' },
  overflowRow: { en: 'Overflow size distribution, largest gap over the 20 sieves', es: 'Distribución granulométrica del rebose, mayor diferencia en los 20 tamices' },
  gapPoints: { en: 'points', es: 'puntos' },
  input: { en: 'input', es: 'entrada' },
  met: { en: 'met', es: 'cumplida' },
  molycopCaption: { en: 'Moly-Cop BallSim_Direct base case with every input it publishes (fresh feed, its own breakage parameters, classifier, densities), re-solved by the engine. P80 and circulating load are inputs the solver meets; the rest are comparisons, and only the net energy has a tolerance.', es: 'Caso base BallSim_Direct de Moly-Cop con todas las entradas que publica (alimentación fresca, sus propios parámetros de fractura, clasificador, densidades), resuelto de nuevo por el motor. El P80 y la carga circulante son entradas que el solucionador cumple; el resto son comparaciones, y solo la energía neta tiene tolerancia.' },
  sizingCaption: { en: 'Plitt\'s uncalibrated sizing at Moly-Cop\'s two published classifier states. The factors that reproduce each state differ in the ratio {cut} on the cut and {p} on the pressure, against {a2} and {a1} between Moly-Cop\'s own printed constants.', es: 'El dimensionado de Plitt sin calibrar en los dos estados de clasificación publicados por Moly-Cop. Los factores que reproducen cada estado difieren en la razón {cut} en el corte y {p} en la presión, frente a {a2} y {a1} entre las constantes impresas por el propio Moly-Cop.' },
  molycopExample: { en: 'Moly-Cop example', es: 'Ejemplo de Moly-Cop' },
  pubCluster: { en: 'Published cluster', es: 'Batería publicada' },
  plittCut: { en: 'Plitt cut at the published flow, µm (published d50c)', es: 'Corte de Plitt con el caudal publicado, µm (d50c publicado)' },
  plittPressure: { en: 'Plitt pressure at the published flow', es: 'Presión de Plitt con el caudal publicado' },
  engCluster: { en: 'Cluster the engine sizes for the published cut', es: 'Batería que dimensiona el motor para el corte publicado' },
  calibration: { en: 'Factors that reproduce it (cut, pressure)', es: 'Factores que lo reproducen (corte, presión)' },
  cluster: { en: '{n} at {p} kPa', es: '{n} a {p} kPa' },
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
  recovery: { en: 'Recovery (%)', es: 'Recuperación (%)' },
  laplanteTitle: { en: 'GRG recovery against the share treated', es: 'Recuperación de GRG contra la fracción tratada' },
  shareTreated: { en: 'Share of the mill discharge treated (%)', es: 'Fracción tratada de la descarga del molino (%)' },
  pubGrgRec: { en: 'Published GRG recovery', es: 'Recuperación de GRG publicada' },
  engDeclared: { en: 'Engine, Snip\'s GRG (declared)', es: 'Motor, GRG de Snip (declarado)' },
  engCoarse: { en: 'Engine, no GRG below 25 µm (diagnosis)', es: 'Motor, sin GRG bajo 25 µm (diagnóstico)' },
  laplanteSummary: { en: 'The published GRG recovery and the engine\'s, like for like: with Snip\'s fine GRG the engine is 5 to 10 points low even with a perfect unit; without the GRG below 25 µm it is within about a point from the 20% row on.', es: 'La recuperación de GRG publicada y la del motor, en igualdad de condiciones: con el GRG fino de Snip el motor queda 5 a 10 puntos abajo aun con una unidad perfecta; sin el GRG bajo 25 µm queda a menos de un punto desde la fila de 20%.' },
  cload: { en: 'Circulating load (%)', es: 'Carga circulante (%)' },
  pubGrg: { en: 'Published gravity-recoverable gold', es: 'Oro recuperable por gravedad publicado' },
  engOre: { en: 'Engine ore', es: 'Mineral del motor' },
  cloadTitle: { en: 'Circulating loads against the bleed', es: 'Cargas circulantes contra la purga' },
  cloadSummary: { en: 'The GRG circulates far above the ore in the published example, and two to four times less in the engine: its unit recovery does not fall with the feed rate, and its fine GRG escapes the cyclone.', es: 'El GRG circula muy por sobre el mineral en el ejemplo publicado, y dos a cuatro veces menos en el motor: su recuperación por unidad no cae con el caudal, y su GRG fino escapa del ciclón.' },
  reading: { en: 'Point at the chart to read it', es: 'Apunte al gráfico para leerlo' },
  model: { en: 'Model', es: 'Modelo' },
  fits: { en: 'Fits', es: 'Ajustes' },
  rmse: { en: 'Mean fit RMSE (points)', es: 'RMSE medio del ajuste (puntos)' },
  meanLump: { en: 'Mean |lumping error| (points)', es: 'Error de agregación medio (puntos)' },
  worstLump: { en: 'Worst |lumping error| (points)', es: 'Peor error de agregación (puntos)' },
  converged: { en: 'Converged', es: 'Convergidos' },
  kineticsTitle: { en: 'Lumping error of each kinetic model', es: 'Error de agregación de cada modelo cinético' },
  kineticsSummary: { en: 'Mean and worst absolute lumping error of the five lumped models over the 88 precomputed flotation variants.', es: 'Error de agregación absoluto medio y peor de los cinco modelos agrupados sobre las 88 variantes de flotación precalculadas.' },
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
  cutCaption: { en: 'The optimum in the cut mode, where the grind decision is the classifier cut instead of the grind target, with the same marks; these searches run without the screen.', es: 'El óptimo en el modo de corte, donde la decisión de molienda es el corte del clasificador en vez del objetivo de molienda, con las mismas marcas; estas búsquedas corren sin el filtro.' },
  screenCaption: { en: 'What the screen cost or saved, per case over its {n} screened variants: the engine evaluations with and without the screen for the same starts and weight, the candidates the screen proposed and the ones that improved the incumbent, the surrogate\'s mean distance from the engine where it proposed, and how many variants reach the same optimum without it.', es: 'Lo que costó o ahorró el filtro, por caso sobre sus {n} variantes filtradas: las evaluaciones del motor con y sin el filtro para los mismos inicios y peso, los candidatos que propuso el filtro y los que mejoraron al incumbente, la distancia media del sustituto al motor donde propuso, y cuántas variantes llegan al mismo óptimo sin él.' },
  evalsScreened: { en: 'Evaluations, screened', es: 'Evaluaciones, con filtro' },
  evalsPlain: { en: 'Evaluations, unscreened', es: 'Evaluaciones, sin filtro' },
  evalsChange: { en: 'Change', es: 'Cambio' },
  proposedShort: { en: 'Proposed / improved', es: 'Propuestos / mejoraron' },
  surrogateError: { en: 'Surrogate error (points)', es: 'Error del sustituto (puntos)' },
  sameOptimum: { en: 'Same optimum', es: 'Mismo óptimo' },
  total: { en: 'All cases', es: 'Todos los casos' },
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
  loco: { en: 'one-case-out median R²', es: 'R² mediano dejando un caso fuera' },
  group: { en: 'one-group-out median R²', es: 'R² mediano dejando fuera un grupo' },
  locoRmse: { en: 'One-case-out mean RMSE', es: 'RMSE medio dejando un caso fuera' },
  learnTitle: { en: 'Interpolation against transfer (one ore group out)', es: 'Interpolación frente a transferencia (un grupo de mineral fuera)' },
  learnSummary: { en: 'The interpolation R² and the median one-ore-group-out R² of the five models for the chosen target; the table also gives one case out.', es: 'El R² de interpolación y el R² mediano dejando fuera un grupo de mineral de los cinco modelos para el objetivo elegido; la tabla da también un caso fuera.' },
  learnCaption: { en: 'The three protocols of the learned lane for every model and target (interpolation, one case out, one ore group out), from the learning record; the Gaussian process\'s 95% intervals cover {cov} of the held-out states.', es: 'Los tres protocolos de la vía aprendida para cada modelo y objetivo (interpolación, un caso fuera, un grupo de mineral fuera), desde el registro de aprendizaje; los intervalos del 95% del proceso gaussiano cubren {cov} de los estados reservados.' },
  heldOut: { en: 'Held-out case', es: 'Caso reservado' },
  flagRate: { en: 'Guard flags', es: 'Marcas del guardia' },
  foldCaption: { en: 'Each one-case-out fold: the share of the held-out plant\'s states the guard flags, and each model\'s recovery R² on that plant.', es: 'Cada partición dejando un caso fuera: la fracción de estados de la planta reservada que marca el guardia, y el R² de recuperación de cada modelo en esa planta.' },
};

const fill = (template: string, values: Record<string, string>) => template.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? key);
const signed = (value: number, lang: Lang, decimals: number) => `${value > 0 ? '+' : ''}${formatFixed(value, lang, decimals)}`;

export function Reading({ text, lang }: { text: string | null; lang: Lang }) {
  return <p className="of-doc-reading" aria-live="polite">{text ?? TEXT.reading[lang]}</p>;
}

type Pair = { published: number; engine: number; relative_error: number };
type GrgSeries = { max_recovery: number; fit_at_bound: boolean; grg_recovery_pct: number[]; grg_circulating_load_pct: number[]; ore_circulating_load_pct: number[]; within_tolerance: boolean };
type Sizing = {
  published: { cyclones: number; pressure_kpa: number; d50c_um: number };
  plitt_at_published_flow: { cut_um: number; pressure_kpa: number };
  sized_for_published_cut: { cyclones: number; pressure_kpa: number };
  calibration: { cut: number; pressure: number };
};
type Oracles = {
  molycop: {
    inputs: { p80_um: Pair; circulating_load: Pair };
    comparison: { net_specific_energy_kwh_t: Pair; gross_specific_energy_kwh_t: Pair; cut_um: Pair; water_bypass: Pair; overflow_passing_max_abs_difference_pct: number };
    tolerance: { net_specific_energy_kwh_t: number }; within_tolerance: boolean;
    sizing: { examples: Record<string, Sizing>; ratio: { engine_cut: number; engine_pressure: number; molycop_a2: number; molycop_a1: number } };
  };
  gmg: { examples: Array<Record<string, number>>; tolerance_abs_kwh_t: number; within_tolerance: boolean };
  laplante: {
    published: { bleed: number[]; grg_recovery_pct: number[]; gold_recovery_pct: number[]; grg_circulating_load_pct: number[] };
    engine: GrgSeries & { bleed: number[] }; without_grg_below_25um: GrgSeries; tolerance: { grg_recovery_points: number; grg_circulating_load_relative: number };
  };
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
              <Chart data={[x, l.published.grg_recovery_pct, l.engine.grg_recovery_pct, l.without_grg_below_25um.grg_recovery_pct] as uPlot.AlignedData}
                xLabel={TEXT.shareTreated[lang]} yLabel={TEXT.recovery[lang]} title={TEXT.laplanteTitle[lang]} summary={TEXT.laplanteSummary[lang]}
                series={[{ label: TEXT.pubGrgRec[lang], colour: 'subtle', points: true }, { label: TEXT.engDeclared[lang], colour: 'warn', points: true }, { label: TEXT.engCoarse[lang], colour: 'accent', dash: [5, 4], points: true }]}
                format={(v, axis) => (v === null ? '-' : axis === 'x' ? `${formatFixed(v, lang, 0)}%` : `${formatFixed(v, lang, 1)}%`)}
                onCursor={c => setReading(c ? `${formatFixed(c.x, lang, 0)}%: ${TEXT.pubGrgRec[lang]} ${formatFixed(c.values[0], lang, 1)}%, ${TEXT.engDeclared[lang]} ${formatFixed(c.values[1], lang, 1)}%, ${TEXT.engCoarse[lang]} ${formatFixed(c.values[2], lang, 1)}%` : null)} />
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
        const c = m.comparison;
        const rel = (e: number) => (Math.abs(e) < 1e-9 ? '< 1e-9' : `${formatSignificant(100 * e, lang, 2)}%`);
        const input = (e: number) => (Math.abs(e) <= 1e-6 ? TEXT.met[lang] : TEXT.no[lang]);
        const net = c.net_specific_energy_kwh_t, tol = m.tolerance.net_specific_energy_kwh_t;
        // label, published, engine, relative error, tolerance, within
        const rows: Array<[Bi, string, string, string, string, string]> = [
          [TEXT.p80, formatFixed(m.inputs.p80_um.published, lang, 1), formatFixed(m.inputs.p80_um.engine, lang, 1), rel(m.inputs.p80_um.relative_error), TEXT.input[lang], input(m.inputs.p80_um.relative_error)],
          [TEXT.cl, formatFraction(m.inputs.circulating_load.published, lang, 0), formatFraction(m.inputs.circulating_load.engine, lang, 0), rel(m.inputs.circulating_load.relative_error), TEXT.input[lang], input(m.inputs.circulating_load.relative_error)],
          [TEXT.netEnergy, formatFixed(net.published, lang, 2), formatFixed(net.engine, lang, 2), rel(net.relative_error), formatFraction(tol, lang, 0), Math.abs(net.relative_error) <= tol ? TEXT.yes[lang] : TEXT.no[lang]],
          [TEXT.grossEnergy, formatFixed(c.gross_specific_energy_kwh_t.published, lang, 2), formatFixed(c.gross_specific_energy_kwh_t.engine, lang, 2), rel(c.gross_specific_energy_kwh_t.relative_error), '-', '-'],
          [TEXT.cutRow, formatFixed(c.cut_um.published, lang, 1), formatFixed(c.cut_um.engine, lang, 1), rel(c.cut_um.relative_error), '-', '-'],
          [TEXT.bypassRow, formatFraction(c.water_bypass.published, lang, 1), formatFraction(c.water_bypass.engine, lang, 1), rel(c.water_bypass.relative_error), '-', '-'],
          [TEXT.overflowRow, '-', `${formatFixed(c.overflow_passing_max_abs_difference_pct, lang, 2)} ${TEXT.gapPoints[lang]}`, '-', '-', '-'],
        ];
        const ratio = m.sizing.ratio;
        const z = o.zandrivierspoort;
        const l = o.laplante;
        const x = l.engine.bleed.map(v => 100 * v); // not-engine: a fraction shown in percent
        return (
          <div className="of-doc-panel">
            <table className="of-doc-table of-doc-table-data">
              <caption>{TEXT.molycopCaption[lang]}</caption>
              <thead><tr>{[TEXT.quantity, TEXT.published, TEXT.engine, TEXT.error, TEXT.tolerance, TEXT.within].map(h => <th scope="col" key={h.en}>{h[lang]}</th>)}</tr></thead>
              <tbody>{rows.map(([label, ...cells]) => (
                <tr key={label.en}>
                  <th scope="row">{label[lang]}</th>
                  {cells.map((v, i) => <td key={i}>{v}</td>)}
                </tr>
              ))}</tbody>
            </table>
            <table className="of-doc-table of-doc-table-data">
              <caption>{fill(TEXT.sizingCaption[lang], { cut: formatFixed(ratio.engine_cut, lang, 2), p: formatFixed(ratio.engine_pressure, lang, 2), a2: formatFixed(ratio.molycop_a2, lang, 2), a1: formatFixed(ratio.molycop_a1, lang, 2) })}</caption>
              <thead><tr>{[TEXT.molycopExample, TEXT.pubCluster, TEXT.plittCut, TEXT.plittPressure, TEXT.engCluster, TEXT.calibration].map(h => <th scope="col" key={h.en}>{h[lang]}</th>)}</tr></thead>
              <tbody>{Object.entries(m.sizing.examples).map(([id, s]) => (
                <tr key={id}>
                  <th scope="row">{id}</th>
                  <td>{fill(TEXT.cluster[lang], { n: String(s.published.cyclones), p: formatFixed(s.published.pressure_kpa, lang, 0) })}</td>
                  <td>{`${formatFixed(s.plitt_at_published_flow.cut_um, lang, 0)} (${formatFixed(s.published.d50c_um, lang, 1)})`}</td>
                  <td>{`${formatFixed(s.plitt_at_published_flow.pressure_kpa, lang, 0)} kPa`}</td>
                  <td>{fill(TEXT.cluster[lang], { n: String(s.sized_for_published_cut.cyclones), p: formatFixed(s.sized_for_published_cut.pressure_kpa, lang, 0) })}</td>
                  <td>{`${formatFixed(s.calibration.cut, lang, 3)}, ${formatFixed(s.calibration.pressure, lang, 3)}`}</td>
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
              <Chart data={[x, l.published.grg_circulating_load_pct, l.engine.grg_circulating_load_pct, l.without_grg_below_25um.grg_circulating_load_pct, l.engine.ore_circulating_load_pct] as uPlot.AlignedData}
                xLabel={TEXT.shareTreated[lang]} yLabel={TEXT.cload[lang]} title={TEXT.cloadTitle[lang]} summary={TEXT.cloadSummary[lang]}
                series={[{ label: TEXT.pubGrg[lang], colour: 'subtle', points: true }, { label: TEXT.engDeclared[lang], colour: 'warn', points: true }, { label: TEXT.engCoarse[lang], colour: 'accent', points: true }, { label: TEXT.engOre[lang], colour: 'subtle', dash: [5, 4] }]}
                format={(v, axis) => (v === null ? '-' : `${formatFixed(v, lang, 0)}%`)}
                onCursor={c => setReading(c ? `${formatFixed(c.x, lang, 0)}%: ${TEXT.pubGrg[lang]} ${formatFixed(c.values[0], lang, 0)}%, ${TEXT.engDeclared[lang]} ${formatFixed(c.values[1], lang, 0)}%, ${TEXT.engCoarse[lang]} ${formatFixed(c.values[2], lang, 0)}%, ${TEXT.engOre[lang]} ${formatFixed(c.values[3], lang, 0)}%` : null)} />
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
                levels={[{ y: 0, label: '' }]} format={(v, axis) => (axis === 'x' ? '' : v === null ? '-' : `${signed(v, lang, 2)}%`)}
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
        // the nominal and the five common variants in one table, the families' own levers in a second, the cut
        // mode's two variants in a third
        const common = ['nominal', ...VARIANT_KINDS.slice(0, 5).map(k => k.id)];
        const cut = VARIANT_KINDS.filter(k => k.input === 'd50c_um').map(k => k.id);
        const own = VARIANT_KINDS.slice(5).filter(k => !cut.includes(k.id)).flatMap(k => cases.filter(id => bench.optimization[id][k.id]).map(id => ({ id, v: k.id })));
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
            <div className="of-doc-scroll">
              <table className="of-doc-table of-doc-table-data">
                <caption>{TEXT.cutCaption[lang]}</caption>
                <thead><tr><th scope="col">{TEXT.case[lang]}</th>{cut.map(v => <th scope="col" key={v}>{label(v)}</th>)}</tr></thead>
                <tbody>{cases.map(id => <tr key={id}><th scope="row">{`${code[id]} ${title(id)}`}</th>{cut.map(v => cell(id, v))}</tr>)}</tbody>
              </table>
            </div>
            <ScreenTable bench={bench} cases={cases} name={id => `${code[id]} ${title(id)}`} lang={lang} />
          </div>
        );
      }}
    </Loaded>
  );
}

/** OP-11: the screen's measured cost or saving and the surrogate's disagreement, per case and over all cases. */
function ScreenTable({ bench, cases, name, lang }: { bench: Benchmark; cases: string[]; name: (id: string) => string; lang: Lang }) {
  const rows = cases.map(id => ({ id, recs: Object.values(bench.optimization[id]).filter(r => r.screened) }));
  const all = rows.flatMap(r => r.recs);
  const line = (recs: typeof all) => {
    const screened = recs.reduce((a, r) => a + r.evaluations, 0), plain = recs.reduce((a, r) => a + (r.evaluations_without_screen ?? 0), 0);
    const errors = recs.map(r => r.surrogate_abs_error_pp).filter((e): e is number => typeof e === 'number');
    return [
      formatFixed(screened, lang, 0), formatFixed(plain, lang, 0), plain > 0 ? `${signed(100 * (screened / plain - 1), lang, 1)}%` : '-',
      `${formatFixed(recs.reduce((a, r) => a + (r.proposed ?? 0), 0), lang, 0)} / ${formatFixed(recs.reduce((a, r) => a + (r.improved ?? 0), 0), lang, 0)}`,
      errors.length ? formatFixed(errors.reduce((a, e) => a + e, 0) / errors.length, lang, 2) : '-',
      `${recs.filter(r => r.same_optimum_without_screen).length} / ${recs.length}`,
    ];
  };
  const heads = [TEXT.case, TEXT.evalsScreened, TEXT.evalsPlain, TEXT.evalsChange, TEXT.proposedShort, TEXT.surrogateError, TEXT.sameOptimum];
  return (
    <div className="of-doc-scroll">
      <table className="of-doc-table of-doc-table-data">
        <caption>{fill(TEXT.screenCaption[lang], { n: formatFixed(all.length, lang, 0) })}</caption>
        <thead><tr>{heads.map(h => <th scope="col" key={h.en}>{h[lang]}</th>)}</tr></thead>
        <tbody>
          {rows.filter(r => r.recs.length).map(r => <tr key={r.id}><th scope="row">{name(r.id)}</th>{line(r.recs).map((v, k) => <td key={k}>{v}</td>)}</tr>)}
          <tr><th scope="row">{TEXT.total[lang]}</th>{line(all).map((v, k) => <td key={k}><strong>{v}</strong></td>)}</tr>
        </tbody>
      </table>
    </div>
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
              {/* the case names and the two named inputs wrap, so the nine columns fit a 1280 px page in both languages */}
              <thead><tr>{[TEXT.case, TEXT.recShort, TEXT.gradeShort, TEXT.probGrade, TEXT.probPower, TEXT.probWater, TEXT.probAll, TEXT.domRec, TEXT.domGrade].map((h, i) => <th scope="col" key={h.en} className={i === 0 || i >= 7 ? 'of-doc-soft' : undefined}>{h[lang]}</th>)}</tr></thead>
              <tbody>{benchmark.value!.cases.map(c => {
                const r0 = u[c.case_id], unit = contract.value!.cases[c.case_id].primary.unit;
                return (
                  <tr key={c.case_id}>
                    <th scope="row" className="of-doc-soft">{index.value!.cases.find(e => e.case_id === c.case_id)?.title[lang]}</th>
                    <td>{three(r0.recovery_pct, '%')}</td>
                    <td>{`${three(r0.concentrate_grade, unit)} ${unitLabel(unit)}`}</td>
                    {['grade_meets_spec', 'power_within_installed', 'water_within_capacity', 'all_constraints'].map(k => <td key={k}>{formatFraction(r0.probabilities[k], lang, 0)}</td>)}
                    <td className="of-doc-soft">{INPUT[r0.dominant_input.recovery_pct]?.[lang] ?? r0.dominant_input.recovery_pct}</td>
                    <td className="of-doc-soft">{INPUT[r0.dominant_input.concentrate_grade]?.[lang] ?? r0.dominant_input.concentrate_grade}</td>
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
        // one ore group out, the transfer protocol (L-01); a record without it draws no bar rather than another protocol's
        const group = LEARN_MODELS.map(m => s[m][target].transfer_r2_median ?? null);
        return (
          <div className="of-doc-panel">
            <label className="of-doc-control"><span>{TEXT.target[lang]}</span>
              <select value={target} onChange={e => setTarget(e.target.value)}>{TARGETS.map(id => <option key={id} value={id}>{t(TARGET[id], lang)}</option>)}</select></label>
            <div className="of-doc-chart of-doc-chart-narrow">
              <Chart data={[LEARN_MODELS.map((_, i) => i), interp, group] as uPlot.AlignedData} categories={LEARN_MODELS.map(m => short(m, lang))}
                xLabel={TEXT.model[lang]} yLabel="R²" title={TEXT.learnTitle[lang]} summary={TEXT.learnSummary[lang]}
                series={[{ label: TEXT.interp[lang], colour: 'accent', bars: true, align: -1 }, { label: TEXT.group[lang], colour: 'warn', bars: true, align: 1 }]}
                levels={[{ y: 0, label: '0' }]} format={(v, axis) => (axis === 'x' ? '' : formatFixed(v, lang, 3))}
                onCursor={c => setReading(c ? `${t(MODEL[LEARN_MODELS[c.index]], lang)}: ${TEXT.interp[lang]} ${formatFixed(interp[c.index], lang, 3)}, ${group[c.index] !== null ? `${TEXT.group[lang]} ${formatFixed(group[c.index] as number, lang, 3)}, ` : ''}${TEXT.loco[lang]} ${formatFixed(loco[c.index], lang, 3)}` : null)} />
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
                  <tr><th scope="col" rowSpan={2}>{TEXT.model[lang]}</th>{TARGETS.map(id => <th scope="colgroup" colSpan={4} key={id}>{t(TARGET[id], lang)}</th>)}</tr>
                  <tr>{TARGETS.flatMap(id => [<th scope="col" key={`${id}-i`}>{TEXT.interp[lang]}</th>, <th scope="col" key={`${id}-l`}>{TEXT.loco[lang]}</th>, <th scope="col" key={`${id}-r`}>{TEXT.locoRmse[lang]}</th>, <th scope="col" key={`${id}-g`}>{TEXT.group[lang]}</th>])}</tr>
                </thead>
                <tbody>{LEARN_MODELS.map(m => (
                  <tr key={m}>
                    <th scope="row">{t(MODEL[m], lang)}</th>
                    {TARGETS.flatMap(id => {
                      const v = l.summary[m][id];
                      return [<td key={`${id}-i`}>{formatFixed(v.interpolation_r2, lang, 3)}</td>, <td key={`${id}-l`} className={v.loco_r2_median < 0 ? 'of-down' : undefined}>{formatFixed(v.loco_r2_median, lang, 3)}</td>, <td key={`${id}-r`}>{formatSignificant(v.loco_rmse_mean, lang, 3, true)}</td>, <td key={`${id}-g`} className={(v.transfer_r2_median ?? 0) < 0 ? 'of-down' : undefined}>{v.transfer_r2_median !== undefined ? formatFixed(v.transfer_r2_median, lang, 3) : ''}</td>];
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
                      return <td key={m} className={v < 0 ? 'of-down' : undefined}>{formatSignificant(v, lang, 3, true)}</td>;
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
    { en: 'No open plant campaign joins operating states with measured metallurgy, so the engine is checked against published examples, each labelled as a published example and not as plant data. The Moly-Cop BallSim base case is re-solved with every input it publishes: the fresh-feed size distribution, its own breakage parameters, the cyclone geometry, Plitt\'s parameter and the stream densities. The solver meets the published overflow P80 and circulating load, which are inputs. What it then computes is compared: the net specific energy is 7.30 kWh/t against the published 7.71 (3,885 kW net over 504 t/h), 5.2% below it and inside the 20% the requirement set before the first run; the corrected cut is 188 µm against 183.3, the water bypass 37.4% against 37.5%, and the overflow size distribution lies within 0.5 points of the published one at all 20 sieves. Until 0.08.000 this oracle used another example\'s parameter guesses, an authored feed and an authored classifier, and compared its energy with the published gross value.',
      es: 'Ninguna campaña de planta abierta une estados de operación con metalurgia medida, así que el motor se contrasta con ejemplos publicados, cada uno rotulado como ejemplo publicado y no como datos de planta. El caso base BallSim de Moly-Cop se resuelve de nuevo con todas las entradas que publica: la distribución granulométrica de la alimentación fresca, sus propios parámetros de fractura, la geometría de los ciclones, el parámetro de Plitt y las densidades de las corrientes. El solucionador cumple el P80 del rebose y la carga circulante publicados, que son entradas. Lo que calcula después se compara: la energía específica neta es 7,30 kWh/t frente a 7,71 publicados (3.885 kW netos sobre 504 t/h), 5,2% bajo ellos y dentro del 20% que fijó el requisito antes de la primera corrida; el corte corregido es 188 µm frente a 183,3, el cortocircuito de agua 37,4% frente a 37,5%, y la distribución granulométrica del rebose queda dentro de 0,5 puntos de la publicada en los 20 tamices. Hasta 0.08.000 este oráculo usaba los valores iniciales de parámetros de otro ejemplo, una alimentación y un clasificador de autor, y comparaba su energía con el valor bruto publicado.' },
    { en: 'The same example tests the cyclone sizing, and the sizing fails. At Moly-Cop\'s two published classifier states, Plitt\'s uncalibrated equations give a cut 1.66 and 1.38 times the published one and a pressure 2.2 and 1.7 times the published one. Sizing a cluster from the cut amplifies that: for BallSim the engine asks for 2 cyclones at 816 kPa against the published 6 at 53 kPa. Moly-Cop calibrates the equations per survey, and the factors that reproduce each example differ in the same ratio as its printed constants, so the equations are Moly-Cop\'s and only the calibration is missing. The count and pressure are therefore shown as an uncalibrated estimate, never as a result or a flag.',
      es: 'El mismo ejemplo pone a prueba el dimensionado de ciclones, y el dimensionado falla. En los dos estados de clasificación publicados por Moly-Cop, las ecuaciones de Plitt sin calibrar dan un corte 1,66 y 1,38 veces el publicado y una presión 2,2 y 1,7 veces la publicada. Dimensionar una batería a partir del corte lo amplifica: para BallSim el motor pide 2 ciclones a 816 kPa frente a los 6 publicados a 53 kPa. Moly-Cop calibra las ecuaciones por muestreo, y los factores que reproducen cada ejemplo difieren en la misma razón que sus constantes impresas, así que las ecuaciones son las de Moly-Cop y solo falta la calibración. Por eso el número de ciclones y la presión se muestran como una estimación sin calibrar, nunca como un resultado ni un aviso.' },
    { en: 'The GMG guideline\'s two worked examples of the Bond operating work index are reproduced within 0.03 kWh/t (14.38 against 14.4 and 11.71 against 11.7), inside the 0.05 kWh/t tolerance. The check runs the formula on the guideline\'s published power, throughput and sizes: it tests the arithmetic, simulates no circuit, and the second example is a rod and ball circuit the engine does not model.',
      es: 'Los dos ejemplos resueltos de la guía GMG del índice de trabajo operacional de Bond se reproducen dentro de 0,03 kWh/t (14,38 frente a 14,4 y 11,71 frente a 11,7), dentro de la tolerancia de 0,05 kWh/t. La verificación aplica la fórmula a la potencia, el tratamiento y los tamaños publicados por la guía: prueba la aritmética, no simula ningún circuito, y el segundo ejemplo es un circuito de barras y bolas que el motor no modela.' },
    { en: 'The Laplante and Staunton simulator example is run like for like: its 150 t/h, 2.0 g/t circuit at 80% passing 75 µm and 250% circulating load, with an ore of 80.4% gravity-recoverable gold (GRG) and the unit on 10 to 60% of the mill discharge. The unit\'s maximum recovery is fitted at the printed 30% row and the other rows are compared within tolerances set before the first run, 5 points on GRG recovery and 35% on the GRG circulating load. With Snip\'s measured GRG, which is very fine, the run misses: even a perfect unit gives 69.5 to 90.7% against 79.8 to 95.9%, and the GRG circulates 65 to 80% less than the printed 2016 to 413%, because 9 to 31% of the GRG, almost all finer than about 37 µm, leaves by the overflow. The one shape check agrees: 86.7 to 88.3% of the discharge GRG is below 150 µm against the printed 87.7%. Without the GRG finer than 25 µm the fitted maximum is 0.74 and the GRG recovery comes within 1.1 points from the 20% row on, while the circulating load stays 50 to 69% low; the example\'s GRG vector is not printed, and its unit recovery falls as the feed grows, which the engine\'s does not.',
      es: 'El ejemplo de simulador de Laplante y Staunton se corre en igualdad de condiciones: su circuito de 150 t/h y 2,0 g/t, con 80% bajo 75 µm y 250% de carga circulante, un mineral con 80,4% de oro recuperable por gravedad (GRG) y la unidad sobre 10 a 60% de la descarga del molino. La recuperación máxima de la unidad se ajusta en la fila impresa de 30% y las demás filas se comparan con tolerancias fijadas antes de la primera corrida, 5 puntos en la recuperación de GRG y 35% en la carga circulante de GRG. Con el GRG medido en Snip, que es muy fino, la corrida no cumple: aun una unidad perfecta da 69,5 a 90,7% frente a 79,8 a 95,9%, y el GRG circula 65 a 80% menos que los 2016 a 413% impresos, porque 9 a 31% del GRG, casi todo más fino que unos 37 µm, sale por el rebose. La única verificación de forma coincide: 86,7 a 88,3% del GRG de la descarga queda bajo 150 µm frente al 87,7% impreso. Sin el GRG más fino que 25 µm el máximo ajustado es 0,74 y la recuperación de GRG queda a menos de 1,1 puntos desde la fila de 20%, mientras la carga circulante sigue 50 a 69% baja; el vector de GRG del ejemplo no se imprime, y su recuperación por unidad cae al crecer la alimentación, lo que la del motor no hace.' },
    { en: 'Zandrivierspoort is a trend, because its ore is not the engine\'s case. There the ball-mill circuit, aiming at 80% passing 75 µm and reaching 66.8%, gave a concentrate of 64.9% Fe, and an IsaMill regrind of that concentrate to 45 µm with three more cleaning stages gave 69.0%. The engine\'s magnetite case, a different ore, reaches 45 µm by a finer primary grind and rises from 63.8 to 67.8% Fe: a step of 4.0 points against the published 4.1, at levels 1.1 and 1.2 points below the published ones. Its silica is 10.9 and 5.8% against the published 7.7 and 2.25%, and its rougher drum at 75 µm recovers 97.3% of the magnetite at 60.1% Fe, against the published 98.1% at 63.8%.',
      es: 'Zandrivierspoort es una tendencia, porque su mineral no es el caso del motor. Allí el circuito de molino de bolas, que buscaba 80% bajo 75 µm y llegó a 66,8%, dio un concentrado de 64,9% Fe, y una remolienda IsaMill de ese concentrado a 45 µm con tres etapas más de limpieza dio 69,0%. El caso de magnetita del motor, un mineral distinto, llega a 45 µm con una molienda primaria más fina y sube de 63,8 a 67,8% Fe: un salto de 4,0 puntos frente a los 4,1 publicados, con niveles 1,1 y 1,2 puntos bajo los publicados. Su sílice es 10,9 y 5,8% frente a los 7,7 y 2,25% publicados, y su tambor rougher a 75 µm recupera 97,3% de la magnetita con 60,1% Fe, frente al 98,1% publicado con 63,8%.' },
  ],
  equations: [
    { tex: r`\epsilon = \frac{y_{E} - y_{P}}{y_{P}}`, caption: { en: 'The relative error of an engine result $y_E$ against the published value $y_P$.', es: 'El error relativo de un resultado del motor $y_E$ frente al valor publicado $y_P$.' } },
    { tex: r`\left(T^{-1}(e) - \mathrm{diag}\big[C\,(1 - bR)\big]\right) p = f,\qquad d = b\,R\,p`, caption: { en: 'The GRG balance with the unit on a share b of the mill discharge p: the engine\'s form of the published model, with the mill operator T at the energy per pass, the GRG partition C and the unit\'s recovery R.', es: 'El balance de GRG con la unidad sobre una fracción b de la descarga del molino p: la forma del motor del modelo publicado, con el operador del molino T a la energía por pasada, la partición del GRG C y la recuperación de la unidad R.' } },
    { tex: r`R(b_{k+1}) > R(b_k),\qquad R(b_{k+1}) - R(b_k) < R(b_k) - R(b_{k-1})`, caption: { en: 'The trend the gravity recovery also keeps: it rises with the bleed b, with diminishing returns.', es: 'El oráculo de tendencia de la purga gravimétrica b: la recuperación sube con la purga, con rendimientos decrecientes.' } },
  ],
  limits: [
    { en: 'Published examples test that the engine reproduces documented behaviour; they are not measurements of the authored plants.', es: 'Los ejemplos publicados prueban que el motor reproduce comportamientos documentados; no son mediciones de las plantas de autor.' },
    { en: 'The gravity oracle fits one parameter, the unit\'s maximum recovery, at one printed row; its other rows are predictions, and its miss is shown, not tuned away. The Zandrivierspoort trend checks a direction and a proportion, not a level, because its ore is not the engine\'s case.', es: 'El oráculo gravimétrico ajusta un parámetro, la recuperación máxima de la unidad, en una fila impresa; sus otras filas son predicciones, y su desajuste se muestra, no se ajusta para ocultarlo. La tendencia de Zandrivierspoort verifica una dirección y una proporción, no un nivel, porque su mineral no es el caso del motor.' },
  ],
  figure: { caption: { en: 'The published GRG recovery against the share of the mill discharge treated, with the engine\'s declared run and its diagnosis without the GRG below 25 µm.', es: 'La recuperación de GRG publicada contra la fracción tratada de la descarga del molino, con la corrida declarada del motor y su diagnóstico sin el GRG bajo 25 µm.' }, render: lang => <LaplanteChart lang={lang} /> },
  data: lang => <OracleTables lang={lang} />,
  refs: ['molycop', 'gmg2021', 'laplante-staunton', 'laplante2005', 'muthaphuli2014'],
};

const KINETICS: Topic = {
  id: 'kinetics',
  title: { en: 'Kinetic lumping', es: 'Agregación cinética' },
  paragraphs: [
    { en: 'The five lumped kinetic models were fitted to the engine\'s virtual batch test of the rougher feed on all 88 precomputed variants with flotation, and every fit converged. Their lumping errors say how much a lumped model loses when it predicts the plant bank from a batch curve of this kind.',
      es: 'Los cinco modelos cinéticos agrupados se ajustaron a la prueba batch virtual de la alimentación rougher del motor en las 88 variantes precalculadas con flotación, y cada ajuste convergió. Sus errores de agregación dicen cuánto pierde un modelo agrupado al predecir el banco de planta desde una curva batch de este tipo.' },
    { en: 'The first-order model loses most: 7.6 points of recovery on average and 19.1 at worst. Its batch test ends at 16 minutes, while nominal bank residence ranges from 23 to 84 minutes; at every nominal state it underestimates the bank. Gamma and Kelsall lose 1.27 and 1.81 points on average, with worst errors of 5.1 and 8.5; Klimpel averages 2.80 and the stretched exponential 4.76 points.',
      es: 'El modelo de primer orden pierde más: 7,6 puntos de recuperación en promedio y 19,1 en el peor caso. Su prueba batch termina a los 16 minutos, mientras la residencia nominal del banco va de 23 a 84 minutos; subestima el banco en todos los estados nominales. Gamma y Kelsall pierden 1,27 y 1,81 puntos en promedio, con errores máximos de 5,1 y 8,5; Klimpel promedia 2,80 y la exponencial estirada 4,76 puntos.' },
  ],
  equations: [
    { tex: r`\bar\varepsilon = \frac{1}{n}\sum_{v} \left|\hat R_N^{(v)} - R_N^{(v)}\right|`, caption: { en: 'The mean absolute lumping error of a model over the n precomputed variants with flotation.', es: 'El error de agregación absoluto medio de un modelo sobre las n variantes precalculadas con flotación.' } },
  ],
  limits: [
    { en: 'The batch test is virtual, without the froth or entrainment effects a laboratory test includes; the errors describe this engine\'s rate distributions, not any particular ore.', es: 'La prueba batch es virtual, sin los efectos de espuma ni de arrastre que incluye una prueba de laboratorio; los errores describen las distribuciones de tasas de este motor, no un mineral particular.' },
  ],
  figure: { caption: { en: 'Mean and worst absolute lumping error of each model over the 88 precomputed variants with flotation.', es: 'Error de agregación absoluto medio y peor de cada modelo sobre las 88 variantes precalculadas con flotación.' }, render: lang => <KineticsChart lang={lang} /> },
  data: lang => <KineticsTable lang={lang} />,
  refs: ['marquardt1963', 'polat2000', 'bu2017', 'vinnett2025'],
};

const OPTIMIZATION: Topic = {
  id: 'optimization',
  title: { en: 'Constrained optimization', es: 'Optimización con restricciones' },
  paragraphs: [
    { en: 'The pattern search, from six starts with all the weight on recovered metal, found a point within every constraint for 94 of the 96 variants. The two it could not are the magnetite case\'s harder ore and higher throughput: with the grind as its only decision and the mill already at installed power, no grind target meets every constraint.',
      es: 'La búsqueda por patrones, desde seis inicios y con todo el peso en el metal recuperado, encontró un punto dentro de todas las restricciones en 94 de las 96 variantes. Las dos que no son las de mineral más duro y más tratamiento del caso de magnetita: con la molienda como única decisión y el molino ya a potencia instalada, ningún objetivo de molienda cumple todas las restricciones.' },
    { en: 'Twenty-nine of the 72 target-mode variants begin outside at least one constraint. The optimum gain over the variant state ranges from -0.8% (magnetite with a coarser grind) to +20.0% (oxide copper with a coarser grind); the first begins infeasible, while the second begins feasible. Among the 43 feasible-start target variants, gains run from 0.3% (magnetite with a finer crusher setting) to 20.0% (oxide copper with a coarser grind). Nominal gains run from 0.3% (magnetite) to 7.9% (oxide copper). All 24 cut-mode variants meet constraints as run; their optimized gains range from 0.3% in magnetite to 6.2% in zinc sulphide.',
      es: 'Veintinueve de las 72 variantes en modo objetivo comienzan fuera de al menos una restricción. La ganancia del óptimo sobre el estado propio de la variante va de -0,8% (magnetita con molienda más gruesa) a +20,0% (cobre oxidado con molienda más gruesa); la primera comienza fuera de restricciones y la segunda dentro. Entre las 43 variantes objetivo que comienzan factibles, las ganancias van de 0,3% (magnetita con chancador más fino) a 20,0% (cobre oxidado con molienda más gruesa). Las ganancias nominales van de 0,3% (magnetita) a 7,9% (cobre oxidado). Las 24 variantes de corte cumplen restricciones tal como se operan; sus ganancias optimizadas van de 0,3% en magnetita a 6,2% en sulfuro de zinc.' },
    { en: 'Installed power is the constraint that shapes the answer most often, active at 70 of the 94 optima and at all 24 in the cut mode, then the grade specification at 31 and the water capacity at 20: with the objective on recovered metal alone, the optimizer spends every kilowatt the mill has.',
      es: 'La potencia instalada es la restricción que más a menudo define la respuesta, activa en 70 de los 94 óptimos y en los 24 del modo de corte, seguida de la especificación de ley en 31 y la capacidad de agua en 20: con el objetivo solo en el metal recuperado, el optimizador gasta cada kilowatt que tiene el molino.' },
    { en: 'The screen did not save engine evaluations. Across 72 target-mode variants it used 26,367 engine evaluations versus 22,487 without screening, 17.3% more; it used more in 68 variants and the same in four. Of 79,034 candidates, 19 were rejected by the guard and 48,268 by the uncertainty interval; 5,811 were proposed to the engine and 901 improved the incumbent. Mean absolute surrogate error is 0.66 points per variant; across proposals its mean is 0.71, median 0.48 and maximum 38.2, with the surrogate below the engine in about half. Screening and unscreened searches reach the same optimum in 65 variants. In the seven differing cases, metal differs by at most 0.017% and decisions by one to five mesh steps; five favour the unscreened result and two the screened result. Cut-mode searches remain unscreened.',
      es: 'El filtro no ahorró evaluaciones del motor. En 72 variantes objetivo usó 26.367 evaluaciones frente a 22.487 sin filtro, 17,3% más; usó más en 68 variantes e igual en cuatro. De 79.035 candidatos, la guardia rechazó 19 y el intervalo de incertidumbre 48.266; se propusieron 5.811 al motor y 901 mejoraron al incumbente. El error absoluto medio del sustituto fue 0,66 puntos por variante; entre las propuestas fue 0,71 de media, 0,48 de mediana y 38,2 como máximo, y el sustituto quedó bajo el motor en cerca de la mitad. Ambas búsquedas alcanzaron el mismo óptimo en 65 variantes. En los siete casos distintos, el metal difirió como máximo 0,017% y las decisiones entre uno y cinco pasos de malla; cinco favorecieron la búsqueda sin filtro y dos la filtrada. El modo de corte no usa filtro.' },
    { en: 'Moving weight from metal to energy trades one for the other. At the nominal states, with a quarter of the weight on metal, the optimum spends 0 to 42% less energy per tonne and 0 to 29% less metal than the metal-only optimum; the magnetite optimum does not move, because its grade specification already binds there and a coarser grind would break it. Along every path neither the energy nor the metal rises as the weight falls, beyond 0.01%, the mesh\'s resolution.',
      es: 'Mover peso del metal a la energía cambia uno por otro. En los estados nominales, con un cuarto del peso en el metal, el óptimo gasta de 31 a 47% menos energía por tonelada y recupera de 8 a 37% menos metal que el óptimo solo de metal; el óptimo de la magnetita no se mueve, porque su especificación de ley ya está activa ahí y una molienda más gruesa la incumpliría. A lo largo de cada camino ni la energía ni el metal suben al bajar el peso, más allá de 0,01%, la resolución de la malla.' },
  ],
  equations: [
    { tex: r`g = \frac{\dot m(u^{*}) - \dot m(u_v)}{\dot m(u_v)}`, caption: { en: 'The gain of the optimum $u^{*}$ over the variant\'s own point $u_v$ in recovered metal.', es: 'La ganancia del óptimo $u^{*}$ sobre el punto propio de la variante $u_v$ en metal recuperado.' } },
    { tex: r`\Delta N = \frac{N_{s} - N_{0}}{N_{0}}`, caption: { en: 'What the screen costs or saves: the engine evaluations of the screened search $N_s$ against those of the same starts and weight without it, $N_0$.', es: 'Lo que cuesta o ahorra el filtro: las evaluaciones del motor de la búsqueda filtrada $N_s$ frente a las de los mismos inicios y peso sin él, $N_0$.' } },
  ],
  limits: [
    { en: 'A steady-state optimum of an authored plant, weighing recovered metal against energy per tonne: no reagent cost, payability or value of energy beyond the declared weight, and no froth-stability penalty on air.', es: 'Un óptimo de estado estacionario de una planta de autor, que pondera el metal recuperado contra la energía por tonelada: sin costo de reactivos, condiciones comerciales ni valor de la energía más allá del peso declarado, y sin penalización de estabilidad de espuma al aire.' },
    { en: 'A pattern search converges to a local optimum on its mesh; the starts (up to six) are the safeguard against a poor one, and the unscreened run of every screened variant is a second search from the same starts.',
      es: 'Una búsqueda por patrones converge a un óptimo local en su malla; los inicios (hasta seis) son la salvaguarda contra uno malo, y la corrida sin filtro de cada variante filtrada es una segunda búsqueda desde los mismos inicios.' },
  ],
  figure: { caption: { en: 'The optimizer\'s gain over every variant of every case, by whether the variant\'s own state met every constraint.', es: 'La ganancia del optimizador sobre cada variante de cada caso, según si el estado propio de la variante cumplía cada restricción.' }, render: lang => <OptimizerChart lang={lang} /> },
  data: lang => <OptimizerTable lang={lang} />,
  refs: ['torczon1997', 'audet2006', 'audet2009', 'booker1999'],
};

const UNCERTAINTY: Topic = {
  id: 'uncertainty',
  title: { en: 'Uncertainty and sensitivity', es: 'Incertidumbre y sensibilidad' },
  paragraphs: [
    { en: 'At the nominal operating point, 128 draws of work index, head grade, liberation size and floatability spread recovery P05–P95 by 1.5 points in high-clay copper and up to 9.7 in zinc. Across eight further seeds, those widths range from 1.5 to 1.7 in high-clay copper and 10.2 to 11.9 in zinc. The probability of meeting all constraints together is lowest in zinc (44%) and highest in oxide copper (88%); magnetite is 52%, with grade meeting specification in 66% and mill power within its limit in 79% of draws.',
      es: 'En el punto nominal, 128 muestras del índice de trabajo, la ley de cabeza, el tamaño de liberación y la flotabilidad dispersan el P05–P95 de recuperación en 1,5 puntos en cobre con arcilla y hasta 9,7 en zinc. En ocho semillas adicionales, esos rangos van de 1,5 a 1,7 en cobre con arcilla y de 10,2 a 11,9 en zinc. La probabilidad de cumplir todas las restricciones juntas es menor en zinc (44%) y mayor en cobre oxidado (88%); magnetita queda en 52%, con ley dentro de especificación en 66% y potencia de molino dentro del límite en 79% de las muestras.' },
    { en: 'The Sobol indices at the nominal states name the input behind each output. Floatability drives recovery in ten cases (the work index in the hard porphyry, the head grade in the magnetite); liberation size drives concentrate grade in eight (the head grade in the two gold cases, the nickel and the oxide copper); the work index drives grinding energy and the head grade drives recovered metal in all twelve.',
      es: 'Los índices de Sobol en los estados nominales nombran la entrada detrás de cada salida. La flotabilidad domina la recuperación en diez casos (el índice de trabajo en el pórfido duro, la ley de cabeza en la magnetita); el tamaño de liberación domina la ley del concentrado en ocho (la ley de cabeza en los dos casos de oro, en el níquel y en el cobre oxidado); el índice de trabajo domina la energía de molienda y la ley de cabeza el metal recuperado en los doce.' },
  ],
  equations: [
    { tex: r`\Pr[c] \approx \frac{1}{128}\sum_{s=1}^{128} \mathbb{1}\left[c(x_s)\right]`, caption: { en: 'The probability of meeting a constraint c: the share of the 128 draws $x_s$ whose state meets it.', es: 'La probabilidad de cumplir una restricción c: la fracción de los 128 sorteos $x_s$ cuyo estado la cumple.' } },
  ],
  limits: [
    { en: 'The spreads are authored and the inputs independent by construction; real ore properties co-vary, and the indices are only as meaningful as that assumption.', es: 'Los rangos son de autor y las entradas independientes por construcción; las propiedades reales del mineral covarían, y los índices valen lo que ese supuesto.' },
    { en: 'The workbench re-runs the uncertainty record at another seed or sample count, in the browser, with the same generator as the precompute; the Sobol indices are precomputed only, at the nominal states, and are not re-run live.', es: 'El simulador vuelve a correr el registro de incertidumbre con otra semilla o número de muestras, en el navegador, con el mismo generador del precálculo; los índices de Sobol solo se precalculan, en los estados nominales, y no se vuelven a correr en vivo.' },
  ],
  figure: { caption: { en: 'The recovery quantiles of every case under the ore\'s uncertainty, at its nominal operating point.', es: 'Los cuantiles de recuperación de cada caso bajo la incertidumbre del mineral, en su punto nominal de operación.' }, render: lang => <UncertaintyChart lang={lang} /> },
  data: lang => <UncertaintyTable lang={lang} />,
  refs: ['saltelli2010', 'salib2017'],
};

const LEARNED: Topic = {
  id: 'learned',
  title: { en: 'The learned lane', es: 'La vía aprendida' },
  paragraphs: [
    { en: 'Interpolation and transfer rank the models differently. Under interpolation the MLP fits recovery best (R² 0.951 at the record seed; RMSE 3.0 to 3.5 points over five training seeds). With one case held out, it is most accurate on four of the five copper sulphide plants (RMSE 1.7 to 9.1 across cases and seeds); in high-clay copper the random forest scores 5.99 points against the MLP at 6.57. The magnetite holdout is difficult for the MLP (240 points at the record seed; 217 to 277 over seeds), while phosphate error is 9 points at the record seed (7 to 19 over seeds). Mean one-case-out MLP RMSE ranges from 25.0 to 30.1 across seeds, 26.2 at the record seed. Its median one-case-out recovery R² is 0.547, followed by gradient boosting at 0.512. On 612 matched training rows the forest and gradient boosting score R² 0.683 and 0.813; the Gaussian process uses 500 of 2,460 rows and scores 0.878. The five copper plants share chalcopyrite, so holding one out tests near-neighbour interpolation rather than transfer to another ore.',
      es: 'La interpolación y la transferencia ordenan los modelos de forma distinta. En interpolación el MLP ajusta mejor la recuperación (R² 0,951 con la semilla del registro; RMSE de 3,0 a 3,5 puntos sobre cinco semillas de entrenamiento). Al dejar un caso fuera, es más preciso en cuatro de las cinco plantas de sulfuros de cobre (RMSE de 1,7 a 9,1 entre casos y semillas); en el cobre con arcilla, el bosque aleatorio obtiene 5,99 puntos frente a 6,57 del MLP. La magnetita es difícil para el MLP (240 puntos con la semilla del registro; 217 a 277 entre semillas), mientras que el error en fosfato es 9 puntos con la semilla del registro (7 a 19 entre semillas). El RMSE medio del MLP al dejar un caso fuera va de 25,0 a 30,1 entre semillas, 26,2 con la semilla del registro. Su R² mediano de recuperación al dejar un caso fuera es 0,547, seguido por gradient boosting con 0,512. Las cinco plantas de cobre comparten calcopirita; dejar una fuera prueba interpolación entre vecinas, no transferencia a otro mineral.' },
    { en: 'A whole ore group out is a different test: the MLP has the highest median recovery R² across seven groups (0.437), but mean error is 46.7 points; holding out the two pyrite gold plants gives it R² -10.2, while the five chalcopyrite plants held out together score 0.795 for the MLP and 0.539 for the Gaussian process. The five copper plants held out one at a time yield MLP R² from 0.52 to 0.99. Median energy R² remains 0.923 to 0.968 with one case out and 0.88 to 0.91 with a whole ore group out; on phosphate the Gaussian process and MLP score -0.9 and 0.0. The copper-group median upgrade R² is 0.92 for the Gaussian process, 0.95 for the MLP, 0.11 for gradient boosting, 0.23 for the forest and -5.88 for ridge. Gaussian-process interval coverage is 90.7, 91.3 and 93.8% under interpolation and 82.9, 68.1 and 86.9% with one case out (worst folds 35.5, 0 and 43.8%).',
      es: 'Dejar fuera un grupo completo de mineral es otra prueba: el MLP tiene el mayor R² mediano de recuperación entre siete grupos (0,437), pero un error medio de 46,7 puntos; al reservar las dos plantas de oro con pirita obtiene R² -10,2, mientras que las cinco plantas de calcopirita juntas dan 0,795 al MLP y 0,539 al proceso gaussiano. Las cinco plantas de cobre reservadas de a una dan al MLP R² entre 0,52 y 0,99. El R² mediano de energía queda entre 0,923 y 0,968 al dejar un caso fuera y entre 0,88 y 0,91 al dejar un grupo completo; en fosfato el proceso gaussiano y el MLP obtienen -0,9 y 0,0. El R² mediano del enriquecimiento en el grupo de cobre es 0,92 para el proceso gaussiano, 0,95 para el MLP, 0,11 para gradient boosting, 0,23 para el bosque y -5,88 para ridge. La cobertura de intervalos del proceso gaussiano es 90,7, 91,3 y 93,8% en interpolación y 82,9, 68,1 y 86,9% al dejar un caso fuera (peores particiones 35,5, 0 y 43,8%).' },
    { en: 'The guard raises a false alarm on 1.5% of held-out envelope states. At half a training range beyond the maximum it accepts 15.5% of probes (19.9% below the minimum); at one tenth it accepts 48% (60% below), and at one full range 6%. Crusher setting, water per tonne and circulating load account for 74% of the summed false-accept feature rates. The oxide-copper, magnetite, phosphate and refractory-gold plants are flagged in every held-out state; nickel is flagged in 71%, zinc in 9%, mixed high-clay in 95%, and soft porphyry in 16%; the other copper sulphide cases stay below 3.2%. The guard detects unfamiliar features, not prediction error: it flags 16% of soft-porphyry states while gradient boosting upgrade R² is -1.46, and all refractory-gold states while gradient boosting recovery R² is 0.17.',
      es: 'El guardia genera falsas alarmas en 1,5% de los estados reservados dentro de la envolvente. A media amplitud de entrenamiento más allá del máximo acepta 15,5% de las sondas (19,9% bajo el mínimo); a una décima acepta 48% (60% bajo el mínimo), y a una amplitud completa 6%. La abertura del chancador, el agua por tonelada y la carga circulante suman 74% de las tasas de aceptación falsa por variable. Las plantas de cobre oxidado, magnetita, fosfato y oro refractario se marcan en cada estado reservado; níquel en 71%, zinc en 9%, cobre con arcilla en 95% y pórfido blando en 16%; los demás casos de sulfuros de cobre quedan bajo 3,2%. El guardia detecta variables desconocidas, no el error de predicción: marca 16% de los estados del pórfido blando mientras el R² de enriquecimiento de gradient boosting es -1,46, y todos los estados del oro refractario mientras el R² de recuperación de gradient boosting es 0,17.' },
  ],
  equations: [
    { tex: { en: r`\tilde R^2 = \operatorname{median}_{u}\ R^2_{u}`, es: r`\tilde R^2 = \operatorname{mediana}_{u}\ R^2_{u}` }, caption: { en: 'The held-out score: the median over the held-out units u of the R² on u, the twelve cases with one case out and the seven ore groups with one group out, the transfer score.', es: 'El puntaje reservado: la mediana sobre las unidades reservadas u del R² en u, los doce casos al dejar un caso fuera y los siete grupos de mineral al dejar fuera un grupo, el puntaje de transferencia.' } },
  ],
  limits: [
    { en: 'The surrogates learn this engine on these twelve authored plants; one ore group out bounds their transfer to a thirteenth authored plant on an ore none of them shares, and one case out to a plant on a known ore; neither bounds transfer to a real plant.', es: 'Los sustitutos aprenden este motor en estas doce plantas de autor; dejar fuera un grupo de mineral acota su transferencia a una decimotercera planta de autor sobre un mineral que ninguna comparte, y dejar un caso fuera a una planta sobre un mineral conocido; ninguno acota la transferencia a una planta real.' },
  ],
  figure: { caption: { en: 'Interpolation R² against the median one-ore-group-out R² of every model, for the chosen target; the table gives one case out too.', es: 'R² de interpolación frente al R² mediano dejando fuera un grupo de mineral de cada modelo, para el objetivo elegido; la tabla da también un caso fuera.' }, render: lang => <LearnedChart lang={lang} /> },
  data: lang => <LearnedTables lang={lang} />,
  refs: ['sklearn2011', 'breiman2001', 'friedman2001', 'rasmussen2006', 'pytorch2019'],
};

export const ENGINE_BENCHMARK = { ORACLES, KINETICS, OPTIMIZATION, UNCERTAINTY, LEARNED };
