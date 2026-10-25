"""Every catalogued JSON payload satisfies its registered boundary schema."""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(ROOT / "scripts"))

import contract_schemas as cs  # noqa: E402
from check_contracts import parse_catalog, split_documents  # noqa: E402


def test_catalogued_documents_validate() -> None:
    parsed = parse_catalog((ROOT / "docs/contracts/catalog.md").read_text(encoding="utf-8"))
    assert parsed is not None
    _, rows = parsed
    checked: set[Path] = set()
    for row in rows:
        schema_file = Path(row["schema file"])
        schema_name = schema_file.name.removesuffix(".schema.json")
        for item in split_documents(row["documents"]):
            path = ROOT / item
            if path.suffix != ".json" or path in checked:
                continue
            checked.add(path)
            payload = json.loads(path.read_text(encoding="utf-8"))
            problems = cs.errors(schema_name, payload)
            assert not problems, f"{path.relative_to(ROOT)}: {problems}"
    assert len(checked) >= 38


def test_readiness_schema_rejects_wrong_product_identity() -> None:
    assert cs.errors("oreflow-readiness-v1", {"schema": "wrong"})
