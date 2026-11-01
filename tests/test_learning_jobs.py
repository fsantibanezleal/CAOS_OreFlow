"""Bounded execution and integrity tests; workers must be importable under spawn."""
from __future__ import annotations

import hashlib
import json
import multiprocessing
import os
import subprocess
import time
from pathlib import Path

import pytest

from pipeline.io.storage import REPOSITORY
from pipeline.methods.learning_jobs import Job, run_jobs

FINGERPRINT = hashlib.sha256(b"same-code-engine-data-config-device").hexdigest()


def tiny_worker(payload):
    if payload.get("marker"):
        marker = Path(payload["marker"])
        with marker.open("a", encoding="utf-8") as handle:
            handle.write("executed\n")
    time.sleep(payload.get("delay", 0))
    if payload.get("error"):
        raise ArithmeticError("scientific worker failed")
    if payload.get("probe"):
        return {"pid": os.getpid(), "start": multiprocessing.get_start_method()}
    return {"value": payload["value"], "label": "cobre ñ"}


def coordinated_worker(payload):
    marker = Path(payload["root"]) / payload["name"]
    marker.write_text(str(os.getpid()), encoding="utf-8")
    if payload["name"] == "bad":
        deadline = time.monotonic() + 5
        while not (marker.parent / "running").exists():
            if time.monotonic() > deadline:
                raise TimeoutError("running worker did not start")
            time.sleep(0.01)
        raise ArithmeticError("scientific worker failed")
    if payload["name"] == "running":
        time.sleep(0.2)
    return {"name": payload["name"]}


def require_positive(record):
    if record["value"] <= 0:
        raise ValueError("value must be positive")


def cache_file(root, job_id="a", fingerprint=FINGERPRINT):
    return root / fingerprint / (hashlib.sha256(job_id.encode("utf-8")).hexdigest() + ".json")


def canonical(value):
    return json.dumps(value, sort_keys=True, ensure_ascii=False, allow_nan=False, separators=(",", ":")).encode("utf-8")


def assert_identity(exc, job_id):
    assert any(repr(job_id) in note for note in getattr(exc, "__notes__", []))


@pytest.mark.parametrize("workers", [1, 2])
def test_adversarial_order_progress_and_honest_counts_without_cache(workers):
    jobs = [Job("slow", {"value": 3, "delay": 0.2}), Job("fast", {"value": 7})]
    calls = []
    parent = os.getpid()

    def progress(*args):
        assert os.getpid() == parent
        calls.append(args)

    records, meta = run_jobs(jobs, tiny_worker, workers=workers, progress=progress)
    assert [record["value"] for record in records] == [3, 7]
    assert meta == {"workers": workers, "attempted": 2, "resumed": 0, "executed": 2}
    assert [call[1:] for call in calls] == [(1, 2, False), (2, 2, False)]
    assert [call[0] for call in calls] == (["slow", "fast"] if workers == 1 else ["fast", "slow"])


def test_actual_spawn_and_cleanup():
    before = {child.pid for child in multiprocessing.active_children()}
    records, _ = run_jobs([Job(str(i), {"probe": True, "delay": 0.1}) for i in range(4)], tiny_worker, workers=2)
    assert {record["start"] for record in records} == {"spawn"}
    pids = {record["pid"] for record in records}
    assert len(pids) == 2 and os.getpid() not in pids
    assert not ({child.pid for child in multiprocessing.active_children()} - before)


@pytest.mark.parametrize("workers", [1, 2])
def test_empty_jobs_do_not_create_cache(tmp_path, workers):
    root = tmp_path / "absent"
    assert run_jobs([], tiny_worker, workers=workers, checkpoint_dir=root, fingerprint=FINGERPRINT) == (
        [], {"workers": workers, "attempted": 0, "resumed": 0, "executed": 0})
    assert not root.exists()


@pytest.mark.parametrize("workers", [0, -1, 5, True, 1.5, "2"])
def test_worker_count_rejected_before_execution(tmp_path, workers):
    marker = tmp_path / "marker"
    with pytest.raises((TypeError, ValueError)):
        run_jobs([Job("a", {"value": 1, "marker": str(marker)})], tiny_worker, workers=workers)
    assert not marker.exists()


@pytest.mark.parametrize("ids", [["a", "a"], [""], ["   "], [None], [7]])
def test_adversarial_invalid_ids_fail_before_cache_creation(tmp_path, ids):
    root = tmp_path / "cache"
    with pytest.raises((TypeError, ValueError)):
        run_jobs([Job(ident, {"value": 1}) for ident in ids], tiny_worker, checkpoint_dir=root, fingerprint=FINGERPRINT)
    assert not root.exists()


@pytest.mark.parametrize("fingerprint", [None, "", "g" * 64, "a" * 63, "../escape", 7])
def test_cache_requires_valid_fingerprint(tmp_path, fingerprint):
    root = tmp_path / "absent"
    with pytest.raises((TypeError, ValueError)):
        run_jobs([Job("a", {"value": 1})], tiny_worker, checkpoint_dir=root, fingerprint=fingerprint)
    assert not root.exists()


@pytest.mark.parametrize("workers", [1, 2])
def test_resume_validates_in_parent_and_does_not_execute(tmp_path, workers):
    root = tmp_path / "cache"
    marker = tmp_path / "execution"
    jobs = [Job("a", {"value": 4, "marker": str(marker)})]
    first, _ = run_jobs(jobs, tiny_worker, workers=workers, checkpoint_dir=root, fingerprint=FINGERPRINT)
    before = cache_file(root).read_bytes()
    calls = []
    validations = []
    parent = os.getpid()

    def validate(record):
        assert os.getpid() == parent
        validations.append(record)

    records, meta = run_jobs(jobs, tiny_worker, workers=workers, checkpoint_dir=root, fingerprint=FINGERPRINT,
                             validate=validate, progress=lambda *args: calls.append(args))
    assert records == first == validations
    assert marker.read_text().splitlines() == ["executed"]
    assert cache_file(root).read_bytes() == before
    assert meta == {"workers": workers, "attempted": 1, "resumed": 1, "executed": 0}
    assert calls == [("a", 1, 1, True)]


def test_partial_resume_and_config_namespace(tmp_path):
    root = tmp_path / "cache"
    run_jobs([Job("a", {"value": 1})], tiny_worker, checkpoint_dir=root, fingerprint=FINGERPRINT)
    records, meta = run_jobs([Job("a", {"value": 1}), Job("b", {"value": 2})], tiny_worker, workers=2,
                             checkpoint_dir=root, fingerprint=FINGERPRINT)
    assert [record["value"] for record in records] == [1, 2]
    assert meta == {"workers": 2, "attempted": 2, "resumed": 1, "executed": 1}
    changed = hashlib.sha256(b"different-device-config").hexdigest()
    records, meta = run_jobs([Job("a", {"value": 8})], tiny_worker, checkpoint_dir=root, fingerprint=changed)
    assert records[0]["value"] == 8 and meta["executed"] == 1
    assert cache_file(root).exists() and cache_file(root, fingerprint=changed).exists()


@pytest.mark.parametrize("damage", ["checksum", "identity", "fingerprint", "schema", "json", "nonfinite", "overflow", "duplicate-key"])
def test_adversarial_invalid_cache_preflight_never_launches_any_job(tmp_path, damage):
    root = tmp_path / "cache"
    run_jobs([Job("a", {"value": 1})], tiny_worker, checkpoint_dir=root, fingerprint=FINGERPRINT)
    path = cache_file(root)
    envelope = json.loads(path.read_text(encoding="utf-8"))
    if damage == "checksum":
        envelope["result"]["value"] = 2
    elif damage == "identity":
        envelope["job_id"] = "other"
    elif damage == "fingerprint":
        envelope["fingerprint"] = "f" * 64
    elif damage == "schema":
        envelope["schema"] = "other/v1"
    if damage in {"nonfinite", "overflow"}:
        text = json.dumps(envelope).replace('"value": 1', '"value": ' + ("NaN" if damage == "nonfinite" else "1e400"))
    elif damage in {"json", "duplicate-key"}:
        text = {"json": "{", "duplicate-key": '{"job_id":"a","job_id":"b"}'}[damage]
    else:
        text = json.dumps(envelope)
    path.write_text(text, encoding="utf-8")
    marker = tmp_path / "must-not-run"
    with pytest.raises(ValueError) as caught:
        run_jobs([Job("new-before-corrupt", {"value": 2, "marker": str(marker)}), Job("a", {"value": 1})],
                 tiny_worker, workers=2, checkpoint_dir=root, fingerprint=FINGERPRINT)
    assert_identity(caught.value, "a")
    assert not marker.exists()
    assert path.read_text(encoding="utf-8") == text


@pytest.mark.parametrize("cached", [False, True])
def test_validator_failure_is_fatal_with_identity(tmp_path, cached):
    root = tmp_path / "cache"
    jobs = [Job("bad-value", {"value": -1})]
    if cached:
        run_jobs(jobs, tiny_worker, checkpoint_dir=root, fingerprint=FINGERPRINT)
    with pytest.raises(ValueError, match="value must be positive") as caught:
        run_jobs(jobs, tiny_worker, validate=require_positive, checkpoint_dir=root, fingerprint=FINGERPRINT)
    assert_identity(caught.value, "bad-value")
    assert cache_file(root, "bad-value").exists() is cached


@pytest.mark.parametrize("value", [float("nan"), float("inf"), float("-inf"), {"nested": [float("nan")]}])
def test_new_nonfinite_result_never_checkpointed(tmp_path, value):
    with pytest.raises(ValueError) as caught:
        run_jobs([Job("a", {"value": value})], tiny_worker, checkpoint_dir=tmp_path, fingerprint=FINGERPRINT)
    assert_identity(caught.value, "a")
    assert not cache_file(tmp_path).exists()


def test_canonical_bytes_and_safe_job_component(tmp_path):
    job_id = "../../x:C:\\escape/ñ"
    for root in [tmp_path / "one", tmp_path / "two"]:
        run_jobs([Job(job_id, {"value": 1})], tiny_worker, checkpoint_dir=root, fingerprint=FINGERPRINT)
    left, right = [cache_file(tmp_path / name, job_id) for name in ["one", "two"]]
    assert left.read_bytes() == right.read_bytes()
    envelope = json.loads(left.read_bytes())
    assert left.read_bytes() == canonical(envelope)
    assert envelope["result_sha256"] == hashlib.sha256(canonical(envelope["result"])).hexdigest()
    assert envelope["schema"] == "oreflow.learning-job/v1"
    assert set(envelope) == {"schema", "fingerprint", "job_id", "result_sha256", "result"}
    assert list(left.parent.iterdir()) == [left]


def test_repository_destination_rejected_before_creation():
    root = REPOSITORY / "must-not-create-learning-jobs"
    assert not root.exists()
    with pytest.raises(ValueError, match="outside"):
        run_jobs([Job("a", {"value": 1})], tiny_worker, checkpoint_dir=root, fingerprint=FINGERPRINT)
    assert not root.exists()


def test_adversarial_symlink_back_to_repository_rejected(tmp_path):
    link = tmp_path / "repo-link"
    try:
        link.symlink_to(REPOSITORY, target_is_directory=True)
    except OSError as exc:
        if os.name != "nt":
            raise
        result = subprocess.run(["cmd", "/c", "mklink", "/J", str(link), str(REPOSITORY)], capture_output=True, text=True)
        assert result.returncode == 0, f"Cannot create test junction after {exc}: {result.stderr}"
    with pytest.raises(ValueError, match="outside"):
        run_jobs([Job("a", {"value": 1})], tiny_worker, checkpoint_dir=link / "must-not-create-learning-jobs",
                 fingerprint=FINGERPRINT)
    assert not (REPOSITORY / "must-not-create-learning-jobs").exists()


def test_adversarial_atomic_replace_failure_keeps_no_final_or_temporary_file(tmp_path, monkeypatch):
    from pipeline.methods import learning_jobs

    def fail_replace(source, destination):
        assert Path(source).parent == Path(destination).parent
        assert Path(source).is_file()
        raise OSError("simulated replace failure")

    monkeypatch.setattr(learning_jobs.os, "replace", fail_replace)
    with pytest.raises(OSError, match="simulated replace failure") as caught:
        run_jobs([Job("a", {"value": 1})], tiny_worker, checkpoint_dir=tmp_path, fingerprint=FINGERPRINT)
    assert_identity(caught.value, "a")
    assert list((tmp_path / FINGERPRINT).iterdir()) == []


@pytest.mark.parametrize("workers", [1, 2])
def test_worker_exception_keeps_original_type_and_job_id(workers):
    with pytest.raises(ArithmeticError, match="scientific worker failed") as caught:
        run_jobs([Job("failing-case", {"error": True})], tiny_worker, workers=workers)
    assert_identity(caught.value, "failing-case")


def test_adversarial_spawn_failure_retains_completed_and_running_success_and_cleans_children(tmp_path):
    root = tmp_path / "markers"
    root.mkdir()
    cache = tmp_path / "cache"
    names = ["first", "bad", "running", *[f"queued-{i}" for i in range(12)]]
    jobs = [Job(name, {"name": name, "root": str(root)}) for name in names]
    before = {child.pid for child in multiprocessing.active_children()}
    progress = []
    with pytest.raises(ArithmeticError, match="scientific worker failed") as caught:
        run_jobs(jobs, coordinated_worker, workers=2, checkpoint_dir=cache, fingerprint=FINGERPRINT,
                 progress=lambda *args: progress.append(args))
    assert_identity(caught.value, "bad")
    assert cache_file(cache, "first").exists() and cache_file(cache, "running").exists()
    assert not cache_file(cache, "bad").exists()
    assert {path.name for path in root.iterdir()} == {"first", "bad", "running"}
    assert {call[0] for call in progress} == {"first", "running"}
    assert [call[1:] for call in progress] == [(1, len(jobs), False), (2, len(jobs), False)]
    assert not ({child.pid for child in multiprocessing.active_children()} - before)


def test_adversarial_without_checkpoint_directory_never_uses_checkpoint_io(monkeypatch):
    from pipeline.methods import learning_jobs

    def unexpected_io(*args, **kwargs):
        pytest.fail("Checkpoint filesystem I/O is disabled")

    monkeypatch.setattr(learning_jobs, "external_path", unexpected_io)
    monkeypatch.setattr(learning_jobs, "_read", unexpected_io)
    monkeypatch.setattr(learning_jobs, "_write", unexpected_io)
    records, _ = run_jobs([Job("a", {"value": 1})], tiny_worker)
    assert records == [{"value": 1, "label": "cobre ñ"}]


@pytest.mark.parametrize("workers", [1, 2])
def test_adversarial_new_validator_and_progress_run_in_parent_and_callback_failure_is_fatal(tmp_path, workers):
    parent = os.getpid()
    validations = []

    def validate(record):
        assert os.getpid() == parent
        validations.append(record)

    def progress(*args):
        assert os.getpid() == parent
        raise LookupError("cannot report progress")

    before = {child.pid for child in multiprocessing.active_children()}
    with pytest.raises(LookupError, match="cannot report progress") as caught:
        run_jobs([Job("a", {"value": 1})], tiny_worker, workers=workers, checkpoint_dir=tmp_path,
                 fingerprint=FINGERPRINT, validate=validate, progress=progress)
    assert_identity(caught.value, "a")
    assert validations == [{"value": 1, "label": "cobre ñ"}]
    assert cache_file(tmp_path).exists()
    assert not ({child.pid for child in multiprocessing.active_children()} - before)


def test_cached_validator_file_not_found_is_not_a_cache_miss(tmp_path):
    marker = tmp_path / "marker"
    jobs = [Job("a", {"value": 1, "marker": str(marker)})]
    run_jobs(jobs, tiny_worker, checkpoint_dir=tmp_path, fingerprint=FINGERPRINT)

    def missing_scientific_dependency(record):
        raise FileNotFoundError("required validation input is absent")

    with pytest.raises(FileNotFoundError, match="required validation input is absent") as caught:
        run_jobs(jobs, tiny_worker, checkpoint_dir=tmp_path, fingerprint=FINGERPRINT, validate=missing_scientific_dependency)
    assert_identity(caught.value, "a")
    assert marker.read_text().splitlines() == ["executed"]


@pytest.mark.parametrize("value", [(1, 2), {1: "not a string key"}, b"bytes", object()])
def test_native_json_only_no_silent_conversion(tmp_path, value):
    with pytest.raises(TypeError) as caught:
        run_jobs([Job("a", {"value": value})], tiny_worker, checkpoint_dir=tmp_path, fingerprint=FINGERPRINT)
    assert_identity(caught.value, "a")
    assert not cache_file(tmp_path).exists()


def test_non_dict_and_mutating_validator_are_rejected(tmp_path):
    with pytest.raises(TypeError, match="dict") as caught:
        run_jobs([Job("a", {})], lambda payload: [], checkpoint_dir=tmp_path, fingerprint=FINGERPRINT)
    assert_identity(caught.value, "a")

    def mutating_validator(record):
        record["value"] = 2

    with pytest.raises(ValueError, match="must not mutate"):
        run_jobs([Job("a", {"value": 1})], tiny_worker, checkpoint_dir=tmp_path, fingerprint=FINGERPRINT,
                 validate=mutating_validator)
    assert not cache_file(tmp_path).exists()


def test_unpickleable_payload_propagates_and_pool_is_cleaned():
    before = {child.pid for child in multiprocessing.active_children()}
    with pytest.raises((AttributeError, TypeError)) as caught:
        run_jobs([Job("unpickleable", {"value": lambda: None})], tiny_worker, workers=2)
    assert_identity(caught.value, "unpickleable")
    assert not ({child.pid for child in multiprocessing.active_children()} - before)


def test_cached_validator_failure_preflights_all_jobs_before_execution(tmp_path):
    run_jobs([Job("a", {"value": -1})], tiny_worker, checkpoint_dir=tmp_path, fingerprint=FINGERPRINT)
    marker = tmp_path / "must-not-run"
    with pytest.raises(ValueError, match="must be positive"):
        run_jobs([Job("new", {"value": 2, "marker": str(marker)}), Job("a", {"value": -1})], tiny_worker,
                 workers=2, checkpoint_dir=tmp_path, fingerprint=FINGERPRINT, validate=require_positive)
    assert not marker.exists()
