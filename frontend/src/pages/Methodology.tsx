import { Link } from "react-router";
import { PageHeading, ResearchSection, Tabset } from "../content/Research";
import { useShellLang } from "@fasl-work/caos-app-shell";
const p = (en: string, es: string) => [en, es] as const;
export default function Methodology() {
  const es = useShellLang() === "es";
  const common = (
    title: readonly [string, string],
    refs: string[],
    paragraphs: Array<readonly [string, string]>,
    equations: Array<{ tex: string; caption: readonly [string, string] }>,
    diagram?: string,
  ) => (
    <ResearchSection
      title={title}
      refs={refs}
      paragraphs={paragraphs}
      equations={equations}
      diagram={diagram}
    />
  );
  return (
    <div className="of-page of-content">
      <PageHeading
        title={p(
          "Model definitions and assumptions",
          "Definiciones y supuestos de los modelos",
        )}
        lede={p(
          "The equations specify energy, particle-size response, four process families, separation, flotation and learning. Coefficients are authored unless case-specific testwork is supplied; none establishes a plant operating point.",
          "Las ecuaciones especifican energía, respuesta granulométrica, cuatro familias de proceso, separación, flotación y aprendizaje. Los coeficientes son supuestos salvo ensayos específicos; ningún cálculo establece un punto de operación de planta.",
        )}
      />
      <Tabset
        tabs={[
          {
            id: "energy",
            label: p("Energy laws", "Leyes de energía"),
            content: common(
              p(
                "1. Three comminution laws, three questions",
                "1. Tres leyes de conminución, tres preguntas",
              ),
              ["bond"],
              [
                p(
                  "Rittinger emphasises new surface area and becomes highly sensitive as product size shrinks. Kick treats the reduction ratio geometrically and is more appropriate for coarse breakage. Bond places the work index between feed and product sizes and remains the engineering reference used in the baked energy ledger.",
                  "Rittinger enfatiza nueva superficie y se vuelve sensible al reducir tamaño. Kick trata la razón geométricamente y es útil para rotura gruesa. Bond ubica work index entre tamaños y sigue como referencia de ingeniería en ledger.",
                ),
                p(
                  "OreFlow evaluates all three at the same P80. This is an intentional comparison of scaling assumptions, not three calibrated estimates of one mill. Their disagreement is the point: it identifies where product-size decisions are doing most of the work.",
                  "OreFlow evalúa las tres en el mismo P80. Es comparación de escalas, no tres estimaciones calibradas de un molino. Su desacuerdo es el punto: identifica dónde decisión de tamaño domina.",
                ),
                p(
                  "The Bond work index is case-specific in the registry, while Rittinger and Kick coefficients are declared global research constants. A real calibration would replace those values with laboratory work, ore competency and equipment efficiency factors.",
                  "Bond work index es específico de caso, mientras coeficientes Rittinger y Kick son constantes declaradas. Calibración real reemplazaría valores con trabajo de laboratorio, competencia y eficiencia.",
                ),
                p(
                  "All energy numbers are specific energy proxies. They do not include motor efficiency, liner wear, circulating load, media, capital or power price. They are suitable for a visual sensitivity question, not a feasibility study.",
                  "Todos los números son proxies de energía específica. No incluyen eficiencia, desgaste, carga circulante, medios, capital ni precio. Sirven para sensibilidad visual, no estudio de factibilidad.",
                ),
              ],
              [
                {
                  tex: String.raw`E_R=C_R\left(\frac{1}{P_{80}}-\frac{1}{F_{80}}\right)`,
                  caption: p(
                    "Rittinger increases with surface area created.",
                    "Rittinger aumenta con superficie creada.",
                  ),
                },
                {
                  tex: String.raw`E_B=10W_i\left(\frac{1}{\sqrt{P_{80}}}-\frac{1}{\sqrt{F_{80}}}\right)`,
                  caption: p(
                    "Bond work-index form used in the ledger.",
                    "Forma Bond usada en ledger.",
                  ),
                },
              ],
              "energy-laws",
            ),
          },
          {
            id: "grinding",
            label: p("Size-distribution proxy", "Proxy granulométrico"),
            content: common(
              p(
                "2. A size distribution survives the mill",
                "2. La distribución de tamaños sobrevive a la molienda",
              ),
              ["pbm", "bond"],
              [
                p(
                  "A single P80 hides the tail that classification and flotation later see. The process model therefore carries a cumulative particle-size response over a logarithmic grid. Its slope is softened by hardness and crusher reduction, making the tail a visible state variable.",
                  "Un P80 único oculta la cola que luego ven clasificación y flotación. El modelo lleva respuesta acumulativa sobre grilla logarítmica. Pendiente se suaviza por dureza y reducción de trituradora, haciendo visible la cola.",
                ),
                p(
                  "This is a cumulative shape proxy, not a solved population-balance equation or calibrated breakage kernel. It lets the user alter the grind target and see an internally consistent size curve respond.",
                  "Es un proxy de forma acumulativa, no una ecuación de balance poblacional resuelta ni un kernel de ruptura calibrado. Permite alterar el P80 y observar una curva granulométrica internamente consistente.",
                ),
                p(
                  "The crusher stage uses CSS and feed P80 to produce a product P80. That output feeds the grinding response, so a change upstream is not overwritten by an independent downstream target.",
                  "Trituradora usa CSS y feed P80 para producir P80. Ese resultado alimenta molienda, por lo que cambio upstream no se sobrescribe con target independiente.",
                ),
                p(
                  "The resulting arrays are stored in every variant artifact and plotted with hover values. This is more informative than a single “fineness” KPI because it reveals where curves cross and where model conclusions are tail-driven.",
                  "Arreglos resultantes quedan en cada artefacto y se grafican con hover. Es más informativo que KPI único porque revela cruces y conclusiones dominadas por cola.",
                ),
              ],
              [
                {
                  tex: String.raw`\frac{\partial M_i}{\partial t}=S_{i+1}M_{i+1}-S_iM_i+\sum_{j>i}b_{ij}S_jM_j`,
                  caption: p(
                    "General population-balance form; OreFlow uses a compact cumulative proxy.",
                    "Forma general de balance; OreFlow usa proxy acumulativo compacto.",
                  ),
                },
              ],
              "instrument",
            ),
          },
          {
            id: "classification",
            label: p("Classification", "Clasificación"),
            content: common(
              p(
                "3. Partition curves turn size into probability",
                "3. Curvas de partición vuelven tamaño probabilidad",
              ),
              ["hydrocyclone"],
              [
                p(
                  "A classifier does not split a sample at one perfect aperture. Real separation is probabilistic. OreFlow uses a logistic partition to expose the d50 and imperfection, then applies a Plitt-style cut-size approximation affected by water, density and feed load.",
                  "Un clasificador no divide muestra en apertura perfecta. Separación real es probabilística. OreFlow usa partición logística para exponer d50 e imperfección, y aproximación estilo Plitt afectada por agua, densidad y carga.",
                ),
                p(
                  "The ground cumulative curve is differenced into size-bin masses. Each bin is multiplied by its fine-recovery probability; those masses are then summed to obtain the overflow fraction and renormalized into the overflow cumulative curve. Multiplying cumulative ordinates directly would not conserve the stream basis.",
                  "La curva acumulativa molida se diferencia en masas por clase de tamaño. Cada clase se multiplica por su probabilidad de pasar a finos; las masas se suman para obtener la fracción overflow y se renormalizan como curva acumulativa. Multiplicar directamente las ordenadas acumulativas no conservaría la base del flujo.",
                ),
                p(
                  "Water is included as a declared process variable, not a visual slider detached from physics. Increasing water shifts the modeled cut response and changes plant water demand through throughput times water per tonne.",
                  "Agua es variable declarada, no slider separado de física. Aumentar agua desplaza corte modelado y cambia demanda por throughput por agua por tonelada.",
                ),
                p(
                  "The classifier model is a research-level approximation. It does not represent cyclone geometry, apex, vortex finder, pressure drop or rheology in enough detail to authorize equipment selection.",
                  "Modelo de clasificador es aproximación de investigación. No representa geometría, apex, vortex finder, caída de presión o reología con detalle para seleccionar equipo.",
                ),
              ],
              [
                {
                  tex: String.raw`P_{\mathrm{overflow}}(d)=\frac{1}{1+\exp\left((d-d_{50})/(\alpha d_{50})\right)}`,
                  caption: p(
                    "Logistic fine-recovery partition used for the response curve.",
                    "Partición logística de finos usada en curva.",
                  ),
                },
              ],
              "classification-curve",
            ),
          },
          {
            id: "gravity",
            label: p("Gold gravity branch", "Rama gravimétrica"),
            content: common(
              p("4. Free gold is a separate branch", "4. El oro libre es una rama separada"),
              ["gold-flowsheet", "metso-handbook"],
              [
                p("The free-milling gold case sends classifier underflow through a one-pass gravity size window while overflow enters a rougher. The two products and two reject streams are balanced separately before overall recovery is reported.", "El caso de oro libre envía gruesos del clasificador a una ventana gravimétrica de una pasada, mientras finos entran al rougher. Ambos productos y rechazos se balancean por separado antes de reportar recuperación global."),
                p("The capture window penalises very fine and very coarse particles. Its 0.82 scale and 45/700 micron shape parameters are authored teaching assumptions, not fitted gravity-recoverable-gold tests. The assumed gravity-product grade also lacks an assay basis.", "La ventana penaliza partículas muy finas y muy gruesas. Su escala 0,82 y parámetros 45/700 micrómetros son supuestos didácticos, no ensayos GRG ajustados. La ley del producto gravimétrico tampoco tiene base de ensaye."),
                p("Moving the classification cut reallocates mass between gravity and flotation, not merely a label on the same rougher. The browser and Python kernels are checked against every baked variant.", "Mover el corte reasigna masa entre gravedad y flotación, no solo cambia la etiqueta de un rougher. Los motores de navegador y Python se comparan en cada variante."),
              ],
              [{ tex: String.raw`R_g=0.82\sum_i m_i^{U}(1-e^{-d_i/45})e^{-d_i/700}`, caption: p("Authored gravity response on classifier underflow size-bin mass.", "Respuesta gravimétrica supuesta sobre masa de gruesos por tamaño.") }],
            ),
          },
          {
            id: "magnetic",
            label: p("Magnetic separation", "Separación magnética"),
            content: common(
              p("5. Magnetite bypasses the rougher", "5. Magnetita no pasa por rougher"),
              ["metso-lims"],
              [
                p("The magnetite path sends ground ore directly to a low-intensity magnetic separation proxy. It has no hydrocyclone or flotation stage, and those registry methods are marked not applicable. The visual mass ledger shows magnetic concentrate and nonmagnetic reject.", "La ruta de magnetita envía mineral molido directamente a un proxy de separación magnética de baja intensidad. No tiene hidrociclón ni flotación, y esos métodos se marcan no aplicables. El balance muestra concentrado magnético y rechazo."),
                p("A size-window capture is integrated over the ground distribution. A 62% product grade closes the valuable-metal balance, but it is an authored assumption, not measured iron grade. No field strength, susceptibility, mineral liberation or separator geometry is modeled.", "Se integra una ventana de captura por tamaño sobre la distribución molida. Una ley de producto de 62% cierra el balance de metal, pero es un supuesto, no una ley de hierro medida. No se modelan campo, susceptibilidad, liberación ni geometría."),
                p("Changing grind P80 alters both the size distribution and energy estimate. Collector dose, residence and air controls are omitted because they would not affect this path.", "Cambiar P80 altera distribución y energía. Dosis de colector, residencia y aire se omiten porque no afectan esta ruta."),
              ],
              [{ tex: String.raw`R_m=\sum_i m_i\,0.91(1-e^{-d_i/25})e^{-d_i/1800}`, caption: p("Authored LIMS capture response; not separator calibration.", "Respuesta LIMS supuesta; no calibración de separador.") }],
            ),
          },
          {
            id: "deslime",
            label: p("Desliming path", "Ruta de deslamado"),
            content: common(
              p("6. Phosphate retains the coarse stream", "6. Fosfato conserva los gruesos"),
              ["metso-handbook", "usgs-laterite"],
              [
                p("In the phosphate-with-clay scenario, classifier overflow leaves as slimes. The retained underflow, not overflow, enters the rougher. Changing the cut therefore changes both slime discard and the fraction of solids available for recovery.", "En fosfato con arcilla, el overflow sale como lamas. El underflow retenido, no los finos, entra al rougher. Cambiar el corte altera descarte y fracción disponible para recuperación."),
                p("The current model assumes head grade is uniform across size classes. Real desliming can preferentially lose or retain valuable mineral, so a measured mineral-by-size assay and separation test are required before interpreting this as a phosphate prediction.", "El modelo supone ley uniforme entre tamaños. El deslamado real puede perder o retener mineral valioso preferentemente; se requiere ensaye mineralógico por tamaño y prueba de separación antes de interpretarlo como predicción de fosfato."),
                p("The nickel laterite case remains a named proxy using the generic rougher path. It is explicitly not a hydrometallurgical laterite flowsheet; leach kinetics, acid consumption and residue chemistry are outside this implementation.", "El caso de laterita de níquel sigue siendo un proxy con rougher genérico. No es un flowsheet hidrometalúrgico; cinética de lixiviación, ácido y química de residuos están fuera de esta implementación."),
              ],
              [{ tex: String.raw`R_c=(1-\phi_{\mathrm{slimes}})R_f(t)`, caption: p("Overall recovery when classifier overflow is discarded as slimes.", "Recuperación global cuando los finos se descartan como lamas.") }],
            ),
          },
          {
            id: "flotation",
            label: p("Flotation kinetics", "Cinética de flotación"),
            content: common(
              p(
                "7. Residence time reveals kinetic populations",
                "7. Tiempo de residencia revela poblaciones cinéticas",
              ),
              ["flotation"],
              [
                p(
                  "The first-order form treats the valuable fraction as one kinetic population. Kelsall separates fast and slow populations, while the compressed exponential changes the shape of the approach to a plateau. Comparing them shows how the same final time can imply a very different early recovery path.",
                  "Forma de primer orden trata fracción valiosa como una población. Kelsall separa rápida y lenta, mientras exponencial comprimida cambia forma al plateau. Compararlas muestra trayectorias diferentes.",
                ),
                p(
                  "Reagent dose and air rate enter the rate constant through saturating response terms. Those saturations are a useful reminder that dosage is not linearly exchangeable with time, and that increasing one operating variable can leave another bottleneck unchanged.",
                  "Dosis y aire entran en tasa con términos saturantes. Recordatorio: dosis no es intercambiable linealmente con tiempo y variable puede dejar otro cuello de botella.",
                ),
                p(
                  "The circuit converts recovery into concentrate grade using a mass-pull proxy and closes valuable metal balance analytically. The balance is exact for the declared one-stage model; it is not evidence that a plant has no sampling or accounting error.",
                  "Circuito convierte recuperación a ley con proxy mass-pull y cierra balance analíticamente. Balance exacto para modelo declarado, no evidencia de planta sin error de muestreo.",
                ),
                p(
                  "The visual curve is a hypothesis generator. Metallurgical testing would fit rate populations, entrainment, froth stability and reagent selectivity to observed time-recovery data before any production decision.",
                  "Curva visual genera hipótesis. Prueba metalúrgica ajustaría poblaciones, arrastre, estabilidad y selectividad con datos observados antes de decisión productiva.",
                ),
              ],
              [
                {
                  tex: String.raw`R(t)=R_{\max}\left(1-e^{-kt}\right)`,
                  caption: p(
                    "First-order cumulative recovery.",
                    "Recuperación acumulativa de primer orden.",
                  ),
                },
                {
                  tex: String.raw`R_K(t)=R_{\max}\left[f(1-e^{-k_ft})+(1-f)(1-e^{-k_st})\right]`,
                  caption: p(
                    "Kelsall fast and slow populations.",
                    "Poblaciones rápida y lenta de Kelsall.",
                  ),
                },
              ],
              "flotation-kinetics",
            ),
          },
          {
            id: "optimization",
            label: p("Optimisation", "Optimización"),
            content: common(
              p(
                "8. Constrained optimisation is a transparent search",
                "8. Optimización acotada es búsqueda transparente",
              ),
              ["scipy-opt"],
              [
                p(
                  "OreFlow’s optimizer enumerates bounded grind and reagent factors and evaluates the same circuit used by the workbench. The candidate objective rewards recovery and concentrate grade while penalising specific energy and reagent dose.",
                  "Optimizador enumera factores acotados de molienda y reactivo y evalúa mismo circuito. Objetivo premia recuperación y ley y penaliza energía y dosis.",
                ),
                p(
                  "The implementation records the winning objective and operating point, not just a success flag. A researcher can therefore compare whether the “best” point comes from a real recovery gain, an energy penalty or the arbitrary weight choices.",
                  "Implementación registra objetivo y punto ganador. Investigador puede comparar si “mejor” viene de recuperación, penalización energética o pesos elegidos.",
                ),
                p(
                  "Constraints include the physical ordering of product sizes and mass-balance closure. The search is not a global nonlinear optimum because the feasible region, weights and model forms are intentionally limited.",
                  "Restricciones incluyen orden físico de tamaños y cierre de balance. No es óptimo global porque región, pesos y formas están limitados.",
                ),
                p(
                  "For plant deployment, this layer should be connected to measured economics, equipment envelopes, water permits and operator constraints. OreFlow exposes where those inputs would enter without inventing them.",
                  "Para planta, esta capa debe conectarse a economía medida, equipos, permisos de agua y operadores. OreFlow muestra dónde entrarían sin inventarlos.",
                ),
              ],
              [
                {
                  tex: String.raw`\max_{x\in\Omega}\;J(x),\quad J=R_c+0.35G_c-0.18E-0.006D`,
                  caption: p(
                    "Declared research objective in the 25-point grid search.",
                    "Objetivo declarado en la búsqueda de 25 puntos.",
                  ),
                },
              ],
              "optimization-grid",
            ),
          },
          {
            id: "learning",
            label: p("Learning limits", "Límites del aprendizaje"),
            content: common(
              p(
                "9. Learned models inherit the simulator boundary",
                "9. Modelos aprendidos heredan límite del simulador",
              ),
              ["ml-mining", "ml-review", "sklearn", "pytorch"],
              [
                p(
                  "The feature matrix spans 720 seeded parametric variants around the twelve authored cases. The target is overall circuit recovery produced by the declared one-pass simulator, so learned models approximate that simulator rather than discovering relationships from plant observations.",
                  "La matriz incluye 720 variantes paramétricas sembradas alrededor de doce casos de autor. La variable objetivo es la recuperación global del simulador de una pasada; los modelos aprendidos aproximan ese simulador y no descubren relaciones a partir de observaciones de planta.",
                ),
                p(
                  "Ridge establishes a linear baseline; random forest, boosting and Gaussian process test nonlinear surrogate families. Only point predictions are evaluated here: the Gaussian-process posterior uncertainty is not calibrated or reported. The MLP is trained offline with PyTorch and exported to ONNX.",
                  "Ridge establece una referencia lineal; bosque aleatorio, boosting y proceso gaussiano prueban sustitutos no lineales. Aquí se evalúan solo predicciones puntuales: la incertidumbre posterior del proceso gaussiano no está calibrada ni reportada. El MLP se entrena fuera del navegador con PyTorch y se exporta a ONNX.",
                ),
                p(
                  "An autoencoder reconstruction error is stored as a diagnostic, not a probability of correctness. High reconstruction error means the feature vector looks unlike training vectors; it does not prove the process is unsafe or wrong.",
                  "Error de reconstrucción de autoencoder es diagnóstico, no probabilidad. Error alto significa vector distinto a entrenamiento; no prueba que proceso sea inseguro o erróneo.",
                ),
                p(
                  "The evaluation perturbations are disjoint from the training rows and report percentage-point RMSE. They reuse the same authored case families, so this is interpolation testing, not an out-of-ore-domain validation.",
                  "Las perturbaciones de evaluación son distintas de las filas de entrenamiento y reportan RMSE en puntos porcentuales. Reutilizan las mismas familias de casos de autor: es una prueba de interpolación, no una validación fuera de dominio mineralógico.",
                ),
              ],
              [
                {
                  tex: String.raw`\hat{y}=f_\theta(x),\quad \mathrm{RMSE}=\sqrt{\frac{1}{n}\sum_i(y_i-\hat{y}_i)^2}`,
                  caption: p(
                    "Prediction and held-out error reported by the pipeline.",
                    "Predicción y error reservado reportados por pipeline.",
                  ),
                },
              ],
              "surrogate-errors",
            ),
          },
        ]}
      />
      <div className="of-next">
        <Link to="/implementation">{es ? "Ver detalles de implementación" : "Open implementation details"} ↗</Link>
      </div>
    </div>
  );
}
