import { Link } from "react-router";
import { PageHeading, ResearchSection, Tabset } from "../content/Research";
import { useShellLang } from "@fasl-work/caos-app-shell";
const p = (en: string, es: string) => [en, es] as const;
const section = (
  title: readonly [string, string],
  refs: string[],
  text: readonly [string, string],
  diagram?: string,
) => (
  <ResearchSection
    title={title}
    refs={refs}
    diagram={diagram}
    paragraphs={[
      text,
      p(
        "Each experiment is an evidence slice, not a universal conclusion. The protocol, seed, partition or perturbation is named so a future calibration can replace the authored value without changing the interpretation boundary.",
        "Cada experimento es una porción de evidencia, no conclusión universal. Protocolo, semilla, partición o perturbación se nombran para que calibración futura reemplace valor sin cambiar límite.",
      ),
      p(
        "The workbench is designed to let a researcher move from the figure to the exact case, variant, method and parameter record. That relationship is important: visual insight without a reproducible input is only a suggestion.",
        "El laboratorio permite pasar de figura a caso, variante, método y parámetros exactos. La relación es importante: intuición visual sin entrada reproducible es solo sugerencia.",
      ),
      p(
        "Results below are interpreted at the level supported by the data. A synthetic response can test implementation and provoke a hypothesis. It cannot establish a plant-wide operating envelope or transfer guarantee.",
        "Resultados se interpretan al nivel soportado por datos. Respuesta sintética prueba implementación y provoca hipótesis. No establece envelope de planta ni garantía de transferencia.",
      ),
    ]}
  />
);
export default function Experiments() {
  const es = useShellLang() === "es";
  return (
    <div className="of-page of-content">
      <PageHeading
        title={p(
          "Experiment design and sensitivities",
          "Diseño experimental y sensibilidades",
        )}
        lede={p(
          "The six variants per authored case perturb specified operating parameters. Comparisons are conditional on the declared simulator; learned-model scores test reproduction of its output, not prediction at another mine.",
          "Las seis variantes por caso de autor perturban parámetros definidos. Las comparaciones son condicionales al simulador declarado; los puntajes aprendidos miden reproducción de su salida, no predicción en otra mina.",
        )}
      />
      <Tabset
        tabs={[
          {
            id: "coverage",
            label: p("Coverage matrix", "Matriz de cobertura"),
            content: section(
              p(
                "1. Complete method coverage",
                "1. Cobertura completa de métodos",
              ),
              ["sklearn", "ml-mining"],
              p(
                "The bake contains 12 authored cases, six variants per case and 19 method records per variant. The artifact checker validates coverage. A record may be unavailable when a model could not be exported; coverage is not evidence that all methods are plant-validated.",
                "El cálculo contiene 12 casos de autor, seis variantes por caso y 19 registros de método por variante. El verificador valida cobertura. Un registro puede estar no disponible si el modelo no se pudo exportar; cobertura no equivale a validación en planta.",
              ),
              "pipeline",
            ),
          },
          {
            id: "size",
            label: p("Grind ablation", "Ablación de molienda"),
            content: section(
              p(
                "2. The grind-size ablation",
                "2. Ablación del tamaño de molienda",
              ),
              ["bond", "pbm"],
              p(
                "The fine-feed and coarse-grind variants perturb P80 while preserving the rest of the case identity. The expected pattern is a lower product P80, higher surface-area energy and a different kinetic response. The artifact records the complete curves so a reader can verify whether those patterns actually occur.",
                "Variantes fine-feed y coarse-grind perturban P80 conservando identidad. Patrón esperado: P80 menor, energía de superficie mayor y cinética diferente. Artefacto registra curvas para verificar si ocurre.",
              ),
              "instrument",
            ),
          },
          {
            id: "kinetics",
            label: p("Kinetic ablation", "Ablación cinética"),
            content: section(
              p(
                "3. Fast versus slow flotation populations",
                "3. Poblaciones rápidas y lentas",
              ),
              ["flotation"],
              p(
                "First-order, Kelsall and compressed-exponential methods are evaluated at the same operating point. Their end points are deliberately close enough to compare shape, not just score. A fast initial response and a long slow tail imply different value in residence time, so one recovery number is not enough.",
                "Primer orden, Kelsall y exponencial se evalúan en mismo punto. Endpoints cercanos permiten comparar forma, no solo score. Respuesta rápida y cola lenta implican valor distinto de residencia, por lo que un número no basta.",
              ),
              "lanes",
            ),
          },
          {
            id: "uncertainty",
            label: p("Robust uncertainty", "Incertidumbre robusta"),
            content: section(
              p(
                "4. Declared uncertainty, solved repeatedly",
                "4. Incertidumbre declarada, resuelta repetidamente",
              ),
              ["hzdr", "scipy-opt"],
              p(
                "The uncertainty experiment samples positive multipliers for hardness, head grade and cyclone cut using a seeded lognormal distribution. Each draw re-enters the circuit and the recovery quantiles are retained. This is conditional uncertainty around an authored state, not a calibrated confidence interval for a mine.",
                "Experimento muestrea multiplicadores positivos de dureza, ley y corte con lognormal sembrada. Cada muestra vuelve al circuito y conserva cuantiles. Es incertidumbre condicional de escenario, no intervalo calibrado de mina.",
              ),
              "data",
            ),
          },
          {
            id: "leakage",
            label: p("Leakage audit", "Auditoría de fuga"),
            content: section(
              p(
                "5. Learning without label leakage",
                "5. Aprendizaje sin fuga de etiquetas",
              ),
              ["sklearn", "ml-review"],
              p(
                "The feature design is shuffled once, with training, validation and test counts stored in the artifact. The evaluation uses disjoint perturbations built after the training matrix. Model selection and reporting therefore have an auditable split, although the target remains simulator-generated.",
                "Diseño de features se mezcla una vez y guarda conteos. Evaluación usa perturbaciones disjuntas creadas después de matriz de train. Split es auditable, aunque target sigue generado por simulador.",
              ),
              "pipeline",
            ),
          },
          {
            id: "novel",
            label: p("Research extension", "Extensión de investigación"),
            content: section(
              p(
                "6. Proposed test: transfer beyond the authored simulator",
                "6. Prueba propuesta: transferencia fuera del simulador de autor",
              ),
              ["ml-mining", "pytorch", "onnx"],
              p(
                "A future study could pair measured mineralogy with recovery assays, fit the circuit on one ore family, and reserve another family entirely for evaluation. It would compare set-point ranking, metal-balance error and calibrated uncertainty. OreFlow does not implement that study: its particle reference and simulator labels are separate data sources, and the browser does not run an OOD detector.",
                "Un estudio futuro podría vincular mineralogía medida con ensayos de recuperación, ajustar el circuito en una familia de mineral y reservar otra completa para evaluación. Compararía el orden de decisiones, el error de balance y la incertidumbre calibrada. OreFlow no implementa ese estudio: la referencia de partículas y las etiquetas del simulador son fuentes distintas, y el navegador no ejecuta un detector fuera de dominio.",
              ),
              "lanes",
            ),
          },
        ]}
      />
      <div className="of-callout-novel">
        <strong>{es ? "Estado de la investigación" : "Research status"}</strong>
        <p>
          {es
            ? "El resultado reproducible es la consistencia del simulador y el ajuste de sus sustitutos. Una afirmación de transferencia requiere ensayos medidos, calibración y reservar una familia mineral completa."
            : "The reproducible result is simulator consistency and surrogate fit. A transfer claim requires measured assays, calibration and a complete ore-family holdout."}
        </p>
        <Link to="/benchmark">{es ? "Ver protocolo de evaluación" : "See the evaluation protocol"} ↗</Link>
      </div>
    </div>
  );
}
