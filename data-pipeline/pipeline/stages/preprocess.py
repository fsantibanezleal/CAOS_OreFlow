"""Stage 1: acquire and summarize the licensed particle-mineralogy reference."""
from __future__ import annotations

from pathlib import Path
from typing import Any

HZDR_FILE = "SM1.Constructed_cases_data.xlsx"
HZDR_DOI = "10.14278/rodare.336"
HZDR_URL = "https://rodare.hzdr.de/record/336"


def run(raw_dir: str | Path, derived_dir: str | Path) -> dict[str, Any]:
    """Read the public HZDR workbook when present and emit a compact summary."""
    raw_path = Path(raw_dir) / HZDR_FILE
    out = Path(derived_dir) / "source" / "hzdr_summary.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    summary: dict[str, Any] = {
        "dataset": "HZDR particle mineralogy constructed cases", "doi": HZDR_DOI, "url": HZDR_URL,
        "license": "CC BY 4.0", "raw_file": HZDR_FILE, "raw_available": raw_path.exists(),
        "rows": {}, "features": {}, "main_mineral_counts": {},
        "note": "Particle-mineralogy reference; not a measured plant campaign and not used as a plant label.",
    }
    if raw_path.exists():
        try:
            import pandas as pd
            book = pd.ExcelFile(raw_path)
            for sheet in ("Train data", "Test data"):
                if sheet not in book.sheet_names:
                    continue
                frame = pd.read_excel(raw_path, sheet_name=sheet)
                summary["rows"][sheet] = int(len(frame))
                numeric = frame.select_dtypes(include="number")
                summary["features"][sheet] = {
                    col: {"mean": round(float(numeric[col].mean()), 6), "p05": round(float(numeric[col].quantile(0.05)), 6),
                          "p50": round(float(numeric[col].quantile(0.50)), 6), "p95": round(float(numeric[col].quantile(0.95)), 6)}
                    for col in numeric.columns
                }
                if "Main mineral" in frame:
                    counts = frame["Main mineral"].astype(str).value_counts().to_dict()
                    summary["main_mineral_counts"][sheet] = {str(k): int(v) for k, v in counts.items()}
            summary["status"] = "processed"
        except Exception as exc:
            summary["status"] = "available_but_not_read"
            summary["error"] = type(exc).__name__
    else:
        summary["status"] = "not_downloaded"
    import json
    out.write_text(json.dumps(summary, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return summary
