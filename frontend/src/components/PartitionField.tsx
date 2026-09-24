import { useState } from "react";
import type { Trace } from "../lib/contract.types";

export type PartitionBin = {
  lowUm: number;
  highUm: number;
  ground: number;
  overflow: number;
  underflow: number;
};

export function derivePartitionBins(trace: Trace): PartitionBin[] {
  const fraction = trace.metrics.overflow_fraction;
  return trace.size_um.map((highUm, i) => {
    const ground = trace.ground_psd[i] - (i ? trace.ground_psd[i - 1] : 0);
    const overflow = fraction * (trace.overflow_psd[i] - (i ? trace.overflow_psd[i - 1] : 0));
    return {
      lowUm: i ? trace.size_um[i - 1] : 0,
      highUm,
      ground,
      overflow,
      underflow: ground - overflow,
    };
  });
}

export function groupPartitionBins(bins: PartitionBin[], target = 24): PartitionBin[] {
  if (bins.length <= target) return bins;
  const step = Math.ceil(bins.length / target);
  const grouped: PartitionBin[] = [];
  for (let i = 0; i < bins.length; i += step) {
    const slice = bins.slice(i, i + step);
    grouped.push({
      lowUm: slice[0].lowUm,
      highUm: slice[slice.length - 1].highUm,
      ground: slice.reduce((sum, bin) => sum + bin.ground, 0),
      overflow: slice.reduce((sum, bin) => sum + bin.overflow, 0),
      underflow: slice.reduce((sum, bin) => sum + bin.underflow, 0),
    });
  }
  return grouped;
}

export function partitionTotals(bins: PartitionBin[]) {
  return bins.reduce((totals, bin) => ({
    ground: totals.ground + bin.ground,
    overflow: totals.overflow + bin.overflow,
    underflow: totals.underflow + bin.underflow,
  }), { ground: 0, overflow: 0, underflow: 0 });
}

const formatMass = (value: number) => `${(100 * value).toFixed(2)}%`;
const formatSize = (value: number) => value < 100 ? value.toFixed(1) : value.toFixed(0);

export default function PartitionField({ trace, es, deslime = false }: { trace: Trace; es: boolean; deslime?: boolean }) {
  const bins = groupPartitionBins(derivePartitionBins(trace));
  const [hover, setHover] = useState(Math.floor(bins.length / 2));
  const index = Math.min(Math.max(hover, 0), bins.length - 1);
  const current = bins[index];
  const maxMass = Math.max(0.000001, ...bins.map(bin => bin.ground));
  const totals = partitionTotals(bins);
  const rows: Array<{ key: "ground" | "overflow" | "underflow"; en: string; es: string; total: number }> = [
    { key: "ground", en: "Mill discharge", es: "Descarga molino", total: totals.ground },
    { key: "overflow", en: deslime ? "Slimes reject" : "To rougher", es: deslime ? "Lamas descartadas" : "Finos al rougher", total: totals.overflow },
    { key: "underflow", en: deslime ? "Retained to rougher" : "Classifier underflow", es: deslime ? "Gruesos al rougher" : "Gruesos clasificador", total: totals.underflow },
  ];
  return (
    <div className="of-partition-field" data-testid="partition-field">
      <div className="of-partition-head">
        <div>
          <h3>{es ? "Distribución de masa por tamaño" : "Size-by-size mass distribution"}</h3>
          <p>{es ? "Cada barra es una fracción de la alimentación al clasificador; escala común." : "Each bar is a fraction of classifier feed; one shared scale."}</p>
        </div>
        <span>{bins.length} {es ? "grupos" : "size groups"}</span>
      </div>
      <div className="of-partition-chart">
        {rows.map(row => (
          <div className={`of-partition-row of-partition-${row.key}`} key={row.key}>
            <div className="of-partition-label">
              <strong>{es ? row.es : row.en}</strong>
              <span>{(100 * row.total).toFixed(1)}%</span>
            </div>
            <div className="of-partition-bars" style={{ gridTemplateColumns: `repeat(${bins.length}, minmax(0, 1fr))` }}>
              {bins.map((bin, i) => (
                <div key={i} className={`of-partition-bar ${i === index ? "active" : ""}`}>
                  <i style={{ height: `${Math.max(0, 100 * bin[row.key] / maxMass)}%` }} />
                </div>
              ))}
            </div>
          </div>
        ))}
        <div className="of-partition-hitboxes" style={{ gridTemplateColumns: `repeat(${bins.length}, minmax(0, 1fr))` }}>
          {bins.map((bin, i) => (
            <button
              key={i}
              type="button"
              onMouseEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              aria-label={`${formatSize(bin.lowUm)}–${formatSize(bin.highUm)} µm; ${es ? "fino" : "overflow"} ${formatMass(bin.overflow)}, ${es ? "grueso" : "underflow"} ${formatMass(bin.underflow)}`}
            />
          ))}
        </div>
      </div>
      <div className="of-partition-readout" aria-live="polite">
        <strong>{formatSize(current.lowUm)}–{formatSize(current.highUm)} µm</strong>
        <span>{es ? "Molido" : "Ground"} {formatMass(current.ground)}</span>
        <span>{es ? "Finos" : "Overflow"} {formatMass(current.overflow)}</span>
        <span>{es ? "Gruesos" : "Underflow"} {formatMass(current.underflow)}</span>
        <span>{es ? "Partición" : "Partition"} {current.ground > 0 ? (100 * current.overflow / current.ground).toFixed(1) : "0.0"}%</span>
      </div>
    </div>
  );
}
