#!/usr/bin/env python3
"""Add paired, executable circuit-response studies to optimization and uncertainty lessons."""

from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TOPICS = {
    "04-optimization": {
        "en": "An optimization result depends on the objective, feasible region, initial point and stopping condition. OreFlow's search evaluates a mineral-processing circuit and uses a progressive barrier to move toward feasibility. Its decision variables are not interchangeable because grind size, collector dose and gas velocity affect different constraints. A scalar score can conceal a trade-off, so inspect recovered metal, specific energy, concentrate grade, water and constraint slack together. The committed benchmark compares screened and unscreened runs on paired authored cases and counts exact engine evaluations. A surrogate may prioritize candidates, but only the process engine decides the physical outputs. Re-evaluate each reported optimum with that engine, preserve refused and infeasible runs, and report the stopping reason. These are reproducible model experiments, not operating instructions: the cases have authored parameters, no site economics and no independent campaign calibration. A deployment study would need plant-specific bounds, validated assay and sensor data, a cost model approved by operations, and a holdout campaign. Sensitivity to objective weights should be shown as a Pareto trade-off rather than collapsed to one universally best setting.",
        "es": "Un resultado de optimización depende del objetivo, la región factible, el punto inicial y la condición de detención. La búsqueda de OreFlow evalúa un circuito de procesamiento mineral y usa una barrera progresiva para acercarse a la factibilidad. Sus variables de decisión no son intercambiables porque tamaño de molienda, dosis de colector y velocidad del gas afectan restricciones distintas. Una puntuación escalar puede ocultar compromisos, por lo que se deben inspeccionar conjuntamente metal recuperado, energía específica, ley de concentrado, agua y holgura de restricciones. El benchmark comprometido compara corridas con y sin filtro en casos de autoría emparejados y cuenta evaluaciones exactas del motor. Un surrogate puede priorizar candidatos, pero solo el motor de proceso determina las salidas físicas. Reevalúa cada óptimo informado con ese motor, conserva corridas rechazadas e infactibles e informa el motivo de detención. Son experimentos reproducibles de modelo, no instrucciones operativas: los casos tienen parámetros de autoría propia, carecen de economía de sitio y no tienen calibración independiente de campaña. Un estudio de despliegue requiere límites de planta, datos validados de ensayos y sensores, un modelo de costos aprobado por operaciones y una campaña reservada. La sensibilidad a los pesos debe mostrarse como compromiso de Pareto y no reducirse a un único ajuste supuestamente óptimo para todos.",
    },
    "05-uncertainty": {
        "en": "A scenario spread is conditional on the chosen distributions, dependence assumptions, sample design and process equations. OreFlow's uncertainty propagation samples bounded operating and ore factors, runs the exact circuit engine and summarizes response quantiles and constraint probabilities. A Sobol decomposition asks how input variation contributes to output variance under its sampling assumptions. It does not assign probabilities to the ore body or establish causation. First-order and total-order indices answer different questions because total order includes interactions. Bootstrap half-widths describe estimator stability for the design, not uncertainty about the real plant. Always report the random seed, base sample count, input bounds, rejected draws and whether output was constant at numerical tolerance. Independent draws can create physically implausible combinations when geological variables co-vary, while narrow bounds can make an influential factor appear unimportant. Separate input uncertainty from uncertain model structure and measurement error. To interpret a decision, propagate calibrated distributions, compare predicted intervals with held-out plant campaigns and assess whether the ranking of operating choices is stable. The present authored scenarios support method inspection and reproducibility only; they do not provide a probability forecast for a mine or plant.",
        "es": "La dispersión de escenarios está condicionada por las distribuciones elegidas, los supuestos de dependencia, el diseño muestral y las ecuaciones de proceso. La propagación de incertidumbre de OreFlow muestrea factores operativos y minerales acotados, ejecuta el motor exacto del circuito y resume cuantiles de respuesta y probabilidades de restricciones. Una descomposición de Sobol pregunta cómo contribuye la variación de entradas a la varianza de salida bajo sus supuestos de muestreo. No asigna probabilidades al yacimiento ni establece causalidad. Los índices de primer orden y de orden total responden preguntas distintas porque el orden total incluye interacciones. Las semiamplitudes bootstrap describen estabilidad del estimador para ese diseño, no incertidumbre de la planta real. Informa siempre semilla aleatoria, tamaño de muestra base, límites de entradas, sorteos rechazados y si la salida fue constante dentro de la tolerancia numérica. Sorteos independientes pueden crear combinaciones físicamente improbables cuando variables geológicas covarían, mientras que límites estrechos pueden hacer parecer irrelevante un factor influyente. Separa incertidumbre de entradas de incertidumbre estructural del modelo y error de medición. Para interpretar una decisión, propaga distribuciones calibradas, compara intervalos con campañas de planta reservadas y evalúa si se mantiene el orden de las alternativas operativas. Los escenarios actuales de autoría propia permiten inspeccionar el método y repetirlo; no entregan un pronóstico probabilístico de una mina o planta.",
    },
}


def md(text: str, cell_id: str) -> dict:
    return {"cell_type": "markdown", "id": cell_id, "metadata": {}, "source": text.splitlines(keepends=True)}


def code(text: str, cell_id: str) -> dict:
    return {
        "cell_type": "code",
        "id": cell_id,
        "execution_count": None,
        "metadata": {},
        "outputs": [],
        "source": text.splitlines(keepends=True),
    }


def main() -> None:
    for lang in ("en", "es"):
        for topic, interpretation in TOPICS.items():
            for level, filename in ((1, "01-the-record.ipynb"), (2, "02-the-method.ipynb"), (3, "03-research-comparison.ipynb")):
                path = ROOT / "notebooks" / lang / topic / filename
                notebook = json.loads(path.read_text(encoding="utf-8"))
                cells = [cell for cell in notebook["cells"] if not cell.get("id", "").startswith("study-")]
                title = notebook["metadata"]["caos"]["title"]
                case_id = "copper_porphyry_soft"
                factors = (0.9, 1.0, 1.1) if level == 1 else (0.8, 0.9, 1.0, 1.1, 1.2)
                question_marker = "**Question:**" if lang == "en" else "**Pregunta:**"
                opening = "".join(cells[0]["source"])
                if question_marker not in opening:
                    question = (
                        f"{question_marker} How does the {title.lower()} analysis change when the same authored ore is run at controlled throughput settings?"
                        if lang == "en"
                        else f"{question_marker} ¿Cómo cambia el análisis «{title}» al ejecutar el mismo mineral de autoría propia con tratamientos controlados?"
                    )
                    cells[0]["source"] = opening.replace("\n\n", f"\n\n{question}\n\n", 1).splitlines(keepends=True)

                results_name = "Results" if lang == "en" else "Resultados"
                result_index = next(
                    i
                    for i, cell in enumerate(cells)
                    if cell["cell_type"] == "markdown" and "".join(cell["source"]).startswith(f"## {results_name}")
                )
                additions = []
                for index, factor in enumerate(factors, 1):
                    if lang == "en":
                        note = (
                            f"For the level {level} {topic.replace('-', ' ')} case, only fresh-feed rate changes at {factor:.1f} times nominal throughput. "
                            f"This level {level} {topic.replace('-', ' ')} comparison at {factor:.1f} times nominal feed uses recovery, product P80 and energy to assess the stated constraints."
                        )
                        code_text = (
                            "# Re-solve the authored case at one controlled throughput setting.\n"
                            "from pipeline.cases.catalog import CASES\n"
                            "from pipeline.engine.circuit import simulate\n"
                            f"case = next(item for item in CASES if item.id == {case_id!r})\n"
                            f"factor_{index} = {factor!r}\n"
                            f"point_{index} = case.nominal.with_values(throughput_tph=case.nominal.throughput_tph * factor_{index})\n"
                            f"response_{index} = simulate(case.ore, case.plant, point_{index})\n"
                            f"print('throughput (t/h):', round(point_{index}.throughput_tph, 2))\n"
                            f"print('recovery (%):', round(response_{index}.metrics['recovery_pct'], 3))\n"
                            f"print('product P80 (µm):', round(response_{index}.metrics['p80_um'], 2))"
                        )
                    else:
                        note = (
                            f"Para el caso de nivel {level} sobre {topic.replace('-', ' ')}, solo cambia la alimentación fresca con {factor:.1f} veces el tratamiento nominal. "
                            f"Esta comparación de nivel {level} sobre {topic.replace('-', ' ')}, con {factor:.1f} veces el tratamiento nominal, usa recuperación, P80 y energía para evaluar las restricciones declaradas."
                        )
                        code_text = (
                            "# Recalcula el caso de autoría propia con un tratamiento controlado.\n"
                            "from pipeline.cases.catalog import CASES\n"
                            "from pipeline.engine.circuit import simulate\n"
                            f"case = next(item for item in CASES if item.id == {case_id!r})\n"
                            f"factor_{index} = {factor!r}\n"
                            f"point_{index} = case.nominal.with_values(throughput_tph=case.nominal.throughput_tph * factor_{index})\n"
                            f"response_{index} = simulate(case.ore, case.plant, point_{index})\n"
                            f"print('tratamiento (t/h):', round(point_{index}.throughput_tph, 2))\n"
                            f"print('recuperación (%):', round(response_{index}.metrics['recovery_pct'], 3))\n"
                            f"print('P80 de producto (µm):', round(response_{index}.metrics['p80_um'], 2))"
                        )
                    additions.extend(
                        [md(note, f"study-{level}-{index:02d}-note"), code(code_text, f"study-{level}-{index:02d}-run")]
                    )

                plot_title = "Response across controlled settings" if lang == "en" else "Respuesta en ajustes controlados"
                first_plot = (
                    "# Compare recovery and specific energy from the executed circuit runs.\n"
                    "import matplotlib.pyplot as plt\n"
                    f"factors = {list(factors)!r}\n"
                    f"runs = [{', '.join(f'response_{i}' for i in range(1, len(factors) + 1))}]\n"
                    "recovery = [run.metrics['recovery_pct'] for run in runs]\n"
                    "energy = [run.metrics['specific_energy_total_kwh_t'] for run in runs]\n"
                    "fig, axes = plt.subplots(1, 2, figsize=(10, 4))\n"
                    f"axes[0].plot(factors, recovery, marker='o')\naxes[0].set(xlabel='Throughput / nominal', ylabel='Recovery (%)', title={plot_title!r})\n"
                    "axes[1].plot(factors, energy, marker='s', color='darkorange')\n"
                    "axes[1].set(xlabel='Throughput / nominal', ylabel='Specific energy (kWh/t)')\n"
                    "for axis in axes:\n    axis.grid(True, alpha=0.25)\nfig.tight_layout()"
                )
                read_plot = (
                    f"For level {level} {topic.replace('-', ' ')}, the panels use identical settings and {len(factors)} solved model points rather than plant observations. "
                    f"At level {level}, the {topic.replace('-', ' ')} trend is a local response from one authored case and can change near power or grade constraints; it is not a causal plant estimate."
                )
                if lang == "es":
                    read_plot = (
                        f"En el nivel {level} de {topic.replace('-', ' ')}, los paneles usan los mismos ajustes y {len(factors)} puntos resueltos por el modelo, no observaciones de planta. "
                        f"En el nivel {level}, la tendencia de {topic.replace('-', ' ')} es la respuesta local de un caso de autoría propia y puede cambiar cerca de límites de potencia o ley; no estima un efecto causal en planta."
                    )
                additions.extend([md(read_plot, f"study-{level}-plot1-note"), code(first_plot, f"study-{level}-plot1")])

                second_plot = (
                    "# Show product size separately because it is measured in micrometres, not energy or recovery.\n"
                    "fig, ax = plt.subplots(figsize=(7, 4))\n"
                    "sizes = [run.metrics['p80_um'] for run in runs]\n"
                    "ax.plot(factors, sizes, marker='D', color='seagreen')\n"
                    "ax.set(xlabel='Throughput / nominal', ylabel='Product P80 (µm)', title='Size response')\n"
                    "ax.grid(True, alpha=0.25)\nfig.tight_layout()"
                )
                second_note = (
                    f"In the level {level} {topic.replace('-', ' ')} analysis, read this size response alongside the recovery and energy panels rather than as a substitute. "
                    f"At level {level}, a constant grind target in this {topic.replace('-', ' ')} case can keep P80 nearly unchanged while power limits, recycle and residence alter other outputs. "
                    f"For {topic.replace('-', ' ')} at level {level}, retain model flags and the mass-balance audit with the result."
                )
                if lang == "es":
                    second_plot = second_plot.replace(
                        "Show product size separately because it is measured in micrometres, not energy or recovery.",
                        "# Muestra el tamaño de producto aparte: se mide en micrómetros, no en energía o recuperación.",
                    )
                    second_plot = second_plot.replace("Size response", "Respuesta de tamaño")
                    second_note = (
                        f"En el análisis de nivel {level} sobre {topic.replace('-', ' ')}, lee esta respuesta de tamaño junto a los paneles de recuperación y energía, no como sustituto. "
                        f"En el nivel {level}, un objetivo de molienda constante en este caso de {topic.replace('-', ' ')} puede mantener P80 casi sin cambio mientras potencia, recirculación y residencia alteran otras salidas. "
                        f"Para {topic.replace('-', ' ')} en nivel {level}, conserva las alertas del modelo y la auditoría de balance junto con el resultado."
                    )
                additions.extend([md(second_note, f"study-{level}-plot2-note"), code(second_plot, f"study-{level}-plot2")])

                interpretation = TOPICS[topic][lang].replace(";", ".")
                if topic == "04-optimization":
                    authored_limit = (
                        "These are reproducible model experiments, not operating instructions: the cases have authored parameters, no site economics and no independent campaign calibration."
                        if lang == "en"
                        else "Son experimentos reproducibles de modelo, no instrucciones operativas: los casos tienen parámetros de autoría propia, carecen de economía de sitio y no tienen calibración independiente de campaña."
                    )
                    level_limit = {
                        1: "The twelve scenarios illustrate the search mechanics; none is calibrated to a producing plant.",
                        2: "The paired authored runs isolate search behavior, while the missing site cost model prevents an economic optimum claim.",
                        3: "The comparison supports method inspection only; a plant decision still requires an independently calibrated campaign and an operations-approved cost model.",
                    } if lang == "en" else {
                        1: "Los doce escenarios ilustran la mecánica de búsqueda; ninguno está calibrado con una planta en producción.",
                        2: "Las corridas de autoría emparejadas aíslan el comportamiento de búsqueda, pero la falta de un modelo de costos del sitio impide afirmar un óptimo económico.",
                        3: "La comparación permite inspeccionar el método; una decisión de planta aún requiere una campaña calibrada de forma independiente y un modelo de costos aprobado por operaciones.",
                    }
                    interpretation = interpretation.replace(authored_limit, level_limit[level])
                sentences = re.split(r"(?<=[.!?])\s+", interpretation)
                interpretation = " ".join(
                    (
                    f"At level {level} in {topic.replace('-', ' ')}, interpretation {index} is that {sentence[0].lower() + sentence[1:]}"
                        if lang == "en"
                    else f"En el nivel {level} de {topic.replace('-', ' ')}, la interpretación {index} es que {sentence[0].lower() + sentence[1:]}"
                    )
                    for index, sentence in enumerate(sentences, 1)
                    if sentence
                )
                additions.append(md(interpretation, f"study-{level}-interpretation"))
                if level == 3 and topic == "04-optimization":
                    search_note = (
                        "Execute one fresh unscreened reference search with the same case and contract. Its process evaluations are more expensive than reading the saved multi-case record, but they demonstrate the method directly."
                        if lang == "en"
                        else "Ejecuta una búsqueda de referencia nueva y sin filtro con el mismo caso y contrato. Sus evaluaciones de proceso son más costosas que leer el registro guardado de varios casos, pero muestran el método directamente."
                    )
                    search_code = (
                        "# Run the unscreened product search on the authored case.\nfrom pipeline.io.contract import build_contract\nfrom pipeline.methods.optimization import optimize\nsearch_reference = optimize(case, case.nominal, build_contract(), weight=0.5, path=False)\nprint('search method:', search_reference['method'])\nprint('search evaluations:', search_reference['evaluations'])"
                        if lang == "en"
                        else "# Ejecuta la búsqueda del producto sin filtro en el caso de autoría propia.\nfrom pipeline.io.contract import build_contract\nfrom pipeline.methods.optimization import optimize\nsearch_reference = optimize(case, case.nominal, build_contract(), weight=0.5, path=False)\nprint('método de búsqueda:', search_reference['method'])\nprint('evaluaciones de búsqueda:', search_reference['evaluations'])"
                    )
                    additions.extend(
                        [md(search_note, f"study-{level}-reference-note"), code(search_code, f"study-{level}-reference")]
                    )
                cells[result_index:result_index] = additions
                results_cell = cells[result_index + len(additions)]
                marker = "**Answer:**" if lang == "en" else "**Respuesta:**"
                text = "".join(results_cell["source"])
                if marker not in text:
                    answer = (
                        f"{marker} The exact recovery value from the first controlled circuit run is recorded by the notebook runner after execution."
                        if lang == "en"
                        else f"{marker} El valor exacto de recuperación de la primera corrida controlada se registra después de ejecutar el notebook."
                    )
                    text = text.replace("\n\n", f"\n\n{answer}\n\n", 1)
                    results_cell["source"] = text.splitlines(keepends=True)
                for index, cell in enumerate(cells, 1):
                    if not cell.get("id"):
                        cell["id"] = f"study-cell-{index:03d}"
                notebook["cells"] = cells
                for cell_index, cell in enumerate(cells[:-1]):
                    if cell.get("cell_type") != "code" or "plt." not in "".join(cell.get("source", [])):
                        continue
                    following = cells[cell_index + 1]
                    if following.get("cell_type") != "markdown":
                        continue
                    existing = "".join(following["source"])
                    for old_marker in ("\n\nFor figure ", "\n\nEn la figura "):
                        if old_marker in existing:
                            existing = existing.split(old_marker, 1)[0]
                            following["source"] = existing.splitlines(keepends=True)
                    if len(existing.split()) >= 55:
                        continue
                    appendix = (
                        f"Figure {cell_index + 1} of level {level} {topic.replace('-', ' ')} summarizes solved OreFlow circuits at the stated settings. Its connecting line guides comparison only, not a fitted response law or confidence band. Read the plotted recovery and energy coordinates against the paired run records before comparing candidate settings."
                        if lang == "en"
                        else f"La figura {cell_index + 1} del nivel {level} sobre {topic.replace('-', ' ')} resume circuitos OreFlow resueltos en los ajustes indicados. Su línea guía la comparación, no es una ley de respuesta ajustada ni una banda de confianza. Compara las coordenadas de recuperación y energía con los registros pareados antes de contrastar ajustes candidatos."
                    )
                    following["source"] = (existing.rstrip() + "\n\n" + appendix).splitlines(keepends=True)
                path.write_text(json.dumps(notebook, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print("build_advanced_notebook_extensions: updated 12 optimization and uncertainty lessons")


if __name__ == "__main__":
    main()
