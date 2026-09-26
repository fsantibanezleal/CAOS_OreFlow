#!/usr/bin/env python3
"""Fail the build if the interface computes what the engine owns (PE-36) or sweeps without being asked (PE-38).

The browser engine lives in frontend/src/engine/ and runs in the Web Worker; everything else in the
interface draws what the engine's trace says. Three rules, checked on the interface sources:

1. No engine formula outside the engine: no ``Math.exp(``, ``Math.pow(`` or ``**`` in an interface
   file, unless the line carries a ``not-engine:`` comment saying why the arithmetic is not an engine
   quantity (the inverse of a learned target's definition, the guard's error norm, a classifier's link).
2. Interface files import from the engine only its interface: the worker client, the contract
   validator, the data types, the mineral table and the grade-unit conversion. Importing the solver
   itself would run the engine on the interface thread and outside the parity test.
3. A sweep starts only from an explicit request: ``sweepInWorker(`` is called only inside a function
   named ``compute``, and ``compute`` is referenced only as a click handler, never from an effect or a
   slider's change handler.

Files of the pre-0.05 interface that the content rewrite removes are listed in LEGACY and skipped;
the list must be empty for release. Standard library only; exit 1 on any finding.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "frontend" / "src"
ENGINE = SRC / "engine"
LEGACY = {
    "live/engine.ts", "components/Charts.tsx", "components/MethodFigures.tsx", "components/EvidenceFigure.tsx",
    "content/Research.tsx", "api/artifacts.ts", "lib/locale.ts", "lib/contract.types.ts",
}
ALLOWED_ENGINE = {"client", "contract", "model", "trace", "sweep", "circuit", "constants", "ore"}
FORMULA = re.compile(r"Math\.exp\(|Math\.pow\(|\*\*")
ENGINE_IMPORT = re.compile(r"""from\s+['"]((?:\.\./)+|\./)engine(?:/([\w-]+))?['"]""")
COMMENT = re.compile(r"^\s*(//|\*|/\*)")


def interface_files() -> list[Path]:
    out = []
    for path in sorted(SRC.rglob("*")):
        if path.suffix not in {".ts", ".tsx"} or ENGINE in path.parents or "test" in path.relative_to(SRC).parts:
            continue
        if path.relative_to(SRC).as_posix() in LEGACY:
            continue
        out.append(path)
    return out


def function_body(text: str, start: int) -> tuple[int, int]:
    """Span of the braces that open after ``start``."""
    open_at = text.index("{", start)
    depth = 0
    for i in range(open_at, len(text)):
        if text[i] == "{":
            depth += 1
        elif text[i] == "}":
            depth -= 1
            if depth == 0:
                return open_at, i
    raise ValueError("unbalanced braces")


def check(path: Path) -> list[str]:
    rel = path.relative_to(ROOT).as_posix()
    text = path.read_text(encoding="utf-8")
    findings = []
    for number, line in enumerate(text.splitlines(), 1):
        if FORMULA.search(line) and not COMMENT.match(line) and "not-engine:" not in line:
            findings.append(f"{rel}:{number}: engine-style arithmetic in the interface (PE-36): {line.strip()[:90]}")
        for match in ENGINE_IMPORT.finditer(line):
            module = match.group(2)
            if module is None or module not in ALLOWED_ENGINE:
                findings.append(f"{rel}:{number}: imports the engine's solver into the interface (PE-36): {line.strip()[:90]}")
    calls = [m.start() for m in re.finditer(r"\bsweepInWorker\(", text)]
    if calls:
        definition = re.search(r"const\s+compute\s*=\s*(async\s*)?\([^)]*\)\s*=>\s*{", text)
        if not definition:
            findings.append(f"{rel}: sweepInWorker is called outside a compute function (PE-38)")
        else:
            lo, hi = function_body(text, definition.start())
            for at in calls:
                if not lo < at < hi:
                    findings.append(f"{rel}:{text.count(chr(10), 0, at) + 1}: sweepInWorker outside compute (PE-38)")
            # code references only: a call, a prop, or a callback argument (the word inside a string is text)
            for use in re.finditer(r"\bcompute\s*\(|=\{\s*compute\s*\}|[(,]\s*compute\s*[),]", text):
                if use.group(0) == "={compute}" and text[use.start() - 7:use.start()] == "onClick":
                    continue
                findings.append(f"{rel}:{text.count(chr(10), 0, use.start()) + 1}: compute is referenced other than as a click handler (PE-38)")
    return findings


def main() -> int:
    findings = [f for path in interface_files() for f in check(path)]
    legacy_present = sorted(p for p in LEGACY if (SRC / p).exists())
    if findings:
        print("UI FORMULA CHECK FAILED:")
        for finding in findings:
            print("  " + finding)
        return 1
    note = f"; {len(legacy_present)} legacy file(s) pending removal: {', '.join(legacy_present)}" if legacy_present else ""
    print(f"check_ui_formulas: OK, {len(interface_files())} interface files{note}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
