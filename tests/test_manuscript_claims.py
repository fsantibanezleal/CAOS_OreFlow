"""The manuscript quotes the committed records; this pins its result numbers and counts to them (the test counts are
the release record's, which the draft points to).

Tables 1 and 2 are parsed and compared with ``data/derived/learning.json`` at the precision they print; the
numbers in the prose are formatted from the records and must appear in the text. A new bake therefore cannot
leave the manuscript describing the previous one, which is how the 0.05.000 draft outlived its numbers.
"""
from __future__ import annotations

import json
import re
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PAPER = ROOT / "manuscript" / "oreflow-digital-twin.md"
DERIVED = ROOT / "data" / "derived"
MODELS = {"Ridge": "ridge", "Random forest": "random_forest", "Histogram gradient boosting": "hist_gradient_boosting",
          "Gaussian process": "gaussian_process", "Perceptron": "mlp"}
ORDER = ("ridge", "random_forest", "hist_gradient_boosting", "gaussian_process", "mlp")
COPPER = ("copper_porphyry_soft", "copper_porphyry_hard", "copper_molybdenum", "mixed_ore_high_clay", "low_grade_copper")
UNLIKE = ("iron_magnetite_fine", "phosphate_clay")


def _read(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def _text() -> str:
    return PAPER.read_text(encoding="utf-8")


def _flat() -> str:
    """The manuscript with its line wrapping undone, so a quoted phrase can span lines."""
    return re.sub(r"\s+", " ", _text())


def _table(caption: str) -> list[list[str]]:
    text = _text()
    start = text.index("\n\n", text.index(caption)) + 2
    lines = text[start:text.index("\n\n", start)].splitlines()
    return [[c.strip() for c in line.strip().strip("|").split("|")] for line in lines[2:]]


def _matches(quoted: str, value: float) -> bool:
    decimals = len(quoted.split(".")[1]) if "." in quoted else 0
    return f"{value:.{decimals}f}" == quoted


def _missing(phrases: list[str]) -> list[str]:
    flat = _flat()
    return [p for p in phrases if p not in flat]


def test_the_draft_names_the_version_of_its_records():
    version = (ROOT / "VERSION").read_text(encoding="utf-8").strip()
    assert f"written against OreFlow {version}" in _text()
    for record in ("learning.json", "benchmark.json"):
        assert _read(DERIVED / record)["engine_version"] == version, record


def test_table_1_quotes_the_record():
    summary = _read(DERIVED / "learning.json")["summary"]
    rows = _table("**Table 1.**")
    assert [r[0] for r in rows] == list(MODELS)
    columns = ("interpolation_rmse", "interpolation_r2", "loco_rmse_mean", "loco_rmse_max", "loco_r2_median", "transfer_r2_median")
    for cells in rows:
        record = summary[MODELS[cells[0]]]["recovery_pct"]
        for quoted, column in zip(cells[1:], columns, strict=True):
            assert _matches(quoted, record[column]), (cells[0], column, quoted, record[column])


def test_table_2_quotes_every_held_out_case():
    learning = _read(DERIVED / "learning.json")
    title = {c["case_id"]: c["title"]["en"] for c in _read(DERIVED / "manifests" / "index.json")["cases"]}
    folds = {title[f["held_out"]]: f for f in learning["leave_one_case_out"]}
    rows = _table("**Table 2.**")
    assert sorted(r[0] for r in rows) == sorted(folds)
    for cells in rows:
        for quoted, model in zip(cells[1:], ORDER, strict=True):
            actual = folds[cells[0]]["models"][model]["recovery_pct"]["rmse"]
            assert _matches(quoted, actual), (cells[0], model, quoted, actual)


def test_the_learning_prose_quotes_the_record():
    """Check the current conclusions against the current records, not a prior bake's ranking."""
    learning = _read(DERIVED / "learning.json")
    summary = learning["summary"]
    folds = {f["held_out"]: f for f in learning["leave_one_case_out"]}
    groups = {g["held_out_group"]: g for g in learning["leave_one_group_out"]}
    assert len(folds) == 12 and len(groups) == 2
    assert len(set(learning["transfer_groups"].values())) == 7
    assert learning["design"]["rows"] == 3072
    assert min(summary, key=lambda m: summary[m]["recovery_pct"]["interpolation_rmse"]) == "mlp"
    assert min(summary, key=lambda m: summary[m]["recovery_pct"]["loco_rmse_mean"]) == "gaussian_process"
    copper = groups["Cu:chalcopyrite"]["models"]["mlp"]["recovery_pct"]["r2"]
    gold = groups["Au:pyrite"]["models"]["mlp"]["recovery_pct"]["r2"]
    assert copper > 0 and gold < 0
    text = _flat()
    for phrase in (
        f"lowest interpolation recovery RMSE ({summary['mlp']['recovery_pct']['interpolation_rmse']:.2f}",
        f"lowest mean held-out-case RMSE ({summary['gaussian_process']['recovery_pct']['loco_rmse_mean']:.2f} points)",
        f"highest median case-fold R² ({summary['mlp']['recovery_pct']['loco_r2_median']:.3f})",
        f"MLP scores {copper:.3f} on the five chalcopyrite cases held out together",
        f"and {gold:.1f} on the two gold-in-pyrite cases",
        "Log-upgrade median R² is negative for every model under group holdout",
    ):
        assert phrase in text, phrase
    assert "no model keeps a positive median recovery R² over the seven groups" not in text
    assert "median held-out R² 0.923 to 0.968" not in text


def _proposal_error(optimization: list) -> float:
    """The mean absolute surrogate error over every proposal the engine evaluated, from the case records."""
    errors = []
    for case, variant, r in optimization:
        if not r["screened"]:
            continue
        record = next(v for v in _read(DERIVED / "cases" / f"{case}.json")["variants"] if v["id"] == variant)["methods"]["optimization"]
        columns = record["proposal_columns"]
        for start in record["starts"]:
            for row in start["screen"].get("proposals", []):
                engine = row[columns.index("engine_recovery_pct")]
                if engine is not None:
                    errors.append(abs(row[columns.index("surrogate_recovery_pct")] - engine))
    return sum(errors) / len(errors)


def test_the_method_records_quote_the_benchmark():
    bench = _read(DERIVED / "benchmark.json")
    k = bench["kinetics"]
    mean = {m: k[m]["mean_abs_lumping_error_pct"] for m in k}
    assert sorted(mean, key=mean.get) == ["gamma", "kelsall", "klimpel", "stretched_exponential", "first_order"]
    assert {k[m]["fits"] for m in k} == {88}
    optimization = [(case, variant, r) for case, variants in bench["optimization"].items() for variant, r in variants.items()]
    infeasible = sorted(f"{c}:{v}" for c, v, r in optimization if r["status"] != "optimal")
    screened = [r for _, _, r in optimization if r["screened"]]
    with_screen, without = sum(r["evaluations"] for r in screened), sum(r["evaluations_without_screen"] for r in screened)
    errors = [r["surrogate_abs_error_pp"] for r in screened if r["surrogate_abs_error_pp"] is not None]
    assert infeasible == ["iron_magnetite_fine:harder_ore", "iron_magnetite_fine:higher_throughput"]
    dominant = {t: Counter(u["dominant_input"][t] for u in bench["uncertainty"].values())
                for t in ("recovery_pct", "concentrate_grade", "specific_energy_grinding_kwh_t", "recovered_primary_tph")}
    words = {1: "one", 2: "two", 3: "three", 4: "four", 5: "five", 6: "six", 7: "seven", 8: "eight", 9: "nine", 10: "ten", 11: "eleven", 12: "twelve"}
    assert dominant["specific_energy_grinding_kwh_t"] == {"work_index": 12} and dominant["recovered_primary_tph"] == {"head_grade": 12}
    grade = dominant["concentrate_grade"]
    assert set(grade) == {"liberation_size", "head_grade"}
    missing = _missing([
        f"over {k['gamma']['fits']} flotation states: mean absolute projection errors of {mean['gamma']:.2f} points for the gamma model,"
        f" {mean['kelsall']:.2f} for Kelsall, {mean['klimpel']:.2f} for Klimpel, {mean['stretched_exponential']:.2f} for the stretched exponential"
        f" and {mean['first_order']:.2f} for first order",
        f"for {len(optimization) - len(infeasible)} of the {len(optimization)} variants",
        f"over the {len(screened)} screened variants it cost {100 * (with_screen / without - 1):.1f}% more engine evaluations",
        f"the surrogate's recovery was {sum(errors) / len(errors):.2f} points from the engine's on average",
        f"reaches the same optimum in {sum(1 for r in screened if r['same_optimum_without_screen'])} of the {len(screened)}"
        f" and a little more metal in the other {words[sum(1 for r in screened if not r['same_optimum_without_screen'])]}",
        f"({_proposal_error(optimization):.2f} over the {sum(r['proposed'] for r in screened)} proposals)",
        f"floatability drives recovery in {words[dominant['recovery_pct']['floatability']]} cases",
        f"liberation size drives concentrate grade in {words[grade['liberation_size']]} and the head grade in the other {words[grade['head_grade']]}",
    ])
    assert not missing, missing


def test_the_counts_and_the_verification_claims_quote_the_records():
    index = _read(DERIVED / "manifests" / "index.json")
    learning = _read(DERIVED / "learning.json")
    validation = _read(DERIVED / "validation.json")
    assert index["n_variants"] == 96
    assert learning["design"]["rows"] == 3072
    assert validation["passed"] is True
    flat = _flat()
    assert f"reproduces all {index['n_variants']} committed states within 1e-6" in flat
    assert f"All {index['n_variants']} committed states close within 1e-9" in flat
    assert f"{learning['design']['rows']:,}-state design" in flat
    assert f"took {validation['seconds']['cases']:.0f} s for the cases on {validation['workers']} workers and {validation['seconds']['learning']:.0f} s for the learned lane" in flat
    assert "independent browser implementation" not in flat and "independent second implementation" not in flat


def test_the_published_examples_quote_the_oracles():
    oracles = _read(DERIVED / "benchmark.json")["oracles"]
    lap = oracles["laplante"]
    grg, published = lap["engine"]["grg_recovery_pct"], lap["published"]["grg_recovery_pct"]
    load, published_load = lap["engine"]["grg_circulating_load_pct"], lap["published"]["grg_circulating_load_pct"]
    z = oracles["zandrivierspoort"]
    net = oracles["molycop"]["comparison"]["net_specific_energy_kwh_t"]
    gmg = [e["engine_operating_work_index_kwh_t"] for e in oracles["gmg"]["examples"]]
    assert lap["within_tolerance"] is False  # the miss is stated, not tuned away
    missing = _missing([
        f"{gmg[0]:.2f} and {gmg[1]:.2f} kWh/t",
        f"net {net['engine']:.2f} kWh/t, {abs(100 * net['relative_error']):.1f}% below",
        f"GRG recovery {published[0] + 1e-9:.1f} to {published[-1] + 1e-9:.1f}%, GRG circulating load {published_load[0]:.0f} to {published_load[-1]:.0f}%",
        f"GRG recovery {grg[0]:.1f} to {grg[-1]:.1f}%, GRG circulating load {load[0]:.0f} to {load[-1]:.0f}%",
        f"{z['engine']['concentrate_fe_pct'][0]:.1f} and {z['engine']['concentrate_fe_pct'][1]:.1f}% Fe: a step of {z['grade_difference_pct_points']['engine']:.1f} points",
        f"at levels {-z['gap_fe_pct_points'][0]:.1f} and {-z['gap_fe_pct_points'][1]:.1f} points below",
    ])
    assert not missing, missing


def test_the_measured_lanes_quote_their_records():
    hzdr = {c["case"]: c for c in _read(DERIVED / "source" / "hzdr_particle_benchmark.json")["cases"]}
    rows = _table("scored against the constructed probabilities:")
    assert [r[0].split(" ")[0] for r in rows] == sorted(hzdr)
    for cells in rows:
        case = hzdr[cells[0].split(" ")[0]]
        for quoted, model in zip(cells[1:], ("published_reference", "l1_logistic", "particle_mlp"), strict=True):
            assert _matches(quoted, case["models"][model]["rmse"]), (cells[0], model, quoted)
        if "complete rows" in cells[0]:
            assert f"{case['test_rows']:,}".replace(",", " ") in cells[0]
    geomet = _read(DERIVED / "source" / "geomet_lct_benchmark.json")["protocols"]
    rmse = {p: [v["rmse_pp"] for v in geomet[p]["scores"].values()] for p in ("hole", "zone")}
    ridge = geomet["hole"]["paired_bootstrap"]["rmse_differences"]["train_mean-ridge"]
    beats = {p: [d for d, v in geomet[p]["paired_bootstrap"]["rmse_differences"].items() if d.startswith("train_mean-") and v["excludes_zero"] and v["mean_pp"] > 0]
             for p in ("hole", "zone")}
    assert beats == {"hole": ["train_mean-ridge"], "zone": []}
    missing = _missing([
        f"RMSE ranges from {min(rmse['hole']):.2f} to {max(rmse['hole']):.2f} points (whole holes) and {min(rmse['zone']):.2f} to {max(rmse['zone']):.2f} (zones)",
        f"by {ridge['mean_pp']:.2f} points (95% interval {ridge['interval_95_pp'][0]:.2f} to {ridge['interval_95_pp'][1]:.2f})",
    ])
    assert not missing, missing


def test_the_engine_on_the_samples_and_the_plant_hours_quote_their_records():
    samples = _read(DERIVED / "real_samples.json")
    s = samples["summary"]
    case = _read(DERIVED / "cases" / "copper_porphyry_soft.json")
    gap = s["engine_minus_measured_pp"]
    sens = samples["sensitivity"]
    curve = {r["p80_um"]: r for r in sens["gap_by_assumed_p80"]}
    target = sens["target_grind_throughput"]
    assert s["samples"] == 52 and s["power_limited"] == s["samples"]
    assert gap["max"] < 0  # every sample below its test
    iron = _read(DERIVED / "source" / "iron_plant_soft_sensor.json")
    mae = {m: v["mae_pct_points"] for m, v in iron["pooled_scores"].items()}
    sensors = ("ridge", "random_forest", "hist_gradient_boosting")
    best = min(sensors, key=mae.get)
    assert best == "ridge" and min(mae, key=mae.get) == "previous_lab"
    held = iron["held_labels"]
    clean = {m: v["mae_pct_points"] for m, v in held["pooled_scores_without"].items()}
    missing = _missing([
        f"in the hole ({s['work_index_assignment']['nearest_in_hole']} samples) or the deposit median ({s['work_index_assignment']['deposit_median']})",
        f"spans {s['work_index_kwh_t']['min']:.1f} to {s['work_index_kwh_t']['max']:.1f} kWh/t against the case's {case['variants'][0]['point']['work_index_kwh_t']:.1f}",
        f"float at declared ratios to chalcopyrite ({samples['floatability_ratios']['bornite']:g}, and chalcocite at {samples['floatability_ratios']['chalcocite_to_bornite']:g} times bornite, a choice",
        f"falls short of the locked-cycle test by {-gap['mean']:.1f} points on average (RMSE {gap['rmse']:.1f} points; {-gap['max']:.1f} to {-gap['min']:.1f} points below)",
        f"With the circuit sized for the case's 150 µm target the gap is {curve[150.0]['mean_gap_pp']:+.1f} points",
        f"it runs from {curve[75.0]['mean_gap_pp']:+.1f} to {curve[300.0]['mean_gap_pp']:.1f} points as the assumed laboratory grind goes from 75 to 300 µm",
        f"At each sample's own target-grind throughput it is {target['mean_gap_pp']:+.1f} points, of which {target['residence_share_pp']:.1f} come from the longer flotation residence",
        f"(Pearson r between {min(r['pearson'] for r in sens['gap_by_assumed_p80']):.2f} and {max(r['pearson'] for r in sens['gap_by_assumed_p80']):.2f})",
        f"CC0; {iron['quality']['source_rows']:,} rows)",
        f"Dropping the {iron['quality']['changing_lab_hours_excluded']} hours whose silica label was interpolated leaves {iron['protocol']['pair_rows']:,} pairs",
        f"with a mean absolute error of {mae['previous_lab']:.3f} points",
        f"ridge, is {mae['train_mean'] - mae['ridge']:.3f} points below the training mean's {mae['train_mean']:.3f}",
        # S-16: the laboratory values carried over, and the scores without the pairs that touch them
        f"In {held['pairs_touching']} of those pairs the laboratory value is one carried over unchanged for three or more consecutive hours",
        f"without them the previous assay's error is {clean['previous_lab']:.3f} points, still the lowest, and ridge is {clean['ridge'] - clean['train_mean']:.3f} points above the training mean",
    ])
    assert not missing, missing
    assert held["run_hours_min"] == 3 and min(clean, key=clean.get) == "previous_lab"
