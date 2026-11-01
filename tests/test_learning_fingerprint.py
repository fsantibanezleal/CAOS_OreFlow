"""Scientific constants and version drift cannot reuse a same-code checkpoint."""
from pathlib import Path

from pipeline.cases.catalog import CASES
from pipeline.io.contract import build_contract
from pipeline.methods import learning


def test_fingerprint_covers_scientific_json_and_version(tmp_path, monkeypatch):
    source = tmp_path / "data-pipeline/pipeline/methods/learning.py"
    source.parent.mkdir(parents=True)
    source.write_text("# isolated fingerprint source\n", encoding="utf-8")
    constants = tmp_path / "data-pipeline/pipeline/engine/data/constants.json"
    constants.parent.mkdir(parents=True)
    constants.write_text('{"coefficient":1}', encoding="utf-8")
    version = tmp_path / "VERSION"
    current_version = (Path(__file__).resolve().parents[1] / "VERSION").read_text(encoding="utf-8").strip()
    version.write_text(current_version + "\n", encoding="utf-8")
    monkeypatch.setattr(learning, "__file__", str(source))
    contract, settings = build_contract(), learning.settings(device="cpu")
    initial = learning._fingerprint(contract, CASES[:1], settings)[0]
    assert learning._fingerprint(contract, CASES[:1], settings)[0] == initial
    constants.write_text('{"coefficient":2}', encoding="utf-8")
    changed_constants = learning._fingerprint(contract, CASES[:1], settings)[0]
    assert changed_constants != initial
    major, minor, patch = (int(part) for part in current_version.split("."))
    version.write_text(f"{major}.{minor}.{patch+1}\n", encoding="utf-8")
    assert learning._fingerprint(contract, CASES[:1], settings)[0] != changed_constants
