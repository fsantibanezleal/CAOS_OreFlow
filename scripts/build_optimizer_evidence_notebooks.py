"""Build the bilingual, record-backed assessment of OreFlow's optimizer screen."""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

TEXT = {
    "en": {
        "title": "Measure the cost of screening optimizer proposals",
        "question": "Does the learned screen reduce exact circuit evaluations while preserving the engine-verified operating point?",
        "objective": "This investigation tests a specific engineering claim: a learned score may help a constrained search spend fewer calls on its exact process simulator. You will examine the paired, committed records for every screened operating variant, quantify the evaluation cost, and independently re-run selected reported optima through the circuit engine. A negative result is useful here because the screen is an optimization component whose cost must be measured, not assumed.",
        "data": "The primary data are OreFlow-authored, versioned scenario records in `data/derived/cases/<case_id>.json`, released under the repository's MIT licence. The records contain the screened search, its same-start unscreened counterpart, final decisions and engine-evaluation counts. The twelve cases are constructed scenarios, not operating-plant observations. The optimizer's controls and case bounds are in `data/derived/contract/operating_contract.json`; the method and limitations are documented in `docs/methodologies/12_optimization.md`. The source repository is https://github.com/fsantibanezleal/CAOS_OreFlow.",
        "method": "For each variant, let N_s be the number of distinct exact-engine evaluations made by the screen-assisted search and N_0 the count from the matched search without screening. The paired difference is d=N_s-N_0; the relative cost is 100d/N_0. Negative d would mean fewer simulator calls. A zero difference means no change. Positive d is additional simulator work. We do not compare unrelated seeds, starts, constraints or objectives: both counts belong to the same committed optimization record and use its same operating case and weight. This pairing controls the scenario and search configuration, but it does not make the authored scenarios a sample of real plants.\n\nThe screen is allowed to rank proposals, but the exact process engine evaluates a candidate before it can replace an incumbent. Therefore the key integrity check is not whether the surrogate predicts a good score; it is whether each stored optimum is a valid engine result. The code below reconstructs each saved decision vector from the catalogued base point, invokes OreFlow's production `simulate` method and compares the recovered payable-metal rate with the record. It also checks the maximum balance residual returned by the engine. Small disagreement would indicate a stale record, a changed method or a reconstruction error, and would invalidate the comparison until resolved.\n\nTwo views answer different questions. The paired scatter shows whether one procedure consistently uses fewer evaluations; the identity line marks equal cost. The per-case plot shows how an aggregate can conceal variation between ore scenarios. The number of variants is not the number of independent mines: several variants share a case and differ by one controlled input. We report counts and exact paired differences instead of a confidence interval that would imply a population sampling design the data do not have.",
        "comparison": "The search itself is generalized pattern search with a progressive barrier for grade, power and water constraints. The learned component is only a proposal-ordering screen. The reference procedure is the same constrained search with the screen disabled, not a different optimizer chosen to make the comparison easier. Both procedures retain the exact circuit engine as evaluator. This distinction matters: a fast prediction is not a saving if it leads to extra search steps or changes the selected physical operating point.\n\nThe proposed benefit is reduced calls to the expensive process model. We evaluate that benefit directly with the committed paired counts, then check the selected operating points against `simulate`. We do not infer a speed improvement from model inference latency, from the fact that a screen rejected candidates, or from a small surrogate error at a few points. Those quantities do not measure total work or establish that the screen is useful to an operator.",
        "evidence": "The fixed release record includes 72 screened target-mode variants across twelve authored cases. Its aggregate counts are 26,367 engine evaluations with screening and 22,487 without it. Screening therefore adds 3,880 evaluations, a 17.25% increase relative to the unscreened count. It saves evaluations in zero variants, costs more in 68, and leaves four unchanged. The comparison is paired within each variant; the figures retain that pairing rather than hiding it in one mean.\n\nThe same records have the same terminal outcome in 65 variants: 63 identical feasible decision vectors and two matching infeasible outcomes. Seven of the 70 feasible pairs select different decisions; the largest recovered-metal difference is 0.002653 t/h (0.017%). Across 5,811 screened proposals, absolute prediction error averages 0.71 percentage points, has a median of 0.48 points and reaches 38.16 points. Re-running selected optima is a separate integrity check, not a second performance comparison. The result is bounded to the committed constructed scenarios and recorded algorithm settings.",
        "results": "**Answer:** The screen does not reduce exact-engine work on this release's 72 paired variants: it uses 26,367 evaluations versus 22,487 without screening, a 17.25% increase. It costs more in 68 variants, ties in four and saves in none. The same terminal outcome occurs in 65 variants (63 identical feasible decisions and two matching infeasible outcomes); seven feasible pairs differ. Across 5,811 proposals, mean absolute prediction error is 0.71 points, median 0.48 and maximum 38.16. This result is limited to the committed constructed scenarios and settings; it does not establish behavior on measured plant data or other search designs.",
        "summary": "The screen's intended role is limited to ordering proposals; the circuit engine remains responsible for every physical result. The measured record answers the cost question directly and gives a negative result: screening adds exact evaluations for this scenario suite. Keep that finding visible when discussing the optimizer. Any later screen revision needs a new matched experiment, the same engine-verification check and a fresh notebook run; it cannot inherit a speed claim from this result.",
        "refs": [
            "Torczon (1997), On the convergence of pattern search algorithms. https://doi.org/10.1137/S1052623493250780",
            "Audet and Dennis (2006), Mesh adaptive direct search algorithms for constrained optimization. https://doi.org/10.1137/040603371",
            "Audet and Dennis (2009), A progressive barrier for derivative-free nonlinear programming. https://doi.org/10.1137/070692662",
            "Booker et al. (1999), A rigorous framework for optimization of expensive functions by surrogates. https://doi.org/10.1007/BF01197708",
            "OreFlow constrained optimization method and measured records: `docs/methodologies/12_optimization.md` and `data/derived/cases/`.",
        ],
        "labels": ["Screened", "Unscreened", "Equal evaluations", "Additional engine calls (%)", "Case", "Evaluation difference"],
        "checks": ["copper_porphyry_soft", "copper_oxide", "gold_free_milling", "nickel_sulphide", "zinc_sulfide"],
        "headings": ["Objectives", "Setup", "Data", "Method", "Comparison", "Evidence", "Results", "Summary", "References"],
    },
    "es": {
        "title": "Medir el costo de filtrar propuestas del optimizador",
        "question": "¿El filtro aprendido reduce las evaluaciones exactas del circuito y conserva el punto operativo verificado por el motor?",
        "objective": "Esta investigación prueba una afirmación de ingeniería concreta: una puntuación aprendida podría ayudar a una búsqueda restringida a usar menos llamadas a su simulador exacto de procesos. Examinarás los registros pareados y comprometidos de todas las variantes optimizadas con filtro, cuantificarás el costo de evaluación y volverás a ejecutar algunos óptimos reportados en el motor del circuito. Un resultado negativo es útil porque el filtro es un componente de optimización cuyo costo debe medirse, no suponerse.",
        "data": "Los datos principales son registros de escenarios versionados y escritos por el equipo OreFlow en `data/derived/cases/<case_id>.json`, bajo la licencia MIT del repositorio. Los registros contienen la búsqueda con filtro, su contraparte sin filtro con los mismos inicios, las decisiones finales y los conteos de evaluaciones del motor. Los doce casos son escenarios construidos, no observaciones de plantas en operación. Los controles y límites por caso están en `data/derived/contract/operating_contract.json`; el método y sus límites se documentan en `docs/methodologies/12_optimization.md`. Repositorio: https://github.com/fsantibanezleal/CAOS_OreFlow.",
        "method": "Para cada variante, N_f es el número de evaluaciones distintas del motor exacto que realiza la búsqueda asistida por filtro y N_0 es el conteo de la búsqueda pareada sin filtro. La diferencia es d=N_f-N_0; el costo relativo es 100d/N_0. Un valor negativo de d significaría menos llamadas al simulador. Cero significa que no cambia. Un valor positivo significa más trabajo del simulador. No comparamos semillas, inicios, restricciones u objetivos diferentes: ambos conteos pertenecen al mismo registro de optimización y usan el mismo caso operativo y ponderación. Este emparejamiento controla el escenario y la configuración de búsqueda, pero no convierte los escenarios escritos en una muestra de plantas reales.\n\nEl filtro puede ordenar propuestas, pero el motor exacto de procesos evalúa un candidato antes de que pueda reemplazar a un incumbente. Por ello, la comprobación central de integridad no es si el modelo predice una buena puntuación; es si cada óptimo guardado constituye un resultado válido del motor. El código reconstruye los vectores de decisión desde el punto base del catálogo, llama al método de producción `simulate` de OreFlow y compara la tasa de metal pagable recuperado con el registro. También comprueba el residuo máximo de balance que devuelve el motor. Una discrepancia pequeña invalidaría la comparación hasta resolver si hay un registro obsoleto, un método cambiado o un error de reconstrucción.\n\nLas dos figuras responden preguntas distintas. La dispersión pareada muestra si un procedimiento usa sistemáticamente menos evaluaciones; la línea de identidad marca costos iguales. El gráfico por caso muestra cómo un agregado puede ocultar variación entre escenarios de mineral. El número de variantes no equivale al número de minas independientes: varias variantes comparten caso y cambian una entrada controlada. Informamos conteos y diferencias pareadas exactas, en vez de un intervalo de confianza que implicaría un muestreo de población que estos datos no tienen.",
        "comparison": "La búsqueda es un patrón generalizado con barrera progresiva para las restricciones de ley, potencia y agua. El componente aprendido solo ordena propuestas. El procedimiento de referencia es la misma búsqueda restringida con el filtro desactivado, no otro optimizador escogido para facilitar la comparación. Ambos conservan el motor exacto del circuito como evaluador. Esta distinción importa: una predicción rápida no ahorra cómputo si conduce a más pasos de búsqueda o cambia el punto operativo físico seleccionado.\n\nEl beneficio propuesto es reducir llamadas al modelo de procesos, que es costoso. Lo medimos directamente con los conteos pareados comprometidos y después comprobamos los puntos seleccionados con `simulate`. No deducimos una mejora de velocidad a partir del tiempo de inferencia del modelo, de que el filtro haya rechazado candidatos ni de un error pequeño en algunos puntos. Esas cantidades no miden el trabajo total ni demuestran utilidad para una persona operadora.",
        "evidence": "El registro fijo de la versión incluye 72 variantes en modo objetivo filtradas, distribuidas entre doce casos escritos. Los conteos agregados son 26.367 evaluaciones del motor con filtro y 22.487 sin filtro. Por lo tanto, el filtro añade 3.880 evaluaciones, un aumento de 17,25 % respecto del conteo sin filtro. Ahorra evaluaciones en cero variantes, cuesta más en 68 y deja cuatro iguales. La comparación es pareada dentro de cada variante; las figuras conservan ese emparejamiento en vez de ocultarlo en un promedio.\n\nLos mismos registros tienen el mismo resultado terminal en 65 variantes: 63 vectores de decisión factibles idénticos y dos resultados no factibles coincidentes. Siete de las 70 parejas factibles seleccionan decisiones diferentes; la mayor diferencia de metal recuperado es 0,002653 t/h (0,017 %). En 5.811 propuestas filtradas, el error absoluto medio de predicción es 0,71 puntos porcentuales, la mediana 0,48 y el máximo 38,16. Volver a ejecutar óptimos seleccionados es una comprobación de integridad separada, no una segunda comparación de rendimiento. El resultado se limita a los escenarios construidos comprometidos y a los ajustes registrados.",
        "results": "**Respuesta:** El filtro no reduce el trabajo del motor exacto en las 72 variantes pareadas de esta versión: usa 26.367 evaluaciones frente a 22.487 sin filtro, un aumento de 17,25 %. Cuesta más en 68 variantes, empata en cuatro y no ahorra en ninguna. El resultado terminal coincide en 65 variantes (63 decisiones factibles idénticas y dos resultados no factibles coincidentes); siete parejas factibles difieren. En 5.811 propuestas, el error absoluto medio es 0,71 puntos, la mediana 0,48 y el máximo 38,16. El resultado se limita a escenarios construidos y ajustes comprometidos; no establece el comportamiento con datos medidos de planta ni otros diseños de búsqueda.",
        "summary": "El filtro solo pretende ordenar propuestas; el motor del circuito sigue siendo responsable de cada resultado físico. El registro medido responde directamente la pregunta de costo y entrega un resultado negativo: el filtro añade evaluaciones exactas en esta suite de escenarios. Mantén ese hallazgo visible al describir el optimizador. Cualquier revisión futura del filtro necesita un experimento pareado nuevo, la misma comprobación con el motor y una ejecución fresca del notebook; no puede heredar de este resultado una afirmación de velocidad.",
        "refs": [
            "Torczon (1997), On the convergence of pattern search algorithms. https://doi.org/10.1137/S1052623493250780",
            "Audet y Dennis (2006), Mesh adaptive direct search algorithms for constrained optimization. https://doi.org/10.1137/040603371",
            "Audet y Dennis (2009), A progressive barrier for derivative-free nonlinear programming. https://doi.org/10.1137/070692662",
            "Booker et al. (1999), A rigorous framework for optimization of expensive functions by surrogates. https://doi.org/10.1007/BF01197708",
            "Método de optimización restringida y registros medidos de OreFlow: `docs/methodologies/12_optimization.md` y `data/derived/cases/`.",
        ],
        "labels": ["Con filtro", "Sin filtro", "Evaluaciones iguales", "Llamadas adicionales al motor (%)", "Caso", "Diferencia de evaluaciones"],
        "checks": ["copper_porphyry_soft", "copper_oxide", "gold_free_milling", "nickel_sulphide", "zinc_sulfide"],
        "headings": ["Objetivos", "Preparación", "Datos", "Método", "Comparación", "Evidencia", "Resultados", "Resumen", "Referencias"],
    },
}


def md(source: str) -> dict:
    return {"cell_type": "markdown", "metadata": {}, "source": source}


def code(source: str) -> dict:
    return {"cell_type": "code", "execution_count": None, "metadata": {}, "outputs": [], "source": source}


def doc(lang: str) -> dict:
    t = TEXT[lang]
    h = t["headings"]
    es = lang == "es"
    opening = f"# {t['title']}\n\n**Question:** {t['question']}\n\nLevel: 4. Prerequisites: levels 1–3 in this topic. Reading time: 32 minutes."
    if es:
        opening = f"# {t['title']}\n\n**Pregunta:** {t['question']}\n\nNivel: 4. Prerrequisitos: niveles 1–3 de este tema. Lectura: 32 minutos."
    setup = ("Pinned environment; install once in the repository environment with this command, not in the notebook:\n\n```bash\npip install numpy==2.2.6 pandas==2.2.3 matplotlib==3.11.2\n```\n\nThe notebook only reports installed versions and never writes to the source records."
             if not es else "Entorno fijado; instala una vez en el entorno del repositorio con este comando, no dentro del notebook:\n\n```bash\npip install numpy==2.2.6 pandas==2.2.3 matplotlib==3.11.2\n```\n\nEl notebook solo informa las versiones instaladas y nunca modifica los registros de origen.")
    root_comment = "# Load the committed paired records without changing them."
    if es:
        root_comment = "# Carga los registros pareados comprometidos sin modificarlos."
    version_code = """# Record the exact analysis-library versions used by this lesson.
import importlib.metadata
for package in ('numpy', 'pandas', 'matplotlib'):
    print(package, importlib.metadata.version(package))"""
    imports = """# Import the analysis tools and the production circuit engine.
import json
from pathlib import Path
import sys
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

repo = Path('../../../').resolve()
sys.path.insert(0, str(repo / 'data-pipeline'))
from pipeline.cases.catalog import CASES
from pipeline.engine.circuit import simulate

case_by_id = {case.id: case for case in CASES}
print('scenario count:', len(case_by_id))
print('engine method:', simulate.__module__ + '.' + simulate.__name__)"""
    if es:
        imports = imports.replace("# Import the analysis tools and the production circuit engine.", "# Importa las herramientas de análisis y el motor de circuito de producción.")
        version_code = version_code.replace("# Record the exact analysis-library versions used by this lesson.", "# Registra las versiones exactas de las bibliotecas de análisis usadas en esta lección.")
    load = f"""{root_comment}
records = []
for path in sorted((repo / 'data/derived/cases').glob('*.json')):
    artifact = json.loads(path.read_text(encoding='utf-8'))
    for variant in artifact['variants']:
        result = variant['methods']['optimization']
        if not result.get('screened') or 'without_screen' not in result:
            continue
        plain = result['without_screen']
        optimum = result.get('optimum') or {{}}
        records.append({{
            'case_id': artifact['case_id'],
            'variant_id': variant['id'],
            'screened_evaluations': result['evaluations'],
            'plain_evaluations': plain['evaluations'],
            'metal_screened_tph': optimum.get('recovered_tph', np.nan),
            'metal_plain_tph': plain.get('recovered_tph', np.nan),
        }})
paired = pd.DataFrame(records)
paired['difference'] = paired.screened_evaluations - paired.plain_evaluations
paired['relative_cost_pct'] = 100 * paired.difference / paired.plain_evaluations
print('paired variants:', len(paired))
display(paired.head())"""
    plot1 = f"""# Plot the paired exact-engine counts for every screened variant.
fig, ax = plt.subplots(figsize=(7.4, 5.2))
ax.scatter(paired.plain_evaluations, paired.screened_evaluations, alpha=0.78, s=42)
limit = max(paired.plain_evaluations.max(), paired.screened_evaluations.max()) * 1.04
ax.plot([0, limit], [0, limit], color='black', linestyle='--', label={t['labels'][2]!r})
ax.set(xlabel={t['labels'][1] + ' (count)'!r}, ylabel={t['labels'][0] + ' (count)'!r})
ax.set_title({('Evaluaciones exactas por variante' if es else 'Exact-engine evaluations per variant')!r})
ax.legend()
ax.grid(alpha=0.2)
fig.tight_layout()"""
    plot2 = f"""# Summarize the paired evaluation difference within each authored case.
by_case = paired.groupby('case_id', as_index=False).agg(
    mean_relative_cost_pct=('relative_cost_pct', 'mean'),
    variants=('variant_id', 'count'))
by_case = by_case.sort_values('mean_relative_cost_pct')
fig, ax = plt.subplots(figsize=(8.2, 5.4))
colors = np.where(by_case.mean_relative_cost_pct > 0, '#b45f06', '#2878a0')
ax.barh(by_case.case_id.str.replace('_', ' '), by_case.mean_relative_cost_pct, color=colors)
ax.axvline(0, color='black', linewidth=1)
ax.set(xlabel={t['labels'][3]!r}, ylabel={t['labels'][4]!r})
ax.set_title({('Costo medio pareado por caso' if es else 'Mean paired cost by case')!r})
ax.grid(axis='x', alpha=0.2)
fig.tight_layout()"""
    total = "screen_total = int(paired.screened_evaluations.sum())\nplain_total = int(paired.plain_evaluations.sum())\ndelta_total = screen_total - plain_total\nrelative_total = 100 * delta_total / plain_total\nprint('screened total:', screen_total)\nprint('unscreened total:', plain_total)\nprint('additional evaluations:', delta_total)\nprint('relative increase (%):', round(relative_total, 1))\nprint('variants with fewer evaluations:', int((paired.difference < 0).sum()))\nprint('variants with more evaluations:', int((paired.difference > 0).sum()))\nprint('unchanged variants:', int((paired.difference == 0).sum()))"
    if es:
        total = total.replace("screened total:", "total con filtro:").replace("unscreened total:", "total sin filtro:").replace("additional evaluations:", "evaluaciones adicionales:").replace("relative increase (%):", "aumento relativo (%):").replace("variants with fewer evaluations:", "variantes con menos evaluaciones:").replace("variants with more evaluations:", "variantes con más evaluaciones:").replace("unchanged variants:", "variantes sin cambio:")
    cells = [
        md(opening), md(f"## {h[0]}\n\n{t['objective']}"), md(f"## {h[1]}\n\n{setup}"),
        md(f"## {h[2]}\n\n{t['data']}"), md(f"## {h[3]}\n\n{t['method']}"),
        md(f"## {h[4]}\n\n{t['comparison']}"), md("Record the pinned library versions before importing the analysis and process methods." if not es else "Registra las versiones fijadas antes de importar los métodos de análisis y de proceso."), code(version_code),
        md("Import the analysis tools and bind to OreFlow's production circuit method." if not es else "Importa las herramientas de análisis y vincúlate al método de circuito de producción de OreFlow."), code(imports),
        md("Read the paired scenario records and calculate one row per screened variant; the raw files remain unchanged." if not es else "Lee los registros pareados y calcula una fila por variante con filtro; los archivos originales permanecen intactos."), code(load),
        md("Re-evaluate a saved optimum with the engine. The small residual checks reproducibility; it is not plant validation." if not es else "Reevalúa un óptimo guardado con el motor. El residuo pequeño comprueba reproducibilidad; no valida frente a una planta."),
    ]
    for case_id in t["checks"]:
        cells.append(md((f"Reconstruct the reported {case_id.replace('_', ' ')} optimum from its decisions and check the engine output against the stored record." if not es else f"Reconstruye el óptimo reportado de {case_id.replace('_', ' ')} desde sus decisiones y compara el resultado del motor con el registro guardado.")))
        cells.append(code(f"""# Re-run this saved decision vector through the production circuit engine.
case_id = {case_id!r}
artifact = json.loads((repo / f'data/derived/cases/{{case_id}}.json').read_text(encoding='utf-8'))
variant = next(v for v in artifact['variants'] if v['methods']['optimization'].get('optimum'))
case = case_by_id[case_id]
optimum = variant['methods']['optimization']['optimum']
operating_point = case.nominal.with_values(**optimum['decisions'])
trace = simulate(case.ore, case.plant, operating_point)
recorded = optimum['recovered_tph']
recomputed = trace.metrics['recovered_primary_tph']
print(case_id, variant['id'], 'recorded:', round(recorded, 6),
      'engine:', round(recomputed, 6), 'balance:', trace.metrics['balance_max_relative_error'])"""))
    cells.extend([
        md(f"## {h[5]}\n\n{t['evidence']}"), code(plot1),
        md(("Points above the dashed identity line require more exact circuit evaluations with screening. A point below it is a saving for that one paired variant. Read the distribution together with the total: equal weighting of variants is transparent here, but the cases are authored and not sampled from operating plants. The plot describes this committed algorithm run only." if not es else "Los puntos sobre la línea de identidad discontinua requieren más evaluaciones exactas del circuito con el filtro. Un punto bajo la línea ahorra evaluaciones en esa variante pareada. Lee la distribución junto con el total: ponderar por igual las variantes es transparente, pero los casos fueron construidos y no muestreados de plantas en operación. El gráfico describe solo esta corrida comprometida del algoritmo.")),
        md("Aggregate the paired changes by ore scenario to expose variation hidden by the total." if not es else "Resume los cambios pareados por escenario de mineral para mostrar la variación que oculta el total."), code(plot2),
        md(("A positive bar means that the screen increased the mean exact-engine count across the case's controlled variants; a negative bar would mean fewer calls. Bars are descriptive summaries, not independent estimates. Variants within one case share ore, plant definition and most operating settings. This view therefore helps find case-specific cost patterns without making a claim about frequencies in industry." if not es else "Una barra positiva indica que el filtro aumentó el conteo medio de llamadas al motor exacto entre las variantes controladas del caso; una barra negativa indicaría menos llamadas. Las barras son resúmenes descriptivos, no estimaciones independientes. Las variantes de un caso comparten mineral, definición de planta y la mayoría de los parámetros operativos. Esta vista ayuda a detectar patrones de costo por caso sin afirmar frecuencias industriales.")),
        md("Compute the paired totals and count how many variants save or add engine calls." if not es else "Calcula los totales pareados y cuenta cuántas variantes ahorran o añaden llamadas al motor."), code("# Sum the paired counts and report the direction of every variant.\n" + total),
        md(f"## {h[6]}\n\n{t['results']}"), md(f"## {h[7]}\n\n{t['summary']}"),
        md(f"## {h[8]}\n\n" + "\n".join(f"- {ref}" for ref in t["refs"])),
    ])
    for i, cell in enumerate(cells, 1):
        cell["id"] = f"screen-study-{i:02d}"
    return {"cells": cells, "metadata": {
        "kernelspec": {"display_name": "Python 3", "language": "python", "name": "python3"},
        "language_info": {"name": "python"},
        "caos": {"language": lang, "topic": "04-optimization", "level": 4,
                 "title": t["title"], "packages": ["numpy==2.2.6", "pandas==2.2.3", "matplotlib==3.11.2"],
                 "data": [f"data/derived/cases/{case_id}.json" for case_id in t["checks"]] + ["data/derived/contract/operating_contract.json"],
                 "sources": ["https://doi.org/10.1137/S1052623493250780", "https://doi.org/10.1137/040603371", "https://doi.org/10.1137/070692662", "https://doi.org/10.1007/BF01197708"],
                 "methods": [], "beyond": ["BS-1"]}}, "nbformat": 4, "nbformat_minor": 5}


def main() -> None:
    for lang in TEXT:
        path = ROOT / "notebooks" / lang / "04-optimization" / "04-screening-evidence.ipynb"
        path.write_text(json.dumps(doc(lang), ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print("build_optimizer_evidence_notebooks: wrote the English and Spanish level-4 assessment")


if __name__ == "__main__":
    main()
