"""OP-05 measurement (2026-09-30), run with the committed models' screen export: the screen's cost on the 12 nominal states at weight 1, three ways: no screen, the screen as designed (candidates one
and two mesh steps away), and a screen limited to one step. Usage: python screen_variants.py <models dir> <output json>.

Measure the screen's cost on the 12 nominal states at weight 1: no screen, the screen as designed (candidates one
and two mesh steps away), and a screen limited to one step (the poll's own points, so a failed proposal costs no extra
evaluation). The optimizer module is patched in memory only for the third run."""
import json
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[5] / 'data-pipeline'))
from pipeline.cases.catalog import CASES  # noqa: E402
from pipeline.io.contract import build_contract  # noqa: E402
from pipeline.methods import optimization as opt  # noqa: E402
from pipeline.methods.screen import Screen  # noqa: E402

screen = Screen(Path(sys.argv[1]))
contract = build_contract()
real_constant = opt.constant


def constant_one_step(key):
    return [1.0] if key == "optimization.screen_steps" else real_constant(key)


out = []
for case in CASES:
    row = {"case": case.id}
    for label in ("plain", "designed", "one_step"):
        opt.constant = constant_one_step if label == "one_step" else real_constant
        t0 = time.perf_counter()
        r = opt.optimize(case, case.nominal, contract, path=False, screen=None if label == "plain" else screen)
        row[label] = {"evaluations": r["evaluations"], "recovered_tph": (r["optimum"] or {}).get("recovered_tph"),
                      "seconds": time.perf_counter() - t0}
    opt.constant = real_constant
    out.append(row)
    print(case.id, {k: (v["evaluations"], round(v["recovered_tph"] or 0, 6)) for k, v in row.items() if k != "case"}, flush=True)
tot = {k: sum(r[k]["evaluations"] for r in out) for k in ("plain", "designed", "one_step")}
print("totals", tot, {k: f"{100 * (1 - v / tot['plain']):.1f}% saved" for k, v in tot.items()})
Path(sys.argv[2]).write_text(json.dumps({"rows": out, "totals": tot}, indent=1), encoding="utf-8")
