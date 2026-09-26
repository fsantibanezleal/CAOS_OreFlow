#!/usr/bin/env python3
"""PE-33 units guard: every numeric constant of the process engine and its methods is declared.

Fails when an engine or method module (Python or TypeScript) contains a numeric literal that is
neither structural (0, 1, 2, 0.5, 100, integers) nor read from engine/data/constants.json, and when
a declared constant lacks a unit or a source. Standard library only (ADR-0074).
"""
from __future__ import annotations

import ast
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ENGINE_PY = ROOT / "data-pipeline" / "pipeline" / "engine"
METHODS_PY = ROOT / "data-pipeline" / "pipeline" / "methods"
ENGINE_TS = ROOT / "frontend" / "src" / "engine"
CONSTANTS = ENGINE_PY / "data" / "constants.json"
STRUCTURAL = {0.0, 1.0, 2.0, 0.5, 100.0, -1.0, 0.25}
BLOCK_COMMENT = re.compile(r"/\*.*?\*/", re.S)
TS_NUMBER = re.compile(r"(?<![\w.])(\d+\.\d+(?:e[-+]?\d+)?|\d+e[-+]?\d+)(?![\w.])")


def python_violations() -> list[str]:
    out = []
    for path in sorted(ENGINE_PY.glob("*.py")) + sorted(METHODS_PY.glob("*.py")):
        tree = ast.parse(path.read_text(encoding="utf-8"))
        for node in ast.walk(tree):
            if isinstance(node, ast.Constant) and isinstance(node.value, float) and node.value not in STRUCTURAL:
                out.append(f"{path.relative_to(ROOT)}:{node.lineno}: undeclared literal {node.value!r}")
    return out


def typescript_violations() -> list[str]:
    out = []
    if not ENGINE_TS.exists():
        return out
    for path in sorted(ENGINE_TS.glob("*.ts")):
        text = path.read_text(encoding="utf-8")
        # block comments are not code: blank them, keeping their newlines so line numbers stay true
        text = BLOCK_COMMENT.sub(lambda m: "\n" * m.group(0).count("\n"), text)
        for lineno, line in enumerate(text.splitlines(), 1):
            code = line.split("//", 1)[0]
            for match in TS_NUMBER.finditer(code):
                if float(match.group(1)) not in STRUCTURAL:
                    out.append(f"{path.relative_to(ROOT)}:{lineno}: undeclared literal {match.group(1)}")
    return out


def declaration_violations() -> list[str]:
    table = json.loads(CONSTANTS.read_text(encoding="utf-8"))["constants"]
    return [f"constants.json: {key} lacks unit or source" for key, entry in table.items()
            if not str(entry.get("unit", "")).strip() or not str(entry.get("source", "")).strip()]


def main() -> int:
    problems = declaration_violations() + python_violations() + typescript_violations()
    for line in problems:
        print(line)
    print(f"check_units: {'FAILED' if problems else 'OK'} ({len(problems)} problem(s))")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
