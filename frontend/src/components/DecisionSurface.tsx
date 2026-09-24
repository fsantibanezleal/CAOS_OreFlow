import { useMemo, useState } from "react";
import type { Params } from "../lib/contract.types";
import { simulateLive } from "../live/engine";

type Props = {
  params: Params;
  caseId: string;
  onChoose: (grind: number, reagent: number) => void;
  es: boolean;
};
type Point = {
  x: number;
  y: number;
  grind: number;
  reagent: number;
  recovery: number;
  energy: number;
  px: number;
  py: number;
};

export default function DecisionSurface({
  params,
  caseId,
  onChoose,
  es,
}: Props) {
  const [azimuth, setAzimuth] = useState(32);
  const [angleStep, setAngleStep] = useState(8);
  const [selected, setSelected] = useState<[number, number]>([4, 4]);
  const points = useMemo(() => {
    const raw = Array.from({ length: 9 }, (_, y) =>
      Array.from({ length: 9 }, (_, x) => {
        const grind = Math.max(35, params.grind_p80_um * (0.65 + x * 0.0875));
        const reagent = Math.max(20, params.reagent_gpt * (0.65 + y * 0.0875));
        const trace = simulateLive(
          { ...params, grind_p80_um: grind, reagent_gpt: reagent },
          caseId,
        );
        return {
          x,
          y,
          grind,
          reagent,
          recovery: trace.metrics.recovery_pct,
          energy: trace.metrics.specific_energy_kwh_t,
        };
      }),
    );
    const values = raw.flat().map((p) => p.recovery);
    const low = Math.min(...values);
    const span = Math.max(0.001, Math.max(...values) - low);
    const a = (azimuth * Math.PI) / 180;
    return raw.map((row) =>
      row.map((p) => {
        const xx = (p.x - 4) / 4;
        const yy = (p.y - 4) / 4;
        return {
          ...p,
          px: 450 + (xx * Math.cos(a) - yy * Math.sin(a)) * 265,
          py:
            410 +
            (xx * Math.sin(a) + yy * Math.cos(a)) * 105 -
            ((p.recovery - low) / span) * 195,
        };
      }),
    );
  }, [params, caseId, azimuth]);
  const flat = points.flat();
  const minX = Math.min(...flat.map((p) => p.px));
  const maxX = Math.max(...flat.map((p) => p.px));
  const minY = Math.min(...flat.map((p) => p.py));
  const maxY = Math.max(...flat.map((p) => p.py));
  const focus = points[selected[1]][selected[0]];
  const quads = Array.from({ length: 8 }, (_, y) =>
    Array.from({ length: 8 }, (_, x) => {
      const p = [
        points[y][x],
        points[y][x + 1],
        points[y + 1][x + 1],
        points[y + 1][x],
      ];
      const recovery = p.reduce((v, point) => v + point.recovery, 0) / 4;
      return { x, y, p, recovery };
    }),
  )
    .flat()
    .sort((a, b) => a.x + a.y - (b.x + b.y));
  const min = Math.min(...flat.map((p) => p.recovery));
  const max = Math.max(...flat.map((p) => p.recovery));
  return (
    <div className="of-surface-layout">
      <div className="of-surface-canvas">
        <div className="of-viz-head">
          <div>
            <span className="of-kicker">
              {es ? "BARRIDO CONDICIONAL" : "CONDITIONAL SWEEP"}
            </span>
            <h2>{es ? "Superficie de decisión" : "Decision surface"}</h2>
          </div>
          <span className="of-boundary">
            {es ? "SIMULADOR, NO PLANTA" : "SIMULATOR, NOT PLANT"}
          </span>
        </div>
        <svg
          viewBox={`${minX - 30} ${minY - 30} ${maxX - minX + 60} ${maxY - minY + 60}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={
            es
              ? "Superficie de recuperación por molienda y reactivo"
              : "Recovery surface over grind size and collector dose"
          }
        >
          {quads.map((q) => (
            <polygon
              key={`${q.x}-${q.y}`}
              points={q.p.map((p) => `${p.px},${p.py}`).join(" ")}
              fill={`hsl(${190 - (150 * (q.recovery - min)) / Math.max(max - min, 0.001)} 55% 48%)`}
              stroke="var(--of-surface-grid)"
              strokeWidth="1.5"
              opacity=".9"
            />
          ))}
          {flat.map((p) => (
            <circle
              key={`${p.x}-${p.y}`}
              cx={p.px}
              cy={p.py}
              r={selected[0] === p.x && selected[1] === p.y ? 9 : 5}
              className={`of-surface-point ${selected[0] === p.x && selected[1] === p.y ? "selected" : ""}`}
              tabIndex={0}
              role="button"
              aria-label={`${p.grind.toFixed(0)} µm, ${p.reagent.toFixed(0)} g/t, ${p.recovery.toFixed(1)}%`}
              onMouseEnter={() => setSelected([p.x, p.y])}
              onFocus={() => setSelected([p.x, p.y])}
              onClick={() => onChoose(p.grind, p.reagent)}
              onKeyDown={(event) => {
                if (event.key === "Enter") onChoose(p.grind, p.reagent);
              }}
            />
          ))}
        </svg>
        <div className="of-surface-scale">
          <span>
            {es ? "Recuperación" : "Recovery"} {min.toFixed(1)}%
          </span>
          <i />
          <span>{max.toFixed(1)}%</span>
        </div>
      </div>
      <aside className="of-surface-inspector">
        <span className="of-kicker">
          {es ? "PUNTO INSPECCIONADO" : "INSPECTED POINT"}
        </span>
        <strong className="of-big-number">
          {focus.recovery.toFixed(1)}
          <small>%</small>
        </strong>
        <p>
          {es
            ? "Recuperación global condicional"
            : "Conditional overall recovery"}
        </p>
        <dl>
          <div>
            <dt>{es ? "Molienda P80" : "Grind P80"}</dt>
            <dd>{focus.grind.toFixed(0)} µm</dd>
          </div>
          <div>
            <dt>{es ? "Colector" : "Collector"}</dt>
            <dd>{focus.reagent.toFixed(0)} g/t</dd>
          </div>
          <div>
            <dt>{es ? "Energía específica" : "Specific energy"}</dt>
            <dd>{focus.energy.toFixed(1)} kWh/t</dd>
          </div>
        </dl>
        <button
          type="button"
          className="of-action"
          onClick={() => onChoose(focus.grind, focus.reagent)}
        >
          {es ? "Aplicar este punto" : "Apply this point"}
        </button>
        <div className="of-view-controls">
          <span>
            {es ? "Vista / acimut" : "View / azimuth"} {azimuth}°
          </span>
          <div>
            <button
              type="button"
              onClick={() => setAzimuth((a) => a - angleStep)}
              aria-label={es ? "Girar a la izquierda" : "Rotate left"}
            >
              ↶
            </button>
            <button
              type="button"
              onClick={() => setAzimuth((a) => a + angleStep)}
              aria-label={es ? "Girar a la derecha" : "Rotate right"}
            >
              ↷
            </button>
          </div>
          <label>
            {es ? "Paso angular" : "Angle step"} <output>{angleStep}°</output>
            <input
              type="range"
              min="1"
              max="24"
              step="1"
              value={angleStep}
              onChange={(e) => setAngleStep(Number(e.target.value))}
            />
          </label>
        </div>
        <p className="of-disclaimer">
          {es
            ? "El ángulo cambia solo la proyección. La superficie se calcula con el motor local; no es un óptimo calibrado de planta."
            : "Angle changes only the projection. The surface uses the local engine; it is not a calibrated plant optimum."}
        </p>
      </aside>
    </div>
  );
}
