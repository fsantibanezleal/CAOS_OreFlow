"""Scientific constants and version drift cannot reuse a same-code checkpoint."""
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
    version.write_text("0.10.008\n", encoding="utf-8")
    monkeypatch.setattr(learning, "__file__", str(source))
    contract, settings = build_contract(), learning.settings(device="cpu")
    initial = learning._fingerprint(contract, CASES[:1], settings)[0]
    assert learning._fingerprint(contract, CASES[:1], settings)[0] == initial
    constants.write_text('{"coefficient":2}', encoding="utf-8")
    changed_constants = learning._fingerprint(contract, CASES[:1], settings)[0]
    assert changed_constants != initial
    version.write_text("0.10.009\n", encoding="utf-8")
    assert learning._fingerprint(contract, CASES[:1], settings)[0] != changed_constants
