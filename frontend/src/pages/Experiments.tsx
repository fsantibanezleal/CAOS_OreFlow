import { Link } from "react-router";
import { PageHeading, ResearchSection, Tabset } from "../content/Research";
import { useShellLang } from "@fasl-work/caos-app-shell";
const p = (en: string, es: string) => [en, es] as const;
const section = (
  title: readonly [string, string],
  refs: string[],
  text: readonly [string, string],
  diagram?: string,
  details: Array<readonly [string, string]> = [],
) => (
  <ResearchSection
    title={title}
    refs={refs}
    diagram={diagram}
    paragraphs={[text, ...details]}
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
                "1. Method applicability across circuits",
                "1. Aplicabilidad de métodos por circuito",
              ),
              ["sklearn", "ml-mining"],
              p(
                "The bake contains 12 authored cases, six variants per case and 21 registered method records per variant. Records mark methods that do not apply to a circuit or whose learned output is unavailable; a full registry is not full execution or plant validation.",
                "El cálculo contiene 12 casos de autor, seis variantes por caso y 21 registros de método por variante. Los registros indican métodos no aplicables o salidas aprendidas no disponibles; un registro completo no equivale a ejecución completa ni validación en planta.",
              ),
              "coverage-matrix",
              [
                p("The matrix distinguishes calculated, inapplicable and unavailable methods in each process family. It checks the exported method contract; it does not compare incompatible units or infer accuracy from a filled cell.", "La matriz distingue métodos calculados, no aplicables o no disponibles en cada familia. Comprueba el contrato exportado; no compara unidades incompatibles ni infiere precisión de una celda llena."),
                p("Select a case in the workbench to inspect its actual parameters and method values. The benchmark reports the separate hold-out evaluation of learned surrogates.", "Seleccione un caso en el laboratorio para inspeccionar parámetros y valores reales. El benchmark informa por separado la evaluación reservada de los sustitutos aprendidos."),
              ],
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
              "energy-laws",
              [
                p("The three curves are normalized at the same nominal grind to compare slopes. This removes the misleading impression that different uncalibrated energy coefficients can be ranked as competing mill measurements.", "Las tres curvas se normalizan en la misma molienda nominal para comparar pendientes. Así no se confunden coeficientes energéticos sin calibrar con mediciones de molino comparables."),
                p("Move feed P80 in the figure to see how the upstream size changes the reduction-ratio sensitivity. The workbench shows the downstream circuit response for a selected case.", "Mueva P80 de alimentación en la figura para observar sensibilidad a la reducción. El laboratorio muestra respuesta posterior del circuito para el caso seleccionado."),
              ],
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
              "flotation-kinetics",
              [
                p("The figure evaluates all three hypotheses with the same feed, partition and collector setting. Altering collector dose changes the curves through the declared saturating rate term, not a hand-drawn animation.", "La figura evalúa tres hipótesis con la misma alimentación, partición y dosis. Cambiar colector modifica curvas mediante el término de tasa saturante declarado, no una animación dibujada."),
                p("These are overall circuit curves, so the classifier's solids split is already included. They are not fitted rougher-test data and cannot identify fast and slow fractions in a real ore.", "Son curvas globales del circuito e incluyen la partición del clasificador. No se ajustaron a ensayos rougher ni identifican fracciones rápida y lenta de mineral real."),
              ],
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
              undefined,
              [
                p("The seeded Monte Carlo reruns the same circuit under perturbed hardness, head grade and classifier cut. Its output is conditional on those chosen distributions; changing the distribution family would change the uncertainty statement.", "Monte Carlo sembrado recalcula el mismo circuito con perturbaciones de dureza, ley y corte. La salida depende de las distribuciones elegidas; cambiarlas altera la afirmación de incertidumbre."),
                p("The public variant record exposes only the p05 recovery value. The pipeline computes p50 and p95 but does not persist them in that artifact; this is not a calibrated probability of meeting a production target.", "El registro público de la variante expone solo la recuperación p05. El pipeline calcula p50 y p95 pero no los conserva en ese artefacto; no es probabilidad calibrada de cumplir una meta de producción."),
              ],
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
              "surrogate-errors",
              [
                p("The displayed RMSE values come from 48 evaluation perturbations that are disjoint from the training rows. The ore families, however, are the same authored families; this is interpolation across parameter states, not ore-family transfer.", "Los RMSE provienen de 48 perturbaciones reservadas distintas de entrenamiento. Las familias minerales siguen siendo las mismas: es interpolación de estados, no transferencia entre familias."),
                p("A lower bar measures better reproduction of simulator labels. No bar measures agreement with plant recovery, because paired plant-recovery assays were not available for this experiment.", "Una barra menor indica mejor reproducción de etiquetas del simulador. Ninguna mide acuerdo con recuperación de planta, porque no hubo ensayos emparejados para este experimento."),
              ],
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
              undefined,
              [
                p("The proposed design separates two missing tests: calibration on observed metallurgical response and evaluation on a completely held-out ore family. Passing only the first would still leave transfer unproven.", "El diseño propuesto separa dos pruebas faltantes: calibración con respuesta metalúrgica observada y evaluación sobre una familia mineral completamente reservada. Aprobar solo la primera no prueba transferencia."),
                p("Until those data exist, the valid result is narrower: reproducible simulator behavior and surrogate error within its authored domain.", "Hasta contar con esos datos, el resultado válido es más limitado: comportamiento reproducible del simulador y error de sustitutos dentro de su dominio creado."),
              ],
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
