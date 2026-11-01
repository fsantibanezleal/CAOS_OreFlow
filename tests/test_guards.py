"""The complete product must pass before an isolated adversarial plant is meaningful."""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]


@pytest.mark.parametrize("script, marker", [
    ("check_sdd.py", "check_sdd: OK"),
    ("check_svg_animation.py", "check_svg_animation: OK"),
    ("check_base_integrity.py", "guards: OK"),
])
def test_guard_cli_accepts_the_complete_product(script: str, marker: str) -> None:
    result = subprocess.run(
        [sys.executable, str(ROOT / "scripts" / script), str(ROOT)],
        cwd=ROOT, capture_output=True, encoding="utf-8", errors="replace", timeout=120,
    )
    assert result.returncode == 0, result.stdout + result.stderr
    assert marker in result.stdout, result.stdout
