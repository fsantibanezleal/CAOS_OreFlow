/**
 * Case view (ADR-0016 section 9.B; design §12.1 view 6): the case's context and the comparison of its
 * variants, as the shell's sub-tabs. The context follows the binding order: the problem, the
 * components and variables, the formalization, the scope and assumptions, what each variant shows and
 * how to read the views. Prose is authored (content/cases.ts); every number is read from the artifact:
 * the ore and plant definitions, the contract bounds, the KPI checks and each variant's results.
 */
import { Callout, Equation, Refs, SubTabs } from '@fasl-work/caos-app-shell';
import { mineralTable } from '../../engine/constants';
import type { OperatingContract } from '../../engine/contract';
import type { OperatingPoint } from '../../engine/model';
import { CASE_CONTEXT, VARIANT_NOTES } from '../../content/cases';
import { familyFormulas } from '../../content/equations';
import type { Benchmark, CaseArtifact, CaseIndex } from '../../lib/artifacts.types';
import { formatSignificant, formatValue, formatWithUnit, type Lang } from '../../lib/format';
import { flagShort, metricLabel, mineralName } from '../../lib/i18n';
import { CompareView } from './CompareView';

const TEXT = {
  label: { en: 'Case', es: 'Caso' },
  context: { en: 'Context', es: 'Contexto' },
  compare: { en: 'Variants and cases', es: 'Variantes y casos' },
  problem: { en: 'The problem', es: 'El problema' },
  question: { en: 'The question', es: 'La pregunta' },
  components: { en: 'Components and variables', es: 'Componentes y variables' },
  formalization: { en: 'Formalization', es: 'Formalización' },
  scope: { en: 'Scope and assumptions', es: 'Alcance y supuestos' },
  variants: { en: 'What each variant shows', es: 'Qué muestra cada variante' },
  read: { en: 'How to read and use the views', es: 'Cómo leer y usar las vistas' },
  refs: { en: 'References', es: 'Referencias' },
  mineral: { en: 'Mineral', es: 'Mineral' },
  role: { en: 'Role', es: 'Rol' },
  liberation: { en: 'Liberation size', es: 'Tamaño de liberación' },
  composites: { en: 'In composites', es: 'En mixtos' },
  density: { en: 'Density', es: 'Densidad' },
  carrier: { en: 'carries', es: 'porta' },
  traceCarrier: { en: 'carries trace', es: 'porta traza de' },
  host: { en: 'host gangue', es: 'ganga huésped' },
  gangue: { en: 'gangue', es: 'ganga' },
  magneticTag: { en: 'magnetic', es: 'magnético' },
  gravityTag: { en: 'gravity recoverable', es: 'recuperable por gravedad' },
  unit: { en: 'Unit', es: 'Unidad' },
  parameter: { en: 'Parameter', es: 'Parámetro' },
  input: { en: 'Operating input', es: 'Entrada de operación' },
  nominal: { en: 'Nominal', es: 'Nominal' },
  bounds: { en: 'Contract bounds', es: 'Límites del contrato' },
  crusher: { en: 'Crusher feed F80', es: 'F80 alimentación del chancador' },
  mill: { en: 'Ball mill installed power', es: 'Potencia instalada del molino de bolas' },
  cyclone: { en: 'Cyclone diameter', es: 'Diámetro del ciclón' },
  rougher: { en: 'Rougher cell volume', es: 'Volumen de celda rougher' },
  cleaner: { en: 'Cleaner bank', es: 'Banco de limpieza' },
  recleaner: { en: 'Recleaner bank', es: 'Banco de relimpieza' },
  regrind: { en: 'Regrind energy', es: 'Energía de remolienda' },
  cells: { en: 'cells of', es: 'celdas de' },
  gradeSpec: { en: 'Concentrate grade specification', es: 'Ley mínima del concentrado' },
  water: { en: 'Process-water capacity', es: 'Capacidad de agua de proceso' },
  gravityUnit: { en: 'Gravity unit, maximum recovery of free gold', es: 'Unidad gravimétrica, recuperación máxima de oro libre' },
  magneticUnit: { en: 'LIMS maximum capture', es: 'Captura máxima LIMS' },
  deslimeUnit: { en: 'Desliming sharpness and water bypass', es: 'Nitidez y cortocircuito de agua del deslamado' },
  head: { en: 'Head grade', es: 'Ley de cabeza' },
  kpi: { en: 'Plausibility gates at the nominal state (practice ranges, not predictions)', es: 'Controles de plausibilidad en el estado nominal (rangos de práctica, no predicciones)' },
  within: { en: 'within', es: 'dentro' },
  outside: { en: 'outside', es: 'fuera' },
  variant: { en: 'Variant', es: 'Variante' },
  changes: { en: 'What it changes', es: 'Qué cambia' },
  result: { en: 'Result', es: 'Resultado' },
  nominalState: { en: 'nominal', es: 'nominal' },
  provenance: { en: 'Provenance', es: 'Procedencia' },
  noFlags: { en: 'no flags', es: 'sin avisos' },
};

export function CaseView(props: {
  contract: OperatingContract; artifact: CaseArtifact; index: CaseIndex; benchmark: Benchmark | null; variantId: string; lang: Lang;
  onCursor: (text: string | null) => void;
}) {
  const { artifact, lang } = props;
  const tabs = [
    { id: 'context', label: TEXT.context[lang], content: <CaseContextPanel key={artifact.case_id} contract={props.contract} artifact={artifact} lang={lang} /> },
    { id: 'compare', label: TEXT.compare[lang], content: <CompareView {...props} /> },
  ];
  return (
    <div className="of-view of-view-tabbed of-view-case">
      <SubTabs tabs={tabs} ariaLabel={TEXT.label[lang]} />
    </div>
  );
}

function CaseContextPanel({ contract, artifact, lang }: { contract: OperatingContract; artifact: CaseArtifact; lang: Lang }) {
  const context = CASE_CONTEXT[artifact.case_id];
  const { ore, plant } = artifact.definition;
  const entry = contract.cases[artifact.case_id];
  const declared = Object.fromEntries(contract.inputs.map(s => [s.name, s]));
  const unitOf = (name: string) => (declared[name].unit === 'case' ? entry.primary.unit : declared[name].unit);
  const nominal = artifact.variants.find(v => v.id === 'nominal') ?? artifact.variants[0];
  const m = nominal.trace.metrics;
  const units = nominal.trace.metric_units;

  const role = (id: string) => {
    const parts: string[] = [];
    for (const payable of ore.payables) {
      for (const c of payable.carriers) {
        if (c.mineral !== id) continue;
        parts.push(`${c.mode === 'trace' ? TEXT.traceCarrier[lang] : TEXT.carrier[lang]} ${payable.species} (${formatWithUnit(100 * c.share, '%', lang)})`);
      }
    }
    if (parts.length === 0) parts.push(ore.minerals.some(x => x.host === id) ? TEXT.host[lang] : TEXT.gangue[lang]);
    const spec = ore.minerals.find(x => x.id === id);
    if (spec?.magnetic) parts.push(TEXT.magneticTag[lang]);
    if (spec?.gravity) parts.push(TEXT.gravityTag[lang]);
    return parts.join(', ');
  };

  const plantRows: Array<[string, string]> = [
    [TEXT.crusher[lang], formatWithUnit(plant.crusher.feed_f80_um, 'um', lang)],
    [TEXT.mill[lang], formatWithUnit(plant.mill.installed_power_kw, 'kW', lang)],
    [TEXT.cyclone[lang], `${formatSignificant(plant.cyclone.diameter_cm, lang, 3)} cm`],
  ];
  if (plant.flotation) {
    const f = plant.flotation;
    plantRows.push([TEXT.rougher[lang], `${formatSignificant(f.rougher.cell_volume_m3, lang, 3)} m³`]);
    plantRows.push([TEXT.cleaner[lang], `${f.cleaner.cells} ${TEXT.cells[lang]} ${formatSignificant(f.cleaner.cell_volume_m3, lang, 3)} m³`]);
    if (f.recleaner) plantRows.push([TEXT.recleaner[lang], `${f.recleaner.cells} ${TEXT.cells[lang]} ${formatSignificant(f.recleaner.cell_volume_m3, lang, 3)} m³`]);
    if (f.regrind_energy_kwh_t > 0) plantRows.push([TEXT.regrind[lang], formatWithUnit(f.regrind_energy_kwh_t, 'kWh/t', lang)]);
  }
  if (plant.gravity) plantRows.push([TEXT.gravityUnit[lang], formatWithUnit(100 * plant.gravity.max_recovery, '%', lang)]);
  if (plant.magnetic) plantRows.push([TEXT.magneticUnit[lang], formatWithUnit(100 * plant.magnetic.max_capture, '%', lang)]);
  if (plant.deslime) plantRows.push([TEXT.deslimeUnit[lang], `${formatSignificant(plant.deslime.sharpness, lang, 2)} · ${formatWithUnit(100 * plant.deslime.bypass, '%', lang)}`]);
  if (plant.grade_spec) plantRows.push([TEXT.gradeSpec[lang], `${plant.grade_spec.species} ≥ ${formatWithUnit(plant.grade_spec.minimum, entry.primary.unit, lang)}`]);
  if (plant.water_limit_m3_t > 0) plantRows.push([TEXT.water[lang], formatWithUnit(plant.water_limit_m3_t, 'm3/t', lang)]);

  const shown = (name: string, value: number) => {
    const spec = declared[name];
    return spec.display_scale !== 1 ? `${formatValue(value * spec.display_scale, spec.display_unit, lang)}${spec.display_unit}` : formatWithUnit(value, unitOf(name), lang);
  };
  const delta = (key: string, v: (typeof artifact.variants)[number]) => formatWithUnit(v.trace.metrics[key], units[key], lang);

  return (
    <div className="of-context">
      <div className="of-context-text">
        <section>
          <h3>{TEXT.problem[lang]}</h3>
          <p>{artifact.description[lang]}</p>
          {context.problem.map((p, i) => <p key={i}>{p[lang]}</p>)}
          <Callout variant="strong" title={TEXT.question[lang]}>{artifact.question[lang]}</Callout>
        </section>
        <section>
          <h3>{TEXT.scope[lang]}</h3>
          <ul>
            {context.scope.map((s, i) => <li key={i}>{s[lang]}</li>)}
            <li>{`${TEXT.provenance[lang]}: ${artifact.provenance}.`}</li>
          </ul>
          <table className="of-table">
            <caption>{TEXT.kpi[lang]}</caption>
            <tbody>{Object.entries(artifact.kpi_ranges).map(([key, [lo, hi]]) => {
              const value = m[key];
              const inside = value >= lo && value <= hi;
              return (
                <tr key={key}><th scope="row">{metricLabel(key, lang)}</th><td>{formatWithUnit(value, units[key], lang)}</td>
                  <td>{`${formatValue(lo, units[key], lang)} – ${formatWithUnit(hi, units[key], lang)}`}</td>
                  <td><span className={inside ? 'of-tag ok' : 'of-tag'}>{inside ? TEXT.within[lang] : TEXT.outside[lang]}</span></td></tr>
              );
            })}</tbody>
          </table>
        </section>
        <section>
          <h3>{TEXT.variants[lang]}</h3>
          <table className="of-table of-variant-notes">
            <thead><tr><th scope="col">{TEXT.variant[lang]}</th><th scope="col">{TEXT.changes[lang]}</th><th scope="col">{TEXT.result[lang]}</th></tr></thead>
            <tbody>{artifact.variants.map(v => (
              <tr key={v.id}><th scope="row">{v.label[lang]}</th><td>{VARIANT_NOTES[v.id]?.[lang]}</td>
                <td>{[`${metricLabel('recovery_pct', lang)} ${delta('recovery_pct', v)}`, `${metricLabel('concentrate_grade', lang)} ${delta('concentrate_grade', v)}`,
                  `${metricLabel('p80_um', lang)} ${delta('p80_um', v)}`,
                  v.trace.flags.length ? v.trace.flags.map(f => flagShort(f.code, lang)).join(', ') : TEXT.noFlags[lang]].join('; ')}</td></tr>
            ))}</tbody>
          </table>
        </section>
        <section>
          <h3>{TEXT.read[lang]}</h3>
          <ul>{context.read.map((s, i) => <li key={i}>{s[lang]}</li>)}</ul>
          <Refs ids={context.refs} label={TEXT.refs[lang]} />
        </section>
      </div>
      <div className="of-context-side">
        <section>
          <h3>{TEXT.components[lang]}</h3>
          <table className="of-table">
            <thead><tr><th scope="col">{TEXT.mineral[lang]}</th><th scope="col">{TEXT.role[lang]}</th><th scope="col">{TEXT.liberation[lang]}</th>
              <th scope="col">{TEXT.composites[lang]}</th><th scope="col">{TEXT.density[lang]}</th></tr></thead>
            <tbody>{ore.minerals.map(x => (
              <tr key={x.id}><th scope="row">{mineralName(x.id, lang)}</th><td>{role(x.id)}</td>
                <td>{x.liberation_size_um > 0 ? formatWithUnit(x.liberation_size_um, 'um', lang) : ''}</td>
                <td>{x.liberation_size_um > 0 ? formatWithUnit(100 * x.composite_content, '%', lang) : ''}</td>
                <td>{`${formatSignificant(mineralTable[x.id]?.density, lang, 3)} t/m³`}</td></tr>
            ))}</tbody>
          </table>
          <p className="of-footnote">{ore.payables.map(p => `${TEXT.head[lang]} ${p.species} ${formatWithUnit(p.head_grade, p.unit, lang)}`).join('; ')}</p>
          <table className="of-table">
            <thead><tr><th scope="col">{TEXT.unit[lang]}</th><th scope="col">{TEXT.parameter[lang]}</th></tr></thead>
            <tbody>{plantRows.map(([name, value]) => <tr key={name}><th scope="row">{name}</th><td>{value}</td></tr>)}</tbody>
          </table>
          <table className="of-table">
            <thead><tr><th scope="col">{TEXT.input[lang]}</th><th scope="col">{TEXT.nominal[lang]}</th><th scope="col">{TEXT.bounds[lang]}</th></tr></thead>
            <tbody>{Object.keys(entry.inputs).map(name => (
              <tr key={name}><th scope="row">{declared[name].label[lang]}</th><td>{shown(name, artifact.nominal[name as keyof OperatingPoint])}</td>
                <td>{`${shown(name, entry.inputs[name].min)} – ${shown(name, entry.inputs[name].max)}`}</td></tr>
            ))}</tbody>
          </table>
        </section>
        <section>
          <h3>{TEXT.formalization[lang]}</h3>
          {familyFormulas(artifact.family).map(f => <Equation key={f.tex} tex={f.tex} caption={f.caption[lang]} />)}
        </section>
      </div>
    </div>
  );
}
