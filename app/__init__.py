"""OreFlow service: serves the static build, the baked artifacts, the operating contract and a bounded live
simulation that validates each state against Contract 1 before running the process engine. It is a thin
layer over data/derived and data-pipeline/pipeline/engine, never a second implementation of the engine."""
from pathlib import Path

__version__ = (Path(__file__).resolve().parents[1] / "VERSION").read_text(encoding="utf-8").strip()
