#!/usr/bin/env python3
"""Explicitly train the HZDR lane; keep local weights outside the repository."""
from __future__ import annotations

import argparse
import hashlib
import shutil
from pathlib import Path

from fetch import HZDR_FILE, HZDR_SHA256, fetch
from pipeline.io.storage import checkpoint_directory, source_path
from pipeline.stages import preprocess
from pipeline.stages.particle_experiment import run

ROOT = Path(__file__).resolve().parents[1]


def build(source: Path | None = None, output: Path = ROOT / "data" / "derived",
          models_root: Path | None = None, data_root: Path | None = None,
          onnx_output: Path = ROOT / "models" / "particle_mlp.onnx") -> dict:
    models = checkpoint_directory(models_root)
    if source is None:
        source = fetch("hzdr", data_root)[0]
    source = source_path(HZDR_FILE, source)
    if source.name != HZDR_FILE:
        raise ValueError(f"HZDR --source must retain the workbook filename {HZDR_FILE} for its source summary.")
    if hashlib.sha256(source.read_bytes()).hexdigest() != HZDR_SHA256:
        raise ValueError("HZDR source checksum drift")
    preprocess.run(source.parent, output)
    result = run(source, output / "source" / "hzdr_particle_benchmark.json", models)
    # The stage exports local .pt weights and browser ONNX externally. Only the
    # declared compact browser asset is copied back during this explicit bake.
    onnx_output.parent.mkdir(parents=True, exist_ok=True)
    if onnx_output.resolve() != (models / "particle_mlp.onnx").resolve():
        shutil.copyfile(models / "particle_mlp.onnx", onnx_output)
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, help="existing read-only HZDR workbook")
    parser.add_argument("--data-root", type=Path, help="external data root (or CAOS_DATA_ROOT)")
    parser.add_argument("--models-root", type=Path, help="external checkpoint root (or CAOS_MODELS_ROOT)")
    parser.add_argument("--output", type=Path, default=ROOT / "data" / "derived", help="compact derived artifact directory")
    parser.add_argument("--onnx-output", type=Path, default=ROOT / "models" / "particle_mlp.onnx")
    args = parser.parse_args()
    result = build(args.source, args.output, args.models_root, args.data_root, args.onnx_output)
    print(f"HZDR particles: {result['protocol']['train_rows']} train, "
          f"{result['protocol']['test_rows']} test, 4 constructed separation cases; "
          f"neural device={result['protocol']['device']}")


if __name__ == "__main__":
    main()
