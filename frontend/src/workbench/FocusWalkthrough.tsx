import { useEffect, useMemo, useState } from 'react';
import type { TopologyUnit } from '../engine/circuit';
import type { Trace } from '../engine/trace';
import { formatSignificant, formatWithUnit, type Lang } from '../lib/format';
import { formulaText, streamName } from '../lib/i18n';
import { unitName } from './FlowsheetDiagram';

type Stream = { solids_tph: number; grades: Record<string, number> };
const COPY = {
  title: { en: 'Process walkthrough', es: 'Recorrido del proceso' },
  previous: { en: 'Previous operation', es: 'Operación anterior' },
  next: { en: 'Next operation', es: 'Operación siguiente' },
  play: { en: 'Play walkthrough', es: 'Iniciar recorrido' },
  pause: { en: 'Pause walkthrough', es: 'Pausar recorrido' },
  interval: { en: 'Step interval', es: 'Intervalo entre pasos' },
  input: { en: 'Feed to this operation', es: 'Alimentación de esta operación' },
  outputs: { en: 'Products from this operation', es: 'Productos de esta operación' },
  closure: { en: 'Balance closure error', es: 'Error de cierre del balance' },
  note: { en: 'This steps through the calculated steady-state circuit. It is not elapsed plant time.', es: 'Este recorrido avanza por el circuito calculado en estado estacionario. No representa tiempo de planta.' },
  noUnits: { en: 'This circuit has no separately selectable unit operations.', es: 'Este circuito no tiene operaciones unitarias seleccionables.' },
};

/** A real, data-bound inspection sequence over this case's solved unit topology. */
export function walkthroughUnits(topology: TopologyUnit[]): TopologyUnit[] {
  return topology.filter(unit => !unit.unit.endsWith('_junction') && unit.unit !== 'underflow_return');
}

export function FocusWalkthrough({ trace, primary, lang, caseId, selected, onSelect }: {
  trace: Trace; primary: { species: string; unit: string }; lang: Lang; caseId: string;
  selected: string | null; onSelect: (unit: string | null) => void;
}) {
  const units = useMemo(() => walkthroughUnits(trace.topology as unknown as TopologyUnit[]), [trace.topology]);
  const [index, setIndex] = useState(0);
  const [interval, setInterval] = useState(1800);
  const [playing, setPlaying] = useState(false);
  const unit = units[index];
  const active = units.findIndex(item => item.unit === selected);
  const currentIndex = active >= 0 ? active : index;
  const streams = trace.streams as unknown as Record<string, Stream>;
  const closure = (trace.balance as unknown as { units: Record<string, number> }).units;

  useEffect(() => {
    if (!playing || units.length < 2) return;
    const timer = window.setTimeout(() => {
      if (currentIndex >= units.length - 1) { setPlaying(false); return; }
      const next = currentIndex + 1;
      setIndex(next);
      onSelect(units[next].unit);
    }, interval);
    return () => window.clearTimeout(timer);
  }, [playing, interval, units, onSelect, currentIndex]);

  useEffect(() => {
    if (active >= 0 && active !== index) setIndex(active);
  }, [active, index]);

  useEffect(() => {
    if (units.length) onSelect(units[0].unit);
  // A new case/variant remounts this component so the selected operation starts at the feed.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId]);

  const choose = (next: number) => {
    const bounded = Math.max(0, Math.min(units.length - 1, next));
    setIndex(bounded);
    onSelect(units[bounded]?.unit ?? null);
  };
  const streamLine = (name: string) => {
    const stream = streams[name];
    if (!stream) return null;
    return <li key={name}><span>{streamName(name, lang)}</span><strong>{formatWithUnit(stream.solids_tph, 't/h', lang)}</strong><small>{formulaText(primary.species)} {formatWithUnit(stream.grades[primary.species], primary.unit, lang)}</small></li>;
  };

  if (!unit) return <section className="of-walkthrough"><h3>{COPY.title[lang]}</h3><p>{COPY.noUnits[lang]}</p></section>;
  const selectedUnit = units[currentIndex] ?? unit;
  return (
    <section className="of-walkthrough" aria-label={COPY.title[lang]}>
      <div className="of-walkthrough-heading"><h3>{COPY.title[lang]}</h3><span>{currentIndex + 1} / {units.length}</span></div>
      <p className="of-walkthrough-unit" aria-live="polite">{unitName(selectedUnit.unit, lang)}</p>
      <div className="of-walkthrough-actions">
        <button type="button" className="of-walkthrough-step" aria-label={COPY.previous[lang]} disabled={currentIndex === 0} onClick={() => { setPlaying(false); choose(currentIndex - 1); }}>‹</button>
        <button type="button" className="of-walkthrough-play" aria-label={playing ? COPY.pause[lang] : COPY.play[lang]} onClick={() => {
          if (playing) setPlaying(false);
          else { if (currentIndex >= units.length - 1) choose(0); else setIndex(currentIndex); setPlaying(true); }
        }}>{playing ? 'Ⅱ' : '▶'} <span>{playing ? COPY.pause[lang] : COPY.play[lang]}</span></button>
        <button type="button" className="of-walkthrough-step" aria-label={COPY.next[lang]} disabled={currentIndex >= units.length - 1} onClick={() => { setPlaying(false); choose(currentIndex + 1); }}>›</button>
      </div>
      <label className="of-walkthrough-interval"><span>{COPY.interval[lang]}: {formatWithUnit(interval / 1000, 's', lang)}</span>
        <input type="range" min="700" max="5000" step="100" value={interval} onChange={event => setInterval(Number(event.target.value))} />
      </label>
      <div className="of-walkthrough-streams">
        <h4>{COPY.input[lang]}</h4><ul>{selectedUnit.inputs.map(streamLine)}</ul>
        <h4>{COPY.outputs[lang]}</h4><ul>{selectedUnit.outputs.map(streamLine)}</ul>
      </div>
      <p className="of-walkthrough-closure">{COPY.closure[lang]} <strong>{formatSignificant(closure[selectedUnit.unit], lang, 2)}</strong></p>
      <p className="of-walkthrough-note">{COPY.note[lang]}</p>
    </section>
  );
}
