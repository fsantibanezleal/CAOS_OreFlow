/**
 * Experiments (ADR-0016 section 9.C): the design of the numerical experiments and its coverage, the
 * metrics (with the kinetic protocol) and what the single-factor variants did in every case; the data and
 * splits tabs are experiments-data.tsx, the uncertainty and ablations tabs experiments-studies.tsx. Transcribed from the process-engine design and
 * requirements and the methodology pages; every result is read from the committed benchmark, and every
 * qualitative claim of the results text is checked against it by a test.
 */
import { useState } from 'react';
import type uPlot from 'uplot';
import { Chart } from '../components/charts/Chart';
import { loadBenchmark, loadContract, loadIndex } from '../lib/artifacts';
import type { Benchmark } from '../lib/artifacts.types';
import { formatFixed, formatRange, formatValue, formatWithUnit, kpiMargin, unitLabel, type Lang } from '../lib/format';
import { metricLabel } from '../lib/i18n';
import { Loaded, useArtifact } from './data';
import { VARIANT_KINDS } from './design';
import type { Bi, Topic } from './doc';
import { DATA, SPLITS } from './experiments-data';
import { ABLATIONS, UNCERTAINTY } from './experiments-studies';
import { Arrow, pick } from './figures';

const r = String.raw;

const COMMON = VARIANT_KINDS.slice(0, 5);

/** How each response metric is compared across cases: points of recovery, a relative change, or the unit itself. */
const RESPONSES: Array<{ key: string; mode: 'points' | 'relative' | 'absolute'; unit: string }> = [
  { key: 'recovery_pct', mode: 'points', unit: '%' },
  { key: 'concentrate_grade', mode: 'relative', unit: '%' },
  { key: 'recovered_primary_tph', mode: 'relative', unit: '%' },
  { key: 'specific_energy_total_kwh_t', mode: 'absolute', unit: 'kWh/t' },
  { key: 'p80_um', mode: 'absolute', unit: 'um' },
  { key: 'mill_power_kw', mode: 'absolute', unit: 'kW' },
  { key: 'water_intensity_m3_t', mode: 'absolute', unit: 'm3/t' },
];

function DesignFigure({ lang }: { lang: Lang }) {
  const p = (en: string, es: string) => pick(lang, en, es);
  const arrow = 'url(#of-exp-arrow)';
  const sobol = [[0.5, 0.5], [0.25, 0.75], [0.75, 0.25], [0.375, 0.375], [0.875, 0.875], [0.625, 0.125], [0.125, 0.625], [0.1875, 0.3125], [0.6875, 0.8125], [0.9375, 0.0625], [0.4375, 0.5625], [0.3125, 0.1875], [0.8125, 0.6875], [0.0625, 0.9375], [0.5625, 0.4375], [0.15625, 0.84375]];
  const panel = (x: number, title: string) => (
    <g>
      <rect className="dg-box" x={x} y="36" width="120" height="120" />
      <text className="dg-box-title" x={x + 60} y="26" textAnchor="middle">{title}</text>
    </g>
  );
  return (
    <svg className="fig-svg" viewBox="0 0 440 214" role="img" aria-label={p('One factor at a time around the nominal, a Latin hypercube, and a space-filling Sobol design', 'Un factor a la vez alrededor del nominal, un hipercubo latino y un diseño Sobol de relleno')}>
      <Arrow id="of-exp-arrow" />
      {panel(10, p('variants', 'variantes'))}
      <circle cx="70" cy="96" r="6" className="dg-fill-accent" />
      {[[70, 50], [116, 96], [70, 142], [30, 96]].map(([x, y]) => <line key={`${x}-${y}`} className="dg-edge" x1="70" y1="96" x2={x} y2={y} markerEnd={arrow} />)}
      {panel(160, p('uncertainty', 'incertidumbre'))}
      {Array.from({ length: 8 }, (_, i) => <line key={`h${i}`} className="dg-grid" x1="160" y1={36 + 15 * i} x2="280" y2={36 + 15 * i} />)}
      {Array.from({ length: 8 }, (_, i) => <line key={`v${i}`} className="dg-grid" x1={160 + 15 * i} y1="36" x2={160 + 15 * i} y2="156" />)}
      {[3, 6, 0, 5, 7, 2, 4, 1].map((row, col) => <circle key={col} cx={160 + 15 * col + 7.5} cy={36 + 15 * row + 7.5} r="3" className="dg-fill-warn" />)}
      {panel(310, p('learned lane', 'vía aprendida'))}
      {sobol.map(([u, v], i) => <circle key={i} cx={310 + 6 + 108 * u} cy={36 + 6 + 108 * v} r="3" className="dg-fill-accent" />)}
      <text className="dg-box-sub" x="70" y="176" textAnchor="middle">{p('one input each', 'una entrada cada una')}</text>
      <text className="dg-box-sub" x="220" y="176" textAnchor="middle">{p('128 ore draws', '128 sorteos del mineral')}</text>
      <text className="dg-box-sub" x="370" y="176" textAnchor="middle">{p('256 states a case', '256 estados por caso')}</text>
      <text className="dg-note" x="220" y="204" textAnchor="middle">{p('each design answers a different question about the same engine', 'cada diseño responde una pregunta distinta sobre el mismo motor')}</text>
    </svg>
  );
}

function RecoveryFigure({ lang }: { lang: Lang }) {
  const p = (en: string, es: string) => pick(lang, en, es);
  const arrow = 'url(#of-exp-arrow-2)';
  return (
    <svg className="fig-svg" viewBox="0 0 440 210" role="img" aria-label={p('Overall recovery on the plant feed, and a stage recovery on its own feed', 'Recuperación total sobre la alimentación de planta, y una recuperación de etapa sobre su propia alimentación')}>
      <Arrow id="of-exp-arrow-2" />
      <rect className="of-dg-frame" x="6" y="30" width="428" height="118" rx="10" />
      <text className="dg-marker-label" x="16" y="24">{p('overall recovery: concentrates over plant feed', 'recuperación total: concentrados sobre alimentación de planta')}</text>
      <text className="dg-edge-label" x="14" y="70">{p('plant feed', 'alimentación')}</text>
      <line className="dg-edge" x1="14" y1="80" x2="98" y2="80" markerEnd={arrow} />
      <rect className="dg-box" x="100" y="58" width="96" height="44" rx="6" />
      <text className="dg-box-title" x="148" y="78" textAnchor="middle">{p('upstream', 'aguas arriba')}</text>
      <text className="dg-box-sub" x="148" y="93" textAnchor="middle">{p('slimes, gravity', 'lamas, gravedad')}</text>
      <line className="dg-edge" x1="148" y1="102" x2="148" y2="138" markerEnd={arrow} />
      <text className="dg-edge-label" x="156" y="128">{p('lost or recovered', 'perdido o recuperado')}</text>
      <text className="dg-edge-label" x="202" y="70">{p('stage feed', 'alim. etapa')}</text>
      <line className="dg-edge" x1="196" y1="80" x2="272" y2="80" markerEnd={arrow} />
      <rect className="of-dg-frame" x="264" y="46" width="160" height="66" rx="8" />
      <rect className="dg-box accent" x="274" y="58" width="96" height="44" rx="6" />
      <text className="dg-box-title" x="322" y="78" textAnchor="middle">{p('flotation', 'flotación')}</text>
      <text className="dg-box-sub" x="322" y="93" textAnchor="middle">{p('rougher, cleaner', 'rougher, cleaner')}</text>
      <line className="dg-edge" x1="370" y1="80" x2="418" y2="80" markerEnd={arrow} />
      <text className="dg-edge-label" x="376" y="72">conc.</text>
      <text className="dg-marker-label" x="344" y="130" textAnchor="middle">{p('stage recovery', 'recuperación de etapa')}</text>
      <text className="dg-note" x="220" y="186" textAnchor="middle">{p('they differ whenever an upstream unit removes payable', 'difieren cuando una unidad aguas arriba retira pagable')}</text>
    </svg>
  );
}


const SIGN_METRICS: Array<{ key: string; label: Bi }> = [
  { key: 'recovery_pct', label: { en: 'recovery', es: 'recuperación' } },
  { key: 'concentrate_grade', label: { en: 'grade', es: 'ley' } },
  { key: 'specific_energy_total_kwh_t', label: { en: 'energy', es: 'energía' } },
  { key: 'recovered_primary_tph', label: { en: 'metal per hour', es: 'metal por hora' } },
];

/** How many cases each common variant moved up and down, per metric: the directions of the results, from the benchmark. */
function SignMatrix({ lang }: { lang: Lang }) {
  const benchmark = useArtifact(loadBenchmark);
  const p = (en: string, es: string) => pick(lang, en, es);
  return (
    <Loaded lang={lang} errors={[benchmark.error]} ready={Boolean(benchmark.value)}>
      {() => {
        const bench = benchmark.value!;
        const count = (kind: string, key: string) => {
          let up = 0, down = 0;
          for (const c of bench.cases) {
            const v = c.variants[kind]?.[key] as number | undefined, n = c.variants.nominal[key] as number;
            if (v === undefined) continue;
            const rel = n ? (v - n) / Math.abs(n) : v - n; // not-engine: the sign of a change between two baked results
            if (rel > 1e-9) up += 1; else if (rel < -1e-9) down += 1;
          }
          return { up, down };
        };
        return (
          <svg className="fig-svg" viewBox="0 0 440 244" role="img" aria-label={p('How many cases each common variant moved up and down, per metric', 'Cuántos casos subió y bajó cada variante común, por métrica')}>
            {SIGN_METRICS.map((m, j) => <text key={m.key} className="of-dg-small" x={176 + 68 * j} y="18" textAnchor="middle">{m.label[lang]}</text>)}
            {COMMON.map((kind, i) => (
              <g key={kind.id}>
                <text className="dg-box-title" x="8" y={50 + 38 * i}>{kind.label[lang]}</text>
                {SIGN_METRICS.map((m, j) => {
                  const { up, down } = count(kind.id, m.key);
                  const x = 144 + 68 * j, y = 28 + 38 * i;
                  return (
                    <g key={m.key}>
                      <rect className="dg-box" x={x} y={y} width="64" height="32" rx="5" />
                      <path className="dg-bar" d={`M ${x + 8} ${y + 21} l 5 -9 l 5 9 z`} />
                      <text className="dg-box-sub" x={x + 21} y={y + 21}>{up}</text>
                      <path className="dg-bar-2" d={`M ${x + 36} ${y + 12} l 5 9 l 5 -9 z`} />
                      <text className="dg-box-sub" x={x + 49} y={y + 21}>{down}</text>
                    </g>
                  );
                })}
              </g>
            ))}
            <text className="dg-note" x="220" y="234" textAnchor="middle">{p('cases that rose and fell from their nominal state', 'casos que subieron y bajaron respecto de su estado nominal')}</text>
          </svg>
        );
      }}
    </Loaded>
  );
}

const TEXT = {
  case: { en: 'Case', es: 'Caso' },
  metric: { en: 'Metric', es: 'Métrica' },
  kpi: { en: 'Checked result', es: 'Resultado verificado' },
  value: { en: 'Nominal value', es: 'Valor nominal' },
  range: { en: 'Checked range', es: 'Rango de verificación' },
  basis: { en: 'Range from', es: 'Rango desde' },
  cited: { en: 'a cited source', es: 'una fuente citada' },
  authored_bound: { en: 'a source, one bound authored', es: 'una fuente, un límite de autor' },
  authored: { en: 'authored', es: 'de autor' },
  inside: { en: 'Inside', es: 'Dentro' },
  yes: { en: 'yes', es: 'sí' },
  no: { en: 'no', es: 'no' },
  none: { en: 'not in this family', es: 'no en esta familia' },
  coverageCaption: {
    en: 'The factor each variant applies to its input, for the variants each case carries in the benchmark; a dash marks a variant the case does not have.',
    es: 'El factor que cada variante aplica a su entrada, para las variantes que lleva cada caso en el benchmark; un guion marca una variante que el caso no tiene.',
  },
  kpiCaption: {
    en: 'Every plausibility check of the nominal states, read from the benchmark; each range is taken from a cited source or labelled authored, and the Case view gives each range\'s source.',
    es: 'Cada verificación de plausibilidad de los estados nominales, leída desde el benchmark; cada rango viene de una fuente citada o está marcado como de autor, y la vista Caso da la fuente de cada rango.',
  },
  kpiCount: {
    en: (n: number, cited: number, bound: number, authored: number) => `Of the ${n} ranges, ${cited} come from a cited source, ${bound} from a cited source with an authored or unverified bound, and ${authored} are authored.`,
    es: (n: number, cited: number, bound: number, authored: number) => `De los ${n} rangos, ${cited} vienen de una fuente citada, ${bound} de una fuente citada con un límite de autor o sin verificar, y ${authored} son de autor.`,
  },
  margin: { en: 'Margin to the nearer bound', es: 'Margen al límite más cercano' },
  pts: { en: 'points', es: 'puntos' },
  overFloor: { en: 'above the floor', es: 'sobre el mínimo' },
  underCeiling: { en: 'below the ceiling', es: 'bajo el máximo' },
  kpiMargins: {
    en: (near: number, n: number, outside: number, states: number, cases: number, total: number) => `${near} of the ${n} checks lie within one point of a bound. Of the ${states} variant states, ${outside} leave the recovery or grade range of their case, in ${cases} of the ${total} cases.`,
    es: (near: number, n: number, outside: number, states: number, cases: number, total: number) => `${near} de las ${n} verificaciones quedan a menos de un punto de un límite. De los ${states} estados de variante, ${outside} salen del rango de recuperación o de ley de su caso, en ${cases} de los ${total} casos.`,
  },
  points: { en: 'change (percentage points)', es: 'cambio (puntos porcentuales)' },
  relative: { en: 'change relative to nominal (%)', es: 'cambio relativo al nominal (%)' },
  absolute: { en: 'change', es: 'cambio' },
  variantKind: { en: 'Variant', es: 'Variante' },
  cases: { en: 'Cases', es: 'Casos' },
  noChange: { en: 'no change', es: 'sin cambio' },
  chartTitle: { en: 'Change from the nominal state, every case', es: 'Cambio respecto del estado nominal, cada caso' },
  chartSummary: { en: 'The change of the chosen metric from each case\'s nominal state under the five common variants; one point per case.', es: 'El cambio de la métrica elegida respecto del estado nominal de cada caso bajo las cinco variantes comunes; un punto por caso.' },
  hover: { en: 'Point at a case to read it', es: 'Apunte a un caso para leerlo' },
  tableCaption: {
    en: 'The change of the chosen metric under every variant each case carries; * marks a state that runs at installed power.',
    es: 'El cambio de la métrica elegida bajo cada variante que lleva cada caso; * marca un estado que opera a potencia instalada.',
  },
};

function CoverageTable({ lang }: { lang: Lang }) {
  const index = useArtifact(loadIndex);
  const benchmark = useArtifact(loadBenchmark);
  return (
    <Loaded lang={lang} errors={[index.error, benchmark.error]} ready={Boolean(index.value && benchmark.value)}>
      {() => (
        <div className="of-doc-scroll">
          <table className="of-doc-table of-doc-table-data">
            <caption>{TEXT.coverageCaption[lang]}</caption>
            <thead><tr><th scope="col">{TEXT.case[lang]}</th>{VARIANT_KINDS.map(k => <th scope="col" key={k.id}>{k.label[lang]}</th>)}</tr></thead>
            <tbody>{benchmark.value!.cases.map(c => (
              <tr key={c.case_id}>
                <th scope="row">{index.value!.cases.find(e => e.case_id === c.case_id)?.title[lang] ?? c.case_id}</th>
                {VARIANT_KINDS.map(k => <td key={k.id}>{c.variants[k.id] ? `× ${formatFixed(k.except?.[c.case_id] ?? k.factor, lang, 2)}` : '-'}</td>)}
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </Loaded>
  );
}

function KpiTable({ lang }: { lang: Lang }) {
  const index = useArtifact(loadIndex);
  const contract = useArtifact(loadContract);
  const benchmark = useArtifact(loadBenchmark);
  return (
    <Loaded lang={lang} errors={[index.error, contract.error, benchmark.error]} ready={Boolean(index.value && contract.value && benchmark.value)}>
      {() => {
        // T-02: the counts are the record's, never typed
        const all = benchmark.value!.cases.flatMap(c => Object.values(c.kpis));
        const count = (basis: string) => all.filter(k => k.basis === basis).length;
        // E-12: the margins and the variants that leave a range, read from the record (the variant states carry the
        // recovery and the grade, not the secondary checks)
        const near = all.filter(k => kpiMargin(k.value, k.range).margin < 1).length;
        const states = benchmark.value!.cases.flatMap(c => Object.entries(c.variants).filter(([id]) => id !== 'nominal').map(([, v]) => ({ c, v })));
        const leaves = states.filter(({ c, v }) => (['recovery_pct', 'concentrate_grade'] as const).some(key => {
          const kpi = c.kpis[key];
          const x = v[key] as number | undefined;
          return kpi && x != null && (x < kpi.range[0] || x > kpi.range[1]);
        }));
        const casesLeaving = new Set(leaves.map(({ c }) => c.case_id)).size;
        return (
        <table className="of-doc-table of-doc-table-data">
          <caption>{`${TEXT.kpiCaption[lang]} ${TEXT.kpiCount[lang](all.length, count('cited'), count('authored_bound'), count('authored'))} ${TEXT.kpiMargins[lang](near, all.length, leaves.length, states.length, casesLeaving, benchmark.value!.cases.length)}`}</caption>
          <thead><tr>{[TEXT.case, TEXT.kpi, TEXT.value, TEXT.range, TEXT.margin, TEXT.basis, TEXT.inside].map(h => <th scope="col" key={h.en}>{h[lang]}</th>)}</tr></thead>
          <tbody>{benchmark.value!.cases.flatMap(c => Object.entries(c.kpis).map(([key, kpi], i) => {
            const unit = key === 'concentrate_grade' ? contract.value!.cases[c.case_id].primary.unit : '%';
            const m = kpiMargin(kpi.value, kpi.range);
            return (
              <tr key={`${c.case_id}-${key}`} className={i === 0 ? 'of-doc-group' : undefined}>
                <th scope="row">{i === 0 ? index.value!.cases.find(e => e.case_id === c.case_id)?.title[lang] : ''}</th>
                <td>{metricLabel(key, lang)}</td>
                <td>{formatWithUnit(kpi.value, unit, lang)}</td>
                <td>{formatRange(kpi.range[0], kpi.range[1], unit, lang)}</td>
                <td>{`${formatFixed(m.margin, lang, 2)} ${unit === '%' ? TEXT.pts[lang] : unitLabel(unit)} ${m.floor ? TEXT.overFloor[lang] : TEXT.underCeiling[lang]}`}</td>
                <td title={kpi.source?.[lang]}>{kpi.basis ? TEXT[kpi.basis][lang] : '-'}</td>
                <td>{kpi.within ? TEXT.yes[lang] : TEXT.no[lang]}</td>
              </tr>
            );
          }))}</tbody>
        </table>
        );
      }}
    </Loaded>
  );
}

/** A variant's change from its nominal in the metric's comparison mode, or null where the case lacks it. */
function change(bench: Benchmark, caseId: string, variant: string, response: (typeof RESPONSES)[number]): number | null {
  const c = bench.cases.find(e => e.case_id === caseId);
  const v = c?.variants[variant];
  const n = c?.variants.nominal;
  if (!v || !n) return null;
  const a = v[response.key] as number, b = n[response.key] as number;
  if (response.mode === 'relative') return b ? (100.0 * (a - b)) / Math.abs(b) : null; // not-engine: a display comparison of two baked results
  return a - b;
}

function ResponsesPanel({ lang }: { lang: Lang }) {
  const index = useArtifact(loadIndex);
  const benchmark = useArtifact(loadBenchmark);
  const [metric, setMetric] = useState('recovery_pct');
  const [reading, setReading] = useState<string | null>(null);
  return (
    <Loaded lang={lang} errors={[index.error, benchmark.error]} ready={Boolean(index.value && benchmark.value)}>
      {() => {
        const bench = benchmark.value!;
        const response = RESPONSES.find(m => m.key === metric)!;
        const title = (id: string) => index.value!.cases.find(e => e.case_id === id)?.title[lang] ?? id;
        const unit = response.mode === 'absolute' ? response.unit : '%';
        const yLabel = `${metricLabel(metric, lang)}: ${TEXT[response.mode][lang]}${response.mode === 'absolute' ? ` (${unitLabel(response.unit)})` : ''}`;
        const show = (value: number | null) => (value === null ? '-' : `${value > 0 ? '+' : ''}${formatValue(value, unit, lang)}`);
        // one point per case and variant kind, spread across the kind's tick so twelve cases stay apart
        const points = COMMON.flatMap((kind, k) => bench.cases.map((c, i) => ({ x: k - 0.3 + (0.6 * i) / (bench.cases.length - 1), y: change(bench, c.case_id, kind.id, response), caseId: c.case_id, kind })))
          .filter(point => point.y !== null)
          .sort((a, b) => a.x - b.x);
        return (
          <div className="of-doc-panel">
            <label className="of-doc-control"><span>{TEXT.metric[lang]}</span>
              <select value={metric} onChange={e => setMetric(e.target.value)}>{RESPONSES.map(m => <option key={m.key} value={m.key}>{metricLabel(m.key, lang)}</option>)}</select>
            </label>
            <div className="of-doc-chart">
              <Chart data={[points.map(p => p.x), points.map(p => p.y)] as uPlot.AlignedData}
                categories={COMMON.map(k => k.label[lang])} xLabel={TEXT.variantKind[lang]} yLabel={yLabel} title={TEXT.chartTitle[lang]}
                series={[{ label: TEXT.cases[lang], colour: 'accent', points: true }]} levels={[{ y: 0, label: TEXT.noChange[lang] }]}
                summary={TEXT.chartSummary[lang]} format={(v, axis) => (axis === 'x' ? '' : show(v))}
                onCursor={cursor => setReading(cursor ? `${points[cursor.index].kind.label[lang]}, ${title(points[cursor.index].caseId)}: ${show(points[cursor.index].y)}` : null)} />
            </div>
            <p className="of-doc-reading" aria-live="polite">{reading ?? TEXT.hover[lang]}</p>
            <div className="of-doc-scroll">
              <table className="of-doc-table of-doc-table-data">
                <caption>{TEXT.tableCaption[lang]}</caption>
                <thead><tr><th scope="col">{TEXT.case[lang]}</th>{VARIANT_KINDS.map(k => <th scope="col" key={k.id}>{k.label[lang]}</th>)}</tr></thead>
                <tbody>{bench.cases.map(c => (
                  <tr key={c.case_id}>
                    <th scope="row">{title(c.case_id)}</th>
                    {VARIANT_KINDS.map(k => {
                      const value = change(bench, c.case_id, k.id, response);
                      const limited = Boolean(c.variants[k.id]?.power_limited);
                      return <td key={k.id} className={value === null ? undefined : value > 0 ? 'of-up' : value < 0 ? 'of-down' : undefined}>{`${show(value)}${limited ? ' *' : ''}`}</td>;
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

const COVERAGE_ROWS: Array<Array<string | Bi>> = [
  [{ en: 'Trace: streams, curves, balances, flags', es: 'Traza: corrientes, curvas, balances, avisos' }, { en: 'every variant', es: 'cada variante' }, { en: 'every variant', es: 'cada variante' }, { en: 'every variant', es: 'cada variante' }, { en: 'every variant', es: 'cada variante' }],
  [{ en: 'Kinetic fits, five lumped models', es: 'Ajustes cinéticos, cinco modelos agrupados' }, { en: 'every variant', es: 'cada variante' }, { en: 'every variant', es: 'cada variante' }, { en: 'not applicable', es: 'no aplica' }, { en: 'every variant', es: 'cada variante' }],
  // the cut mode has its own row: as a parenthetical in a row header, which does not wrap, it pushed the Spanish table
  // 27 px past the page at 1280 (0.08 gate)
  [{ en: 'Constrained optimization', es: 'Optimización con restricciones' }, { en: 'grind, collector, air', es: 'molienda, colector, aire' }, { en: 'grind, collector, air', es: 'molienda, colector, aire' }, { en: 'grind only', es: 'solo molienda' }, { en: 'grind, collector, air', es: 'molienda, colector, aire' }],
  [{ en: 'The same, in the cut mode', es: 'Lo mismo, en modo de corte' }, { en: 'cut, collector, air', es: 'corte, colector, aire' }, { en: 'cut, collector, air', es: 'corte, colector, aire' }, { en: 'cut only', es: 'solo corte' }, { en: 'cut, collector, air', es: 'corte, colector, aire' }],
  [{ en: 'Uncertainty, 128 draws', es: 'Incertidumbre, 128 sorteos' }, { en: 'every variant', es: 'cada variante' }, { en: 'every variant', es: 'cada variante' }, { en: 'every variant', es: 'cada variante' }, { en: 'every variant', es: 'cada variante' }],
  [{ en: 'Sobol indices', es: 'Índices de Sobol' }, { en: 'nominal', es: 'nominal' }, { en: 'nominal', es: 'nominal' }, { en: 'nominal', es: 'nominal' }, { en: 'nominal', es: 'nominal' }],
  [{ en: 'Learned lane design', es: 'Diseño de la vía aprendida' }, { en: '256 states a case', es: '256 estados por caso' }, { en: '256 states a case', es: '256 estados por caso' }, { en: '256 states a case', es: '256 estados por caso' }, { en: '256 states a case', es: '256 estados por caso' }],
];

const DESIGN: Topic = {
  id: 'design',
  title: { en: 'Design of the experiments', es: 'Diseño de los experimentos' },
  paragraphs: [
    { en: 'The numerical experiments are a designed matrix, not a sample of plants. Twelve cases span four circuit families and four teaching categories, and each carries a nominal state, five variants that each change exactly one operating or ore input by a declared factor, and two that run the circuit the plant\'s way round, with the classifier cut held; a test fails the precompute if a variant changes a second input. Every variant runs through the full circuit and every method record, so the difference between a variant and its nominal is the effect of one input at one state, on the same plant.',
      es: 'Los experimentos numéricos son una matriz diseñada, no una muestra de plantas. Doce casos cubren cuatro familias de circuito y cuatro categorías de enseñanza, y cada uno lleva un estado nominal, cinco variantes que cambian exactamente una entrada de operación o del mineral por un factor declarado, y dos que corren el circuito en el sentido de la planta, con el corte del clasificador fijo; una prueba hace fallar el precálculo si una variante cambia una segunda entrada. Cada variante pasa por el circuito completo y por cada registro de métodos, así que la diferencia entre una variante y su nominal es el efecto de una entrada en un estado, sobre la misma planta.' },
    { en: 'The five common variants probe the levers every concentrator has: harder ore (Bond work index ×1.25), a coarser grind (target P80 ×1.35), higher throughput (×1.25), more collector (×1.6) and more air (gas velocity ×1.4). Three families replace some of them with their own lever: gold doubles the gravity bleed instead of adding air; magnetite, which has no flotation, grinds finer (×0.75) and closes the crusher (setting ×0.8); phosphate coarsens the desliming cut by half (×1.5) instead of adding air, and its collector step is ×1.4.',
      es: 'Las cinco variantes comunes prueban las palancas que tiene todo concentrador: mineral más duro (índice de trabajo de Bond ×1,25), una molienda más gruesa (P80 objetivo ×1,35), más tratamiento (×1,25), más colector (×1,6) y más aire (velocidad de gas ×1,4). Tres familias reemplazan algunas con su propia palanca: el oro duplica la purga gravimétrica en vez de agregar aire; la magnetita, que no tiene flotación, muele más fino (×0,75) y cierra el chancador (abertura ×0,8); el fosfato aumenta el corte de deslamado en 50% (×1,5) en vez de agregar aire, y su paso de colector es ×1,4.' },
    { en: 'One factor at a time is chosen so that each result can be read on its own. The method records complement it: the constrained optimizer moves the decisions together, the uncertainty record samples the ore properties together, the Sobol design attributes each output\'s variance to each ore property and their interactions, and the learned lane is trained on a space-filling design over each case\'s whole envelope.',
      es: 'Un factor a la vez se elige para que cada resultado se pueda leer por sí solo. Los registros de métodos lo complementan: el optimizador con restricciones mueve las decisiones juntas, el registro de incertidumbre muestrea juntas las propiedades del mineral, el diseño de Sobol atribuye la varianza de cada salida a cada propiedad del mineral y sus interacciones, y la vía aprendida se entrena con un diseño de relleno sobre toda la envolvente de cada caso.' },
    { en: 'The hypotheses are stated in advance as requirements of the engine, each with the test that fails when it is violated: more collector never lowers recovery by more than 0.01 points (past its peak, near 2.5 times the nominal dose, the oxide copper loses 0.009 points by three times the dose) and, past the valuable mineral\'s saturation, lowers grade; harder ore raises the required energy and, at installed power, coarsens the product; more throughput shortens flotation residence; more air raises water recovery and entrained gangue; a finer grind costs energy and raises liberation; a coarser product loses less payable to slimes where the circuit deslimes.',
      es: 'Las hipótesis se enuncian de antemano como requisitos del motor, cada una con la prueba que falla cuando se viola: más colector nunca baja la recuperación en más de 0,01 puntos (pasado su máximo, cerca de 2,5 veces la dosis nominal, el cobre oxidado pierde 0,009 puntos hasta tres veces la dosis) y, pasada la saturación del mineral valioso, baja la ley; un mineral más duro sube la energía requerida y, a potencia instalada, engruesa el producto; más tratamiento acorta la residencia de flotación; más aire sube la recuperación de agua y la ganga arrastrada; una molienda más fina cuesta energía y sube la liberación; un producto más grueso pierde menos pagable en lamas donde el circuito deslama.' },
  ],
  equations: [
    { tex: r`\Delta_v m = m\big(x^{(v)}\big) - m\big(x^{(0)}\big),\qquad \delta_v m = \frac{\Delta_v m}{\big|m\big(x^{(0)}\big)\big|}`, caption: { en: 'The effect of variant v on a metric m: its change from the nominal state, and the relative change used where units differ between cases.', es: 'El efecto de la variante v sobre una métrica m: su cambio respecto del estado nominal, y el cambio relativo que se usa donde las unidades difieren entre casos.' } },
    { tex: r`N = 12 \times 8 = 96`, caption: { en: 'The design: twelve cases with eight states each, six of the target mode and two of the cut mode, every one a full trace with its method records.', es: 'El diseño: doce casos con ocho estados cada uno, seis del modo objetivo y dos del modo de corte, cada uno una traza completa con sus registros de métodos.' } },
  ],
  limits: [
    { en: 'One factor at a time cannot show interactions between operating inputs; the optimizer and the Response view move several inputs together.', es: 'Un factor a la vez no puede mostrar interacciones entre entradas de operación; el optimizador y la vista de Respuesta mueven varias entradas juntas.' },
    { en: 'The factors are authored, sized so that each variant moves its input well inside the contract envelope.', es: 'Los factores son de autor, dimensionados para que cada variante mueva su entrada bien dentro de la envolvente del contrato.' },
  ],
  figure: { caption: { en: 'Three designs on the same engine: single-factor variants around each nominal, a Latin hypercube of the ore properties, and a space-filling design over each case\'s envelope.', es: 'Tres diseños sobre el mismo motor: variantes de un factor alrededor de cada nominal, un hipercubo latino de las propiedades del mineral, y un diseño de relleno sobre la envolvente de cada caso.' }, render: lang => <DesignFigure lang={lang} /> },
  table: { head: [{ en: 'Method record', es: 'Registro de métodos' }, { en: 'Flotation', es: 'Flotación' }, { en: 'Gravity and flotation', es: 'Gravedad y flotación' }, { en: 'Magnetic', es: 'Magnética' }, { en: 'Desliming and flotation', es: 'Deslamado y flotación' }], rows: COVERAGE_ROWS },
  data: lang => <CoverageTable lang={lang} />,
  refs: ['saltelli2010', 'ears2009'],
};

const METRICS: Topic = {
  id: 'metrics',
  title: { en: 'Metrics', es: 'Métricas' },
  paragraphs: [
    { en: 'Overall recovery is the primary payable in the final concentrates (for gold, the gravity concentrate included) over the payable in the plant feed. Stage recoveries are computed on each stage\'s own feed, so the flotation recovery of a circuit that loses payable to slimes, or recovers it by gravity first, differs from the overall recovery; the two are never confused, and a test fails if they coincide where an upstream loss exists.',
      es: 'La recuperación total es el pagable principal en los concentrados finales (para el oro, incluido el concentrado gravimétrico) sobre el pagable en la alimentación de planta. Las recuperaciones de etapa se calculan sobre la propia alimentación de cada etapa, así que la recuperación de flotación de un circuito que pierde pagable en lamas, o que lo recupera antes por gravedad, difiere de la total; nunca se confunden, y una prueba falla si coinciden donde existe una pérdida aguas arriba.' },
    { en: 'Grades come from mineral masses and element contents. The recovered metal (t/h of the primary payable) is the optimizer\'s objective and the fairest comparison between two states that treat different tonnages; mass pull is the share of the feed that reports to concentrate.',
      es: 'Las leyes salen de las masas de minerales y los contenidos de elementos. El metal recuperado (t/h del pagable principal) es el objetivo del optimizador y la comparación más justa entre dos estados que tratan tonelajes distintos; el rendimiento en masa es la fracción de la alimentación que va al concentrado.' },
    { en: 'Specific energy is crushing plus grinding plus regrind, per tonne of ore; mill power is the grinding energy times the throughput. The Bond operating work index and its efficiency ratio are reported for the achieved reduction, and the Rittinger and Kick laws are comparisons calibrated to Bond, never added to it. Water intensity is the fresh water per tonne of ore.',
      es: 'La energía específica es chancado más molienda más remolienda, por tonelada de mineral; la potencia del molino es la energía de molienda por el tratamiento. El índice de trabajo operacional de Bond y su razón de eficiencia se informan para la reducción lograda, y las leyes de Rittinger y Kick son comparaciones calibradas con Bond, nunca sumadas a él. La intensidad de agua es el agua fresca por tonelada de mineral.' },
    { en: 'Three constraints judge a state: the final grade at or above the case\'s specification, the required mill power at or below the installed power, and the process water within the plant\'s capacity. Each case\'s nominal results are also compared with plausibility ranges for its ore type, each taken from a cited source or labelled authored. The ranges are authoring constraints, not evidence: each case\'s floatability and plant were authored so that its nominal results fall inside them. At the nominal state no case is power-limited and every check lies inside its range, several within a point of a bound, and most cases leave a range under at least one variant; the table reads each check, its margin to the nearer bound and how its range is sourced from the precompute.',
      es: 'Tres restricciones juzgan un estado: la ley final sobre la especificación del caso, la potencia requerida del molino bajo la instalada, y el agua de proceso dentro de la capacidad de la planta. Los resultados nominales de cada caso también se comparan con rangos de plausibilidad para su tipo de mineral, cada uno tomado de una fuente citada o marcado como de autor. Los rangos son restricciones de autor, no evidencia: la flotabilidad y la planta de cada caso se escribieron para que sus resultados nominales queden dentro. En el estado nominal ningún caso está limitado por potencia y cada verificación cae dentro de su rango, varias a menos de un punto de un límite, y la mayoría de los casos sale de un rango con al menos una variante; la tabla lee cada verificación, su margen al límite más cercano y cómo se obtuvo su rango desde el precálculo.' },
    { en: 'Kinetics: for every variant of the flotation families the engine floats its own rougher feed in a virtual batch test from 0.5 to 16 minutes, fits the five lumped models by Levenberg-Marquardt, projects each to the plant bank through the bank\'s residence distribution, and records the lumping error, the projection minus the bank recovery the engine computes exactly from its class rates. Optimization starts from six fixed points (the variant\'s own and five declared interior points) and reports an optimum only if it is feasible when simulated again from scratch, and otherwise the least-violating end point, labelled infeasible.',
      es: 'Cinética: para cada variante de las familias con flotación el motor flota su propia alimentación rougher en una prueba batch virtual de 0,5 a 16 minutos, ajusta los cinco modelos agrupados por Levenberg-Marquardt, proyecta cada uno al banco de planta por la distribución de residencia del banco, y registra el error de agregación, la proyección menos la recuperación del banco que el motor calcula exactamente desde sus tasas por clase. La optimización parte de seis puntos fijos (el de la propia variante y cinco puntos interiores declarados) e informa un óptimo solo si es factible al simularlo de nuevo desde cero, y si no, el punto final de menor violación, marcado como infactible.' },
  ],
  equations: [
    { tex: r`\varepsilon = \hat R_N - R_N`, caption: { en: 'The lumping error ε of a kinetic model: its projection to the bank of N cells minus the exact distributed bank recovery $R_N$.', es: 'El error de agregación ε de un modelo cinético: su proyección al banco de N celdas menos la recuperación exacta del banco distribuido $R_N$.' } },
    { tex: r`R = \frac{C_p}{F_p},\qquad R_s = \frac{C_{p,s}}{F_{p,s}}`, caption: { en: 'Overall recovery: the payable flow in the final concentrates $C_p$ over the payable flow in the plant feed $F_p$; a stage recovery $R_s$ on the stage s\'s own concentrate and feed.', es: 'Recuperación total: el flujo de pagable en los concentrados finales $C_p$ sobre el flujo de pagable en la alimentación de planta $F_p$; una recuperación de etapa $R_s$ sobre el concentrado y la alimentación propios de la etapa s.' } },
    { tex: r`\dot m = R\,f\,F,\qquad W_{i,o} = \frac{E}{10/\sqrt{P_{80}} - 10/\sqrt{F_{80}}}`, caption: { en: 'Recovered metal from recovery, head grade and throughput, and the Bond operating work index of the achieved reduction.', es: 'Metal recuperado desde la recuperación, la ley de cabeza y el tratamiento, y el índice de trabajo operacional de Bond de la reducción lograda.' } },
  ],
  limits: [
    { en: 'The metrics are engine outputs on authored plants; the plausibility ranges test that a case is a sensible instance of its ore type, not that it matches a specific plant.', es: 'Las métricas son salidas del motor sobre plantas de autor; los rangos de plausibilidad prueban que un caso es una instancia sensata de su tipo de mineral, no que coincida con una planta específica.' },
  ],
  figure: { caption: { en: 'Overall recovery is measured on the plant feed, a stage recovery on the stage\'s own feed; an upstream loss separates them.', es: 'La recuperación total se mide sobre la alimentación de planta, una recuperación de etapa sobre la alimentación propia de la etapa; una pérdida aguas arriba las separa.' }, render: lang => <RecoveryFigure lang={lang} /> },
  data: lang => <KpiTable lang={lang} />,
  refs: ['gmg2021', 'porphyry-practice', 'kroha1985', 'zanin2009', 'nickel2024', 'oxide2022', 'phosphate2019', 'marquardt1963', 'torczon1997'],
};

const RESULTS: Topic = {
  id: 'responses',
  title: { en: 'What the variants did', es: 'Qué hicieron las variantes' },
  paragraphs: [
    { en: 'Harder ore sends every case to installed power, as it must: each plant\'s installed power is authored at 1.02 to 1.20 times its nominal requirement, and a 25% higher work index asks for 25% more energy. The circuit can no longer reach its target, the product coarsens by 9 to 64 µm, specific energy rises by 0.5 to 2.5 kWh/t and concentrate grade falls in all twelve cases. Recovery falls in eleven; in the magnetite case the drums keep capturing the coarser composites, so total iron recovery rises while the grade falls.',
      es: 'Un mineral más duro lleva cada caso a potencia instalada, como debe: la potencia instalada de cada planta es de autor, entre 1,02 y 1,20 veces su requerimiento nominal, y un índice de trabajo 25% mayor pide 25% más energía. El circuito ya no alcanza su objetivo, el producto engruesa entre 9 y 64 µm, la energía específica sube entre 0,5 y 2,5 kWh/t y la ley del concentrado baja en los doce casos. La recuperación baja en once; en el caso de magnetita los tambores siguen capturando los mixtos más gruesos, así que la recuperación total de hierro sube mientras la ley baja.' },
    { en: 'A coarser grind target saves 1.2 to 3.4 kWh/t and lowers concentrate grade in eleven cases, because fewer valuable grains are free (in the gold case the grade rises by 0.07 points); recovery falls in eleven cases and, again, rises in the magnetite case.',
      es: 'Un objetivo de molienda más grueso ahorra entre 1,2 y 3,4 kWh/t y baja la ley del concentrado en once casos, porque quedan menos granos valiosos libres (en el caso de oro la ley sube 0,07 puntos); la recuperación baja en once casos y, otra vez, sube en el caso de magnetita.' },
    { en: 'Higher throughput also sends every case to installed power, for the same reason, so the energy per tonne falls by 0.6 to 2.8 kWh/t and the product coarsens. Recovery falls in eleven cases, but the metal recovered per hour rises in all twelve: the extra tonnes outweigh the lost recovery. Grade rises in nine cases and falls in the hard porphyry, the magnetite and the refractory gold.',
      es: 'Más tratamiento también lleva cada caso a potencia instalada, por la misma razón, así que la energía por tonelada baja entre 0,6 y 2,8 kWh/t y el producto engruesa. La recuperación baja en once casos, pero el metal recuperado por hora sube en los doce: las toneladas extra pesan más que la recuperación perdida. La ley sube en nueve casos y baja en el pórfido duro, la magnetita y el oro refractario.' },
    { en: 'More collector raises recovery in all eleven flotation cases, by 0.4 to 1.5 points, and lowers concentrate grade in all eleven: in the engine the valuable mineral saturates at a lower dose than the gangue, which keeps responding. More air raises recovery in all nine cases that carry the variant, by 0.8 to 1.3 points; grade rises in seven and falls in the nickel and the refractory gold. More air dilutes every rougher concentrate, but the larger concentrate flow shortens the residence in the fixed cleaner volumes, which then reject more of the slow-floating gangue: the final grade rises through the cleaners, not the rougher. Of the families\' own levers, doubling the gold bleed adds 0.1 points of gold recovery, grinding the magnetite finer raises its concentrate by 1.3 points of Fe at 2.3 kWh/t more and at installed power, a finer crusher setting saves 0.17 kWh/t at the same product, and widening the phosphate desliming cut loses 5.3 points of recovery to the slimes.',
      es: 'Más colector sube la recuperación en los once casos de flotación, entre 0,4 y 1,5 puntos, y baja la ley del concentrado en los once: en el motor el mineral valioso se satura a una dosis menor que la ganga, que sigue respondiendo. Más aire sube la recuperación en los nueve casos que llevan la variante, entre 0,8 y 1,3 puntos; la ley sube en siete y baja en el níquel y el oro refractario. Más aire diluye cada concentrado rougher, pero el mayor caudal de concentrado acorta la residencia en los volúmenes fijos de limpieza, que entonces rechazan más de la ganga de flotación lenta: la ley final sube por las limpiezas, no por el rougher. De las palancas propias de las familias, duplicar la purga de oro agrega 0,1 puntos de recuperación de oro, moler más fino la magnetita sube su concentrado en 1,3 puntos de Fe con 2,3 kWh/t más y a potencia instalada, una abertura de chancador menor ahorra 0,17 kWh/t con el mismo producto, y ampliar el corte de deslamado del fosfato pierde 5,3 puntos de recuperación en las lamas.' },
  ],
  limits: [
    { en: 'Each result is one engine on one authored plant; the directions are the engine\'s physics, and their sizes depend on the authored parameters.', es: 'Cada resultado es un motor sobre una planta de autor; las direcciones son la física del motor, y sus tamaños dependen de los parámetros de autor.' },
  ],
  figure: { caption: { en: 'For each common variant and metric, how many cases rose and how many fell from their nominal state, counted from the benchmark.', es: 'Para cada variante común y métrica, cuántos casos subieron y cuántos bajaron respecto de su estado nominal, contados desde el benchmark.' }, render: lang => <SignMatrix lang={lang} /> },
  data: lang => <ResponsesPanel lang={lang} />,
  refs: ['gorain1997', 'savassi1998', 'muthaphuli2014', 'laplante-staunton', 'phosphate2019'],
};


export const EXPERIMENTS: Array<{ id: string; label: Bi; topics: Topic[] }> = [
  { id: 'design', label: { en: 'Design and coverage', es: 'Diseño y cobertura' }, topics: [DESIGN] },
  { id: 'data', label: { en: 'Data', es: 'Datos' }, topics: [DATA] },
  { id: 'splits', label: { en: 'Splits', es: 'Particiones' }, topics: [SPLITS] },
  { id: 'metrics', label: { en: 'Metrics', es: 'Métricas' }, topics: [METRICS] },
  { id: 'responses', label: { en: 'What the variants did', es: 'Qué hicieron las variantes' }, topics: [RESULTS] },
  { id: 'uncertainty', label: { en: 'Uncertainty', es: 'Incertidumbre' }, topics: [UNCERTAINTY] },
  { id: 'ablations', label: { en: 'Ablations', es: 'Ablaciones' }, topics: [ABLATIONS] },
];
