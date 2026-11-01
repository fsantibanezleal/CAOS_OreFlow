"""Call-time external raw/cache paths. Compact release artifacts stay in the repo.

Roots are device roles supplied by the caller; this module never loads .env.
Explicit source files are read-only, including legacy ignored files in a checkout.
"""
from __future__ import annotations

import os
from pathlib import Path

REPOSITORY = Path(__file__).resolve().parents[3]


def external_path(path: str | Path) -> Path:
    """Resolve symlinks/junctions before checking a raw/checkpoint destination."""
    resolved = Path(path).expanduser().resolve()
    if resolved.is_relative_to(REPOSITORY):
        raise ValueError("Raw caches and checkpoints must be outside the repository; use an external root.")
    return resolved


def resolve_root(variable: str, root: str | Path | None = None) -> Path:
    value = root if root is not None else os.environ.get(variable)
    if value is None or not str(value).strip():
        option = "--data-root" if variable == "CAOS_DATA_ROOT" else "--models-root"
        raise ValueError(f"Set {variable} or pass {option} pointing outside the repository.")
    return external_path(value)


def raw_directory(data_root: str | Path | None = None) -> Path:
    return external_path(resolve_root("CAOS_DATA_ROOT", data_root) / "oreflow" / "raw")


def source_path(filename: str, path: str | Path | None = None, *, data_root: str | Path | None = None) -> Path:
    if path is not None:
        explicit = Path(path).expanduser().resolve()
        if not explicit.is_file():
            raise FileNotFoundError(f"Explicit source file does not exist: {explicit}; use fetch-data to populate a cache.")
        return explicit
    return external_path(raw_directory(data_root) / filename)


def checkpoint_directory(models_root: str | Path | None = None) -> Path:
    return external_path(resolve_root("CAOS_MODELS_ROOT", models_root) / "oreflow")


def checkpoint_path(filename: str, path: str | Path | None = None, *, models_root: str | Path | None = None) -> Path:
    return external_path(path if path is not None else checkpoint_directory(models_root) / filename)
