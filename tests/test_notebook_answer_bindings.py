"""Explicit Results bindings must preserve authored scientific interpretations."""
import copy
import importlib.util
import json
from pathlib import Path

import pytest

SPEC = importlib.util.spec_from_file_location(
    "oreflow_notebook_runner", Path(__file__).resolve().parents[1] / "scripts/run_notebooks.py"
)
RUNNER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(RUNNER)


def notebook(language="en", summary=None):
    results = ("## Results\n\n**Answer:** Screening costs " if language == "en" else
               "## Resultados\n\n**Respuesta:** El filtro cuesta ")
    return {"metadata": {"caos": {"language": language, "topic": "04-optimization", "level": 4}},
            "cells": [{"cell_type": "code", "metadata": {}, "outputs": [
                {"output_type": "stream", "text": ["recovery (%): 99.999\n"]}]},
                {"cell_type": "code", "metadata": {"tags": ["answer-values"]}, "outputs": [
                    {"output_type": "stream", "text": [json.dumps(summary or {"Screened count": 68}) + "\n"]}]},
                {"cell_type": "markdown", "source": [results +
                    "<!-- result:Screened count -->0<!-- /result -->. Negative result.\n"]}]}


@pytest.mark.parametrize("language", ["en", "es"])
def test_explicit_binding_refreshes_only_the_named_value(language):
    book = notebook(language)
    RUNNER.answer_from_execution(book)
    text = "".join(book["cells"][-1]["source"])
    assert "<!-- result:Screened count -->68<!-- /result -->" in text
    assert "Negative result." in text
    assert "99.999" not in text and "throughput" not in text
    book["cells"][1]["outputs"][0]["text"] = ['{"Screened count": 73}\n']
    RUNNER.answer_from_execution(book)
    assert "-->73<!--" in "".join(book["cells"][-1]["source"])


def test_ordinary_authored_results_are_never_rewritten_from_recovery():
    book = notebook()
    book["cells"][-1]["source"] = ["## Results\n\n**Answer:** Ridge has RMSE 12.768 pp on this case.\n"]
    before = copy.deepcopy(book)
    RUNNER.answer_from_execution(book)
    assert book == before


@pytest.mark.parametrize("summary", [{"Wrong key": 68}, {"Screened count": float("nan")},
                                    {"Screened count": True}, {"Screened count": "68"}])
def test_missing_or_invalid_bound_evidence_fails_clearly(summary):
    with pytest.raises(ValueError, match="answer|Answer|result|Result"):
        RUNNER.answer_from_execution(notebook(summary=summary))


def test_untagged_json_cannot_silently_supply_an_answer():
    book = notebook()
    book["cells"][1]["metadata"] = {}
    with pytest.raises(ValueError, match="answer|Answer|result|Result"):
        RUNNER.answer_from_execution(book)
