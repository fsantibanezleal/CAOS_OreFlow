#!/usr/bin/env python3
"""Reproduce the distinct HZDR particle-separation learning lane and its source summary."""
from pathlib import Path

from pipeline.stages import preprocess
from pipeline.stages.particle_experiment import run

ROOT = Path(__file__).resolve().parents[1]
preprocess.run(ROOT / "data" / "raw", ROOT / "data" / "derived")
result = run(
    ROOT / "data" / "raw" / "SM1.Constructed_cases_data.xlsx",
    ROOT / "data" / "derived" / "source" / "hzdr_particle_benchmark.json",
    ROOT / "models",
)
print(
    f"HZDR particles: {result['protocol']['train_rows']} train, "
    f"{result['protocol']['test_rows']} test, 4 constructed separation cases; "
    f"neural device={result['protocol']['device']}"
)
