"""Deterministic release-readiness summary for the committed OreFlow research artifacts."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

SCHEMA = "oreflow.readiness/v1"


def compute(*, repo_root: str | Path, derived_root: str | Path, models_dir: str | Path) -> dict:
    root = Path(repo_root)
    catalog = root / "docs/contracts/catalog.md"
    raw = catalog.read_bytes().replace(b"\r\n", b"\n")
    lines = raw.decode("utf-8").splitlines()
    rows: list[dict] = []
    in_table = False
    for line in lines:
        if line.strip() == "## Contracts":
            in_table = True
            continue
        if in_table and line.startswith("## "):
            break
        if not in_table or not line.startswith("|"):
            continue
        cells = [part.strip() for part in line.strip().strip("|").split("|")]
        if not cells or cells[0].lower() == "id" or all(set(c) <= {"-", ":"} for c in cells):
            continue
        if len(cells) < 13:
            raise ValueError("contract catalog row has fewer than 13 columns")
        rid, version, owner, schema_file, example, documents, producer, consumer, missing_behavior, provider, model_io, swap, status = cells[:13]
        paths = [p.strip().strip("`") for p in documents.split(",") if p.strip()]
        missing = sorted(p for p in paths if not (root / p).is_file())
        state = "available" if status == "real" and not missing else "missing" if missing else "provider"
        rows.append({"id": rid, "version": version, "status": status, "state": state,
                     "provenance": "real" if state == "available" else provider.split(":", 1)[0],
                     "missing": missing})
    version = (root / "VERSION").read_text(encoding="utf-8").strip()
    return {"schema": SCHEMA, "product_version": version,
            "catalog_sha256": hashlib.sha256(raw).hexdigest(), "contracts": rows}


def write(derived_root: str | Path, doc: dict) -> int:
    path = Path(derived_root) / "readiness.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    data = json.dumps(doc, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    path.write_bytes(data)
    return len(data)
