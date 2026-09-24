import { Link } from "react-router";
import { PageHeading, ResearchSection, Tabset } from "../content/Research";
import { useShellLang } from "@fasl-work/caos-app-shell";

const p = (en: string, es: string) => [en, es] as const;
export default function Introduction() {
  const es = useShellLang() === "es";
  return (
    <div className="of-page of-content">
      <PageHeading
        title={p("Mineral-processing circuit", "Circuito de procesamiento mineral")}
        lede={p(
          "Investigate a case-specific operating envelope under explicit recovery, grade, energy and water limits, then inspect the circuit physics and a separate measured locked-cycle recovery benchmark. Four declared one-pass process paths remain authored scenarios; neither the HZDR particles nor the GeoMet tests calibrate their operating controls.",
          "Investigue la envolvente de operación de un caso bajo límites explícitos de recuperación, ley, energía y agua; luego examine la física del circuito y un benchmark separado de recuperación medida en ciclo cerrado. Las cuatro rutas de una pasada siguen siendo escenarios de autor; ni las partículas HZDR ni los ensayos GeoMet calibran sus controles operativos.",
        )}
      />
      <Tabset
        tabs={[
          {
            id: "chain",
            label: p("The process chain", "La cadena de proceso"),
            content: (
              <ResearchSection
                title={p(
                  "1. A circuit is a sequence of transformations",
                  "1. Un circuito es una secuencia de transformaciones",
                )}
                diagram="instrument"
                refs={["nptel", "bond", "flotation"]}
                paragraphs={[
                  p(
                    "The feed is not a scalar. It is a distribution of sizes, grade and hardness. Comminution changes the distribution; a classifier, gravity branch or magnetic separator routes size classes differently. Where flotation applies, recovery also depends on residence. The useful object is a circuit state and its topology, not an isolated formula.",
                    "La alimentación no es un escalar. Es una distribución de tamaños, ley y dureza. La conminución cambia esa distribución; clasificador, gravedad y separador magnético encaminan clases de modo diferente. Donde hay flotación, la recuperación depende además de residencia. El objeto útil es estado y topología del circuito, no fórmula aislada.",
                  ),
                  p(
                    "The workbench selects stages from the active process family. Gold has a separate gravity product; magnetite omits flotation; phosphate rejects slimes before its rougher. Each stage uses response arrays or mass-balance terms from the selected scenario, and a control change recalculates the linked model.",
                    "El laboratorio selecciona etapas según la familia activa. Oro tiene producto gravimétrico separado; magnetita omite flotación; fosfato rechaza lamas antes del rougher. Cada etapa usa arreglos o términos de balance del escenario, y cambiar un control recalcula el modelo vinculado.",
                  ),
                  p(
                    "The reference models are intentionally modest enough to audit. They are not a commercial plant simulator and do not claim to capture liberation classes, froth stability, residence-time distributions or circulating-load dynamics that were not measured. Their value is to show how such effects enter the reasoning chain.",
                    "Los modelos de referencia son deliberadamente auditables. No son simulador comercial ni afirman capturar clases de liberación, estabilidad de espuma, distribuciones de residencia o carga circulante no medidas. Su valor es mostrar cómo esos efectos entran en el razonamiento.",
                  ),
                  p(
                    "A new data source can replace the authored feed through Contract 1. The resulting artifact keeps the source identity and limits, so a user can distinguish a licensed particle reference from a calibrated plant campaign.",
                    "Una nueva fuente puede reemplazar la alimentación mediante el contrato 1. El artefacto conserva identidad y límites de fuente, para distinguir referencia de partículas licenciada de campaña de planta calibrada.",
                  ),
                ]}
              />
            ),
          },
          {
            id: "particles",
            label: p("Particle to plant", "Partícula a planta"),
            content: (
              <ResearchSection
                title={p(
                  "2. Particle evidence needs a boundary",
                  "2. La evidencia de partículas necesita límite",
                )}
                refs={["hzdr", "nptel"]}
                equations={[
                  {
                    tex: String.raw`P(x)=1-\exp\left[-\left(\frac{x}{x_0}\right)^n\right]`,
                    caption: p(
                      "A cumulative passing curve; x is particle size, x0 is scale and n is a shape parameter.",
                      "Curva acumulativa pasante; x es tamaño, x0 escala y n parámetro de forma.",
                    ),
                  },
                ]}
                paragraphs={[
                  p(
                    "The downloaded HZDR RODARE workbook contains constructed particle-mineralogy cases with geometry, modal and surface descriptors and mineral classes. OreFlow preprocesses its train and test sheets into a compact summary, retaining the DOI and CC BY 4.0 license in the public artifact.",
                    "El libro HZDR RODARE descargado contiene casos construidos de mineralogía de partículas con geometría, descriptores modales y superficiales y clases minerales. OreFlow preprocesa hojas train y test en resumen compacto, conservando DOI y licencia CC BY 4.0.",
                  ),
                  p(
                    "Those rows support a conversation about features and leakage. They do not become a hidden plant calibration. The app states this boundary beside the data, because a model trained on constructed mineralogical labels cannot be presented as an observed recovery curve.",
                    "Esas filas permiten conversar sobre características y fuga. No se vuelven calibración oculta de planta. La app declara el límite porque etiquetas mineralógicas creadas no pueden presentarse como curva de recuperación observada.",
                  ),
                  p(
                    "The process scenarios are authored around physical regimes: soft and hard porphyry, fine magnetite, clay-rich feeds, sulphide and oxide flotation, low-grade and refractory stress. Each case carries six variants, allowing a user to see whether a conclusion survives a controlled perturbation.",
                    "Los escenarios se crean alrededor de regímenes físicos: pórfido blando y duro, magnetita fina, alimentación arcillosa, flotación sulfuro y óxido, estrés de baja ley y refractario. Cada caso lleva seis variantes para ver si una conclusión sobrevive perturbación controlada.",
                  ),
                  p(
                    "That separation creates a useful research move: use measured or licensed particles to improve feature contracts and use plant data to calibrate process responses. Do not merge them only because both files contain numbers.",
                    "Esa separación crea un movimiento de investigación útil: usar partículas medidas o licenciadas para mejorar contratos de características y datos de planta para calibrar respuestas. No fusionarlos solo porque ambos archivos contienen números.",
                  ),
                ]}
              />
            ),
          },
          {
            id: "decisions",
            label: p("Decision surfaces", "Superficies de decisión"),
            content: (
              <ResearchSection
                title={p(
                  "3. The decision is a surface, not a single optimum",
                  "3. La decisión es una superficie, no un único óptimo",
                )}
                diagram="optimization-grid"
                refs={["bond", "hydrocyclone", "flotation"]}
                equations={[
                  {
                    tex: String.raw`\mathcal{F}=\{x:R(x)\ge R_{\min},\;G(x)\ge G_{\min},\;E(x)\le E_{\max},\;W(x)\le W_{\max}\}`,
                    caption: p(
                      "Finite feasible sample F: x is an operating point, R recovery, G concentrate grade, E specific energy and W water demand; limits are user-set, not plant constraints.",
                      "Muestra factible finita F: x es punto operativo, R recuperación, G ley, E energía específica y W demanda de agua; los límites son del usuario, no de planta.",
                    ),
                  },
                ]}
                paragraphs={[
                  p(
                    "The workbench samples 49 bounded operating points around the selected case: grind versus collector, or grind versus feed rate for magnetite. It classifies each point against editable limits, then exposes non-dominated feasible points in recovered valuable mass, total power and material consumption. The recommended sampled point maximizes recovered valuable mass within that finite set; it is not a continuous optimum.",
                    "El laboratorio evalúa 49 puntos acotados alrededor del caso: molienda frente a colector, o molienda frente a alimentación para magnetita. Clasifica cada punto según límites editables y presenta los factibles no dominados en masa valiosa recuperada, potencia y consumo. El punto muestreado recomendado maximiza masa valiosa dentro de ese conjunto finito; no es óptimo continuo.",
                  ),
                  p(
                    "This makes trade-offs visible. A finer grind can improve the flotation rate proxy but raise Bond energy. A classifier cut can change the overflow fraction and therefore mass pull. A reagent increase can lift recovery without creating grade for free.",
                    "Esto hace visibles los compromisos. Molienda fina puede mejorar proxy de tasa pero elevar energía Bond. Corte de clasificador cambia overflow y por tanto mass pull. Más reactivo puede elevar recuperación sin crear ley gratis.",
                  ),
                  p(
                    "The operating-envelope study is a conditional simulator experiment, not a production set-point recommender. It has no equipment constraints, ore-blending schedule or linked metallurgical calibration. Its export records every candidate, limit and stress perturbation so another researcher can reproduce the comparison and identify assumptions that need testwork.",
                    "La envolvente es un experimento condicional del simulador, no recomendador de setpoints. No incluye restricciones de equipos, mezcla de mineral ni calibración metalúrgica vinculada. La exportación registra candidatos, límites y perturbaciones para reproducir la comparación e identificar supuestos que necesitan ensayos.",
                  ),
                  p(
                    "The workbench makes the boundary actionable: change the parameters, observe the live response, then inspect the baked matrix to see whether the same method behaved consistently across cases.",
                    "El laboratorio vuelve accionable el límite: cambiar parámetros, observar respuesta viva y luego inspeccionar matriz horneada para ver consistencia entre casos.",
                  ),
                ]}
              />
            ),
          },
          {
            id: "learning",
            label: p("Why machine learning?", "Por qué aprendizaje automático"),
            content: (
              <ResearchSection
                title={p(
                  "4. Learning accelerates a declared simulator",
                  "4. El aprendizaje acelera un simulador declarado",
                )}
                diagram="surrogate-errors"
                refs={["ml-mining", "sklearn", "pytorch", "onnx"]}
                paragraphs={[
                  p(
                    "The learned tiers approximate the simulator response over an explicit design domain. Ridge provides a linear baseline; random forest, gradient boosting and Gaussian process provide nonlinear point-prediction comparisons; a PyTorch MLP provides a neural comparison. Posterior uncertainty is not calibrated here.",
                    "Las capas aprendidas aproximan la respuesta del simulador en un dominio de diseño explícito. Ridge ofrece base lineal; bosque aleatorio, boosting y proceso gaussiano comparan predicciones puntuales no lineales; una MLP PyTorch ofrece comparación neuronal. La incertidumbre posterior no se calibra aquí.",
                  ),
                  p(
                    "Surrogates can reduce evaluation time within a defined domain. Their outputs must be interpreted alongside feature bounds, the training partition, held-out error and out-of-domain status. These quantities do not establish accuracy on unmeasured ore families.",
                    "Los modelos sustitutos pueden reducir el tiempo de evaluación dentro de un dominio definido. Sus salidas deben interpretarse junto con los límites de variables, la partición de entrenamiento, el error reservado y el estado fuera de dominio. Estas medidas no establecen exactitud para familias de mineral no medidas.",
                  ),
                  p(
                    "Circuit-surrogate labels come from the authored simulator. Separately, the GeoMet lane predicts measured locked-cycle copper recovery from five assays using whole-hole and spatial-zone holdouts. Those rows lack the grind, collector and residence controls needed to calibrate the circuit, and the HZDR particle data do not supply matched plant recovery either.",
                    "Las etiquetas de los sustitutos del circuito provienen del simulador. Por separado, GeoMet predice recuperación medida de ensayos de ciclo cerrado a partir de cinco leyes químicas y reservas por pozo y zona espacial. Esas filas no contienen molienda, colector ni residencia para calibrar el circuito; HZDR tampoco aporta recuperación de planta vinculada.",
                  ),
                  p(
                    "The browser currently replays versioned variant artifacts and recalculates the bounded process model when controls move. Exported ONNX assets are preserved for separate parity checks, but neural inference is not wired into the interactive browser state.",
                    "El navegador reproduce artefactos de variante y recalcula el modelo de proceso acotado al mover controles. Los archivos ONNX exportados se conservan para pruebas separadas de concordancia, pero la inferencia neuronal no está conectada al estado interactivo del navegador.",
                  ),
                ]}
              />
            ),
          },
          {
            id: "evidence",
            label: p("Evaluation limits", "Límites de evaluación"),
            content: (
              <ResearchSection
                title={p(
                  "5. Provenance and evaluation limits",
                  "5. Procedencia y límites de evaluación",
                )}
                refs={["sklearn", "modsim", "prommis", "geomet", "geomet-paper"]}
                paragraphs={[
                  p(
                    "OreFlow records the provenance of each number. A case manifest points to a byte-counted artifact; the artifact contains parameters, traces, metrics and method outputs; the index records the complete matrix. This makes an absent or stale result visible instead of silently filling it with a placeholder.",
                    "OreFlow registra procedencia de cada número. Manifiesto apunta a artefacto con bytes; artefacto contiene parámetros, trazas, métricas y salidas; índice registra matriz completa. Un resultado ausente o antiguo queda visible, sin rellenarse con placeholder.",
                  ),
                  p(
                    "The benchmark separates simulator truth from learned error. It uses a disjoint parameter perturbation set and reports RMSE in percentage points and R2. A high R2 does not create a plant guarantee, especially where low-grade or clay-rich cases are extrapolation-prone.",
                    "Benchmark separa verdad del simulador y error aprendido. Usa perturbaciones disjuntas y reporta RMSE en puntos porcentuales y R2. R2 alto no crea garantía de planta, sobre todo en baja ley o arcillas.",
                  ),
                  p(
                    "The circuit, response curves and method views refer to the same selected case and parameter state. A change to an input updates the linked calculations; replay artifacts remain identifiable separately from local recalculation.",
                    "El circuito, las curvas de respuesta y los métodos comparten el mismo caso y estado de parámetros. Un cambio de entrada actualiza los cálculos vinculados; los artefactos reproducidos se distinguen del recálculo local.",
                  ),
                  p(
                    "The final question is not whether the page looks complete. It is whether another researcher can rerun the pipeline, inspect the assumptions, change a parameter and tell exactly which statement is evidence and which is interpretation.",
                    "La pregunta final no es si la página se ve completa. Es si otro investigador puede repetir pipeline, inspeccionar supuestos, cambiar parámetro y saber qué afirmación es evidencia y cuál interpretación.",
                  ),
                ]}
              />
            ),
          },
        ]}
      />
      <div className="of-next">
        <span>{es ? "Compare siempre los cálculos del circuito con la evidencia medida en carriles separados." : "Keep circuit calculations and measured test evidence in separate lanes."}</span>
        <Link to="/methodology">{es ? "Continuar a metodología" : "Continue to methodology"} ↗</Link>
      </div>
    </div>
  );
}
