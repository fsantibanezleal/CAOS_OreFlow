"""Keep the didactic instructions aligned with the English and Spanish trees."""
from __future__ import annotations

import importlib.util
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("oreflow_notebook_authoring", ROOT / "scripts/build_didactic_notebooks.py")
assert SPEC and SPEC.loader
AUTHORING = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(AUTHORING)


def test_each_notebook_step_uses_its_tree_language() -> None:
    for path in sorted((ROOT / "notebooks").glob("*/*/*.ipynb")):
        notebook = json.loads(path.read_text(encoding="utf-8"))
        language = notebook["metadata"]["caos"]["language"]
        for index, cell in enumerate(notebook["cells"]):
            if cell["cell_type"] != "code":
                continue
            assert index and notebook["cells"][index - 1]["cell_type"] == "markdown", path
            program = "".join(cell["source"])
            comments = [line.lstrip() for line in program.splitlines() if line.lstrip().startswith("#")]
            assert comments, path
            if language == "es":
                assert not any(comment.startswith(("# Run ", "# Plot ", "# Compare ", "# Import ", "# Re-solve ",
                                                   "# Evaluate ", "# Separate ", "# Collect ", "# Resume "))
                               for comment in comments), path
                assert "Paso ejecutable del método OreFlow explicado" not in program, path


def test_spanish_display_literals_are_localized() -> None:
    import ast
    import sys
    sys.path.insert(0, str(ROOT / "scripts"))
    from build_advanced_notebook_extensions import LABELS_ES
    for path in (ROOT / "notebooks/es").glob("*/*.ipynb"):
        notebook = json.loads(path.read_text(encoding="utf-8"))
        for cell in notebook["cells"]:
            if cell["cell_type"] != "code":
                continue
            values = {node.value for node in ast.walk(ast.parse("".join(cell["source"])))
                      if isinstance(node, ast.Constant) and isinstance(node.value, str)}
            untranslated = {value for value in values if value in LABELS_ES and LABELS_ES[value] != value}
            assert not untranslated, f"{path}: untranslated display labels: {sorted(untranslated)}"


def test_spanish_computed_plot_labels_do_not_expose_raw_api_ids() -> None:
    import ast
    for path in (ROOT / "notebooks/es").glob("*/*.ipynb"):
        notebook = json.loads(path.read_text(encoding="utf-8"))
        for cell in notebook["cells"]:
            if cell["cell_type"] != "code":
                continue
            for node in ast.walk(ast.parse("".join(cell["source"]))):
                if isinstance(node, ast.keyword) and node.arg == "label":
                    label = ast.unparse(node.value)
                    assert label not in ("stream.replace('_', ' ')", "model['id']", "m['id']"), path
                if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute):
                    if node.func.attr == "set_xticks" and len(node.args) > 1:
                        assert not (isinstance(node.args[1], ast.Name) and node.args[1].id == "names"), path


def test_formal_register_and_numeric_summary_explanations_match_actual_scope():
    import re
    for path in (ROOT / "notebooks").glob("*/*/*.ipynb"):
        book = json.loads(path.read_text(encoding="utf-8"))
        for index, cell in enumerate(book["cells"]):
            source = "".join(cell["source"])
            if source.startswith(("## References", "## Referencias")):
                continue
            if cell["cell_type"] == "markdown":
                if book["metadata"]["caos"]["language"] == "en":
                    assert not re.search(r"\b(?:you|your|we|our)\b", source, re.I), path
                else:
                    assert not re.search(r"(?m)^(?:#\s*)?(?:Compara|Inspecciona|Crea|Activa|Mide|Acorta)\b", source), path
            if "answer-values" in cell.get("metadata", {}).get("tags", []):
                prior = "".join(book["cells"][index - 1]["source"])
                assert not any(text in prior.lower() for text in ("import the pinned", "repository inputs", "resolver las entradas")), path


def test_learning_source_claims_match_the_four_case_point_prediction_experiment():
    for language in ("en", "es"):
        path = ROOT / "notebooks" / language / "03-learning/03-research-comparison.ipynb"
        book = json.loads(path.read_text(encoding="utf-8"))
        prose = "\n".join("".join(c["source"]) for c in book["cells"] if c["cell_type"] == "markdown"
                          and not "".join(c["source"]).startswith(("## References", "## Referencias")))
        assert not any(word in prose for word in ("Adam", "permutation importance", "twelve circuits", "doce circuitos")), path
        assert ("Part 1" if language == "en" else "Parte 1") in prose
        assert ("Part 2" if language == "en" else "Parte 2") in prose


def test_optimizer_comparison_points_to_the_identified_current_cohort():
    for language in ("en", "es"):
        path = ROOT / "notebooks" / language / "04-optimization/03-research-comparison.ipynb"
        book = json.loads(path.read_text(encoding="utf-8"))
        prose = "\n".join("".join(c["source"]) for c in book["cells"] if c["cell_type"] == "markdown")
        assert not any(text in prose for text in ("archived 72-pair", "archivo más amplio de 72 parejas")), path
        expected = "current committed cohort" if language == "en" else "cohorte comprometida actual"
        assert expected in prose, path


def test_spanish_instructions_and_summaries_keep_the_impersonal_register():
    import re
    for path in (ROOT / "notebooks/es").glob("*/*.ipynb"):
        book = json.loads(path.read_text(encoding="utf-8"))
        for cell in book["cells"]:
            text = "".join(cell["source"])
            if text.startswith("## Referencias"):
                continue
            if cell["cell_type"] == "code":
                text = "\n".join(line.lstrip("# ") for line in text.splitlines()
                                 if line.lstrip().startswith("#"))
            assert not re.search(r"\b(?:Ejecutaste|Seguiste|seguiste|leíste|revisaste|separaste)\b", text), path
            assert not re.search(r"(?m)^(?:#\s*)?(?:Busca|Proyecta|Reproduce|Etiqueta|Imprime|Resume)\b", text), path
            assert not re.search(r"\b(?:y proyecta|y extrae|y reconoce|, inspecciona|, sigue el|así que conserva)\b", text), path


def test_internal_tiers_are_absent_from_prose_code_and_outputs() -> None:
    import re
    for path in (ROOT / "notebooks").glob("*/*/*.ipynb"):
        notebook = json.loads(path.read_text(encoding="utf-8"))
        for cell in notebook["cells"]:
            source = "".join(cell["source"])
            if source.startswith(("## References", "## Referencias")):
                continue
            public = source + json.dumps(cell.get("outputs", []), ensure_ascii=False)
            assert not re.search(r"classical|clásic[oa]s?|estado.del.arte|state.of.the.art|\bSOTA\b", public, re.I), path


def test_every_curriculum_pair_has_distinct_language_facing_steps() -> None:
    english_root = ROOT / "notebooks/en"
    for path in sorted(english_root.glob("*/*.ipynb")):
        counterpart = ROOT / "notebooks/es" / path.relative_to(english_root)
        en = json.loads(path.read_text(encoding="utf-8"))
        es = json.loads(counterpart.read_text(encoding="utf-8"))
        assert en["metadata"]["caos"]["language"] == "en"
        assert es["metadata"]["caos"]["language"] == "es"

        def explanations(notebook: dict) -> list[str]:
            cells = notebook["cells"]
            code_indices = [i for i, cell in enumerate(cells) if cell["cell_type"] == "code"]
            return ["".join(cells[i - 1]["source"]).strip() for i in code_indices[1:]]

        en_steps, es_steps = explanations(en), explanations(es)
        assert en_steps != es_steps, f"{path}: English and Spanish step prose is identical"
        assert not any(text.startswith(("Carga ", "Ejecuta ", "Inspecciona ", "Compara ")) for text in en_steps), path
        assert not any(text.startswith(("Load ", "Run ", "Inspect ", "Compare ")) for text in es_steps), counterpart


def test_internal_method_tiers_never_appear_as_notebook_headings() -> None:
    forbidden = (
        "state of the art",
        "beyond the state of the art",
        "estado del arte",
        "más allá del estado del arte",
    )
    for path in sorted((ROOT / "notebooks").glob("*/*/*.ipynb")):
        notebook = json.loads(path.read_text(encoding="utf-8"))
        headings = [
            "".join(cell["source"]) if isinstance(cell["source"], list) else cell["source"]
            for cell in notebook["cells"]
            if cell["cell_type"] == "markdown"
        ]
        level = int(notebook["metadata"]["caos"]["level"])
        language = notebook["metadata"]["caos"]["language"]
        heading_lines = [
            line.strip().removeprefix("## ")
            for heading in headings
            for line in heading.splitlines()
            if line.startswith("## ")
        ]
        comparison = "Comparison" if language == "en" else "Comparación"
        evidence = "Evidence" if language == "en" else "Evidencia"
        if level >= 3:
            assert comparison in heading_lines, path
        if level >= 4:
            assert evidence in heading_lines, path
        for heading in headings:
            first_lines = [line.strip().lower() for line in heading.splitlines() if line.lstrip().startswith("#")]
            assert not any(term in line for line in first_lines for term in forbidden), path


def test_research_comparison_generator_uses_the_required_heading() -> None:
    topic = "01-comminution"
    for language in ("en", "es"):
        lesson = dict(AUTHORING.LESSONS[topic][language][2])
        lesson["data_files"] = AUTHORING.LESSONS[topic]["files"]
        notebook = AUTHORING.lesson_doc(language, topic, 3, lesson)
        headings = [
            line
            for cell in notebook["cells"]
            if cell["cell_type"] == "markdown"
            for line in ("".join(cell["source"]) if isinstance(cell["source"], list) else cell["source"]).splitlines()
            if line.startswith("## ")
        ]
        expected = "## Comparison" if language == "en" else "## Comparación"
        assert expected in headings


def test_notebook_indexes_use_reader_facing_level_names() -> None:
    expected = {
        "en": ("comparison with published methods", "proposed methods"),
        "es": ("comparación con métodos publicados", "métodos propuestos"),
    }
    for language, labels in expected.items():
        tree = ROOT / "notebooks" / language
        index = (tree / "README.md").read_text(encoding="utf-8").lower()
        level_three = False
        level_four = False
        for path in tree.glob("*/*.ipynb"):
            notebook = json.loads(path.read_text(encoding="utf-8"))
            level = int(notebook["metadata"]["caos"]["level"])
            level_three |= level == 3
            level_four |= level == 4
        if level_three:
            assert labels[0] in index
        if level_four:
            assert labels[1] in index
