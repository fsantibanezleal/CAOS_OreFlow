"""Freshness must fail on stale types and constraints, without touching the checked files."""
from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "scripts/generate_contract_types.mjs"


def generate(output, *args):
    return subprocess.run(
        [shutil.which("node") or "node", str(SCRIPT), "--output-dir", str(output), *args],
        cwd=output.parent, capture_output=True, text=True, timeout=60,
    )


def test_fresh_generation_is_idempotent_and_check_is_read_only(tmp_path):
    output = tmp_path / "generated"
    first = generate(output)
    assert first.returncode == 0, first.stderr
    files = sorted(output.glob("*.ts"))
    assert len(files) == 2
    before = {p: (p.read_bytes(), p.stat().st_mtime_ns) for p in files}
    for args in [(), ("--check",)]:
        run = generate(output, *args)
        assert run.returncode == 0, run.stderr
        assert {p: (p.read_bytes(), p.stat().st_mtime_ns) for p in files} == before
    files[0].write_bytes(files[0].read_bytes() + b"\n// stale consumer\n")
    corrupt = {p: p.read_bytes() for p in files}
    stale = generate(output, "--check")
    assert stale.returncode == 1
    assert "Stale or missing generated types" in stale.stderr
    assert {p: p.read_bytes() for p in files} == corrupt
    files[0].unlink()
    missing = generate(output, "--check")
    assert missing.returncode == 1
    assert not files[0].exists()


def test_schema_only_constraint_change_invalidates_generated_output(tmp_path):
    output = tmp_path / "generated"
    assert generate(output).returncode == 0
    schemas = tmp_path / "schemas"
    shutil.copytree(ROOT / "docs/contracts/schemas", schemas)
    path = schemas / "oreflow-contract-v1.schema.json"
    # Changing a runtime constraint can leave the TS shape unchanged. The source
    # digest must still make freshness fail, so this cannot silently drift.
    content = path.read_text(encoding="utf-8")
    assert '"minItems": 1' in content
    path.write_text(content.replace('"minItems": 1', '"minItems": 2', 1), encoding="utf-8")
    before = {p: p.read_bytes() for p in output.glob("*.ts")}
    stale = generate(output, "--schema-dir", str(schemas), "--check")
    assert stale.returncode == 1
    assert {p: p.read_bytes() for p in output.glob("*.ts")} == before
