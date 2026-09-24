import { Link } from "react-router";
import { PageHeading, ResearchSection, Tabset } from "../content/Research";

const p = (en: string, es: string) => [en, es] as const;
export default function Introduction() {
  return (
    <div className="of-page of-content">
      <PageHeading
        title={p("Mineral-processing circuit", "Circuito de procesamiento mineral")}
        lede={p(
          "A one-pass mineral-processing model links size reduction, solids classification and rougher flotation. The cases are authored scenarios; the HZDR particle dataset is not a plant recovery campaign. This page distinguishes calculated quantities from untested conclusions.",
          "Un modelo de procesamiento mineral de una pasada vincula reducción de tamaño, clasificación de sólidos y flotación rougher. Los casos son escenarios de autor; el conjunto de partículas HZDR no es una campaña de recuperación de planta. Esta página distingue cálculos de conclusiones aún no probadas.",
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
                    "The feed is not a scalar. It is a distribution of sizes, mineral associations, grade and hardness. Comminution changes the distribution; classification separates it by a probability; flotation converts a liberated fraction into a time-dependent recovery. The useful object is therefore a circuit state, not an isolated formula.",
                    "La alimentación no es un escalar. Es una distribución de tamaños, asociaciones minerales, ley y dureza. La conminución cambia la distribución; clasificación la separa por probabilidad; flotación convierte fracción liberada en recuperación dependiente del tiempo. El objeto útil es un estado de circuito, no una fórmula aislada.",
                  ),
                  p(
                    "OreFlow keeps the sequence visible in the flowsheet. Click a node to link the narrative, controls and chart state. The feed, crusher, mill, cyclone, rougher and streams are not decorative icons: each one owns a response array or a mass-balance term in the artifact.",
                    "OreFlow mantiene visible la secuencia en el flowsheet. Seleccionar un nodo vincula relato, controles y gráficos. Alimentación, trituradora, molino, ciclón, rougher y corrientes no son iconos decorativos: cada uno posee una respuesta o término de balance en el artefacto.",
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
                diagram="data"
                refs={["bond", "hydrocyclone", "flotation"]}
                equations={[
                  {
                    tex: String.raw`J=R_c+\lambda G_c-\mu E-\nu D`,
                    caption: p(
                      "A transparent objective combining recovery, grade, energy and reagent dose; weights are declared, not universal.",
                      "Objetivo transparente que combina recuperación, ley, energía y reactivo; los pesos se declaran, no son universales.",
                    ),
                  },
                ]}
                paragraphs={[
                  p(
                    "OreFlow uses bounded grid search over grind and reagent factors. Each candidate is evaluated with the same mass-balance circuit and ranked against the declared objective. The displayed domain defines the limits of the result.",
                    "OreFlow aplica una búsqueda en grilla acotada sobre factores de molienda y reactivo. Cada candidato se evalúa con el mismo circuito de balance de masa y se ordena según el objetivo declarado. El dominio mostrado delimita el resultado.",
                  ),
                  p(
                    "This makes trade-offs visible. A finer grind can improve the flotation rate proxy but raise Bond energy. A classifier cut can change the overflow fraction and therefore mass pull. A reagent increase can lift recovery without creating grade for free.",
                    "Esto hace visibles los compromisos. Molienda fina puede mejorar proxy de tasa pero elevar energía Bond. Corte de clasificador cambia overflow y por tanto mass pull. Más reactivo puede elevar recuperación sin crear ley gratis.",
                  ),
                  p(
                    "The optimizer is a research instrument, not a production set-point recommender. It has no economic price sheet, equipment constraints, ore-blending schedule or metallurgical test calibration. Its purpose is to identify which assumptions deserve a real test.",
                    "El optimizador es instrumento de investigación, no recomendador de setpoint productivo. No tiene precios, restricciones de equipos, programa de mezcla ni calibración de pruebas metalúrgicas. Su propósito es identificar supuestos que merecen prueba real.",
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
                diagram="lanes"
                refs={["ml-mining", "sklearn", "pytorch", "onnx"]}
                paragraphs={[
                  p(
                    "The learned tiers approximate the simulator response over an explicit design domain. Ridge provides a stable linear baseline, random forest and gradient boosting capture nonlinear interactions, Gaussian process adds local uncertainty, and a PyTorch MLP provides an exported neural alternative.",
                    "Las capas aprendidas aproximan la respuesta del simulador en un dominio de diseño explícito. Ridge da base lineal estable, random forest y gradient boosting capturan interacciones no lineales, Gaussian process agrega incertidumbre local y MLP PyTorch ofrece alternativa neuronal exportada.",
                  ),
                  p(
                    "Surrogates can reduce evaluation time within a defined domain. Their outputs must be interpreted alongside feature bounds, the training partition, held-out error and out-of-domain status. These quantities do not establish accuracy on unmeasured ore families.",
                    "Los modelos sustitutos pueden reducir el tiempo de evaluación dentro de un dominio definido. Sus salidas deben interpretarse junto con los límites de variables, la partición de entrenamiento, el error reservado y el estado fuera de dominio. Estas medidas no establecen exactitud para familias de mineral no medidas.",
                  ),
                  p(
                    "The training labels come from the authored simulator; the public particle data do not contain matched plant recovery labels. The manuscript proposes a future transfer study using particle-derived features and calibrated process labels when such a campaign becomes available.",
                    "Las etiquetas de entrenamiento provienen del simulador creado para este estudio; los datos públicos de partículas no incluyen etiquetas vinculadas de recuperación de planta. El manuscrito propone estudiar transferencia con características de partículas y respuestas de proceso calibradas cuando exista una campaña apropiada.",
                  ),
                  p(
                    "Browser inference is optional and read-only. ONNX Runtime Web is used only for a small exported model when the asset and parity record exist; the exact replay artifact remains the reference for scientific comparison.",
                    "La inferencia en navegador es opcional y solo lectura. ONNX Runtime Web se usa para modelo pequeño exportado cuando existe asset y registro de concordancia; artefacto exacto sigue siendo referencia científica.",
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
                refs={["sklearn", "modsim", "prommis"]}
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
        <span>Six routes, one scientific state.</span>
        <Link to="/methodology">Continue to methodology ↗</Link>
      </div>
    </div>
  );
}
