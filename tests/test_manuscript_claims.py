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
    summary_gp = s["gaussian_process"]
    nonlinear = [m for m in ORDER if m != "ridge"]
    copper = [folds[c]["mlp"]["recovery_pct"]["rmse"] for c in COPPER]
    unlike = [folds[c]["mlp"]["recovery_pct"]["rmse"] for c in UNLIKE]
    upgrade = [s[m]["log_upgrade"]["interpolation_r2"] for m in nonlinear]
    by_feature = guard["false_accept_by_feature"]
    seeds = learning["mlp_seeds"]["summary"]
    by_distance = {d["distance"]: d for d in guard["acceptance_by_distance"]}
    equal = learning["equal_rows"]

    def median(values):
        values = sorted(values)
        n = len(values)
        return values[n // 2] if n % 2 else (values[n // 2 - 1] + values[n // 2]) / 2

    # the orderings the prose asserts
    assert max(rec, key=lambda m: rec[m]["interpolation_r2"]) == "mlp"
    assert max(rec, key=lambda m: rec[m]["loco_rmse_mean"]) == "mlp"
    assert sorted(rec, key=lambda m: -rec[m]["loco_r2_median"])[:2] == ["hist_gradient_boosting", "mlp"]
    assert all(s[m]["log_upgrade"]["loco_r2_median"] < 0 for m in s)
    assert sorted(by_feature, key=lambda k: -by_feature[k])[:3] == ["crusher_css_mm", "circulating_load", "water_m3_t"]
    assert all(min(folds[c], key=lambda m: folds[c][m]["recovery_pct"]["rmse"]) == "mlp" for c in COPPER)
    # M-23: the forest's lower mean is not a ranking: it wins only 3 of 12 folds
    assert sum(folds[c]["random_forest"]["recovery_pct"]["rmse"] < folds[c]["hist_gradient_boosting"]["recovery_pct"]["rmse"] for c in folds) == 3
    magnetite = folds["iron_magnetite_fine"]
    assert min(magnetite, key=lambda m: magnetite[m]["recovery_pct"]["rmse"]) == "ridge"
    worst_energy = sorted(folds, key=lambda c: -folds[c]["mlp"]["specific_energy_total_kwh_t"]["rmse"])[:2]
    assert worst_energy == ["phosphate_clay", "iron_magnetite_fine"]
    # with the GRG gravity model the gold plant no longer fails for any model
    assert max(folds["gold_free_milling"][m]["recovery_pct"]["rmse"] for m in folds["gold_free_milling"]) < 20
    copper_upgrade = {m: median([folds[c][m]["log_upgrade"]["r2"] for c in COPPER]) for m in ORDER}
    missing = _missing([
        f"interpolates recovery best (RMSE {rec['mlp']['interpolation_rmse']:.2f} points)",
        f"transfers worst by mean error ({rec['mlp']['loco_rmse_mean']:.1f} points on average over the held-out plants at one training seed,"
        f" {min(seeds['recovery_pct']['loco_rmse_mean']):.1f} to {max(seeds['recovery_pct']['loco_rmse_mean']):.1f} over five)",
        f"median held-out R² ({rec['mlp']['loco_r2_median']:.3f}) is close to gradient boosting's ({rec['hist_gradient_boosting']['loco_r2_median']:.3f})",
        f"cost the perceptron {min(copper):.1f} to {max(copper):.1f} points",
        f"cost {min(unlike):.0f} and {max(unlike):.0f} points",
        f"(median held-out R² {min(energy[m]['loco_r2_median'] for m in nonlinear):.3f} to {max(energy[m]['loco_r2_median'] for m in nonlinear):.3f} for the four non-linear models)",
        f"flags {100 * guard['false_alarm_rate']:.1f}% of in-envelope states and accepts {100 * guard['false_accept_rate']:.1f}% of states pushed half a training range"
        f" outside the envelope, {100 * by_distance[0.1]['upward']:.0f}% of those pushed a tenth of it",
        f"({learning['interpolation']['train_rows']} training, {learning['interpolation']['test_rows']} test rows)",
        f"on {guard['probe_rows']:,} probes".replace(",", " "),
        f"interpolation RMSE runs from {min(seeds['recovery_pct']['interpolation_rmse']):.2f} to {max(seeds['recovery_pct']['interpolation_rmse']):.2f} points",
        f"({rec['hist_gradient_boosting']['loco_rmse_mean']:.2f} and {rec['random_forest']['loco_rmse_mean']:.2f} points)",
        f"interpolate recovery with an R² of {equal['random_forest']['recovery_pct']['r2']:.3f} and {equal['hist_gradient_boosting']['recovery_pct']['r2']:.3f} against the Gaussian process's {gp['recovery_pct']['r2']:.3f}",
        f"({magnetite['random_forest']['recovery_pct']['rmse']:.0f} and {magnetite['hist_gradient_boosting']['recovery_pct']['rmse']:.0f} points),"
        f" where ridge fails least ({magnetite['ridge']['recovery_pct']['rmse']:.0f})",
        f"from {energy['random_forest']['loco_r2_median']:.3f} (random forest) to {energy['gaussian_process']['loco_r2_median']:.3f} (Gaussian process)",
        f"gradient boosting ({energy['hist_gradient_boosting']['loco_rmse_mean']:.2f} kWh/t) and the random forest ({energy['random_forest']['loco_rmse_mean']:.2f}) lead",
        f"the perceptron's {energy['mlp']['loco_rmse_mean']:.2f} comes from the phosphate and magnetite circuits"
        f" ({folds['phosphate_clay']['mlp']['specific_energy_total_kwh_t']['rmse']:.1f} and {folds['iron_magnetite_fine']['mlp']['specific_energy_total_kwh_t']['rmse']:.1f} kWh/t)",
        f"(R² {min(upgrade):.3f} to {max(upgrade):.3f} for the four non-linear models)",
        f"the median held-out R² is {copper_upgrade['gaussian_process']:.2f} for the Gaussian process and gradient boosting and {copper_upgrade['mlp']:.2f} for the perceptron",
        f"cover {100 * gp['recovery_pct']['coverage_95']:.1f}% of the held-out recoveries (mean half-width {gp['recovery_pct']['mean_half_width']:.1f} points),"
        f" {100 * gp['log_upgrade']['coverage_95']:.1f}% of the upgrades and {100 * gp['specific_energy_total_kwh_t']['coverage_95']:.1f}% of the energies",
        f"and {100 * summary_gp['recovery_pct']['loco_coverage_pooled']:.1f}, {100 * summary_gp['log_upgrade']['loco_coverage_pooled']:.1f} and"
        f" {100 * summary_gp['specific_energy_total_kwh_t']['loco_coverage_pooled']:.1f}% under leave one case out",
        f"flags {100 * guard['false_alarm_rate']:.1f}% of the held-out in-envelope states and accepts {100 * guard['false_accept_rate']:.1f}% of the out-of-envelope probes",
        f"({100 * by_distance[0.5]['downward']:.1f}% below the minimum)",
        f"shift the crusher setting ({100 * by_feature['crusher_css_mm']:.0f}% accepted), the circulating load ({100 * by_feature['circulating_load']:.0f}%) or"
        f" the water ({100 * by_feature['water_m3_t']:.0f}%)",
    ])
    assert not missing, missing
    assert copper_upgrade["gaussian_process"] == copper_upgrade["hist_gradient_boosting"] or round(copper_upgrade["gaussian_process"], 2) == round(copper_upgrade["hist_gradient_boosting"], 2)
    assert all(gp[t]["coverage_95"] < 0.95 for t in ("recovery_pct", "log_upgrade", "specific_energy_total_kwh_t")), "the prose calls every interval too narrow"


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
        f"reaches the same optimum in {sum(1 for r in screened if r['same_optimum_without_screen'])} of the {len(screened)}",
        f"floatability drives recovery in {words[dominant['recovery_pct']['floatability']]} cases",
        f"liberation size drives concentrate grade in {words[grade['liberation_size']]} and the head grade in the other {words[grade['head_grade']]}",
    ])
    assert not missing, missing


def test_the_counts_and_the_verification_claims_quote_the_records():
    """W-26, W-27 (review of 0.07.000): the counts the draft quoted unpinned, and the verification claims it overstated
    (four examples with no qualifier, an "independent" port that reads the engine's own constant files)."""
    index = _read(DERIVED / "manifests" / "index.json")
    learning = _read(DERIVED / "learning.json")
    contract = _read(DERIVED / "contract" / "operating_contract.json")
    validation = _read(DERIVED / "validation.json")
    oracles = _read(DERIVED / "benchmark.json")["oracles"]
    particles = _read(DERIVED / "source" / "hzdr_particle_benchmark.json")["protocol"]
    geomet = _read(DERIVED / "source" / "geomet_lct_benchmark.json")
    net = oracles["molycop"]["comparison"]["net_specific_energy_kwh_t"]
    lap = oracles["laplante"]
    short = [p - e for p, e in zip(lap["published"]["grg_recovery_pct"], lap["engine"]["grg_recovery_pct"], strict=True)]
    words = {13: "thirteen"}
    assert lap["within_tolerance"] is False and 5.0 <= min(short) and max(short) < 11.0
    missing = _missing([
        f"reproduces all {index['n_variants']} committed states within 1e-6",
        f"All {index['n_variants']} committed states close within 1e-9",
        f"a ball-mill base case's net energy, {abs(100 * net['relative_error']):.1f}% below",
        f"net {net['published']:.2f} kWh/t, gross {oracles['molycop']['comparison']['gross_specific_energy_kwh_t']['published']:.2f}",
        "whose recovery it underestimates by 5 to 10 points",
        "it catches translation errors, not modelling errors",
        f"On a {learning['design']['rows']}-state design over",
        f"draws {learning['design']['per_case']} states the contract accepts",
        f"{learning['design']['rows']} in all",
        f"described by {len(learning['features'])} physical features",
        f"The operating point is {words[len(contract['inputs'])]} inputs declared once",
        f"training sheet ({particles['train_rows']:,} particles".replace(",", " "),
        f"test sheet ({particles['test_rows']:,} particles".replace(",", " "),
        f"{geomet['source']['usable_rows']} GeoMet locked-cycle copper recoveries from {geomet['source']['holes']} drill holes",
        f"({geomet['protocols']['hole']['paired_bootstrap']['samples']} resamples)",
        f"took {validation['seconds']['cases']:.0f} s for the cases on {validation['workers']} workers and {validation['seconds']['learning']:.0f} s for the learned lane",
    ])
    assert not missing, missing
    flat = _flat()
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
