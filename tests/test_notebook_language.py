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
    for topic, spec in AUTHORING.LESSONS.items():
        for language in ("en", "es"):
            for level, lesson in enumerate(spec[language], 1):
                base_lesson = lesson if language == "en" else spec["en"][level - 1]
                expected = [pair[0 if language == "en" else 1] for pair, _ in base_lesson["cells"]]
                slug = "01-the-record" if level == 1 else "02-the-method" if level == 2 else "03-research-comparison"
                path = ROOT / "notebooks" / language / topic / f"{slug}.ipynb"
                notebook = json.loads(path.read_text(encoding="utf-8"))
                cells = notebook["cells"]
                code_indices = [i for i, cell in enumerate(cells) if cell["cell_type"] == "code"]
                steps = ["".join(cells[i - 1]["source"]).strip() for i in code_indices[1:]]
                assert steps == expected, f"{path}: step explanations do not match the {language} authoring"


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
        for heading in headings:
            first_lines = [line.strip().lower() for line in heading.splitlines() if line.lstrip().startswith("#")]
            assert not any(term in line for line in first_lines for term in forbidden), path
