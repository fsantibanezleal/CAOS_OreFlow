import { Chart } from "./Charts";
import type { CaseArtifact, Params, Trace } from "../lib/contract.types";
import { localizedVariant } from "../lib/locale";
import { alternativeKinetics } from "../live/engine";

type Props = {
  methodId: string;
  trace: Trace;
  params: Params;
  caseData: CaseArtifact;
  es: boolean;
};
const energyIds = new Set(["rittinger", "kick", "bond"]);
const sizeIds = new Set(["whiten", "pbm"]);
const splitIds = new Set(["partition", "plitt"]);
const kineticIds = new Set([
  "first_order",
  "kelsall",
  "compressed_exponential",
]);

export default function MethodVisual({
  methodId,
  trace,
  params,
  caseData,
  es,
}: Props) {
  const method = caseData.variants[0]?.method_outputs.find(item => item.id === methodId);
  if (method?.status === "not-applicable") return <div className="of-method-warning">{es ? "Este circuito no contiene esa operación; el método no se ejecuta." : "This circuit does not contain that operation; the method is not executed."}</div>;
  if (methodId === "gravity_window" || methodId === "lims_capture") {
    const gravity = methodId === "gravity_window";
    return <Chart
      title={gravity ? (es ? "Captura gravimétrica por tamaño" : "Gravity capture by size") : (es ? "Captura magnética por tamaño" : "Magnetic capture by size")}
      subtitle={es ? "Respuesta supuesta, no calibrada" : "Authored response, not calibrated"}
      height={220}
      labels={trace.size_um.map(size => `${size.toFixed(0)} µm`)}
      series={[{ name: es ? "Captura" : "Capture", color: "var(--color-accent)", values: trace.size_um.map(size => gravity ? 0.82 * (1 - Math.exp(-size / 45)) * Math.exp(-size / 700) : 0.91 * (1 - Math.exp(-size / 25)) * Math.exp(-size / 1800)) }]}
      format={value => `${(100 * value).toFixed(0)}%`}
    />;
  }
  if (energyIds.has(methodId)) {
    const sizes = Array.from({ length: 48 }, (_, i) => 40 + i * 9);
    const feed = params.feed_p80_um;
    const curves = [
      {
        name: "Rittinger",
        color: "var(--color-warn)",
        values: sizes.map((s) => 0.028 * Math.max(0, 1e6 / s - 1e6 / feed)),
      },
      {
        name: "Kick",
        color: "var(--color-accent-2)",
        values: sizes.map((s) => 1.85 * Math.max(0, Math.log(feed / s))),
      },
      {
        name: "Bond",
        color: "var(--color-accent)",
        values: sizes.map(
          (s) =>
            10 *
            params.hardness_kwh_t *
            Math.max(0, 1 / Math.sqrt(s) - 1 / Math.sqrt(feed)),
        ),
      },
    ];
    return (
      <Chart
        title={
          es
            ? "Sensibilidad al P80 de molienda"
            : "Energy sensitivity to grind P80"
        }
        subtitle={
          es
            ? "Tres leyes; coeficientes no calibrados entre sí"
            : "Three laws; coefficients are not mutually calibrated"
        }
        height={220}
        labels={sizes.map((s) => `${s.toFixed(0)} µm`)}
        series={curves}
        format={(v) => `${v.toFixed(1)} kWh/t`}
      />
    );
  }
  if (sizeIds.has(methodId))
    return (
      <Chart
        title={es ? "Respuesta granulométrica" : "Particle-size response"}
        subtitle={
          es ? "Pasante acumulado por operación" : "Cumulative passing by unit"
        }
        height={220}
        labels={trace.size_um.map((s) => `${s.toFixed(0)} µm`)}
        series={[
          { name: es ? "Alimentación" : "Feed", color: "var(--color-fg-subtle)", values: trace.feed_psd },
          { name: es ? "Triturado" : "Crushed", color: "var(--color-warn)", values: trace.crushed_psd },
          { name: es ? "Molido" : "Ground", color: "var(--color-accent)", values: trace.ground_psd },
        ]}
        format={(v) => `${(v * 100).toFixed(0)}%`}
      />
    );
  if (splitIds.has(methodId)) {
    const d50 = trace.metrics.cyclone_d50_um;
    const domain = Array.from({ length: 80 }, (_, i) => 10 + i * (Math.max(100, d50 * 4) - 10) / 79);
    const partition = domain.map(
      (size) =>
        1 /
        (1 +
          Math.exp(Math.max(-60, Math.min(60, (size - d50) / (d50 * 0.16))))),
    );
    return (
      <Chart
        title={es ? "Partición de finos por tamaño" : "Fine partition by size"}
        subtitle={`d50 ${d50.toFixed(1)} µm · ${es ? "overflow de sólidos" : "solids overflow"} ${(trace.metrics.overflow_fraction * 100).toFixed(1)}%`}
        height={220}
        labels={domain.map((s) => `${s.toFixed(0)} µm`)}
        series={[
          {
            name: es ? "A overflow" : "To overflow",
            color: "var(--color-accent-2)",
            values: partition,
          },
        ]}
        format={(v) => `${(v * 100).toFixed(0)}%`}
      />
    );
  }
  if (kineticIds.has(methodId)) {
    const selected =
      methodId === "first_order"
        ? trace.flotation_recovery
        : alternativeKinetics(
            params,
            caseData.process_family === "deslime_rougher" ? 1 - trace.metrics.overflow_fraction : trace.metrics.overflow_fraction,
            methodId as "kelsall" | "compressed_exponential",
          );
    return (
      <Chart
        title={
          es
            ? "Recuperación global vs tiempo"
            : "Overall recovery versus residence"
        }
        subtitle={
          es
            ? "La fracción alimentada al rougher está incluida"
            : "Includes the fraction reaching the rougher"
        }
        height={220}
        labels={selected.map(
          (_, i) => `${((i / 95) * params.flotation_time_min).toFixed(1)} min`,
        )}
        series={[
          {
            name: es ? "Modelo seleccionado" : "Selected model",
            color: "var(--color-accent)",
            values: selected.map((v) => v * 100),
          },
          ...(methodId === "first_order"
            ? []
            : [
                {
                  name: es ? "Primer orden" : "First order",
                  color: "var(--color-accent-2)",
                  values: trace.flotation_recovery.map((v) => v * 100),
                },
              ]),
        ]}
        format={(v) => `${v.toFixed(1)}%`}
      />
    );
  }
  const vals = caseData.variants.map(
    (v) => v.method_outputs.find((m) => m.id === methodId)?.value ?? 0,
  );
  const unit =
    caseData.variants[0]?.method_outputs.find((m) => m.id === methodId)?.unit ??
    "";
  return (
    <Chart
      title={es ? "Resultado por variante" : "Result by variant"}
      subtitle={
        es
          ? "Comparación del mismo método; artefactos precomputados"
          : "Same-method comparison; precomputed artifacts"
      }
      height={220}
      labels={caseData.variants.map((v) => localizedVariant(v.id, v.label, es))}
      series={[
        { name: methodId.replaceAll("_", " "), color: "var(--color-accent)", values: vals },
      ]}
      format={(v) => `${v.toFixed(2)} ${unit}`}
    />
  );
}
