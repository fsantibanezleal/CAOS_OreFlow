/**
 * Circuit view (PE-37): the flowsheet from the trace with every stream's flow and grade filling the stage,
 * and for the selected unit a card with its input and output streams and its closure error from the
 * independent audit.
 */
import type { TopologyUnit } from '../../engine/circuit';
import type { Trace } from '../../engine/trace';
import { formatSignificant, formatWithUnit, type Lang } from '../../lib/format';
import { metricLabel, streamName } from '../../lib/i18n';
import { FlowsheetDiagram, unitName } from '../FlowsheetDiagram';

type StreamRecord = { solids_tph: number; water_tph: number; solids_pct: number; grades: Record<string, number> };

const TEXT = {
  summary: { en: 'Flowsheet of the circuit with the solids flow and payable grade of every stream; recycle streams are dashed.', es: 'Diagrama del circuito con el flujo de sólidos y la ley del pagable de cada corriente; las recirculaciones van segmentadas.' },
  hint: { en: 'Select a unit to see its streams and its mass-balance closure.', es: 'Seleccione una unidad para ver sus corrientes y el cierre de su balance.' },
  inputs: { en: 'In', es: 'Entra' },
  outputs: { en: 'Out', es: 'Sale' },
  stream: { en: 'Stream', es: 'Corriente' },
  solids: { en: 'Solids', es: 'Sólidos' },
  water: { en: 'Water', es: 'Agua' },
  solidsPct: { en: 'Solids', es: 'Sólidos' },
  grade: { en: 'Grade', es: 'Ley' },
  closure: { en: 'Closure error (relative)', es: 'Error de cierre (relativo)' },
  added: { en: 'Water added', es: 'Agua agregada' },
  close: { en: 'Close', es: 'Cerrar' },
};

export function CircuitView({ trace, primary, lang, selected, onSelect }: {
  trace: Trace; primary: { species: string; unit: string }; lang: Lang; selected: string | null; onSelect: (unit: string | null) => void;
}) {
  const topology = trace.topology as unknown as TopologyUnit[];
  const streams = trace.streams as unknown as Record<string, StreamRecord>;
  const balance = trace.balance as unknown as { units: Record<string, number> };
  const unit = topology.find(u => u.unit === selected) ?? null;
  const row = (name: string) => {
    const s = streams[name];
    return (
      <tr key={name}>
        <th scope="row">{streamName(name, lang)}</th>
        <td>{formatWithUnit(s?.solids_tph, 't/h', lang)}</td>
        <td>{formatWithUnit(s?.water_tph, 't/h', lang)}</td>
        <td>{formatWithUnit(s?.solids_pct, '%', lang)}</td>
        <td>{formatWithUnit(s?.grades[primary.species], primary.unit, lang)}</td>
      </tr>
    );
  };
  return (
    <div className="of-view of-view-circuit">
      <div className="of-stage">
        <FlowsheetDiagram trace={trace} primary={primary} lang={lang} selected={selected} onSelect={onSelect} summary={TEXT.summary[lang]} />
        {!unit && <p className="of-stage-hint">{TEXT.hint[lang]}</p>}
        {unit && (
          <aside className="of-unit-card" aria-label={unitName(unit.unit, lang)}>
            <div className="of-unit-card-head">
              <h3>{unitName(unit.unit, lang)}</h3>
              <button type="button" className="of-revert" onClick={() => onSelect(null)}>{TEXT.close[lang]}</button>
            </div>
            <table className="of-table">
              <thead><tr><th scope="col">{TEXT.stream[lang]}</th><th scope="col">{TEXT.solids[lang]}</th><th scope="col">{TEXT.water[lang]}</th><th scope="col">{TEXT.solidsPct[lang]}</th><th scope="col">{`${TEXT.grade[lang]} ${primary.species}`}</th></tr></thead>
              <tbody>
                <tr className="of-table-group"><td colSpan={5}>{TEXT.inputs[lang]}</td></tr>
                {unit.inputs.map(row)}
                <tr className="of-table-group"><td colSpan={5}>{TEXT.outputs[lang]}</td></tr>
                {unit.outputs.map(row)}
              </tbody>
            </table>
            <dl className="of-facts">
              {unit.water_added_tph > 0 && <div><dt>{TEXT.added[lang]}</dt><dd>{formatWithUnit(unit.water_added_tph, 't/h', lang)}</dd></div>}
              <div><dt>{TEXT.closure[lang]}</dt><dd>{formatSignificant(balance.units[unit.unit], lang, 2)}</dd></div>
              <div><dt>{metricLabel('balance_max_relative_error', lang)}</dt><dd>{formatSignificant(trace.metrics.balance_max_relative_error, lang, 2)}</dd></div>
            </dl>
          </aside>
        )}
      </div>
    </div>
  );
}
