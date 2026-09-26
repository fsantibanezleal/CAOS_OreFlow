"""OreFlow's process engine, methods and reproducible bake."""
from pathlib import Path

# One version source for the pipeline, the service and the artifacts (display X.XX.XXX).
__version__ = (Path(__file__).resolve().parents[2] / "VERSION").read_text(encoding="utf-8").strip()
