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
  kineticsSummary: { en: 'Mean and worst absolute lumping error of the five lumped models over the 88 baked flotation variants.', es: 'Error de agregación absoluto medio y peor de los cinco modelos agrupados sobre las 88 variantes de flotación horneadas.' },
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
    { en: 'No open plant campaign joins operating states with measured metallurgy, so the engine is checked against published examples, each labelled as a published example and not as plant data. The Moly-Cop BallSim base case is re-solved with every input it publishes: the fresh-feed size distribution, its own breakage parameters, the cyclone geometry, Plitt\'s parameter and the stream densities. The solver meets the published overflow P80 and circulating load, which are inputs. What it then computes is compared: the net specific energy is 7.30 kWh/t against the published 7.71 (3,885 kW net over 504 t/h), 5.2% below it and inside the 20% the requirement set before the first run; the corrected cut is 188 µm against 183.3, the water bypass 37.4% against 37.5%, and the overflow size distribution lies within 0.5 points of the published one at all 20 sieves. Until 0.08.000 this oracle used another example\'s parameter guesses, an authored feed and an authored classifier, and compared its energy with the published gross value.',
      es: 'Ninguna campaña de planta abierta une estados de operación con metalurgia medida, así que el motor se contrasta con ejemplos publicados, cada uno rotulado como ejemplo publicado y no como datos de planta. El caso base BallSim de Moly-Cop se resuelve de nuevo con todas las entradas que publica: la distribución granulométrica de la alimentación fresca, sus propios parámetros de fractura, la geometría de los ciclones, el parámetro de Plitt y las densidades de las corrientes. El solucionador cumple el P80 del rebose y la carga circulante publicados, que son entradas. Lo que calcula después se compara: la energía específica neta es 7,30 kWh/t frente a 7,71 publicados (3.885 kW netos sobre 504 t/h), 5,2% bajo ellos y dentro del 20% que fijó el requisito antes de la primera corrida; el corte corregido es 188 µm frente a 183,3, el cortocircuito de agua 37,4% frente a 37,5%, y la distribución granulométrica del rebose queda dentro de 0,5 puntos de la publicada en los 20 tamices. Hasta 0.08.000 este oráculo usaba los valores iniciales de parámetros de otro ejemplo, una alimentación y un clasificador de autor, y comparaba su energía con el valor bruto publicado.' },
    { en: 'The same example tests the cyclone sizing, and the sizing fails. At Moly-Cop\'s two published classifier states, Plitt\'s uncalibrated equations give a cut 1.66 and 1.38 times the published one and a pressure 2.2 and 1.7 times the published one. Sizing a cluster from the cut amplifies that: for BallSim the engine asks for 2 cyclones at 816 kPa against the published 6 at 53 kPa. Moly-Cop calibrates the equations per survey, and the factors that reproduce each example differ in the same ratio as its printed constants, so the equations are Moly-Cop\'s and only the calibration is missing. The count and pressure are therefore shown as an uncalibrated estimate, never as a result or a flag.',
      es: 'El mismo ejemplo pone a prueba el dimensionado de ciclones, y el dimensionado falla. En los dos estados de clasificación publicados por Moly-Cop, las ecuaciones de Plitt sin calibrar dan un corte 1,66 y 1,38 veces el publicado y una presión 2,2 y 1,7 veces la publicada. Dimensionar una batería a partir del corte lo amplifica: para BallSim el motor pide 2 ciclones a 816 kPa frente a los 6 publicados a 53 kPa. Moly-Cop calibra las ecuaciones por muestreo, y los factores que reproducen cada ejemplo difieren en la misma razón que sus constantes impresas, así que las ecuaciones son las de Moly-Cop y solo falta la calibración. Por eso el número de ciclones y la presión se muestran como una estimación sin calibrar, nunca como un resultado ni un aviso.' },
    { en: 'The GMG guideline\'s two worked examples of the Bond operating work index are reproduced within 0.03 kWh/t (14.38 against 14.4 and 11.71 against 11.7), inside the 0.05 kWh/t tolerance.',
      es: 'Los dos ejemplos resueltos de la guía GMG del índice de trabajo operacional de Bond se reproducen dentro de 0,03 kWh/t (14,38 frente a 14,4 y 11,71 frente a 11,7), dentro de la tolerancia de 0,05 kWh/t.' },
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
    { en: 'The five lumped kinetic models were fitted to the engine\'s virtual batch test of the rougher feed on all 88 baked variants with flotation, and every fit converged. Their lumping errors say how much a lumped model loses when it predicts the plant bank from a batch curve of this kind.',
      es: 'Los cinco modelos cinéticos agrupados se ajustaron a la prueba batch virtual de la alimentación rougher del motor en las 88 variantes horneadas con flotación, y cada ajuste convergió. Sus errores de agregación dicen cuánto pierde un modelo agrupado al predecir el banco de planta desde una curva batch de este tipo.' },
    { en: 'The first-order model loses most: 4.9 points of recovery on average and 8.2 at worst, because it caps the bank at the plateau of the batch test while the bank\'s residence (about 20 to 30 minutes at the nominal states) reaches past the test\'s 16 minutes; it underestimates the bank at every nominal state. The gamma and Kelsall forms, which carry a distribution of rates, lose 0.73 and 0.79 points on average and 1.9 at worst; the Klimpel form loses 1.9 points on average and the stretched exponential 2.8.',
      es: 'El modelo de primer orden pierde más: 4,9 puntos de recuperación en promedio y 8,2 en el peor caso, porque limita el banco a la meseta de la prueba batch mientras la residencia del banco (unos 20 a 30 minutos en los estados nominales) llega más allá de los 16 minutos de la prueba; subestima el banco en cada estado nominal. Las formas gamma y de Kelsall, que llevan una distribución de tasas, pierden 0,73 y 0,79 puntos en promedio y 1,9 en el peor caso; la forma de Klimpel pierde 1,9 puntos en promedio y la exponencial estirada 2,8.' },
  ],
  equations: [
    { tex: r`\bar\varepsilon = \frac{1}{n}\sum_{v} \left|\hat R_N^{(v)} - R_N^{(v)}\right|`, caption: { en: 'The mean absolute lumping error of a model over the n baked variants with flotation.', es: 'El error de agregación absoluto medio de un modelo sobre las n variantes horneadas con flotación.' } },
  ],
  limits: [
    { en: 'The batch test is virtual, without the froth or entrainment effects a laboratory test includes; the errors describe this engine\'s rate distributions, not any particular ore.', es: 'La prueba batch es virtual, sin los efectos de espuma ni de arrastre que incluye una prueba de laboratorio; los errores describen las distribuciones de tasas de este motor, no un mineral particular.' },
  ],
  figure: { caption: { en: 'Mean and worst absolute lumping error of each model over the 88 baked variants with flotation.', es: 'Error de agregación absoluto medio y peor de cada modelo sobre las 88 variantes horneadas con flotación.' }, render: lang => <KineticsChart lang={lang} /> },
  data: lang => <KineticsTable lang={lang} />,
  refs: ['marquardt1963', 'polat2000', 'bu2017', 'vinnett2025'],
};

const OPTIMIZATION: Topic = {
  id: 'optimization',
  title: { en: 'Constrained optimization', es: 'Optimización con restricciones' },
  paragraphs: [
    { en: 'The pattern search, from six starts with all the weight on recovered metal, found a point within every constraint for 94 of the 96 variants. The two it could not are the magnetite case\'s harder ore and higher throughput: with the grind as its only decision and the mill already at installed power, no grind target meets every constraint.',
      es: 'La búsqueda por patrones, desde seis inicios y con todo el peso en el metal recuperado, encontró un punto dentro de todas las restricciones en 94 de las 96 variantes. Las dos que no son las de mineral más duro y más tonelaje del caso de magnetita: con la molienda como única decisión y el molino ya a potencia instalada, ningún objetivo de molienda cumple todas las restricciones.' },
    { en: 'Twenty-eight of the 72 target-mode variants break at least one constraint as they are run, which is the point of the variants: they push the plant. The gain of the optimum over the variant\'s own state ranges from -0.8% (the magnetite case with a coarser grind) to +18.1% (oxide copper with a coarser grind), both measured from a state that broke a constraint: meeting the constraints is worth recovering less metal in the one, and the broken constraint inflates the other. Over the 44 target-mode variants whose own state met every constraint the gains run from 0.3% (the magnetite case with a finer crusher setting) to 15.4% (low-grade copper with a coarser grind). At the nominal states the gains run from 0.3% (magnetite) to 7.6% (oxide copper). The 24 cut-mode variants meet every constraint as run, and with the classifier cut as the grind decision their optima gain 0.3% (magnetite) to 5.1% (zinc).',
      es: 'Veintiocho de las 72 variantes en modo objetivo violan al menos una restricción tal como se ejecutan, que es el sentido de las variantes: exigen a la planta. La ganancia del óptimo sobre el estado propio de la variante va de -0,8% (el caso de magnetita con molienda más gruesa) a +18,1% (cobre oxidado con molienda más gruesa), ambas medidas desde un estado que violaba una restricción: en una cumplir las restricciones vale recuperar menos metal, y en la otra la restricción violada infla la ganancia. Sobre las 44 variantes en modo objetivo cuyo propio estado cumplía cada restricción las ganancias van de 0,3% (el caso de magnetita con una abertura de chancador menor) a 15,4% (cobre de baja ley con molienda más gruesa). En los estados nominales las ganancias van de 0,3% (magnetita) a 7,6% (cobre oxidado). Las 24 variantes en modo de corte cumplen cada restricción tal como se ejecutan, y con el corte del clasificador como decisión de molienda sus óptimos ganan de 0,3% (magnetita) a 5,1% (zinc).' },
    { en: 'Installed power is the constraint that shapes the answer most often, active at 81 of the 94 optima and at all 24 in the cut mode, then the grade specification at 23 and the water capacity at 10: with the objective on recovered metal alone, the optimizer spends every kilowatt the mill has.',
      es: 'La potencia instalada es la restricción que más a menudo da forma a la respuesta, activa en 81 de los 94 óptimos y en los 24 del modo de corte, luego la especificación de ley en 23 y la capacidad de agua en 10: con el objetivo solo en el metal recuperado, el optimizador gasta cada kilowatt que tiene el molino.' },
    { en: 'The screen did not save engine evaluations. Over the 72 screened variants the search spent 24,758 engine evaluations, against 21,692 for the same starts and weight without the screen: 14.1% more, with fewer evaluations in 1 variant, more in 64 and the same in 7. Of the 74,327 candidates it screened, the guard rejected 5,023 and the interval 42,306; the engine evaluated the best passing candidate 5,142 times, and 829 of those improved the incumbent. Where it proposed, the surrogate\'s recovery was 0.63 points from the engine\'s, averaged over the variants; over the 5,142 proposals the mean is 0.70 points, the median 0.60 and the largest 46.8, and the surrogate sits below the engine in two thirds of them. Without the screen the search reaches the same optimum in 65 of the 72 variants, and the other seven within 0.02% of the recovered metal, at most five of the finest mesh steps away in any decision. The cut-mode searches run unscreened, because the learned lane describes the target mode.',
      es: 'El filtro no ahorró evaluaciones del motor. Sobre las 72 variantes filtradas la búsqueda gastó 24.758 evaluaciones del motor, frente a 21.692 para los mismos inicios y peso sin el filtro: 14,1% más, con menos evaluaciones en 1 variante, más en 64 y las mismas en 7. De los 74.327 candidatos que filtró, el guardia rechazó 5.023 y el intervalo 42.306; el motor evaluó el mejor candidato que pasó 5.142 veces, y 829 de ellos mejoraron al incumbente. Donde propuso, la recuperación del sustituto quedó a 0,63 puntos de la del motor, en promedio sobre las variantes; sobre las 5.142 propuestas la media es 0,70 puntos, la mediana 0,60 y la mayor 46,8, y el sustituto queda bajo el motor en dos tercios de ellas. Sin el filtro la búsqueda llega al mismo óptimo en 65 de las 72 variantes, y las otras siete quedan dentro de 0,02% del metal recuperado, a lo más a cinco de los pasos de malla más finos en cualquier decisión. Las búsquedas en modo de corte corren sin filtro, porque la vía aprendida describe el modo objetivo.' },
    { en: 'Moving weight from metal to energy trades one for the other. At the nominal states, with a quarter of the weight on metal, the optimum spends 31 to 46% less energy per tonne and recovers 7 to 35% less metal than the metal-only optimum; the magnetite optimum does not move, because its grade specification already binds there and a coarser grind would break it. Along every path neither the energy nor the metal rises as the weight falls, beyond 0.004%, the mesh\'s resolution.',
      es: 'Mover peso del metal a la energía intercambia metal por energía. En los estados nominales, con un cuarto del peso en el metal, el óptimo gasta de 31 a 46% menos energía por tonelada y recupera de 7 a 35% menos metal que el óptimo solo de metal; el óptimo de la magnetita no se mueve, porque su especificación de ley ya está activa allí y una molienda más gruesa la violaría. A lo largo de cada trayectoria ni la energía ni el metal suben al bajar el peso, más allá de 0,004%, la resolución de la malla.' },
  ],
  equations: [
    { tex: r`g = \frac{\dot m(u^{*}) - \dot m(u_v)}{\dot m(u_v)}`, caption: { en: 'The gain of the optimum $u^{*}$ over the variant\'s own point $u_v$ in recovered metal.', es: 'La ganancia del óptimo $u^{*}$ sobre el punto propio de la variante $u_v$ en metal recuperado.' } },
    { tex: r`\Delta N = \frac{N_{s} - N_{0}}{N_{0}}`, caption: { en: 'What the screen costs or saves: the engine evaluations of the screened search $N_s$ against those of the same starts and weight without it, $N_0$.', es: 'Lo que cuesta o ahorra el filtro: las evaluaciones del motor de la búsqueda filtrada $N_s$ frente a las de los mismos inicios y peso sin él, $N_0$.' } },
  ],
  limits: [
    { en: 'A steady-state optimum of an authored plant, weighing recovered metal against energy per tonne: no reagent cost, payability or value of energy beyond the declared weight, and no froth-stability penalty on air.', es: 'Un óptimo de estado estacionario de una planta de autor, que pondera el metal recuperado contra la energía por tonelada: sin costo de reactivos, condiciones comerciales ni valor de la energía más allá del peso declarado, y sin penalización de estabilidad de espuma al aire.' },
    { en: 'A pattern search converges to a local optimum on its mesh; the six starts are the safeguard against a poor one, and the unscreened run of every screened variant is a second search from the same starts.', es: 'Una búsqueda por patrones converge a un óptimo local en su malla; los seis inicios son la salvaguarda contra uno malo, y la corrida sin filtro de cada variante filtrada es una segunda búsqueda desde los mismos inicios.' },
  ],
  figure: { caption: { en: 'The optimizer\'s gain over every variant of every case, by whether the variant\'s own state met every constraint.', es: 'La ganancia del optimizador sobre cada variante de cada caso, según si el estado propio de la variante cumplía cada restricción.' }, render: lang => <OptimizerChart lang={lang} /> },
  data: lang => <OptimizerTable lang={lang} />,
  refs: ['torczon1997', 'audet2006', 'audet2009', 'booker1999'],
};

const UNCERTAINTY: Topic = {
  id: 'uncertainty',
  title: { en: 'Uncertainty and sensitivity', es: 'Incertidumbre y sensibilidad' },
  paragraphs: [
    { en: 'With the operating point held at nominal, 128 draws of the work index, head grade, liberation size and floatability spread recovery between P05 and P95 by about 2.0 points in the free-milling gold (1.9 to 2.1 over the eight seeds of the seed study) and up to about 8.7 points in the zinc case (8.3 to 9.4); the precomputed records, one seed each, read 1.9 and 7.7. The gold and zinc cases are the narrowest and the widest in every seed. The chance of meeting every constraint at once is lowest in the magnetite case, about 52% (50 to 56% over the seeds; its grade meets its specification in 66% of the record\'s draws and its mill stays within installed power in 79%), lowest in seven of the eight seeds, and highest at about 81% in the soft porphyry and the gold case; the phosphate case\'s 83% in the record is one draw of 128 above them, inside one seed\'s sampling error.',
      es: 'Con el punto de operación fijo en el nominal, 128 sorteos del índice de trabajo, la ley de cabeza, el tamaño de liberación y la flotabilidad separan la recuperación entre P05 y P95 en unos 2,0 puntos en el oro de molienda libre (1,9 a 2,1 sobre las ocho semillas del estudio de semillas) y hasta unos 8,7 puntos en el caso de zinc (8,3 a 9,4); los registros precalculados, una semilla cada uno, dan 1,9 y 7,7. Los casos de oro y de zinc son el más estrecho y el más ancho en cada semilla. La probabilidad de cumplir todas las restricciones a la vez es menor en el caso de magnetita, cerca de 52% (50 a 56% sobre las semillas; su ley cumple su especificación en 66% de los sorteos del registro y su molino queda dentro de la potencia instalada en 79%), la menor en siete de las ocho semillas, y mayor, cerca de 81%, en el pórfido blando y el caso de oro; el 83% del caso de fosfato en el registro está un sorteo de 128 sobre ellos, dentro del error de muestreo de una semilla.' },
    { en: 'The Sobol indices at the nominal states name the input behind each output. Floatability drives recovery in ten cases (the work index in the hard porphyry, the head grade in the magnetite); liberation size drives concentrate grade in eight (the head grade in the two gold cases, the nickel and the oxide copper); the work index drives grinding energy and the head grade drives recovered metal in all twelve.',
      es: 'Los índices de Sobol en los estados nominales nombran la entrada detrás de cada salida. La flotabilidad domina la recuperación en diez casos (el índice de trabajo en el pórfido duro, la ley de cabeza en la magnetita); el tamaño de liberación domina la ley del concentrado en ocho (la ley de cabeza en los dos casos de oro, en el níquel y en el cobre oxidado); el índice de trabajo domina la energía de molienda y la ley de cabeza el metal recuperado en los doce.' },
  ],
  equations: [
    { tex: r`\Pr[c] \approx \frac{1}{128}\sum_{s=1}^{128} \mathbb{1}\left[c(x_s)\right]`, caption: { en: 'The probability of meeting a constraint c: the share of the 128 draws $x_s$ whose state meets it.', es: 'La probabilidad de cumplir una restricción c: la fracción de los 128 sorteos $x_s$ cuyo estado la cumple.' } },
  ],
  limits: [
    { en: 'The spreads are authored and the inputs independent by construction; real ore properties co-vary, and the indices are only as meaningful as that assumption.', es: 'Los rangos son de autor y las entradas independientes por construcción; las propiedades reales del mineral covarían, y los índices valen lo que ese supuesto.' },
    { en: 'The workbench re-runs the uncertainty record at another seed or sample count, in the browser, with the same generator as the bake; the Sobol indices are baked only, at the nominal states, and are not re-run live.', es: 'El laboratorio vuelve a correr el registro de incertidumbre con otra semilla o número de muestras, en el navegador, con el mismo generador del horneado; los índices de Sobol solo se hornean, en los estados nominales, y no se vuelven a correr en vivo.' },
  ],
  figure: { caption: { en: 'The recovery quantiles of every case under the ore\'s uncertainty, at its nominal operating point.', es: 'Los cuantiles de recuperación de cada caso bajo la incertidumbre del mineral, en su punto nominal de operación.' }, render: lang => <UncertaintyChart lang={lang} /> },
  data: lang => <UncertaintyTable lang={lang} />,
  refs: ['saltelli2010', 'salib2017'],
};

const LEARNED: Topic = {
  id: 'learned',
  title: { en: 'The learned lane', es: 'La vía aprendida' },
  paragraphs: [
    { en: 'Interpolation and transfer rank the models differently. Under interpolation the MLP fits recovery best (R² 0.947 at the record\'s seed; its RMSE is 2.7 to 4.0 points over five training seeds). Transfer to a plant the models have not seen is where they part: the MLP is the most accurate model on each held-out copper sulphide plant (1.6 to 3.6 points over the five seeds), and the least accurate on the plants whose circuits differ from the rest, where it predicts far outside 0 to 100% (179 to 242 points on the magnetite plant and 28 to 500 on the phosphate plant over the seeds). Its mean leave-one-case-out RMSE is therefore as much the seed\'s as the model\'s: 27.0 to 65.4 points over the five seeds, 65.4 at the record\'s. Gradient boosting has the best median leave-one-case-out R² on recovery (0.668), and gradient boosting and the random forest cannot be told apart by mean error (13.7 and 13.5 points): the forest is better in only 3 of the 12 folds, and its lower mean comes from the magnetite and phosphate folds. The Gaussian process is fitted on a subsample of 500 of the 2,460 training states; on the same 500 states the random forest and gradient boosting interpolate recovery with an R² of 0.706 and 0.824, against the Gaussian process\'s 0.814.',
      es: 'La interpolación y la transferencia ordenan los modelos de forma distinta. En interpolación el MLP ajusta mejor la recuperación (R² 0,947 con la semilla del registro; su RMSE es 2,7 a 4,0 puntos sobre cinco semillas de entrenamiento). La transferencia a una planta que los modelos no han visto es donde se separan: el MLP es el modelo más exacto en cada planta de sulfuros de cobre reservada (1,6 a 3,6 puntos sobre las cinco semillas), y el menos exacto en las plantas cuyos circuitos difieren del resto, donde predice muy fuera de 0 a 100% (179 a 242 puntos en la planta de magnetita y 28 a 500 en la de fosfato sobre las semillas). Su RMSE medio dejando un caso fuera es entonces tanto de la semilla como del modelo: 27,0 a 65,4 puntos sobre las cinco semillas, 65,4 con la del registro. Gradient boosting tiene el mejor R² mediano dejando un caso fuera en recuperación (0,668), y gradient boosting y el bosque aleatorio no se distinguen por el error medio (13,7 y 13,5 puntos): el bosque es mejor en solo 3 de las 12 particiones, y su media menor viene de las particiones de magnetita y fosfato. El proceso gaussiano se ajusta con una submuestra de 500 de los 2.460 estados de entrenamiento; con los mismos 500 estados el bosque aleatorio y gradient boosting interpolan la recuperación con un R² de 0,706 y 0,824, frente al 0,814 del proceso gaussiano.' },
    { en: 'Specific energy transfers for most models and folds: every model but ridge keeps a median leave-one-case-out R² between 0.927 and 0.969, since hardness, grind and throughput per megawatt govern it in every case, but on the held-out phosphate circuit the Gaussian process (R² -16.5) and the MLP (R² -1,061 at the record\'s seed) fail. The upgrade ratio\'s median R² over all twelve folds is negative for every model, which says as much about R² on cases whose own upgrade barely varies (the two gold plants) as about transfer: among the five copper sulphide plants, which share their mineralogy, the upgrade transfers, with a median R² of 0.92 to 0.93 for the Gaussian process, the MLP and gradient boosting (0.72 for the random forest, -0.40 for ridge), and it fails on the plants with other circuits. The Gaussian process\'s 95% intervals cover 84.2, 88.9 and 91.7% of the held-out states under interpolation, and 75.8, 63.9 and 94.2% under leave one case out (2%, 0.4% and 73% in the worst fold): too narrow for recovery and the upgrade.',
      es: 'La energía específica transfiere en la mayoría de los modelos y las particiones: cada modelo salvo ridge mantiene un R² mediano dejando un caso fuera entre 0,927 y 0,969, porque la dureza, la molienda y el tratamiento por megawatt la gobiernan en cada caso, pero en el circuito de fosfato reservado fallan el proceso gaussiano (R² -16,5) y el MLP (R² -1.061 con la semilla del registro). El R² mediano de la razón de enriquecimiento sobre las doce particiones es negativo para cada modelo, lo que dice tanto del R² en casos cuyo propio enriquecimiento casi no varía (las dos plantas de oro) como de la transferencia: entre las cinco plantas de sulfuros de cobre, que comparten su mineralogía, el enriquecimiento transfiere, con un R² mediano de 0,92 a 0,93 para el proceso gaussiano, el MLP y gradient boosting (0,72 para el bosque aleatorio, -0,40 para ridge), y falla en las plantas con otros circuitos. Los intervalos del 95% del proceso gaussiano cubren 84,2, 88,9 y 91,7% de los estados reservados en interpolación, y 75,8, 63,9 y 94,2% dejando un caso fuera (2%, 0,4% y 73% en la peor partición): demasiado estrechos para la recuperación y el enriquecimiento.' },
    { en: 'The guard raises a false alarm on 2.3% of the envelope\'s held-out states. How often it accepts a state outside the envelope depends on how far outside it is: with one feature moved half its training range past the maximum it accepts 17.7% of the probes (20.4% below the minimum), at a tenth of the range 45% (60% below), and at the full range 14%. At half the range 88% of the accepts step out along the crusher setting, the circulating load or the overflow water (92 to 95% of those probes accepted), so the guard barely notices a state that is unusual only in those inputs. Held out, the oxide copper, gold, magnetite, phosphate and refractory gold plants are flagged in every state; nickel (90%) and zinc (17%) sit between, and the five copper sulphide plants are flagged in at most 6.6% of theirs. The guard detects unfamiliar features, not the surrogate\'s error: held out, the soft porphyry is flagged in 4% of its states while gradient boosting\'s upgrade R² there is -1.83, and the refractory gold plant in every state while gradient boosting\'s recovery R² there is 0.65.',
      es: 'El guardia levanta una falsa alarma en 2,3% de los estados reservados de la envolvente. Cuán seguido acepta un estado fuera de la envolvente depende de cuán afuera está: con una variable movida la mitad de su rango de entrenamiento más allá del máximo acepta 17,7% de las sondas (20,4% bajo el mínimo), a un décimo del rango 45% (60% bajo el mínimo), y al rango completo 14%. A la mitad del rango 88% de las aceptaciones salen a lo largo de la abertura del chancador, la carga circulante o el agua del rebose (92 a 95% de esas sondas aceptadas), así que el guardia apenas nota un estado que solo es inusual en esas entradas. Reservadas, las plantas de cobre oxidado, oro, magnetita, fosfato y oro refractario se marcan en cada estado; níquel (90%) y zinc (17%) quedan entre medio, y las cinco plantas de sulfuros de cobre se marcan en a lo más 6,6% de los suyos. El guardia detecta variables desconocidas, no el error del sustituto: reservado, el pórfido blando se marca en 4% de sus estados mientras el R² de enriquecimiento de gradient boosting ahí es -1,83, y la planta de oro refractario en cada estado mientras el R² de recuperación de gradient boosting ahí es 0,65.' },
  ],
  equations: [
    { tex: { en: r`\tilde R^2 = \operatorname{median}_{c}\ R^2_{c}`, es: r`\tilde R^2 = \operatorname{mediana}_{c}\ R^2_{c}` }, caption: { en: 'The transfer score: the median over the twelve folds of the R² on the held-out case c.', es: 'El puntaje de transferencia: la mediana sobre las doce particiones del R² en el caso reservado c.' } },
  ],
  limits: [
    { en: 'The surrogates learn this engine on these twelve authored plants; leave one case out bounds their transfer to a thirteenth authored plant, not to a real one.', es: 'Los sustitutos aprenden este motor en estas doce plantas de autor; dejar un caso fuera acota su transferencia a una decimotercera planta de autor, no a una real.' },
  ],
  figure: { caption: { en: 'Interpolation R² against the median leave-one-case-out R² of every model, for the chosen target.', es: 'R² de interpolación frente al R² mediano dejando un caso fuera de cada modelo, para el objetivo elegido.' }, render: lang => <LearnedChart lang={lang} /> },
  data: lang => <LearnedTables lang={lang} />,
  refs: ['sklearn2011', 'breiman2001', 'friedman2001', 'rasmussen2006', 'pytorch2019'],
};

export const ENGINE_BENCHMARK = { ORACLES, KINETICS, OPTIMIZATION, UNCERTAINTY, LEARNED };
