"""Ordered scientific jobs with spawn isolation and verified external checkpoints.

The caller owns scientific validation and fingerprint identity. This module never
changes seeds, converts numerical arrays, or treats failed work as a result.
"""
from __future__ import annotations

import hashlib
import json
import multiprocessing
import os
import re
import tempfile
from collections.abc import Callable, Iterable
from concurrent.futures import FIRST_COMPLETED, Future, ProcessPoolExecutor, wait
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from ..io.storage import external_path

__all__ = ["Job", "run_jobs"]

_SCHEMA = "oreflow.learning-job/v1"
_FIELDS = {"schema", "fingerprint", "job_id", "result_sha256", "result"}
_FINGERPRINT = re.compile(r"[0-9a-fA-F]{64}")


@dataclass(frozen=True)
class Job:
    """Stable identity plus a caller-owned pickleable payload."""

    id: str
    payload: object


def _native_json(value: Any) -> None:
    if value is None or type(value) in (str, bool, int, float):
        return
    if isinstance(value, dict):
        for key, item in value.items():
            if not isinstance(key, str):
                raise TypeError("JSON object keys must be strings")
            _native_json(item)
    elif isinstance(value, list):
        for item in value:
            _native_json(item)
    else:
        raise TypeError(f"Result contains non-JSON value {type(value).__name__}; convert it in the worker")


def _canonical(value: Any) -> bytes:
    _native_json(value)
    return json.dumps(value, sort_keys=True, ensure_ascii=False, allow_nan=False, separators=(",", ":")).encode("utf-8")


def _identified(job: Job, phase: str, function: Callable, *args: Any) -> Any:
    try:
        return function(*args)
    except BaseException as exc:
        exc.add_note(f"Learning job {job.id!r} during {phase}")
        raise


def _validated(result: Any, validate: Callable[[dict], None] | None) -> bytes:
    if not isinstance(result, dict):
        raise TypeError("A learning job must return a JSON-compatible dict")
    encoded = _canonical(result)
    if validate is not None:
        validate(result)
        if _canonical(result) != encoded:
            raise ValueError("A result validator must not mutate its record")
    return encoded


def _pairs(pairs: list[tuple[str, Any]]) -> dict:
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError(f"Duplicate checkpoint JSON key {key!r}")
        result[key] = value
    return result


def _invalid_constant(value: str) -> None:
    raise ValueError(f"Nonfinite checkpoint JSON constant {value}")


def _read(path: Path, fingerprint: str, job: Job, validate: Callable[[dict], None] | None) -> dict | None:
    try:
        handle = path.open("r", encoding="utf-8")
    except FileNotFoundError:
        return None
    with handle:
        envelope = json.load(handle, object_pairs_hook=_pairs, parse_constant=_invalid_constant)
    if not isinstance(envelope, dict) or set(envelope) != _FIELDS:
        raise ValueError("Invalid checkpoint envelope fields")
    if envelope["schema"] != _SCHEMA or envelope["fingerprint"] != fingerprint or envelope["job_id"] != job.id:
        raise ValueError("Checkpoint schema, fingerprint or job identity mismatch")
    result = envelope["result"]
    encoded = _validated(result, None)
    if envelope["result_sha256"] != hashlib.sha256(encoded).hexdigest():
        raise ValueError("Checkpoint result checksum mismatch")
    _validated(result, validate)
    return result


def _destination(directory: Path, job: Job) -> Path:
    path = external_path(directory / (hashlib.sha256(job.id.encode("utf-8")).hexdigest() + ".json"))
    if path.parent != directory:
        raise ValueError("Checkpoint file escapes its fingerprint namespace")
    return path


def _write(path: Path, fingerprint: str, job: Job, result: dict, encoded: bytes) -> None:
    # Resolve again immediately before creating either directory or unique temp file.
    directory = external_path(path.parent)
    directory.mkdir(parents=True, exist_ok=True)
    directory = external_path(directory)
    destination = _destination(directory, job)
    envelope = {"schema": _SCHEMA, "fingerprint": fingerprint, "job_id": job.id,
                "result_sha256": hashlib.sha256(encoded).hexdigest(), "result": result}
    content = _canonical(envelope)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(mode="wb", dir=directory, prefix=f".{destination.stem}.",
                                         suffix=".tmp", delete=False) as handle:
            temporary = Path(handle.name)
            handle.write(content)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, _destination(external_path(directory), job))
    finally:
        if temporary is not None:
            # Only this call's unique unfinished file, never an existing checkpoint.
            temporary.unlink(missing_ok=True)


def run_jobs(
    jobs: Iterable[Job],
    worker: Callable[[object], dict],
    *,
    workers: int = 1,
    checkpoint_dir: Path | None = None,
    fingerprint: str | None = None,
    validate: Callable[[dict], None] | None = None,
    progress: Callable[[str, int, int, bool], None] | None = None,
) -> tuple[list[dict], dict[str, int]]:
    """Run jobs in input order, resuming only verified same-identity results.

    ``attempted`` counts every planned job, including cache hits; ``executed``
    counts fresh jobs. Progress is called in the parent after validated completion.
    Original exceptions propagate with a job/phase note. Failure cancels queued
    work and waits for running processes, retaining their valid checkpoints.

    Guard application entrypoints with ``if __name__ == '__main__'`` when using
    spawn. Checkpoints require an explicit external directory and 64-hex digest;
    this function does not infer a fingerprint or read environment roots.
    """
    if type(workers) is not int or not 1 <= workers <= 4:
        raise ValueError("workers must be an integer from 1 to 4")
    if not callable(worker) or (validate is not None and not callable(validate)) or (progress is not None and not callable(progress)):
        raise TypeError("worker, validate and progress must be callable when provided")
    planned = list(jobs)
    seen = set()
    for job in planned:
        if not isinstance(job, Job) or not isinstance(job.id, str) or not job.id.strip():
            raise ValueError("Each job must have a nonempty string ID")
        if job.id in seen:
            raise ValueError(f"Duplicate learning job ID {job.id!r}")
        seen.add(job.id)
    if fingerprint is not None:
        if not isinstance(fingerprint, str) or _FINGERPRINT.fullmatch(fingerprint) is None:
            raise ValueError("fingerprint must be a 64-hex SHA256 digest")
        fingerprint = fingerprint.lower()
    directory = None
    if checkpoint_dir is not None:
        if fingerprint is None:
            raise ValueError("Checkpointing requires a configuration fingerprint")
        root = external_path(checkpoint_dir)
        directory = external_path(root / fingerprint)
        if directory.parent != root:
            raise ValueError("Checkpoint fingerprint namespace escapes its external root")

    records: dict[str, dict] = {}
    cached: list[Job] = []
    pending: list[Job] = []
    # Complete preflight before progress notifications or any worker execution.
    for job in planned:
        if directory is None:
            pending.append(job)
            continue
        path = _identified(job, "cache destination", _destination, directory, job)
        record = _identified(job, "cache validation", _read, path, fingerprint, job, validate)
        if record is None:
            pending.append(job)
        else:
            records[job.id] = record
            cached.append(job)

    completed = 0

    def notify(job: Job, resumed: bool) -> None:
        nonlocal completed
        completed += 1
        if progress is not None:
            _identified(job, "progress callback", progress, job.id, completed, len(planned), resumed)

    def finish(job: Job, result: dict) -> None:
        encoded = _identified(job, "result validation", _validated, result, validate)
        if directory is not None:
            path = _identified(job, "cache destination", _destination, directory, job)
            _identified(job, "checkpoint write", _write, path, fingerprint, job, result, encoded)
        records[job.id] = result
        notify(job, False)

    for job in cached:
        notify(job, True)

    if workers == 1:
        for job in pending:
            finish(job, _identified(job, "worker", worker, job.payload))
    elif pending:
        pool = ProcessPoolExecutor(max_workers=workers, mp_context=multiprocessing.get_context("spawn"))
        active: dict[Future, Job] = {}
        iterator = iter(pending)

        def submit_next() -> None:
            job = next(iterator, None)
            if job is not None:
                future = _identified(job, "worker submission", pool.submit, worker, job.payload)
                active[future] = job

        try:
            for _ in range(min(workers, len(pending))):
                submit_next()
            while active:
                ready, _ = wait(active, return_when=FIRST_COMPLETED)
                for future in ready:
                    job = active.pop(future)
                    finish(job, _identified(job, "worker", future.result))
                for _ in ready:
                    submit_next()
        except BaseException as original:
            for future in active:
                future.cancel()
            pool.shutdown(wait=True, cancel_futures=True)
            # Workers never write checkpoints themselves. Drain successful work
            # after shutdown even when another completion caused the failure.
            for future, job in active.items():
                if future.cancelled():
                    continue
                try:
                    finish(job, _identified(job, "worker", future.result))
                except BaseException as additional:
                    original.add_note(f"Additional failure for learning job {job.id!r}: {type(additional).__name__}: {additional}")
            raise
        else:
            pool.shutdown(wait=True)

    return [records[job.id] for job in planned], {
        "workers": workers, "attempted": len(planned), "resumed": len(cached), "executed": len(pending),
    }
