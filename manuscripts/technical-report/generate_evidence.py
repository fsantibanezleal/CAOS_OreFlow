"""Generate report figures and tables from committed OreFlow result records."""
from __future__ import annotations

import json
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
FIG = HERE / "figures"


def read(path: str) -> dict:
    return json.loads((ROOT / path).read_text(encoding="utf-8"))


def esc(value: object) -> str:
    text = str(value)
    for old, new in (("\\", r"\textbackslash{}"), ("&", r"\&"), ("%", r"\%"),
                     ("_", r"\_"), ("#", r"\#"), ("$", r"\$")):
        text = text.replace(old, new)
    return text


def pdf(name: str) -> None:
    plt.tight_layout()
    plt.savefig(FIG / f"{name}.pdf", bbox_inches="tight",
                metadata={"Creator": "OreFlow evidence generator"})
    plt.close()


def table(label: str, caption: str, headers: list, rows: list[list]) -> str:
    alignment = "l" + "r" * (len(headers) - 1)
    lines = [r"\begin{table}[htbp]", r"\centering", r"\small",
             rf"\caption{{{caption}}}", rf"\label{{{label}}}",
             rf"\begin{{tabular}}{{{alignment}}}", r"\toprule",
             " & ".join(map(esc, headers)) + r" \\",
             r"\midrule"]
    lines.extend(" & ".join(map(esc, row)) + r" \\" for row in rows)
    lines.extend([r"\bottomrule", r"\end{tabular}", r"\end{table}"])
    return "\n".join(lines)


def main() -> None:
    FIG.mkdir(parents=True, exist_ok=True)
    bench = read("data/derived/benchmark.json")
    learn = read("data/derived/learning.json")
    real = read("data/derived/real_samples.json")
    particle = read("data/derived/source/hzdr_particle_benchmark.json")
    cases = bench["cases"]
    ids = [c["case_id"] for c in cases]
    names = [x.replace("_", " ") for x in ids]
    models = list(learn["summary"])
    tables: list[str] = []

    # Case-level outputs
    rec = [c["kpis"]["recovery_pct"]["value"] for c in cases]
    grade = [c["kpis"].get("concentrate_grade", {}).get("value") for c in cases]
    y = np.arange(len(ids))
    fig, ax = plt.subplots(figsize=(8, 5))
    ax.scatter(rec, y, label="Recovery (%)", color="#28698f")
    ax2 = ax.twiny()
    ax2.scatter([np.nan if g is None else g for g in grade], y, marker="D",
                label="Concentrate grade (%)", color="#c06b3c")
    ax.set_yticks(y, names, fontsize=7)
    ax.set_xlabel("Recovery (%)")
    ax2.set_xlabel("Concentrate grade (%)")
    ax.grid(axis="x", alpha=.2)
    pdf("case-kpis")
    tables.append(table("tab:case-summary",
        "Modeled recovery and concentrate grade for twelve authored circuits; the points are simulator outputs, not measured plant observations.",
        ["Case", "Family", "Recovery (%)", "Grade (%)"],
        [[c["case_id"], c["family"], f'{c["kpis"]["recovery_pct"]["value"]:.2f}',
          "--" if grade[i] is None else f"{grade[i]:.2f}"] for i, c in enumerate(cases)]))

    # Protocol comparison
    protocols = [("interpolation_rmse", "Interpolation"), ("loco_rmse_mean", "Held-out case"),
                 ("transfer_rmse_mean", "Held-out ore group")]
    fig, ax = plt.subplots(figsize=(7.5, 4.2))
    width = .24
    for j, (key, label) in enumerate(protocols):
        ax.bar(np.arange(len(models)) + (j-1)*width,
               [learn["summary"][m]["recovery_pct"][key] for m in models], width, label=label)
    ax.set_xticks(np.arange(len(models)), [m.replace("_", "\n") for m in models], fontsize=8)
    ax.set_ylabel("Recovery RMSE (percentage points)")
    ax.legend(frameon=False, ncol=3, fontsize=8)
    ax.grid(axis="y", alpha=.2)
    pdf("transfer-protocols")
    tables.append(table("tab:learning-summary",
        "Recovery prediction errors by model and evaluation protocol, with attempted, scored and rejected fold counts kept beside the conditional metrics.",
        ["Model", "Interpolation", "Held-out case", "Held-out group", "Case scored/rejected", "Group scored/rejected"],
        [[m, f'{learn["summary"][m]["recovery_pct"]["interpolation_rmse"]:.2f}',
          f'{learn["summary"][m]["recovery_pct"]["loco_rmse_mean"]:.2f}',
          f'{learn["summary"][m]["recovery_pct"]["transfer_rmse_mean"]:.2f}',
          f'{learn["summary"][m]["recovery_pct"]["loco_folds"]["scored"]}/{learn["summary"][m]["recovery_pct"]["loco_folds"]["rejected"]}',
          f'{learn["summary"][m]["recovery_pct"]["transfer_folds"]["scored"]}/{learn["summary"][m]["recovery_pct"]["transfer_folds"]["rejected"]}']
         for m in models]))

    # Case-transfer errors; a rejected score is explicitly labelled.
    folds = learn["leave_one_case_out"]
    vals = [f["models"]["mlp"]["recovery_pct"].get("rmse") for f in folds]
    fig, ax = plt.subplots(figsize=(8.2, 4.5))
    ax.bar(np.arange(len(folds)), [v or 0 for v in vals],
           color=["#b35343" if v is None else "#397a98" for v in vals])
    ax.set_xticks(np.arange(len(folds)), [f["held_out"].replace("_", "\n") for f in folds],
                  rotation=45, ha="right", fontsize=7)
    ax.set_ylabel("Held-out recovery RMSE (percentage points)")
    ax.grid(axis="y", alpha=.2)
    for i, v in enumerate(vals):
        if v is None:
            ax.text(i, 1, "rejected", rotation=90, ha="center", fontsize=7)
    pdf("case-transfer")
    tables.append(table("tab:transfer-folds",
        "Every held-out case result for the multilayer perceptron, preserving gross-range rejections instead of assigning them an artificial error score.",
        ["Held-out case", "Rows", "Status", "RMSE (pp)", "R squared"],
        [[f["held_out"], f["models"]["mlp"]["recovery_pct"]["rows"],
          f["models"]["mlp"]["recovery_pct"]["status"],
          "--" if vals[i] is None else f"{vals[i]:.2f}",
          "--" if f["models"]["mlp"]["recovery_pct"].get("r2") is None else f'{f["models"]["mlp"]["recovery_pct"]["r2"]:.3f}']
         for i, f in enumerate(folds)]))

    # Group transfer R squared, including negative scores.
    groups = learn["leave_one_group_out"]
    fig, ax = plt.subplots(figsize=(8, 4.5))
    width = .8 / len(models)
    for j, model in enumerate(models):
        v = [g["models"][model]["recovery_pct"].get("r2") for g in groups]
        ax.bar(np.arange(len(groups))-.4+width/2+j*width,
               [0 if x is None else x for x in v], width, label=model.replace("_", " "))
    ax.axhline(0, color="#333333", linewidth=.8)
    ax.set_xticks(np.arange(len(groups)), [g["held_out_group"].replace(":", "\n") for g in groups], fontsize=7)
    ax.set_ylabel("Held-out group recovery R squared")
    ax.legend(frameon=False, fontsize=7, ncol=2)
    ax.grid(axis="y", alpha=.2)
    pdf("group-transfer")
    tables.append(table("tab:group-transfer",
        "Model scores for each held-out ore group; negative R squared values remain visible and group identity is not supplied as a predictor.",
        ["Ore group", "Cases", *models],
        [[g["held_out_group"], len(g["cases"]),
          *["--" if g["models"][m]["recovery_pct"].get("r2") is None else f'{g["models"][m]["recovery_pct"]["r2"]:.3f}' for m in models]]
         for g in groups]))

    # Kinetic fit records
    kin = bench["kinetics"]
    knames = list(kin)
    fig, ax = plt.subplots(figsize=(7, 4))
    ax.barh([k.replace("_", " ") for k in knames], [kin[k]["mean_rmse_pct"] for k in knames], color="#597f67")
    ax.set_xlabel("Mean batch-fit RMSE (%)")
    ax.grid(axis="x", alpha=.2)
    pdf("kinetic-models")
    tables.append(table("tab:kinetics",
        "Five kinetic forms fitted on a common set of virtual batch records; the table reports fit error, circuit-lumping error and convergence.",
        ["Kinetic form", "Fits", "RMSE (%)", "Mean lumping error (%)", "Worst error (%)", "Converged"],
        [[k, kin[k]["fits"], f'{kin[k]["mean_rmse_pct"]:.4f}',
          f'{kin[k]["mean_abs_lumping_error_pct"]:.3f}', f'{kin[k]["worst_abs_lumping_error_pct"]:.3f}',
          f'{kin[k]["converged_share"]:.3f}'] for k in knames]))

    # Nominal paired optimizer calls by circuit
    opt = bench["optimization"]
    pairs = [(c, v["nominal"]["evaluations_without_screen"], v["nominal"]["evaluations"])
             for c, v in opt.items() if "nominal" in v]
    fig, ax = plt.subplots(figsize=(7.2, 4.5))
    ax.scatter([a for _, a, _ in pairs], [b for _, _, b in pairs], color="#a65b3a")
    top = max(max(a, b) for _, a, b in pairs)
    ax.plot([0, top], [0, top], "--", color="#555555", linewidth=1)
    ax.set(xlabel="Unscreened cached evaluations", ylabel="Screened cached evaluations")
    ax.grid(alpha=.2)
    pdf("optimization-cost")
    tables.append(table("tab:optimization",
        "Paired exact-engine evaluation counters at each case's nominal operating point; inference, audits and the later objective-weight path are excluded.",
        ["Case", "Unscreened", "Screened", "Difference", "Proposed", "Improved"],
        [[c, a, b, b-a, opt[c]["nominal"].get("proposed", 0), opt[c]["nominal"].get("improved", 0)]
         for c, a, b in pairs]))

    # Separate measured-data lane
    smp = [x for x in real["samples"] if x.get("measured_recovery_pct") is not None]
    measured = np.array([x["measured_recovery_pct"] for x in smp])
    predicted = np.array([x["metrics"]["recovery_pct"] for x in smp])
    fig, ax = plt.subplots(figsize=(5.3, 4.8))
    ax.scatter(measured, predicted, s=20, alpha=.7, color="#695c8a")
    ax.plot([0, 100], [0, 100], "--", color="#555555", linewidth=1)
    ax.set(xlim=(0, 100), ylim=(0, 100), xlabel="Measured recovery (%)", ylabel="Engine recovery (%)")
    ax.grid(alpha=.2)
    pdf("measured-recovery")
    lane = real["summary"]["geomet_lane_minus_measured_pp"]
    tables.append(table("tab:measured-data",
        "External sample comparison of the mechanistic engine and separate learned data-lane models, with the measured sample count and error units stated.",
        ["Method", "Samples", "Bias (pp)", "RMSE (pp)"],
        [["Mechanistic engine", real["summary"]["samples"],
          f'{real["summary"]["engine_minus_measured_pp"]["mean"]:.2f}',
          f'{real["summary"]["engine_minus_measured_pp"]["rmse"]:.2f}']] +
        [[k, real["summary"]["samples"], f'{v["mean"]:.2f}', f'{v["rmse"]:.2f}'] for k, v in lane.items()]))

    # Interval coverage and output uncertainty
    inter = learn["interpolation"]["models"]
    coverage = [inter[m]["recovery_pct"].get("coverage_95") for m in models]
    fig, ax = plt.subplots(figsize=(7, 3.8))
    ax.bar(np.arange(len(models)), [0 if v is None else 100*v for v in coverage], color="#5b8891")
    ax.axhline(95, linestyle="--", color="#a64a3a", label="Nominal 95%")
    ax.set_xticks(np.arange(len(models)), [m.replace("_", "\n") for m in models], fontsize=8)
    ax.set_ylabel("Empirical coverage (%)")
    ax.legend(frameon=False)
    ax.grid(axis="y", alpha=.2)
    pdf("interval-coverage")

    unc = bench["uncertainty"]
    fig, ax = plt.subplots(figsize=(8.2, 4.5))
    for i, c in enumerate(ids):
        p = unc[c]["recovery_pct"]
        ax.errorbar(p["p50"], i, xerr=[[p["p50"]-p["p05"]], [p["p95"]-p["p50"]]],
                    fmt="o", color="#3c785b", capsize=2)
    ax.set_yticks(np.arange(len(ids)), names, fontsize=7)
    ax.set_xlabel("Modeled recovery (%) over declared input ranges, P05 to P95")
    ax.grid(axis="x", alpha=.2)
    pdf("uncertainty-ranges")
    tables.append(table("tab:uncertainty",
        "Seeded recovery quantiles and feasibility probabilities for authored cases, conditional on the declared independent-factor ranges rather than plant-frequency distributions.",
        ["Case", "P05", "P50", "P95", "All constraints"],
        [[c, f'{unc[c]["recovery_pct"]["p05"]:.2f}', f'{unc[c]["recovery_pct"]["p50"]:.2f}',
          f'{unc[c]["recovery_pct"]["p95"]:.2f}', f'{unc[c]["probabilities"]["all_constraints"]:.3f}'] for c in ids]))

    # Archived published particle-reference calibration
    calibration = particle["cases"][0]["models"]["published_reference"]["calibration"]
    fig, ax = plt.subplots(figsize=(4.8, 4.4))
    ax.plot([0, 1], [0, 1], "--", color="#555555", linewidth=1)
    ax.scatter([x["predicted"] for x in calibration], [x["oracle"] for x in calibration],
               s=[max(16, x["count"]**.5) for x in calibration], color="#b77736")
    ax.set(xlim=(0, 1), ylim=(0, 1), xlabel="Reference-model probability", ylabel="Oracle liberation share")
    ax.grid(alpha=.2)
    pdf("particle-reference-calibration")
    tables.append(table("tab:particle-reference",
        "Calibration bins from the archived particle benchmark reference model; marker area is proportional to test rows and the benchmark protocol remains in the source record.",
        ["Case", "RMSE", "MAE", "Bias"],
        [[x["case"], f'{x["models"]["published_reference"]["rmse"]:.5f}',
          f'{x["models"]["published_reference"]["mae"]:.5f}', f'{x["models"]["published_reference"]["bias"]:.5f}']
         for x in particle["cases"]]))

    names_expected = {"case-kpis", "transfer-protocols", "case-transfer", "group-transfer",
                      "kinetic-models", "optimization-cost", "measured-recovery", "interval-coverage",
                      "uncertainty-ranges", "particle-reference-calibration"}
    made = {p.stem for p in FIG.glob("*.pdf")}
    if made != names_expected or len(tables) < 8:
        raise SystemExit(f"Evidence inventory mismatch: {sorted(made)} / {len(tables)} tables")
    captions = {
        "case-kpis": ("fig:case-kpis", "Modeled recovery and concentrate grade across twelve authored circuits; paired axes preserve their distinct units and the points are not plant measurements."),
        "transfer-protocols": ("fig:transfer-protocols", "Recovery error for five models under interpolation, whole-case holdout and ore-group holdout, showing that each protocol estimates a different transfer question."),
        "case-transfer": ("fig:case-transfer", "Neural recovery error for each held-out authored case; the labelled rejection marks a failed range diagnostic and is not assigned a numerical score."),
        "group-transfer": ("fig:group-transfer", "Recovery determination scores by held-out ore group and model, including negative values that indicate performance below the corresponding cohort-mean predictor."),
        "kinetic-models": ("fig:kinetic-models", "Mean fitted batch-recovery error for five implemented kinetic forms over the common virtual batch-record set."),
        "optimization-cost": ("fig:optimization-cost", "Paired cached exact-engine evaluation counts for nominal circuit searches, where points above identity indicate additional calls under surrogate screening."),
        "measured-recovery": ("fig:measured-recovery", "Mechanistic engine recovery against 52 external measured samples, with the identity line showing the direction and magnitude of the domain mismatch."),
        "interval-coverage": ("fig:interval-coverage", "Empirical recovery-interval coverage on the interpolation test partition compared with the nominal ninety-five-percent reference level."),
        "uncertainty-ranges": ("fig:uncertainty-ranges", "Median and fifth-to-ninety-fifth recovery quantiles over each authored case's declared input ranges, not a population-frequency distribution."),
        "particle-reference-calibration": ("fig:particle-reference-calibration", "Archived particle-reference calibration bins against constructed oracle liberation shares, with marker area proportional to the number of test rows."),
    }
    figure_blocks = []
    for name in sorted(names_expected):
        label, caption = captions[name]
        figure_blocks.append(
            "\\begin{figure}[htbp]\n\\centering\n"
            f"\\includegraphics[width=0.94\\textwidth]{{figures/{name}.pdf}}\n"
            f"\\caption{{{caption}}}\n\\label{{{label}}}\n\\end{{figure}}"
        )
    (HERE / "evidence.tex").write_text("\n".join(figure_blocks + tables) + "\n",
                                       encoding="utf-8", newline="\n")
    print(f"Generated {len(made)} vector figures and {len(tables)} artifact-derived result tables.")


if __name__ == "__main__":
    main()
