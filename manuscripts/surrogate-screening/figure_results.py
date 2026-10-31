"""Build the paired evaluation-cost figure from the committed case records."""
from __future__ import annotations

import json
from pathlib import Path

import matplotlib.pyplot as plt

ROOT = Path(__file__).resolve().parents[2]
RECORDS = ROOT / "data" / "derived" / "cases"
OUT = Path(__file__).resolve().parent / "figure-results.pdf"


def main() -> None:
    rows: list[tuple[str, int, int]] = []
    for path in sorted(RECORDS.glob("*.json")):
        case = json.loads(path.read_text(encoding="utf-8"))
        for variant in case["variants"]:
            result = variant["methods"]["optimization"]
            baseline = result.get("without_screen")
            if result.get("screened") and baseline:
                rows.append((case["case_id"], int(baseline["evaluations"]), int(result["evaluations"])))

    if len(rows) != 72:
        raise SystemExit(f"Expected 72 paired target-mode variants, found {len(rows)}")
    total_base = sum(row[1] for row in rows)
    total_screen = sum(row[2] for row in rows)
    if (total_base, total_screen) != (22_487, 26_367):
        raise SystemExit(f"Unexpected release totals: {(total_base, total_screen)}")

    plt.rcParams.update({
        "font.family": "DejaVu Sans", "font.size": 8, "axes.titlesize": 9, "axes.labelsize": 8,
        "axes.edgecolor": "#667085", "axes.labelcolor": "#263445", "xtick.color": "#475467",
        "ytick.color": "#475467", "text.color": "#172b3a", "figure.facecolor": "white",
        "axes.facecolor": "#fbfcfd", "savefig.facecolor": "white",
    })
    fig, (scatter, totals) = plt.subplots(1, 2, figsize=(7.2, 3.15), gridspec_kw={"width_ratios": [1.35, 1]})
    base = [row[1] for row in rows]
    screened = [row[2] for row in rows]
    upper = max(max(base), max(screened)) * 1.04
    scatter.plot([0, upper], [0, upper], color="#7b8794", linewidth=1.1, linestyle=(0, (4, 3)), zorder=1)
    scatter.scatter(base, screened, s=22, color="#b75b2a", edgecolors="white", linewidths=0.45, alpha=0.86, zorder=2)
    scatter.set(xlim=(0, upper), ylim=(0, upper), xlabel="Unscreened exact engine calls", ylabel="Screened exact engine calls",
                title="A. Paired count by target-mode variant")
    scatter.text(0.04, 0.94, "68 higher · 4 tied · 0 lower", transform=scatter.transAxes, ha="left", va="top",
                 fontsize=7.5, color="#69452f", bbox={"facecolor": "white", "edgecolor": "#e4e7ec", "boxstyle": "round,pad=0.35"})
    scatter.grid(True, color="#e7ebef", linewidth=0.7)
    scatter.set_axisbelow(True)

    bars = totals.bar([0, 1], [total_base, total_screen], width=0.58, color=["#627d98", "#b75b2a"], zorder=2)
    totals.set_xticks([0, 1], ["Without\nscreen", "With\nscreen"])
    totals.set_ylim(0, total_screen * 1.2)
    totals.set_ylabel("Exact engine evaluations")
    totals.set_title("B. Aggregate over 72 variants")
    totals.grid(axis="y", color="#e7ebef", linewidth=0.7)
    totals.set_axisbelow(True)
    for bar, value in zip(bars, [total_base, total_screen], strict=True):
        totals.text(bar.get_x() + bar.get_width() / 2, value + total_screen * 0.025, f"{value:,}", ha="center", va="bottom", fontsize=8, weight="bold")
    totals.annotate("+17.25%", xy=(1, total_screen), xytext=(0.5, total_screen * 1.1), ha="center", va="center",
                    fontsize=9, weight="bold", color="#8c3e1d",
                    arrowprops={"arrowstyle": "-[,widthB=2.2", "lw": 1, "color": "#b75b2a"})
    fig.tight_layout(pad=1.1, w_pad=2.0)
    fig.savefig(OUT, bbox_inches="tight", metadata={"Title": "Paired optimizer evaluation cost", "Creator": "OreFlow committed records"})
    plt.close(fig)
    print(f"Wrote {OUT.name}: n={len(rows)}, screened={total_screen}, unscreened={total_base}")


if __name__ == "__main__":
    main()
