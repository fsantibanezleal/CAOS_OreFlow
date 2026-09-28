"""The manuscript quotes the committed records; this pins every quoted number to them.

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
UNLIKE = ("gold_free_milling", "iron_magnetite_fine", "phosphate_clay")


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
    columns = ("interpolation_rmse", "interpolation_r2", "loco_rmse_mean", "loco_rmse_max", "loco_r2_median")
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
    learning = _read(DERIVED / "learning.json")
    s, guard = learning["summary"], learning["guard"]
    rec = {m: s[m]["recovery_pct"] for m in s}
    energy = {m: s[m]["specific_energy_total_kwh_t"] for m in s}
    folds = {f["held_out"]: f["models"] for f in learning["leave_one_case_out"]}
    gp = learning["interpolation"]["models"]["gaussian_process"]
    nonlinear = [m for m in ORDER if m != "ridge"]
    copper = [folds[c]["mlp"]["recovery_pct"]["rmse"] for c in COPPER]
    unlike = [folds[c]["mlp"]["recovery_pct"]["rmse"] for c in UNLIKE]
    upgrade = [s[m]["log_upgrade"]["interpolation_r2"] for m in nonlinear]
    by_feature = guard["false_accept_by_feature"]
    blind_share = sum(by_feature[k] for k in ("water_m3_t", "circulating_load", "crusher_css_mm")) / sum(by_feature.values())
    # the orderings the prose asserts
    assert max(rec, key=lambda m: rec[m]["interpolation_r2"]) == "mlp"
    assert max(rec, key=lambda m: rec[m]["loco_rmse_mean"]) == "mlp"
    assert sorted(rec, key=lambda m: -rec[m]["loco_r2_median"])[:2] == ["hist_gradient_boosting", "mlp"]
    assert min(rec, key=lambda m: rec[m]["loco_rmse_mean"]) == "random_forest"
    assert all(s[m]["log_upgrade"]["loco_r2_median"] < 0 for m in s)
    assert sorted(by_feature, key=lambda k: -by_feature[k])[:3] == ["water_m3_t", "circulating_load", "crusher_css_mm"]
    assert sum(c < rec["mlp"]["interpolation_rmse"] for c in copper) == 4
    magnetite = folds["iron_magnetite_fine"]
    assert min(magnetite, key=lambda m: magnetite[m]["recovery_pct"]["rmse"]) == "ridge"
    worst_energy = sorted(folds, key=lambda c: -folds[c]["mlp"]["specific_energy_total_kwh_t"]["rmse"])[:2]
    assert worst_energy == ["phosphate_clay", "iron_magnetite_fine"]
    missing = _missing([
        f"interpolates recovery best (RMSE {rec['mlp']['interpolation_rmse']:.2f} points)",
        f"transfers worst by mean error ({rec['mlp']['loco_rmse_mean']:.1f} points",
        f"median held-out R² ({rec['mlp']['loco_r2_median']:.3f}) is second only to gradient boosting's ({rec['hist_gradient_boosting']['loco_r2_median']:.3f})",
        f"cost the perceptron {min(copper):.1f} to {max(copper):.1f} points",
        f"cost {min(unlike):.0f} to {max(unlike):.0f} points",
        f"(median held-out R² {min(energy[m]['loco_r2_median'] for m in nonlinear):.3f} to {max(energy[m]['loco_r2_median'] for m in nonlinear):.3f} for the four non-linear models)",
        f"flags {100 * guard['false_alarm_rate']:.1f}% of in-envelope states but accepts {100 * guard['false_accept_rate']:.1f}% of states pushed"
        f" outside the training range, {100 * blind_share:.0f}% of them shifts of three weakly coupled inputs",
        f"({learning['interpolation']['train_rows']} training, {learning['interpolation']['test_rows']} test rows)",
        f"on {guard['probe_rows']:,} probes".replace(",", " "),
        f"({magnetite['random_forest']['recovery_pct']['rmse']:.0f} and {magnetite['hist_gradient_boosting']['recovery_pct']['rmse']:.0f} points),"
        f" where ridge fails least ({magnetite['ridge']['recovery_pct']['rmse']:.0f})",
        f"from {energy['random_forest']['loco_r2_median']:.3f} (random forest) to {energy['mlp']['loco_r2_median']:.3f} (perceptron)",
        f"gradient boosting ({energy['hist_gradient_boosting']['loco_rmse_mean']:.2f} kWh/t) and the random forest ({energy['random_forest']['loco_rmse_mean']:.2f}) lead",
        f"the perceptron's {energy['mlp']['loco_rmse_mean']:.2f} comes from the phosphate and magnetite circuits"
        f" ({folds['phosphate_clay']['mlp']['specific_energy_total_kwh_t']['rmse']:.1f} and {folds['iron_magnetite_fine']['mlp']['specific_energy_total_kwh_t']['rmse']:.1f} kWh/t)",
        f"(R² {min(upgrade):.3f} to {max(upgrade):.3f} for the four non-linear models)",
        f"cover {100 * gp['recovery_pct']['coverage_95']:.1f}% of the held-out recoveries (mean half-width {gp['recovery_pct']['mean_half_width']:.1f} points),"
        f" {100 * gp['log_upgrade']['coverage_95']:.1f}% of the upgrades and {100 * gp['specific_energy_total_kwh_t']['coverage_95']:.1f}% of the energies",
        f"flags {100 * guard['false_alarm_rate']:.1f}% of the held-out in-envelope states and accepts {100 * guard['false_accept_rate']:.1f}% of the out-of-envelope probes",
        f"shift the water ({100 * by_feature['water_m3_t']:.0f}% accepted), the circulating load ({100 * by_feature['circulating_load']:.0f}%) or"
        f" the crusher setting ({100 * by_feature['crusher_css_mm']:.0f}%)",
    ])
    assert not missing, missing
    assert all(gp[t]["coverage_95"] < 0.95 for t in ("recovery_pct", "log_upgrade", "specific_energy_total_kwh_t")), "the prose calls every interval too narrow"


def test_the_method_records_quote_the_benchmark():
    bench = _read(DERIVED / "benchmark.json")
    k = bench["kinetics"]
    mean = {m: k[m]["mean_abs_lumping_error_pct"] for m in k}
    assert sorted(mean, key=mean.get) == ["gamma", "kelsall", "klimpel", "stretched_exponential", "first_order"]
    assert {k[m]["fits"] for m in k} == {66}
    optimization = [(case, variant, r) for case, variants in bench["optimization"].items() for variant, r in variants.items()]
    infeasible = sorted(f"{c}:{v}" for c, v, r in optimization if r["status"] != "optimal")
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
        f"floatability drives recovery in {words[dominant['recovery_pct']['floatability']]} cases",
        f"liberation size drives concentrate grade in {words[grade['liberation_size']]} and the head grade in the other {words[grade['head_grade']]}",
    ])
    assert not missing, missing


def test_the_published_examples_quote_the_oracles():
    oracles = _read(DERIVED / "benchmark.json")["oracles"]
    gold = oracles["laplante"]["engine"]["gold_circulating_load_pct"]
    gravity = oracles["laplante"]["engine"]["gravity_recovery_pct"]
    z = oracles["zandrivierspoort"]["engine"]["concentrate_fe_pct"]
    gmg = [e["engine_operating_work_index_kwh_t"] for e in oracles["gmg"]["examples"]]
    missing = _missing([
        f"{gmg[0]:.2f} and {gmg[1]:.2f} kWh/t",
        f"gravity recovery rising from {gravity[0]:.1f} to {gravity[-1]:.1f}% over the same bleeds",
        f"gold circulating load {gold[0]:.0f} to {gold[-1]:.0f}%",
        f"rises from {z[0]:.1f} to {z[1]:.1f}% Fe",
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
        f"({ridge['mean_pp']:.2f} points, 95% interval {ridge['interval_95_pp'][0]:.2f} to {ridge['interval_95_pp'][1]:.2f})",
    ])
    assert not missing, missing
