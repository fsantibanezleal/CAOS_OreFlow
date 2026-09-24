import { Link } from "react-router";
import {
  PageHeading,
  ResearchSection,
  Tabset,
  InfoTable,
} from "../content/Research";
const p = (en: string, es: string) => [en, es] as const;
const base = (
  title: readonly [string, string],
  refs: string[],
  focus: readonly [string, string],
  diagram?: string,
) => (
  <ResearchSection
    title={title}
    refs={refs}
    paragraphs={[
      focus,
      p(
        "The repository separates pure numerical kernels from I/O, orchestration and presentation. This keeps a new input dataset applicable without changing the visual contract, and it keeps a browser control from silently rewriting canonical evidence.",
        "El repositorio separa kernels numéricos puros de I/O, orquestación y presentación. Así un nuevo dataset entra sin cambiar contrato visual y un control no reescribe evidencia canónica.",
      ),
      p(
        "Every stage leaves a typed or standard-format boundary. Parameters are explicit, seeds are threaded, method identities are recorded and failed cells remain visible. The same choices make the implementation suitable for code review and future calibration.",
        "Cada etapa deja frontera tipada o formato estándar. Parámetros explícitos, semillas propagadas, identidades registradas y celdas fallidas visibles. Esto sirve para revisión y calibración futura.",
      ),
      p(
        "The app consumes only compact derived artifacts in replay mode. Raw data and heavyweight training files remain outside the public bundle, while their hashes, source links and aggregate summaries remain inspectable.",
        "La app consume solo artefactos derivados compactos en replay. Datos raw y archivos pesados quedan fuera del bundle, con hashes, enlaces y resúmenes inspeccionables.",
      ),
    ]}
    diagram={diagram}
  />
);
export default function Implementation() {
  const tabs = [
    {
      id: "contract",
      label: p("Input contract", "Contrato de entrada"),
      content: base(
        p(
          "1. Contract 1, the bring-your-own-data door",
          "1. Contrato 1, puerta para nuevos datos",
        ),
        ["hzdr"],
        p(
          "The strict operating-point schema requires feed throughput, head grade, feed P80, hardness, density, grind P80, classifier cut, flotation time, air, reagent and water, with units and physically ordered ranges. Missing or non-finite fields reject the row; extreme throughput, reagent or water flags it for review.",
          "El esquema estricto requiere throughput, ley, P80, dureza, densidad, P80 molienda, corte, tiempo, aire, reactivo y agua, con unidades y rangos ordenados. Campos faltantes o no finitos rechazan; extremos se marcan para revisión.",
        ),
        "data",
      ),
    },
    {
      id: "dataset",
      label: p("Dataset and split", "Conjunto y split"),
      content: base(
        p(
          "2. The dataset is generated, shuffled and split once",
          "2. Dataset se genera, mezcla y particiona una vez",
        ),
        ["hzdr", "sklearn"],
        p(
          "The licensed HZDR workbook is read with pandas and reduced to feature statistics. The model design matrix is seeded, generated around case parameters and shuffled once. Training, validation and test counts are written to features.json and models/registry.json.",
          "El libro HZDR licenciado se lee con pandas y se reduce a estadísticas. Matriz se genera con semilla alrededor de casos y se mezcla una vez. Conteos quedan en features.json y registry.json.",
        ),
        "pipeline",
      ),
    },
    {
      id: "classical",
      label: p("Classical kernels", "Kernels clásicos"),
      content: base(
        p(
          "3. Classical methods share one state",
          "3. Métodos clásicos comparten un estado",
        ),
        ["bond", "pbm", "hydrocyclone", "flotation"],
        p(
          "Rittinger, Kick, Bond, Whiten, PBM, partition, Plitt and three flotation kinetics are implemented as callable NumPy functions. They are not just labels in a table: each contributes a scalar or curve to every variant artifact.",
          "Rittinger, Kick, Bond, Whiten, PBM, partition, Plitt y tres cinéticas están implementados como funciones NumPy. No son etiquetas: cada uno aporta escalar o curva a cada artefacto.",
        ),
        "instrument",
      ),
    },
    {
      id: "optimizer",
      label: p("Optimisation and MC", "Optimización y MC"),
      content: base(
        p(
          "4. Optimisation and uncertainty reuse the circuit",
          "4. Optimización e incertidumbre reutilizan circuito",
        ),
        ["scipy-opt"],
        p(
          "The constrained grid evaluates 25 candidates and computes the objective, selected grind P80, reagent, recovery, grade and energy. Robust Monte Carlo draws hardness, grade and cut multipliers from a seeded lognormal distribution. Its public method record currently retains p05 recovery only; p50 and p95 are computed but not exported in that record.",
          "La grilla acotada evalúa 25 candidatos y calcula objetivo, P80, reactivo, recuperación, ley y energía. Monte Carlo dibuja multiplicadores lognormales con semilla para dureza, ley y corte. El registro público conserva solo recuperación p05; p50 y p95 se calculan pero no se exportan allí.",
        ),
        "optimization-grid",
      ),
    },
    {
      id: "learned",
      label: p("Learned tiers", "Capas aprendidas"),
      content: base(
        p(
          "5. Four statistical surrogates and two neural artifacts",
          "5. Cuatro surrogate estadísticos y dos neurales",
        ),
        ["ml-mining", "sklearn", "pytorch"],
        p(
          "Ridge, random forest, gradient boosting and Gaussian process are fitted with scikit-learn on the training slice. PyTorch MLP and autoencoder are fitted in the GPU environment when available. Joblib model files, ONNX exports and registry metadata make the training operation inspectable.",
          "Ridge, random forest, gradient boosting y Gaussian process se ajustan con scikit-learn en train. MLP y autoencoder PyTorch se ajustan en entorno GPU si existe. Joblib, ONNX y registry hacen inspeccionable la operación.",
        ),
        "lanes",
      ),
    },
    {
      id: "inference",
      label: p("Inference", "Inferencia"),
      content: base(
        p(
          "6. Baked scenarios and local calculations are separate",
          "6. Escenarios precomputados y cálculos locales son separados",
        ),
        ["onnx"],
        p(
          "The static build reads baked case arrays. The circuit walkthrough steps through operations and does not simulate physical time. Editing a slider switches to a bounded TypeScript engine that mirrors the declared formulas. That state is marked LOCAL CALCULATION and does not overwrite the offline method matrix; learned values remain marked stale.",
          "El build estático lee arreglos precomputados. El recorrido avanza por operaciones y no simula tiempo físico. Editar un control cambia al motor TypeScript que refleja las fórmulas declaradas. Ese estado se marca CÁLCULO LOCAL y no sobrescribe la matriz; valores aprendidos quedan desactualizados.",
        ),
        "lanes",
      ),
    },
    {
      id: "validation",
      label: p("Validation and QA", "Validación y QA"),
      content: base(
        p(
          "7. Validation is mechanical and visual",
          "7. Validación es mecánica y visual",
        ),
        ["sklearn"],
        p(
          "The artifact guard validates manifest paths, bytes, non-empty files, lane consistency and method coverage. Python tests validate contracts, determinism, mass balance and variant counts. Frontend typecheck and build validate the mirrored JSON contract; browser checks validate that six routes, controls, hover charts and themes respond.",
          "Guard valida rutas, bytes, archivos, lanes y cobertura. Tests validan contratos, determinismo, balance y variantes. Typecheck y build validan contrato JSON; navegador valida rutas, controles, hover y temas.",
        ),
        "data",
      ),
    },
    {
      id: "deploy",
      label: p("Deployment", "Despliegue"),
      content: base(
        p(
          "8. Deployment is a serving operation",
          "8. Despliegue es operación de servicio",
        ),
        ["githubpages", "modsim"],
        p(
          "The GitHub Pages workflow builds the SPA from committed source and derived artifacts. The ML VPS service runs FastAPI behind nginx and TLS, serving the same static build plus read-only health and catalog endpoints. Neither route trains or mutates scientific outputs at request time.",
          "Workflow Pages construye SPA desde source y artefactos. Servicio VPS ML ejecuta FastAPI detrás de nginx y TLS, sirve mismo build más endpoints read-only. Ninguna ruta entrena o muta salidas.",
        ),
        "release",
      ),
    },
  ];
  return (
    <div className="of-page of-content">
      <PageHeading
        title={p(
          "Computation and data contracts",
          "Cómputo y contratos de datos",
        )}
        lede={p(
          "The offline pipeline prepares inputs, trains simulator surrogates, evaluates held-out perturbations and exports versioned case artifacts. The browser replays those artifacts and runs a lightweight process model when controls change.",
          "El pipeline prepara entradas, entrena sustitutos del simulador, evalúa perturbaciones reservadas y exporta artefactos versionados. El navegador reproduce esos artefactos y ejecuta un modelo ligero al mover controles.",
        )}
      />
      <div className="of-implementation-band">
        <InfoTable
          rows={[
            [
              p("Pipeline stages", "Etapas"),
              p(
                "8 named stages from ingest to validation",
                "8 etapas nombradas desde ingestión a validación",
              ),
            ],
            [
              p("Scientific coverage", "Cobertura científica"),
              p(
                "12 cases x 6 variants x 21 method records",
                "12 casos x 6 variantes x 21 registros de método",
              ),
            ],
            [
              p("Public data", "Datos públicos"),
              p(
                "HZDR RODARE summary, CC BY 4.0, DOI retained",
                "Resumen HZDR RODARE, CC BY 4.0, DOI conservado",
              ),
            ],
            [
              p("Deployment", "Despliegue"),
              p(
                "GitHub Pages plus ML VPS service",
                "GitHub Pages más servicio VPS ML",
              ),
            ],
          ]}
        />
      </div>
      <Tabset tabs={tabs} />
      <div className="of-next">
        <Link to="/experiments">Inspect the experiments ↗</Link>
      </div>
    </div>
  );
}
