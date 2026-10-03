"""S-19 (review of 2026-10-02): methodology pages 15 and 16 quote the real-samples record and the iron-plant lane;
every number they print is formatted here from the committed records and must appear in the page, so a new bake or
a lane re-run cannot leave either page describing the previous one. Until 0.08.000 no test read these pages."""
from __future__ import annotations

import json
import re
import statistics
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DERIVED = ROOT / "data" / "derived"
DOCS = ROOT / "docs" / "methodologies"


def _read(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def _flat(page: str) -> str:
    """A page with its line wrapping undone, so a quoted phrase can span lines."""
    return re.sub(r"\s+", " ", (DOCS / page).read_text(encoding="utf-8"))


def _missing(page: str, phrases: list[str]) -> list[str]:
    flat = _flat(page)
    return [p for p in phrases if p not in flat]


def test_page_15_quotes_the_real_samples_record():
    r = _read(DERIVED / "real_samples.json")
    s, sens = r["summary"], r["sensitivity"]
    gap = s["engine_minus_measured_pp"]
    lane = [v["rmse"] for v in s["geomet_lane_minus_measured_pp"].values()]
    curve = {row["p80_um"]: row for row in sens["gap_by_assumed_p80"]}
    hosts, target = sens["hosts"], sens["target_grind_throughput"]
    p80 = [m["metrics"]["p80_um"] for m in r["samples"]]
    magnetite = [100.0 * m["allocation"]["fractions"]["magnetite"] for m in r["samples"]]
    shares = {k: statistics.median(100.0 * m["allocation"]["copper_shares"][k] for m in r["samples"]) for k in ("bornite", "chalcocite")}
    grid = {(g["bornite"], g["chalcocite_to_bornite"]): g for g in sens["ratio_grid"]}
    declared = (r["floatability_ratios"]["bornite"], r["floatability_ratios"]["chalcocite_to_bornite"])
    bornite = sorted({k[0] for k in grid})
    chalcocite = sorted({k[1] for k in grid})
    base_150, base_720 = hosts["soft_720_sized_150"]["mean_gap_pp"], hosts["soft_720_record"]["mean_gap_pp"]
    assert grid[declared]["sized_150"]["mean_gap_pp"] == base_150 and abs(grid[declared]["at_720"]["mean_gap_pp"] - base_720) < 1e-9

    def moves(key: str) -> list[float]:
        base = base_150 if key == "sized_150" else base_720
        return [abs(sens["allocation_alternative"][key]["mean_gap_pp"] - base), abs(sens["no_magnetite"][key]["mean_gap_pp"] - base),
                abs(grid[(bornite[0], declared[1])][key]["mean_gap_pp"] - grid[(bornite[-1], declared[1])][key]["mean_gap_pp"]),
                abs(grid[(declared[0], chalcocite[0])][key]["mean_gap_pp"] - grid[(declared[0], chalcocite[-1])][key]["mean_gap_pp"])]

    sized, at_720 = moves("sized_150"), moves("at_720")
    low_ratio = sorted(grid[(b, chalcocite[0])]["sized_150"]["pearson"] for b in bornite)
    pearson = [row["pearson"] for row in sens["gap_by_assumed_p80"]]
    spread = [row["engine_sd_pp"] for row in sens["gap_by_assumed_p80"]]
    sign = [a for a, b in zip(sorted(curve), sorted(curve)[1:]) if curve[a]["mean_gap_pp"] > 0 > curve[b]["mean_gap_pp"]]
    assert len(sign) == 1 and (sign[0], sorted(curve)[sorted(curve).index(sign[0]) + 1]) == (160.0, 165.0)
    assert (bornite[0], bornite[-1], chalcocite[0], chalcocite[-1]) == (0.62, 0.8, 0.67, 2.5)
    wi = s["work_index_kwh_t"]
    missing = _missing("15_real-samples.md", [
        f"this gives {wi['min']:.1f} to {wi['max']:.1f} kWh/t, median {wi['median']:.1f}",
        f"One sample falls in the first band, {s['bands']['chalcopyrite_bornite']} in the second and {s['bands']['bornite_chalcocite']} in the third",
        f"{s['work_index_assignment']['nearest_in_hole']} of the {s['samples']} take one from their hole",
        f"In the median sample bornite carries {shares['bornite']:.0f}% of the copper and chalcocite {shares['chalcocite']:.0f}%",
        f"({min(magnetite):.1f} to {max(magnetite):.0f}% of the ore)",
        f"(P80 {min(p80):.0f} to {max(p80):.0f} um against the 150 um target)",
        f"The engine is {-gap['mean']:.1f} points below the measurement on average (RMSE {gap['rmse']:.1f} points; {-gap['max']:.1f} to {-gap['min']:.1f} points below)",
        f"are within {min(lane):.1f} to {max(lane):.1f} points RMSE",
        f"| the soft porphyry's circuit at 720 t/h (the record) | {base_720:.1f} | {hosts['soft_720_record']['rmse_pp']:.1f} |",
        f"| the hard porphyry's circuit at its nominal point | {hosts['hard_nominal']['mean_gap_pp']:.1f} | {hosts['hard_nominal']['rmse_pp']:.1f} |",
        f"| the mill sized for a 150 um product | {base_150:+.1f} | {hosts['soft_720_sized_150']['rmse_pp']:.1f} |",
        f"| each sample at the throughput that gives 150 um ({target['tph']['min']:.0f} to {target['tph']['max']:.0f} t/h) | {target['mean_gap_pp']:+.1f} | {target['rmse_pp']:.1f} |",
        f"the gap runs from {curve[75.0]['mean_gap_pp']:+.1f} points at 75 um to {curve[300.0]['mean_gap_pp']:.1f} at 300 um and changes sign between 160 and 165 um",
        f"Of the {target['mean_gap_pp']:+.1f} points at each sample's own target-grind throughput, {target['residence_share_pp']:.1f} come from the longer flotation residence",
        f"(Pearson r between {min(pearson):.2f} and {max(pearson):.2f}), and it varies by {min(spread):.1f} to {max(spread):.1f} points across the samples against the tests' {sens['measured_population_sd_pp']:.1f}",
        f"with chalcocite at {chalcocite[0]:g} of bornite, the low end of its range, r is {low_ratio[0]:.2f} to {low_ratio[-1]:.2f}",
        f"the alternative allocation moves the mean by {sized[0]:.1f} points, removing the magnetite by {sized[1]:.1f}, the bornite ratio over its range (0.62 to 0.80) by {sized[2]:.1f} and the chalcocite ratio over its range (0.67 to 2.5 times bornite) by {sized[3]:.1f}",
        f"At 720 t/h the same four move it by {at_720[0]:.1f}, {at_720[1]:.1f}, {at_720[2]:.1f} and {at_720[3]:.1f}",
        f"a sample's recovery falls by {-sens['work_index']['recovery_per_kwh_t_median']:.1f} points per kWh/t",
        f"Taking the deposit median for every sample gives {sens['work_index']['deposit_median_for_all']['mean_gap_pp']:.1f} points",
        f"anywhere in the deposit gives {sens['work_index']['global_nearest']['mean_gap_pp']:.1f}",
        f"reaches the 150 um target ({target['tph']['min']:.0f} t/h)",
    ])
    assert not missing, missing
    contract = _read(DERIVED / "contract" / "operating_contract.json")
    floor = contract["cases"]["copper_porphyry_soft"]["inputs"]["throughput_tph"]["min"]
    assert floor == 360.0 and target["tph"]["min"] < floor and "360 t/h" in _flat("15_real-samples.md")


def test_page_16_quotes_the_iron_plant_record():
    a = _read(DERIVED / "source" / "iron_plant_soft_sensor.json")
    q, h = a["quality"], a["held_labels"]
    score, clean = a["pooled_scores"], h["pooled_scores_without"]
    diff = {(c["a"], c["b"], c["metric"]): c for c in a["comparisons"]}
    without = {(c["a"], c["b"], c["metric"]): c for c in h["comparisons_without"]}
    slopes = [f["ar1"]["slope"] for f in a["folds"]]
    mm, rr = diff[("ridge_with_previous_lab", "ar1_previous_lab", "mae")], diff[("ridge_with_previous_lab", "ar1_previous_lab", "rmse")]
    all_pairs, held_out = diff[("ar1_previous_lab", "previous_lab", "mae")], without[("ar1_previous_lab", "previous_lab", "mae")]

    def row(name: str, model: str) -> str:
        cells = [score[model]["mae_pct_points"], clean[model]["mae_pct_points"], score[model]["rmse_pct_points"], clean[model]["rmse_pct_points"]]
        return f"| {name} | " + " | ".join(f"{v:.3f}" for v in cells) + " |"

    later = sorted(score[m]["mae_pct_points"] for m in score if m not in ("previous_lab", "ar1_previous_lab", "ridge_with_previous_lab"))
    missing = _missing("16_industrial-soft-sensor.md", [
        f"{q['source_rows']:,} rows",
        f"about 180 rows per hour ({q['rows_per_hour_min']} to {q['rows_per_hour_max']})",
        f"In {q['changing_lab_hours_excluded']} nominal hours the silica label changes",
        f"excluded whole ({q['changing_lab_rows_excluded']:,} rows)",
        f"That gives {a['protocol']['pair_rows']:,} pairs",
        f"($b$ = {min(slopes):.3f} to {max(slopes):.3f})",
        f"| previous laboratory assay | {score['previous_lab']['mae_pct_points']:.3f} | {score['previous_lab']['rmse_pct_points']:.3f} |",
        f"| fitted last assay (AR(1)) | {score['ar1_previous_lab']['mae_pct_points']:.3f} | {score['ar1_previous_lab']['rmse_pct_points']:.3f} |",
        f"| ridge with the previous assay | {score['ridge_with_previous_lab']['mae_pct_points']:.3f} | {score['ridge_with_previous_lab']['rmse_pct_points']:.3f} |",
        f"follow at {later[0]:.2f} to {later[-1]:.2f} points of MAE",
        f"ridge is {score['train_mean']['mae_pct_points'] - score['ridge']['mae_pct_points']:.3f} points below it",
        f"by {mm['difference_pct_points']:.3f} points of MAE and {rr['difference_pct_points']:.3f} of RMSE",
        f"are {mm['interval_95'][0]:.3f} to {mm['interval_95'][1]:.3f} and {rr['interval_95'][0]:.3f} to {rr['interval_95'][1]:.3f}",
        f"{100 * a['repeated_assay_share']:.0f}% of the test hours repeat the previous assay exactly",
        f"without the pairs that touch a held run it is {100 * h['repeated_assay_share_without']:.0f}%",
        # S-16: the held runs and the scores without the pairs that touch them
        f"{h['held_runs']} runs, {h['held_hours']} hours, the longest {h['longest_run_hours']} hours from {h['longest_run_first_hour'][:16]} at {h['longest_run_silica_pct']:.2f}%",
        f"{h['repeated_label_hours']} valid hours repeat the previous hour's silica, and {h['repeated_both_assays_hours']} of them repeat both assays",
        f"{h['pairs_touching']} of the {a['protocol']['pair_rows']:,} pairs touch a held run",
        f"on the other {h['pairs_without']:,} pairs",
        row("previous laboratory assay", "previous_lab"), row("fitted last assay (AR(1))", "ar1_previous_lab"),
        row("ridge with the previous assay", "ridge_with_previous_lab"), row("training mean", "train_mean"), row("ridge, sensors", "ridge"),
        f"ridge moves from {score['train_mean']['mae_pct_points'] - score['ridge']['mae_pct_points']:.3f} points below the training mean to {clean['ridge']['mae_pct_points'] - clean['train_mean']['mae_pct_points']:.3f} above it",
        f"beyond the interval ({all_pairs['difference_pct_points']:.3f} points, {all_pairs['interval_95'][0]:.3f} to {all_pairs['interval_95'][1]:.3f})",
        f"it is not ({held_out['difference_pct_points']:.3f} points, {held_out['interval_95'][0]:.3f} to {held_out['interval_95'][1]:.3f})",
    ])
    assert not missing, missing
    assert h["run_hours_min"] == 3 and "three or more consecutive valid hours" in _flat("16_industrial-soft-sensor.md")
    for scores in (score, clean):
        assert min(scores, key=lambda m: scores[m]["mae_pct_points"]) == "previous_lab"
        assert min(scores, key=lambda m: scores[m]["rmse_pct_points"]) == "ar1_previous_lab"


def _cases() -> list[dict]:
    index = _read(DERIVED / "manifests" / "index.json")
    return [_read(DERIVED / "cases" / f"{entry['case_id']}.json") for entry in index["cases"]]


def _missing_doc(relative: str, phrases: list[str]) -> list[str]:
    flat = re.sub(r"\s+", " ", (ROOT / "docs" / relative).read_text(encoding="utf-8"))
    return [p for p in phrases if p not in flat]


def test_page_17_and_contract_04_quote_the_particle_record():
    """W-15 (review of 0.07.000): the particle lane's own pages, held to its record."""
    r = _read(DERIVED / "source" / "hzdr_particle_benchmark.json")
    p = r["protocol"]
    cases = {c["case"]: c for c in r["cases"]}
    rmse = {k: {m: c["models"][m]["rmse"] for m in ("published_reference", "l1_logistic", "particle_mlp")} for k, c in cases.items()}

    def row(case: str, label: str) -> str:
        v = rmse[case]
        return f"| {label} | {v['published_reference']:.4f} | {v['l1_logistic']:.4f} | {v['particle_mlp']:.4f} |"

    four = cases["4"]
    missing = _missing_doc("methodologies/17_particle-lane.md", [
        f"Its training sheet holds {p['train_rows']:,} particles",
        f"Its test sheet holds {p['test_rows']:,} particles",
        f"15% of it ({p['validation_rows']:,} rows, stratified by the first case's class, seed {p['seed']})",
        f"(epoch {p['mlp_best_epoch']} in the record)",
        row("1", "1"), row("2", "2"), row("3", "3"), row("4", f"4 ({four['test_rows']:,} rows)"),
        f"the same {four['test_rows']:,} finite test rows of that case ({four['excluded_test_rows']:,} excluded)",
        f"use all {p['test_rows']:,} rows",
        f"({rmse['2']['particle_mlp']:.4f} against {rmse['2']['published_reference']:.4f})",
    ])
    assert not missing, missing
    # the comparisons the page states in words
    assert [k for k in "1234" if rmse[k]["l1_logistic"] < rmse[k]["particle_mlp"]] == ["1", "2"]
    assert [k for k in "1234" if rmse[k]["l1_logistic"] < rmse[k]["published_reference"]] == ["1", "2", "3"]
    assert [k for k in "1234" if rmse[k]["particle_mlp"] < rmse[k]["published_reference"]] == ["1", "3", "4"]
    assert all(c["test_rows"] == p["test_rows"] for k, c in cases.items() if k != "4")
    missing = _missing_doc("data-contract/04_particle-lane.md", [
        f"Train data ({p['train_rows']:,} rows)", f"Test data ({p['test_rows']:,} rows)",
        f"`fit_rows` {p['fit_rows']:,}, `validation_rows` {p['validation_rows']:,}",
        f"Case 4 is scored on {four['test_rows']:,} rows ({four['excluded_test_rows']:,} left out); the others on all {p['test_rows']:,}",
        r["source"]["sha256"],
    ])
    assert not missing, missing


def test_page_18_and_contract_05_quote_the_geomet_record():
    """W-15 (review of 0.07.000): the GeoMet lane's own pages, held to its record and to the real samples."""
    g = _read(DERIVED / "source" / "geomet_lct_benchmark.json")
    s, hole, zone = g["source"], g["protocols"]["hole"], g["protocols"]["zone"]
    parts, loho = hole["robust"]["repeated_partitions"], hole["robust"]["leave_one_hole_out"]
    gain = parts["ridge_gain_over_mean_pp"]
    published = hole["paired_bootstrap"]["rmse_differences"]["train_mean-ridge"]
    order = ("train_mean", "ridge", "random_forest", "gaussian_process")

    def row(name: str, protocol: dict) -> str:
        return f"| {name} | " + " | ".join(f"{protocol['scores'][m]['rmse_pp']:.4f}" for m in order) + " |"

    def span(values: list[int]) -> str:
        return f"{min(values)} or {max(values)}"

    def pair(d: dict, unit: str = "") -> str:
        low, high = d["interval_adjusted_pp"]
        return f"{d['difference_pp']:.2f}{unit} ({low:.2f} to {high:.2f})"

    missing = _missing_doc("methodologies/18_geomet-lane.md", [
        f"holds {s['raw_rows']} locked-cycle tests",
        f"(source row {s['exclusions'][0]['source_row']})",
        f"so {s['usable_rows']} tests in {s['holes']} holes remain",
        s["md5"],
        f"({span([f['train_rows'] for f in hole['folds']])} training tests, {span([f['test_rows'] for f in hole['folds']])} held out, "
        f"{span([f['test_holes'] for f in hole['folds']])} holes)",
        f"({span([f['train_rows'] for f in zone['folds']])} training tests, {span([f['test_rows'] for f in zone['folds']])} held out)",
        f"{hole['paired_bootstrap']['samples']} resamples (seed {hole['paired_bootstrap']['seed']})",
        f"{parts['partitions']} random five-fold hole partitions (seed {parts['partition_seed']})",
        f"a bootstrap of {parts['samples']} resamples", f"(seed {loho['seed']})",
        row("Hole", hole), row("Zone", zone),
        f"ridge beats the training mean by {published['mean_pp']:.2f} points (95% interval {published['interval_95_pp'][0]:.2f} to "
        f"{published['interval_95_pp'][1]:.2f})",
        f"at the {gain['published_percentile']}th percentile", f"whose mean is {gain['mean']:.2f}",
        f"the gain is {pair(parts['rmse_differences']['train_mean-ridge'], ' points')}",
        f"leaving one hole out it is {pair(loho['rmse_differences']['train_mean-ridge'])}",
    ])
    assert not missing, missing
    real = _read(DERIVED / "real_samples.json")["summary"]
    missing = _missing_doc("data-contract/05_geomet-lane.md", [
        f"`flotation.csv` ({s['raw_rows']} rows)", f"`comminution.csv` ({real['comminution_samples']} rows)",
        f"pinned at {s['usable_rows']} usable tests and {len(s['exclusions'])} exclusion (source row {s['exclusions'][0]['source_row']}",
        f"({real['work_index_assignment']['nearest_in_hole']} and {real['work_index_assignment']['deposit_median']} tests)",
        f"`raw_rows` {s['raw_rows']}, `usable_rows` {s['usable_rows']}, `holes` {s['holes']}",
    ])
    assert not missing, missing


def test_page_12_quotes_the_optimizer_records():
    """Page 12 said the Benchmark page's claims test held its numbers; that test reads the Benchmark page only, and
    page 12 kept the 0.07 screen counts after the 0.08 records changed them. Every number it quotes is held here."""
    bench = _read(DERIVED / "benchmark.json")
    records = [(c, v, r) for c, variants in bench["optimization"].items() for v, r in variants.items()]
    feasible = [x for x in records if x[2]["status"] == "optimal"]
    target = [x for x in records if not x[1].startswith("cut_")]
    cut = [x for x in records if x[1].startswith("cut_")]
    gains = sorted((r["gain_pct"], c, v) for c, v, r in records if r["gain_pct"] is not None)
    nominal = sorted((v["nominal"]["gain_pct"], c) for c, v in bench["optimization"].items())
    cut_gains = sorted((r["gain_pct"], c) for c, _, r in cut)
    active = {n: sum(1 for x in feasible if n in x[2]["active"]) for n in ("power", "grade", "water")}
    screened = [x for x in records if x[2]["screened"]]
    with_screen = sum(r["evaluations"] for _, _, r in screened)
    without = sum(r["evaluations_without_screen"] for _, _, r in screened)
    change = [r["evaluations"] - r["evaluations_without_screen"] for _, _, r in screened]
    cases = {c: _read(DERIVED / "cases" / f"{c}.json") for c in bench["optimization"]}
    rejected = {"guard": 0, "interval": 0}
    for c, v, _ in screened:
        variant = next(x for x in cases[c]["variants"] if x["id"] == v)
        for start in variant["methods"]["optimization"]["starts"]:
            for reason in rejected:
                rejected[reason] += start["screen"]["rejected"][reason]
    errors = [r["surrogate_abs_error_pp"] for _, _, r in screened if r["surrogate_abs_error_pp"] is not None]
    same = sum(1 for _, _, r in screened if r["same_optimum_without_screen"])
    trade = []
    for c in bench["optimization"]:
        optimum, last = cases[c]["variants"][0]["methods"]["optimization"]["optimum"], bench["optimization"][c]["nominal"]["path"][-1]
        trade.append((c, 100 * (1 - last["energy_kwh_t"] / optimum["values"]["energy_kwh_t"]), 100 * (1 - last["recovered_tph"] / optimum["recovered_tph"])))
    moved = [t for t in trade if t[0] != "iron_magnetite_fine"]
    still = next(t for t in trade if t[0] == "iron_magnetite_fine")
    assert abs(still[1]) < 1e-9 and abs(still[2]) < 1e-9 and "grade" in bench["optimization"]["iron_magnetite_fine"]["nominal"]["active"]
    worst = 0.0
    for c, v, r in feasible:
        if not all(s["status"] == "optimal" for s in r["path"]):
            continue
        optimum = next(x for x in cases[c]["variants"] if x["id"] == v)["methods"]["optimization"]["optimum"]
        for series in ([optimum["values"]["energy_kwh_t"], *[s["energy_kwh_t"] for s in r["path"]]], [optimum["recovered_tph"], *[s["recovered_tph"] for s in r["path"]]]):
            worst = max(worst, *(b / a - 1 for a, b in zip(series, series[1:])))
    names = {"iron_magnetite_fine": "magnetite", "copper_oxide": "oxide copper", "zinc_sulfide": "zinc"}
    infeasible = sorted(v for c, v, r in records if r["status"] != "optimal")
    assert infeasible == ["harder_ore", "higher_throughput"]
    assert gains[0][1:] == ("iron_magnetite_fine", "coarser_grind") and gains[-1][1:] == ("copper_oxide", "coarser_grind")
    page = "12_optimization.md"
    missing = _missing(page, [
        f"{len(feasible)} of the {len(records)} variants reach an optimum",
        f"{sum(1 for x in target if not x[2]['base_feasible'])} of the {len(target)} target-mode variants break a constraint as run; "
        f"the {len(cut)} cut-mode variants break {'none' if all(x[2]['base_feasible'] for x in cut) else 'some'}",
        f"runs from {gains[0][0]:.1f}% (magnetite, coarser grind", f"to +{gains[-1][0]:.1f}% (oxide copper, coarser grind)",
        f"from {nominal[0][0]:.1f}% ({names[nominal[0][1]]}) to {nominal[-1][0]:.1f}% ({names[nominal[-1][1]]})",
        f"in the cut mode from {cut_gains[0][0]:.1f}% ({names[cut_gains[0][1]]}) to {cut_gains[-1][0]:.1f}% ({names[cut_gains[-1][1]]})",
        f"Installed power at {active['power']} of the {len(feasible)} optima, and at all {sum(1 for x in cut if 'power' in x[2]['active'])} in the cut mode; "
        f"the grade specification at {active['grade']}; the water capacity at {active['water']}",
        f"Over the {len(screened)} screened variants the search spent {with_screen:,} engine evaluations, and the same starts and weight "
        f"without the screen {without:,}: {100 * (with_screen / without - 1):.1f}% more with the screen",
        f"It took fewer evaluations in {sum(c < 0 for c in change)} variant{'' if sum(c < 0 for c in change) == 1 else 's'}, more in {sum(c > 0 for c in change)} and the same in {sum(c == 0 for c in change)}",
        f"Of the {sum(r['screened_candidates'] for _, _, r in screened):,} candidates screened, the guard rejected {rejected['guard']:,} and the interval "
        f"{rejected['interval']:,}; the engine evaluated the best passing candidate {sum(r['proposed'] for _, _, r in screened):,} times, and "
        f"{sum(r['improved'] for _, _, r in screened)} of those became an incumbent",
        f"in {same} of the {len(screened)} variants it ends at the same decisions",
        f"the surrogate's recovery was on average {sum(errors) / len(errors):.2f} points from the engine's (the mean of the variants' means; "
        f"{max(errors):.2f} at worst)",
        f"the nominal optima spend {min(t[1] for t in moved):.0f} to {max(t[1] for t in moved):.0f}% less energy per tonne and recover "
        f"{min(t[2] for t in moved):.0f} to {max(t[2] for t in moved):.0f}% less metal",
        f"beyond {worst:.1e} relative".replace("e-0", "e-"),
    ])
    assert not missing, missing


def test_page_06_quotes_the_gravity_oracle():
    """The rebuilt gravity page quotes the like-for-like Laplante oracle; no test read it."""
    lap = _read(DERIVED / "benchmark.json")["oracles"]["laplante"]
    e, p, w, audit = lap["engine"], lap["published"], lap["without_grg_below_25um"], lap["audit"]
    low = [-d for d in e["grg_recovery_difference_points"]]
    below = [-r for r in e["grg_circulating_load_relative_error"]]
    w_below = [-r for r in w["grg_circulating_load_relative_error"]]
    assert lap["within_tolerance"] is False and e["fit_at_bound"] and w["fit_at_bound"] is False
    assert w["grg_recovery_difference_points"][0] < -4 and max(abs(d) for d in w["grg_recovery_difference_points"][1:]) < 1.1
    missing = _missing("06_gravity-gold.md", [
        f"the GRG recovery is {e['grg_recovery_pct'][0]:.1f} to {e['grg_recovery_pct'][-1]:.1f}% against "
        # the published 95.85 is printed half up, as the manuscript's test does
        f"{p['grg_recovery_pct'][0] + 1e-9:.1f} to {p['grg_recovery_pct'][-1] + 1e-9:.1f}%, {low[0]:.1f} to {low[-1]:.1f} points low",
        f"The GRG circulating load is {100 * min(below):.0f} to {100 * max(below):.0f}% below the printed "
        f"{p['grg_circulating_load_pct'][0]:.0f} to {p['grg_circulating_load_pct'][-1]:.0f}%",
        f"{min(e['grg_to_overflow_pct']):.0f} to {max(e['grg_to_overflow_pct']):.0f}% of the GRG leaves by the overflow",
        f"{min(e['discharge_grg_below_150um_pct']):.1f} to {max(e['discharge_grg_below_150um_pct']):.1f}% of the mill discharge's GRG "
        "lies below 150 um, against the printed 87.7%",
        f"the fitted $R_{{max}}$ is {w['max_recovery']:.2f}",
        f"within {max(abs(d) for d in w['grg_recovery_difference_points'][1:]):.1f} points from the 20% row on "
        f"({-w['grg_recovery_difference_points'][0]:.1f} points low at 10%)",
        f"the circulating load stays {100 * min(w_below):.0f} to {100 * max(w_below):.0f}% low",
        f"the engine's GRG circulates at {audit['grg_circulating_load_pct']:.0f}% of its feed",
        f"gold grade ratio of {p['audit']['underflow_au_gpt'] / p['audit']['overflow_au_gpt']:.1f} and "
        f"{100 * p['audit']['underflow_grg_share']:.0f}% GRG in the underflow gold; the engine gives "
        f"{audit['underflow_over_overflow_au_grade']:.1f} and {100 * audit['underflow_grg_share']:.0f}%",
    ])
    assert not missing, missing


def test_pages_04_and_09_quote_the_records():
    """Page 04's Plitt sizing failure (E-07) and page 09's oversize-feed disclosure (E-18), held to the oracle and case
    records; their engine tests pinned the numbers but never read the pages."""
    import math

    sizing = _read(DERIVED / "benchmark.json")["oracles"]["molycop"]["sizing"]
    ex, r = sizing["examples"], sizing["ratio"]
    sim, par = ex["BallSim_Direct"], ex["BallParam_Direct"]

    def ratio(example: dict, key: str, published: str) -> float:
        return example["plitt_at_published_flow"][key] / example["published"][published]

    cases = _cases()
    solids = [a["variants"][0]["trace"]["metrics"]["cyclone_feed_solids_vol_pct"] for a in cases]
    missing = _missing("04_classification.md", [
        f"(a1 {sim['molycop_constants']['a1']:.3f} and {par['molycop_constants']['a1']:.3f} on the pressure, "
        f"a2 {sim['molycop_constants']['a2']:.3f} and {par['molycop_constants']['a2']:.3f} on the cut)",
        f"the engine's Plitt cut is {ratio(sim, 'cut_um', 'd50c_um'):.2f} and {ratio(par, 'cut_um', 'd50c_um'):.2f} times the published corrected "
        f"cut and its pressure {ratio(sim, 'pressure_kpa', 'pressure_kpa'):.1f} and {ratio(par, 'pressure_kpa', 'pressure_kpa'):.1f} times",
        f"differ in the ratio {r['engine_cut']:.2f} on the cut and {r['engine_pressure']:.2f} on the pressure, against "
        f"{r['molycop_a2']:.2f} and {r['molycop_a1']:.2f} between Moly-Cop's own constants",
        f"the engine sizes {sim['sized_for_published_cut']['cyclones']} cyclones at {sim['sized_for_published_cut']['pressure_kpa']:.0f} kPa against the "
        f"published {sim['published']['cyclones']} at {sim['published']['pressure_kpa']:.0f} kPa",
        f"feed their cyclones at {min(solids):.0f} to {max(solids):.0f}% solids by volume against Moly-Cop's {sim['feed_solids_vol_pct']:.0f}%",
    ])
    assert not missing, missing
    # E-18: Rowland's EF4 at F0 = 4000 (13/Wi)^0.5 um on every nominal mill, from the case records
    ratios, ef4, eff, eff4, feeds = [], [], [], [], []
    for a in cases:
        m, wi = a["variants"][0]["trace"]["metrics"], a["nominal"]["work_index_kwh_t"]
        f0 = 4000.0 * math.sqrt(13.0 / wi)
        rr = m["crusher_p80_um"] / m["p80_um"]
        factor = (rr + (wi - 7.0) * (m["crusher_p80_um"] - f0) / f0) / rr
        feeds.append(m["crusher_p80_um"]), ratios.append(m["crusher_p80_um"] / f0), ef4.append(factor)
        eff.append(m["bond_efficiency_ratio"]), eff4.append(m["bond_efficiency_ratio"] * factor)
    assert max(feeds) - min(feeds) < 1.0
    missing = _missing("09_energy.md", [
        f"the crusher product of {feeds[0] / 1000:.1f} mm, {min(ratios):.1f} to {max(ratios):.1f} times Rowland's optimum feed size, "
        f"where EF4 would be {min(ef4):.2f} to {max(ef4):.2f} and raise the efficiency ratio from {min(eff):.2f} to {max(eff):.2f} "
        f"to {min(eff4):.2f} to {max(eff4):.2f}",
    ])
    assert not missing, missing


def test_page_13_quotes_the_nominal_uncertainty_records():
    """Page 13's two nominal cases, held to their uncertainty and Sobol records."""
    soft = _read(DERIVED / "cases" / "copper_porphyry_soft.json")["variants"][0]
    magnetite = _read(DERIVED / "cases" / "iron_magnetite_fine.json")["variants"][0]
    u, st = soft["methods"]["uncertainty"], soft["methods"]["sensitivity"]["indices"]
    driver = {o: max(st[o]["ST"], key=st[o]["ST"].get) for o in st}
    assert driver == {"recovery_pct": "floatability", "concentrate_grade": "liberation_size",
                      "specific_energy_grinding_kwh_t": "work_index", "recovered_primary_tph": "head_grade"}
    m = magnetite["methods"]["uncertainty"]
    missing = _missing("13_uncertainty-sensitivity.md", [
        f"recovery P05 to P95 of {u['outputs']['recovery_pct']['p05']:.1f} to {u['outputs']['recovery_pct']['p95']:.1f}%",
        f"in {100 * u['probabilities']['power_within_installed']:.0f}% of the samples, because a harder ore trips the power limit",
        f"(total index about {st['recovery_pct']['ST']['floatability']:.1f})",
        f"liberation size drives grade (about {st['concentrate_grade']['ST']['liberation_size']:.1f})",
        f"the work index drives grinding energy (about {st['specific_energy_grinding_kwh_t']['ST']['work_index']:.2f})",
        f"head grade drives recovered metal (about {st['recovered_primary_tph']['ST']['head_grade']:.2f})",
        f"meets its 65% Fe specification in {100 * m['probabilities']['grade_meets_spec']:.0f}% of the samples",
        f"nominal grade ({magnetite['trace']['metrics']['concentrate_grade']:.1f}%)",
    ])
    assert not missing, missing


def test_contract_06_and_03_quote_their_records():
    """W-14 (review of 0.07.000): the iron-plant contract page and the studies schema, held to the records."""
    a = _read(DERIVED / "source" / "iron_plant_soft_sensor.json")
    q, h = a["quality"], a["held_labels"]
    traced = max(len(f["trace"]) for f in a["folds"])
    missing = _missing_doc("data-contract/06_iron-plant.md", [
        f"The CSV has {q['source_rows']:,} rows and 24 columns",
        f"{q['changing_lab_hours_excluded']} of the {q['nominal_hours']:,} nominal hours ({q['changing_lab_rows_excluded']:,} rows)",
        f"({a['protocol']['pair_rows']:,} pairs)", f"({h['held_runs']} runs, {h['held_hours']} hours)",
        f"a `trace` of up to {traced} test hours", "the 21 `features`", a["source"]["archive_sha256"],
        f"{({8: 'eight'})[len(a['comparisons'])]} paired differences",
    ])
    assert not missing, missing
    assert len(a["protocol"]["features"]) == 21 and len(a["pooled_scores"]) == 8
    st = _read(DERIVED / "studies.json")
    off = sum(1 for c in st["cases"].values() for rec in c["ablations"].values() if rec["status"] == "not_applicable")
    pairs = sum(len(c["ablations"]) for c in st["cases"].values())
    seed = next(iter(st["cases"].values()))["seed_study"]
    missing = _missing_doc("data-contract/03_case-artifacts.md", [
        f"{off} of the {pairs} case-switch pairs are not applicable",
        f"`seeds` ({seed['seeds'][0]} to {seed['seeds'][-1]} in steps of {seed['seeds'][1] - seed['seeds'][0]}), `samples` ({seed['samples']} per seed)",
        "(`" + "`, `".join(st["switches"]) + "`)",
    ])
    assert not missing, missing
