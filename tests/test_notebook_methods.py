"""Regressions for the worked-method gaps found in the release review."""
import ast
import json
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]


def released_helpers(language="en"):
    import hashlib
    import numpy as np
    from scipy.stats import norm
    import sys
    sys.path.insert(0, str(ROOT / "data-pipeline"))
    from pipeline.methods.learning import FEATURES, TARGETS
    from pipeline.methods.observable import PredictionRejected, check_observable
    state = {"np": np, "json": json, "hashlib": hashlib, "Path": Path, "norm": norm,
             "FEATURES": FEATURES, "TARGETS": TARGETS, "PredictionRejected": PredictionRejected,
             "check_observable": check_observable}
    for source in programs("03-learning", "03-research-comparison.ipynb", language):
        definitions = [node for node in ast.parse(source).body
                       if (isinstance(node, ast.FunctionDef)
                           and node.name.startswith(("released_", "challenge_")))
                       or (isinstance(node, ast.Assign)
                           and any(isinstance(target, ast.Name) and target.id == "target_units"
                                   for target in node.targets))]
        if definitions:
            exec(compile(ast.Module(body=definitions, type_ignores=[]), "<actual notebook helpers>", "exec"), state)
    assert "released_provenance" in state, "the notebook must define the executable artifact preflight"
    return state


@pytest.mark.parametrize("language", ["en", "es"])
def test_adversarial_released_model_provenance(tmp_path, language):
    import copy
    import hashlib
    state = released_helpers(language)
    scalers = {"features": list(state["FEATURES"]), "targets": list(state["TARGETS"]), "guard_threshold": 0.5}
    (tmp_path / "process_surrogate.json").write_text(json.dumps(scalers), encoding="utf-8")
    files = ["process_surrogate.onnx", "process_guard.onnx", "process_screen.json", "process_gp_cholesky.bin"]
    for name in files:
        (tmp_path / name).write_bytes(b"abcd")
    exports = {key: {"path": name, "bytes": 4, "sha256": hashlib.sha256(b"abcd").hexdigest()}
               for key, name in zip(("surrogate", "guard", "screen"), files)}
    exports["screen"]["cholesky"] = {"path": files[-1], "bytes": 4}
    record = {"schema": "oreflow.learning/v2", "engine_version": "fixture", "contract_digest": "digest",
              "features": list(state["FEATURES"]), "targets": list(state["TARGETS"]),
              "final": {"exports": exports, "guard_threshold": 0.5}}
    check = state["released_provenance"]
    hashes = check(record, {"digest": "digest"}, "fixture", tmp_path)
    assert hashes["process_guard.onnx"] == hashlib.sha256(b"abcd").hexdigest()
    for field, wrong in [("schema", "oreflow.learning/v1"), ("engine_version", "old"), ("contract_digest", "wrong")]:
        changed = {**record, field: wrong}
        with pytest.raises(ValueError):
            check(changed, {"digest": "digest"}, "fixture", tmp_path)
    changed = copy.deepcopy(record)
    changed["final"]["exports"]["screen"]["path"] = "another.json"
    with pytest.raises(ValueError):
        check(changed, {"digest": "digest"}, "fixture", tmp_path)
    (tmp_path / "process_guard.onnx").write_bytes(b"abce")
    with pytest.raises(ValueError):
        check(record, {"digest": "digest"}, "fixture", tmp_path)


@pytest.mark.parametrize("language", ["en", "es"])
def test_adversarial_released_model_targets(language):
    import numpy as np
    from types import SimpleNamespace
    state = released_helpers(language)
    targets = state["TARGETS"]
    screen = SimpleNamespace(targets=targets, judge=lambda row: {
        "prediction": {targets[2]: 30.0, targets[0]: 70.0, targets[1]: 2.0}})
    predicted = state["released_predictions"](screen, np.zeros((2, len(state["FEATURES"]))))
    np.testing.assert_array_equal(predicted, [[70, 2, 30], [70, 2, 30]])
    truth = np.array([[60, 1, 20], [80, 3, 40]])
    scores = state["challenge_errors"](truth, predicted, "fixture", np.array([[0., 0., 0.], [100., 4., 50.]]))
    assert [row["target"] for row in scores] == list(targets)
    units = ["pp", "log10 ratio" if language == "en" else "razón log10", "kWh/t"]
    assert [row["unit"] for row in scores] == units
    np.testing.assert_array_equal([row["rmse"] for row in scores], [10, 1, 10])
    screen.targets = tuple(reversed(targets))
    with pytest.raises(ValueError):
        state["released_predictions"](screen, np.zeros((1, len(state["FEATURES"]))))


@pytest.mark.parametrize("language", ["en", "es"])
def test_adversarial_guard_misses_are_retained(language):
    import numpy as np
    from types import SimpleNamespace
    state = released_helpers(language)
    screen = SimpleNamespace(guard_threshold=0.5, judge=lambda row: {"guard_error": 0.1})
    bounds = {name: (1.0, 2.0) for name in ("work_index_kwh_t", "target_p80_um", "water_m3_t")}
    rows = state["challenge_guard"](screen, np.full((2, len(state["FEATURES"])), 1.5),
                                     np.array(["a", "b"]), bounds)
    baseline = [row for row in rows if row["probe"] == "baseline"]
    shifted = [row for row in rows if row["probe"] != "baseline"]
    assert len(baseline) == 2 and len(shifted) == 6
    assert all(row["accepted"] for row in baseline + shifted), "an insensitive guard must retain every miss"
    assert all(row["feature_value"] < bounds[row["probe"]][0] or row["feature_value"] > bounds[row["probe"]][1]
               for row in shifted)
    assert screen.guard_threshold == 0.5


@pytest.mark.parametrize("language", ["en", "es"])
def test_adversarial_gp_coverage_uses_its_own_mean(language):
    import numpy as np
    from types import SimpleNamespace
    state = released_helpers(language)
    def gp(row):
        np.testing.assert_array_equal(row, np.zeros(len(state["FEATURES"])))
        return 60.0, 1.0
    screen = SimpleNamespace(feature_mean=np.ones(len(state["FEATURES"])),
                             feature_scale=np.full(len(state["FEATURES"]), 2.0),
                             gp=gp,
                             judge=lambda row: {"prediction": {"recovery_pct": 15.0}})
    rows, mean, std = state["challenge_coverage"](
        screen, np.ones((8, len(state["FEATURES"]))), np.full(8, 60.0),
        np.array(["a"] * 4 + ["b"] * 4), np.zeros(8, dtype=bool))
    assert all(row["subset"] == "all" for row in rows[:9])
    assert all(row["coverage"] == 1.0 and row["mean_width"] > 0 for row in rows[:9])
    assert all(row["n"] == 0 and row["coverage"] is None and row["mean_width"] is None
               for row in rows[9:])
    np.testing.assert_array_equal(mean, np.full(8, 60.0))
    np.testing.assert_array_equal(std, np.ones(8))


@pytest.mark.parametrize("language", ["en", "es"])
def test_adversarial_released_errors_keep_full_design_reference(language):
    import inspect
    import numpy as np
    state = released_helpers(language)
    observed = np.array([[98., 1., 20.], [99., 2., 30.]])
    predicted = np.array([[90., 1., 20.], [90., 2., 30.]])
    reference = np.array([[0., 0., 0.], [100., 4., 50.]])
    scorer = state["challenge_errors"]
    # The old API reproduces the actual erroneous null score before the explicit-reference API is required.
    if "reference" not in inspect.signature(scorer).parameters:
        assert scorer(observed, predicted, "narrow")[0]["rmse"] == pytest.approx(np.sqrt(72.5))
    assert inspect.signature(scorer).parameters["reference"].default is inspect.Parameter.empty
    row = scorer(observed, predicted, "narrow", reference)[0]
    assert row["scored"] == 2 and row["rejected"] == 0
    assert row["rmse"] == pytest.approx(np.sqrt(72.5)) and row["mae"] == 8.5 and row["bias"] == -8.5
    assert row["observable"]["status"] == "constant-prediction"
    assert row["observable"]["reference_range"] == [0., 100.]
    assert row["observable"]["observed_range"] == [98., 99.]
    outside = predicted.copy()
    outside[:, 0] = 1000
    rejected = scorer(observed, outside, "outside", reference)[0]
    assert rejected["rmse"] is None and rejected["scored"] == 0 and rejected["rejected"] == 2
    assert rejected["observable"]["prediction_range"] == [1000., 1000.]
    for bad in (np.full((2, 3), np.nan), np.ones((1, 3))):
        with pytest.raises(ValueError):
            scorer(observed, bad, "invalid", reference)
    record = {"interpolation": {"models": {"ridge": {
        target: {"observable": {"reference_range": reference[:, j].tolist()}}
        for j, target in enumerate(state["TARGETS"])}}}}
    np.testing.assert_array_equal(state["released_reference"](record), reference)


@pytest.mark.parametrize("language", ["en", "es"])
def test_adversarial_released_parity_uses_standardized_units(language):
    import numpy as np
    from types import SimpleNamespace
    state = released_helpers(language)
    source = next(source for source in programs("03-learning", "03-research-comparison.ipynb", language)
                  if "for row in scalers" in source)
    loop = next(node for node in ast.parse(source).body if isinstance(node, ast.For))
    program = compile(ast.Module(body=[loop], type_ignores=[]), "<actual notebook parity loop>", "exec")
    scales = np.array([20., 0.25, 5.])
    expected = np.array([50., 1., 10.])
    state.update(scalers={"reference": [{"features": [], "case_id": "fixture",
                                         "prediction": dict(zip(state["TARGETS"], expected))}]},
                 released={"settings": {"onnx_tolerance": 1e-5}})
    def evaluate(difference, scale):
        actual = expected + scales * np.asarray(difference)
        state["frozen"] = SimpleNamespace(target_scale=scale, judge=lambda row: {
            "prediction": dict(zip(state["TARGETS"], actual))})
        exec(program, state)
    evaluate([2e-6, 3e-6, 1e-6], scales)
    with pytest.raises(ValueError):
        evaluate([2e-5, 0., 0.], scales)
    for invalid in (0., -1., np.nan, np.inf):
        with pytest.raises(ValueError):
            evaluate([0., 0., 0.], np.array([invalid, 0.25, 5.]))


def programs(topic, filename, language="en"):
    notebook = json.loads((ROOT / "notebooks" / language / topic / filename).read_text(encoding="utf-8"))
    return ["".join(c["source"]) for c in notebook["cells"] if c["cell_type"] == "code"]


@pytest.mark.parametrize("language", ["en", "es"])
def test_learning_comparison_fits_estimators_and_scores_fresh_holdouts(language):
    source = "\n".join(programs("03-learning", "03-research-comparison.ipynb", language))
    tree = ast.parse(source)
    calls = [n for n in ast.walk(tree) if isinstance(n, ast.Call)]
    names = {ast.unparse(n.func) for n in calls}
    assert {"build_design", "interpolation_split", "leave_one_case_out", "leave_one_group_out"} <= names
    assert {"Ridge", "RandomForestRegressor", "HistGradientBoostingRegressor", "GaussianProcessRegressor"} <= names
    assert any(name.endswith(".fit") for name in names)
    assert any(name.endswith(".predict") for name in names)
    assert "StandardScaler" in names and "mean_squared_error" in names
    reference = source.partition("def released_provenance")[0]
    assert "learning.json" not in reference, "archived scores must not carry the estimator comparison"


@pytest.mark.parametrize("language", ["en", "es"])
def test_screening_evidence_runs_real_paired_searches(language):
    source = "\n".join(programs("04-optimization", "04-screening-evidence.ipynb", language))
    tree = ast.parse(source)
    searches = [n for n in ast.walk(tree) if isinstance(n, ast.Call) and ast.unparse(n.func) == "optimize"]
    assert len(searches) >= 2, "run both production methods rather than replay saved optima"
    arguments = [{k.arg: ast.unparse(k.value) for k in n.keywords} for n in searches]
    assert any(a.get("screen") == "None" for a in arguments)
    assert any(a.get("screen") not in (None, "None") for a in arguments)
    assert len({tuple(ast.unparse(arg) for arg in n.args) for n in searches}) == 1
    assert {a.get("weight") for a in arguments} == {"0.5"}
    assert {a.get("path") for a in arguments} == {"False"}
    assert "Screen" in source and "proposals" in source and "trace" in source
    assert "patch(" not in source, "bound the domain without replacing production search settings"


def test_learning_scaling_is_fitted_inside_the_training_partition():
    source = "\n".join(programs("03-learning", "03-research-comparison.ipynb"))
    tree = ast.parse(source)
    fits = [node for node in ast.walk(tree)
            if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute) and node.func.attr == "fit"]
    assert len(fits) == 4
    assert all([ast.unparse(arg) for arg in node.args] == ["x[training]", "y[training, 0]"] for node in fits)
    assert "make_pipeline(StandardScaler(), Ridge" in source
    assert "Prediction range (%)" in source and "Reference range (%)" in source


def test_levels_add_real_learning_questions_and_estimators():
    for level, filename, expected in [(1, "01-the-record.ipynb", 1),
                                     (2, "02-the-method.ipynb", 2),
                                     (3, "03-research-comparison.ipynb", 4)]:
        source = "\n".join(programs("03-learning", filename))
        tree = ast.parse(source)
        fits = [n for n in ast.walk(tree) if isinstance(n, ast.Call)
                and isinstance(n.func, ast.Attribute) and n.func.attr == "fit"]
        assert len(fits) == expected, level


@pytest.mark.parametrize("language,missing", [("en", "Ore-group holdout"), ("es", "Grupo mineral reservado")])
def test_practical_learning_figure_uses_the_executed_case_protocol(language, missing):
    figures = [source for source in programs("03-learning", "02-the-method.ipynb", language)
               if "ax.scatter" in source]
    assert figures
    assert all(missing not in source for source in figures)


def test_no_generic_throughput_extensions_or_repeated_saved_optima():
    for path in (ROOT / "notebooks").glob("*/*/*.ipynb"):
        notebook = json.loads(path.read_text(encoding="utf-8"))
        source = "\n".join("".join(c["source"]) for c in notebook["cells"])
        assert "controlled throughput" not in source, path
        assert "interpretation 1 is that" not in source, path
        assert source.count("recorded = optimum['recovered_tph']") <= 1, path


def notebook(topic, filename, language="en"):
    return json.loads((ROOT / "notebooks" / language / topic / filename).read_text(encoding="utf-8"))


def execute_selected(topic, filename, selectors, language="en"):
    import sys
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    import numpy as np
    import pandas as pd
    sys.path.insert(0, str(ROOT / "data-pipeline"))
    state = {"repo": ROOT, "np": np, "pd": pd, "plt": plt, "display": lambda *args: None}
    cells = programs(topic, filename, language)
    setup = next(source for source in cells if "legend_style =" in source)
    legend = next(node for node in ast.parse(setup).body if isinstance(node, ast.Assign)
                  and any(isinstance(target, ast.Name) and target.id == "legend_style" for target in node.targets))
    exec(compile(ast.Module(body=[legend], type_ignores=[]), "<actual figure setup>", "exec"), state)
    for selector in selectors:
        program = next(source for source in cells if selector in source)
        exec(compile(program, "worked-notebook-cell", "exec"), state)
    return state


@pytest.mark.parametrize("language", ["en", "es"])
def test_reference_markers_use_exact_calibration_and_physical_feed_is_mill_feed(language):
    import numpy as np
    state = execute_selected("01-comminution", "03-research-comparison.ipynb",
                             ["f80 = nominal.grinding.feed_f80_um", "reference_curves =", "axes[1].scatter"], language)
    assert state["f80"] == state["nominal"].grinding.feed_f80_um
    values = [state["calibration"][name][0] for name in ("bond", "rittinger", "kick")]
    assert np.allclose(values, values[0], rtol=0, atol=1e-12)
    for marker, value in zip(state["axes"][1].collections, values):
        assert np.allclose(marker.get_offsets(), [[state["reference_product"], value]], rtol=0, atol=1e-12)
    state["plt"].close("all")


@pytest.mark.parametrize("language", ["en", "es"])
def test_psd_plot_percent_units_and_size_domain_include_feed_f80(language):
    state = execute_selected("01-comminution", "01-the-record.ipynb",
                             ["result = simulate", "psd[stream]"], language)
    assert all(line.get_ydata().max() > 99 for line in state["ax"].lines)
    assert state["ax"].get_xlim()[1] >= state["result"].metrics["crusher_feed_f80_um"]
    assert state["fig"].get_figwidth() <= 6.4
    text = [state["ax"].xaxis.label, state["ax"].yaxis.label,
            *state["ax"].get_xticklabels(), *state["ax"].get_yticklabels(),
            *state["ax"].get_legend().get_texts()]
    assert min(label.get_fontsize() for label in text if label.get_text()) >= 16
    state["plt"].close("all")


def test_short_bank_table_measures_each_frozen_and_refitted_form():
    state = execute_selected("02-flotation", "03-research-comparison.ipynb",
                             ["nominal = simulate", "short_point =", "short_fits =", "residence_rows ="])
    assert len(state["residence"]) == 5
    assert set(state["residence"]["Model"]) == {model.id for model in state["MODELS"]}
    assert all(state["residence"]["Short exact (%)"] == state["short_exact"])
    assert state["residence"]["Short frozen (%)"].between(0, 100).all()
    assert (state["residence"]["Refit absolute error (pp)"] == state["residence"]["Refit signed error (pp)"].abs()).all()
    book = notebook("02-flotation", "03-research-comparison.ipynb")
    answer = next("".join(c["source"]) for c in book["cells"] if "".join(c["source"]).startswith("## Results"))
    assert "Short Kelsall refit error" in answer and "Short Kelsall frozen error" in answer


def test_dose_change_result_uses_actual_matched_before_and_after_values():
    book = notebook("02-flotation", "02-the-method.ipynb")
    answer = next("".join(c["source"]) for c in book["cells"] if "".join(c["source"]).startswith("## Results"))
    assert "Dosed Kelsall batch RMSE" in answer and "Dosed overall recovery" in answer
    source = "\n".join(programs("02-flotation", "02-the-method.ipynb"))
    assert "dose_comparison" in source and "dose_by_id" in source


def test_current_cohort_identity_changes_with_bytes_and_rejects_mixed_versions(tmp_path):
    import hashlib
    cases = sorted((ROOT / "data/derived/cases").glob("*.json"))[:2]
    folder = tmp_path / "data/derived/cases"
    folder.mkdir(parents=True)
    for path in cases:
        record = json.loads(path.read_text(encoding="utf-8"))
        minimal = {key: record[key] for key in ("engine_version", "contract_digest", "variants")}
        (folder / path.name).write_text(json.dumps(minimal), encoding="utf-8")
    (tmp_path / "VERSION").write_text((ROOT / "VERSION").read_text(), encoding="utf-8")
    source = next(s for s in programs("04-optimization", "04-screening-evidence.ipynb") if "cohort_paths =" in s)
    state = {"repo": tmp_path, "json": json}
    exec(source, state)
    digest = state["cohort_hash"].hexdigest()
    expected = hashlib.sha256()
    for path in sorted(folder.glob("*.json")):
        expected.update(path.name.encode() + b"\0" + path.read_bytes())
    assert digest == expected.hexdigest()
    path = next(folder.glob("*.json"))
    path.write_text(path.read_text() + "\n", encoding="utf-8")
    exec(source, state)
    assert state["cohort_hash"].hexdigest() != digest
    record = json.loads(path.read_text())
    record["engine_version"] = "test-mixed-version"
    path.write_text(json.dumps(record), encoding="utf-8")
    with pytest.raises(RuntimeError, match="identity"):
        exec(source, state)


def test_refused_production_search_is_retained_without_physical_zero_substitution():
    import sys
    import pandas as pd
    sys.path.insert(0, str(ROOT / "data-pipeline"))
    from pipeline.cases.catalog import CASE_BY_ID
    from pipeline.methods.optimization import optimize
    case = CASE_BY_ID["iron_magnetite_fine"]
    contract = json.loads((ROOT / "data/derived/contract/operating_contract.json").read_text(encoding="utf-8"))
    refused = optimize(case, case.nominal.with_values(target_p80_um=0), contract, weight=0.5, path=False)
    assert refused["status"] == "base_refused"
    source = next(s for s in programs("04-optimization", "01-the-record.ipynb") if "endpoint_rows =" in s)
    state = {"plain": refused, "pd": pd, "display": lambda *args: None}
    exec(source, state)
    row = state["endpoints"].iloc[0]
    assert row["Status"] == "base_refused"
    assert not row["Feasible"] and pd.isna(row["Recovered metal (t/h)"])


@pytest.mark.parametrize("language,column", [("en", "Unit"), ("es", "Unidad")])
def test_decision_display_localizes_headers_without_translating_contract_unit_key(language, column):
    import sys
    import pandas as pd
    sys.path.insert(0, str(ROOT / "data-pipeline"))
    from pipeline.cases.catalog import CASE_BY_ID
    from pipeline.methods.optimization import optimize
    case = CASE_BY_ID["iron_magnetite_fine"]
    contract = json.loads((ROOT / "data/derived/contract/operating_contract.json").read_text(encoding="utf-8"))
    record = optimize(case, case.nominal.with_values(target_p80_um=0), contract, weight=0.5, path=False)
    # A real refused record is sufficient to test contract metadata, without a full optimization run.
    state = {"plain": record, "plain_end": record["base"], "screened_end": record["base"],
             "case": case, "contract": contract, "pd": pd, "display": lambda *args: None}
    source = next(s for s in programs("04-optimization", "04-screening-evidence.ipynb", language)
                  if "decision_tolerance =" in s)
    exec(source, state)
    assert set(state["decision_comparison"][column]) == {contract["cases"][case.id]["inputs"]["target_p80_um"]["unit"]}
