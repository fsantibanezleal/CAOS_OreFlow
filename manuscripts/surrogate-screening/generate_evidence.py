"""Generate the optimization-paper figures and tables from committed records."""
from __future__ import annotations

import json
import argparse
import hashlib
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
FIG = HERE / "figures"


def load(path: str) -> dict:
    return json.loads((ROOT / path).read_text(encoding="utf-8"))


def tex(value: object) -> str:
    out = str(value)
    for old, new in (("\\", r"\textbackslash{}"), ("&", r"\&"), ("%", r"\%"),
                     ("_", r"\_"), ("#", r"\#"), ("$", r"\$")):
        out = out.replace(old, new)
    return out


def figure(name: str) -> None:
    plt.tight_layout()
    plt.savefig(FIG / f"{name}.pdf", bbox_inches="tight", metadata={"Creator": "OreFlow evidence generator"})
    plt.close()


def table(label: str, caption: str, headers: list[str], rows: list[list[object]]) -> str:
    align = "l" + "r" * (len(headers) - 1)
    lines = [r"\begin{table}[htbp]", r"\centering", r"\small", rf"\caption{{{caption}}}",
             rf"\label{{{label}}}", rf"\begin{{tabular}}{{{align}}}", r"\toprule",
             " & ".join(map(tex, headers)) + " " + chr(92) * 2, r"\midrule"]
    lines.extend(" & ".join(map(tex, row)) + r" \\" for row in rows)
    lines.extend([r"\bottomrule", r"\end{tabular}", r"\end{table}"])
    return "\n".join(lines)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--guard-ablation", type=Path,
                        help="completed five-policy JSON from run_guard_ablations.py")
    args = parser.parse_args()
    FIG.mkdir(parents=True, exist_ok=True)
    records = []
    for path in sorted((ROOT / "data/derived/cases").glob("*.json")):
        case = load(path.relative_to(ROOT).as_posix())
        for variant in case["variants"]:
            opt = variant.get("methods", {}).get("optimization", {})
            if opt.get("screened") and opt.get("without_screen"):
                records.append({"case": case["case_id"], "family": case["family"], "variant": variant["id"], "opt": opt})
    if len(records) != 72:
        raise ValueError(f"Expected 72 screened target-mode pairs, found {len(records)}")

    plain = np.array([r["opt"]["without_screen"]["evaluations"] for r in records], dtype=float)
    screened = np.array([r["opt"]["evaluations"] for r in records], dtype=float)
    delta = screened - plain
    same = 0
    for row in records:
        opt = row["opt"]
        screened_end, plain_end = opt.get("optimum") or {}, opt["without_screen"]
        if screened_end.get("feasible") and plain_end.get("status") == "optimal":
            same += all(abs(screened_end["decisions"][key] - plain_end["decisions"][key]) < 1e-12
                        for key in screened_end["decisions"])
        else:
            same += opt["status"] == plain_end["status"] and not screened_end.get("feasible")
    decision_delta = np.array([abs((r["opt"].get("optimum") or {}).get("recovered_tph", 0.0) -
                                   (r["opt"]["without_screen"].get("recovered_tph") or 0.0)) for r in records])
    proposals, guard, interval, selected, improved = [], 0, 0, 0, 0
    for row in records:
        for start in row["opt"]["starts"]:
            screen = start.get("screen") or {}
            guard += screen.get("rejected", {}).get("guard", 0)
            interval += screen.get("rejected", {}).get("interval", 0)
            selected += screen.get("proposed", 0)
            improved += screen.get("improved", 0)
            for proposal in screen.get("proposals", []):
                proposals.append((proposal[2] - proposal[1], bool(proposal[6])))
    errors = np.abs([p[0] for p in proposals])
    case_ids = sorted({r["case"] for r in records})
    per_case = {case: [r for r in records if r["case"] == case] for case in case_ids}
    rng = np.random.default_rng(20261102)
    cost_draws, agreement_draws, error_draws = [], [], []
    cluster_stats = []
    for case in case_ids:
        case_rows = per_case[case]
        matches = 0
        case_errors = []
        for row in case_rows:
            opt = row["opt"]
            a, b = opt.get("optimum") or {}, opt["without_screen"]
            if a.get("feasible") and b.get("status") == "optimal":
                matches += all(abs(a["decisions"][key] - b["decisions"][key]) < 1e-12 for key in a["decisions"])
            else:
                matches += opt["status"] == b["status"] and not a.get("feasible")
            for start in opt["starts"]:
                case_errors.extend(abs(p[2]-p[1]) for p in start.get("screen", {}).get("proposals", []) if p[2] is not None)
        cluster_stats.append((sum(r["opt"]["without_screen"]["evaluations"] for r in case_rows),
                              sum(r["opt"]["evaluations"] for r in case_rows), matches,
                              len(case_rows), float(sum(case_errors)), len(case_errors)))
    for _ in range(10000):
        sampled = rng.integers(0, len(cluster_stats), size=len(cluster_stats))
        base_count = sum(cluster_stats[i][0] for i in sampled)
        screen_count = sum(cluster_stats[i][1] for i in sampled)
        cost_draws.append(100 * (screen_count / base_count - 1))
        agreement_draws.append(sum(cluster_stats[i][2] for i in sampled) /
                               sum(cluster_stats[i][3] for i in sampled))
        error_draws.append(sum(cluster_stats[i][4] for i in sampled) /
                           sum(cluster_stats[i][5] for i in sampled))
    cost_ci = np.quantile(cost_draws, [.025, .975]).tolist()
    agreement_ci = np.quantile(agreement_draws, [.025, .975]).tolist()
    error_mean_ci = np.quantile(error_draws, [.025, .975]).tolist()

    fig, ax = plt.subplots(figsize=(6.4, 5.0))
    ax.scatter(plain, screened, c=np.where(delta > 0, "#a74738", np.where(delta < 0, "#347c69", "#56789a")), s=26, alpha=.8)
    top = max(float(plain.max()), float(screened.max()))
    ax.plot([0, top], [0, top], color="#333333", linestyle="--", linewidth=1)
    ax.set(xlabel="Unscreened cached trial evaluations", ylabel="Screened cached trial evaluations")
    ax.grid(alpha=.2)
    figure("paired-cost")

    by_case = {}
    for row, change in zip(records, delta):
        by_case.setdefault(row["case"], []).append(change)
    names = list(by_case)
    fig, ax = plt.subplots(figsize=(9, 4.8))
    ax.boxplot([by_case[n] for n in names], patch_artist=True,
               boxprops={"facecolor": "#9fb8bd", "alpha": .8}, medianprops={"color": "#8a3b31", "linewidth": 1.5})
    ax.axhline(0, color="#333333", linestyle="--", linewidth=1)
    ax.set_xticks(range(1, len(names)+1), [n.replace("_", "\n") for n in names], fontsize=7)
    ax.set_ylabel("Additional cached evaluations from screening")
    ax.grid(axis="y", alpha=.2)
    figure("case-cost-deltas")

    ablation = load("docs/design/features/live-optimizer/measurements/screen_variants.json")
    totals = ablation["totals"]
    keys = ("plain", "one_step", "designed")
    labels = ("No screen", "One mesh step", "One and two steps")
    fig, ax = plt.subplots(figsize=(6.8, 4.2))
    bars = ax.bar(labels, [totals[k] for k in keys], color=("#557b92", "#789d78", "#b27652"))
    ax.bar_label(bars, padding=3, fmt="%d")
    ax.set_ylabel("Cached evaluations, 12 nominal cases")
    ax.grid(axis="y", alpha=.2)
    figure("step-ablation")

    fig, ax = plt.subplots(figsize=(6.8, 4.2))
    ax.hist(errors, bins=np.linspace(0, max(5, float(errors.max())), 24), color="#52798b", edgecolor="white")
    ax.axvline(5, color="#a74738", linestyle="--", label="5 pp filter threshold")
    ax.set(xlabel="Absolute recovery prediction error at selected proposal (percentage points)", ylabel="Proposal count")
    ax.legend(frameon=False)
    ax.grid(axis="y", alpha=.2)
    figure("proposal-error")

    fig, ax = plt.subplots(figsize=(6.8, 4.2))
    ax.bar(["Guard rejection", "Interval rejection", "Exact proposals"], [guard, interval, selected],
           color=("#9c6a55", "#718caa", "#729579"))
    ax.set_ylabel("Candidate events across 72 paired searches")
    ax.tick_params(axis="x", labelrotation=12)
    ax.grid(axis="y", alpha=.2)
    figure("screen-activity")

    fig, ax = plt.subplots(figsize=(6.8, 4.4))
    ax.scatter(delta, decision_delta, s=24, alpha=.75, color="#665b88")
    ax.axvline(0, color="#333333", linestyle="--", linewidth=1)
    ax.set(xlabel="Additional screened evaluations", ylabel="Absolute recovered-metal difference (t/h)")
    ax.grid(alpha=.2)
    figure("cost-decision")

    guard_ablation = None
    guard_summary_rows = []
    guard_case_rows = []
    if args.guard_ablation:
        guard_ablation = json.loads(args.guard_ablation.read_text(encoding="utf-8"))
        expected_cases = ["copper_porphyry_soft", "copper_porphyry_hard", "iron_magnetite_fine", "gold_free_milling"]
        expected_policies = ["no_screen", "full", "without_reconstruction_guard", "without_interval_filter", "without_both_filters"]
        if (guard_ablation.get("schema") != "oreflow.screen-ablation/v1"
                or guard_ablation.get("cases") != expected_cases
                or guard_ablation.get("policies") != expected_policies
                or len(guard_ablation.get("rows", [])) != len(expected_cases)):
            raise ValueError("Filter ablation must contain the complete four-case, five-policy design")
        model_sha = hashlib.sha256((ROOT / "models/process_screen.json").read_bytes()).hexdigest()
        if guard_ablation.get("screen_sha256") != model_sha:
            raise ValueError("Filter ablation model hash differs from the committed screen export")
        indexed = {row.get("case"): row for row in guard_ablation["rows"]}
        if set(indexed) != set(expected_cases):
            raise ValueError("Filter ablation case identifiers are incomplete or duplicated")
        for case in expected_cases:
            row = indexed[case]
            if set(row) != {"case", *expected_policies}:
                raise ValueError(f"Filter ablation policy rows are incomplete for {case}")
            for policy in expected_policies:
                if type(row[policy].get("evaluations")) is not int or row[policy]["evaluations"] < 0:
                    raise ValueError(f"Invalid evaluation count: {case}/{policy}")
        ref_total = sum(indexed[case]["no_screen"]["evaluations"] for case in expected_cases)
        def same_endpoint(left: dict, right: dict) -> bool:
            if left.get("status") != right.get("status"):
                return False
            a, b = left.get("decisions"), right.get("decisions")
            if a is None or b is None:
                return a is None and b is None
            return set(a) == set(b) and all(abs(float(a[key])-float(b[key])) <= 1e-12 for key in a)
        policy_totals = {}
        for policy in expected_policies:
            total = sum(indexed[case][policy]["evaluations"] for case in expected_cases)
            matches = sum(same_endpoint(indexed[case]["no_screen"], indexed[case][policy]) for case in expected_cases)
            policy_totals[policy] = total
            guard_summary_rows.append([policy.replace("_", " "), total,
                                       f"{100*(total/ref_total-1):+.2f}%", f"{matches}/4"])
        for case in expected_cases:
            for policy in expected_policies:
                item = indexed[case][policy]
                guard_case_rows.append([case.replace("_", " "), policy.replace("_", " "),
                                        item["evaluations"],
                                        "infeasible" if item.get("recovered_tph") is None else f"{item['recovered_tph']:.6f}",
                                        "same" if same_endpoint(indexed[case]["no_screen"], item) else "different"])
        fig, ax = plt.subplots(figsize=(10, 4.8))
        x = np.arange(len(expected_cases))
        width = .15
        palette = ("#557b92", "#b27652", "#789d78", "#8b78a5", "#c59c54")
        for i, policy in enumerate(expected_policies):
            values = [indexed[case][policy]["evaluations"] for case in expected_cases]
            ax.bar(x + (i-2)*width, values, width, label=policy.replace("_", " "), color=palette[i])
        ax.set_xticks(x, [case.replace("_", "\n") for case in expected_cases], fontsize=8)
        ax.set_ylabel("Distinct cached optimizer evaluations")
        ax.legend(frameon=False, ncols=2, fontsize=8)
        ax.grid(axis="y", alpha=.2)
        figure("guard-ablation")

    families = {}
    for row, a, b in zip(records, plain, screened):
        item = families.setdefault(row["family"], {"n": 0, "plain": 0, "screened": 0})
        item["n"] += 1
        item["plain"] += int(a)
        item["screened"] += int(b)
    family_rows = [[k, v["n"], v["plain"], v["screened"], f'{100*(v["screened"]/v["plain"]-1):.2f}']
                   for k, v in sorted(families.items())]
    ablation_rows = [[label, len(ablation["rows"]), totals[key], f'{100*(totals[key]/totals["plain"]-1):+.2f}%',
                      sum(abs(r[key]["recovered_tph"]-r["plain"]["recovered_tph"]) < 1e-9 for r in ablation["rows"])]
                     for key, label in zip(keys, labels)]
    figure_specs = [
        ("paired-cost", "fig:cost", "Paired cached exact-engine evaluations for each target-mode variant; points above equality indicate added screened work."),
        ("case-cost-deltas", "fig:case-cost-deltas", "Variant-level evaluation-count changes by authored case and circuit family; positive values mean screening increased exact-engine work."),
        ("step-ablation", "fig:step-ablation", "Nominal weight-one evaluation totals across twelve authored cases under no screen, one-step screening and the full one-and-two-step policy."),
        ("proposal-error", "fig:proposal-error", "Absolute recovery prediction error for every exact-evaluated selected proposal, with the five-point interval filter threshold marked."),
        ("screen-activity", "fig:screen-activity", "Guard and interval rejections and proposals aggregated over the 72 paired variants; rejection totals count candidate events."),
        ("cost-decision", "fig:cost-decision", "Added exact evaluations plotted against absolute recovered-metal differences for the matched target-mode outcomes across all twelve authored cases."),
    ]
    if guard_ablation:
        figure_specs.append(("guard-ablation", "fig:guard-ablation",
                             "Exact evaluation counts for each of five filter policies across four authored cases selected to span distinct circuit configurations."))
    figures_tex = []
    for name, label, caption in figure_specs:
        if len(caption.split()) < 15:
            raise ValueError(f"Figure caption too short: {label}")
        figures_tex.extend([r"\begin{figure}[htbp]", r"\centering",
                            rf"\includegraphics[width=0.92\textwidth]{{figures/{name}.pdf}}",
                            rf"\caption{{{caption}}}", rf"\label{{{label}}}", r"\end{figure}"])
    data = ["\n".join(figures_tex),
        table("tab:paired", "Paired search outcomes for the 72 authored target-mode variants, using distinct cached exact-engine trial states as the cost measure.",
              ["Measure", "Result"], [["Paired variants", 72], ["Screened evaluations", int(screened.sum())],
              ["Unscreened evaluations", int(plain.sum())], ["Change", f"{100*(screened.sum()/plain.sum()-1):+.2f}%"],
              ["Case-cluster bootstrap 95% interval for change", f"[{cost_ci[0]:.2f}, {cost_ci[1]:.2f}]%"],
              ["Higher / tied / lower cost", f"{sum(delta>0)} / {sum(delta==0)} / {sum(delta<0)}"],
              ["Same terminal outcome", f"{same} / 72"], ["Case-cluster bootstrap 95% interval for agreement", f"[{100*agreement_ci[0]:.1f}, {100*agreement_ci[1]:.1f}]%"],
              ["Median recovered-metal difference (t/h)", f"{np.median(decision_delta):.6f}"],
              ["Maximum recovered-metal difference (t/h)", f"{decision_delta.max():.6f}"]]),
        table("tab:families", "Evaluation counts aggregated by the four authored circuit families; every family retains its number of paired target-mode variants.",
              ["Circuit family", "Variants", "Unscreened", "Screened", "Change (%)"], family_rows),
        table("tab:ablation", "Nominal weight-one search ablation on twelve authored cases, isolating candidate distance from the matched unscreened baseline.",
              ["Screen policy", "Cases", "Evaluations", "Change vs baseline", "Same recovered metal"], ablation_rows),
        table("tab:screen-events", "Screen candidate counts and exact proposal diagnostics aggregated from the 72 paired artifacts, including the selected-proposal error distribution.",
              ["Event", "Count"], [["Guard rejections", guard], ["Interval-width rejections", interval],
              ["Exact proposals", selected], ["Proposals improving incumbent", improved], ["Absolute error median (pp)", f"{np.median(errors):.3f}"],
              ["Mean absolute error (pp), case-cluster 95% interval", f"{np.mean(errors):.3f} [{error_mean_ci[0]:.3f}, {error_mean_ci[1]:.3f}]"],
              ["Absolute error 95th percentile (pp)", f"{np.quantile(errors, .95):.3f}"], ["Maximum absolute error (pp)", f"{errors.max():.3f}"]]),
    ]
    if guard_ablation:
        data.extend([
            table("tab:guard-summary", "Filter-removal ablation totals across four selected authored cases, compared with the matched no-screen policy and exact endpoint agreement.",
                  ["Policy", "Evaluations", "Change vs no screen", "Same endpoint"], guard_summary_rows),
            table("tab:guard-cases", "Per-case filter policy outcomes preserve evaluation counts, recovered metal, and endpoint agreement for all twenty matched runs.",
                  ["Authored case", "Policy", "Evaluations", "Recovered metal (t/h)", "Endpoint"], guard_case_rows),
        ])
    captions = __import__("re").findall(r"\\caption\{([^{}]*)\}", "\n".join(data))
    if any(len(c.split()) < 15 for c in captions):
        raise ValueError("Every generated table caption must have at least 15 words")
    (HERE / "evidence.tex").write_text("\n\n".join(data) + "\n", encoding="utf-8")
    summary = {"paired": {"n": len(records), "screened": int(screened.sum()), "plain": int(plain.sum()),
                           "change_pct": float(100*(screened.sum()/plain.sum()-1)), "cost_change_case_cluster_ci95_pct": cost_ci,
                           "same_terminal_outcome": int(same), "agreement_case_cluster_ci95": agreement_ci,
                           "proposals": len(proposals), "guard_rejected": guard, "interval_rejected": interval,
                           "proposed": selected, "improved": improved, "mean_absolute_error_pp": float(np.mean(errors)),
                           "mean_absolute_error_case_cluster_ci95_pp": error_mean_ci}, "ablation": totals,
               "guard_ablation": ({"policies": guard_summary_rows, "cases": guard_case_rows,
                                   "screen_sha256": guard_ablation["screen_sha256"]} if guard_ablation else None)}
    (HERE / "evidence-summary.json").write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    table_count = sum(document.count(r"\begin{table}") for document in data)
    print(f"Generated {len(figure_specs)} vector figures, {table_count} result tables and summary from persisted records.")


if __name__ == "__main__":
    main()
