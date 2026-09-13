#!/usr/bin/env python3
"""Guard that the public product does not ship the template's SIR example."""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TEXT = {".ts", ".tsx", ".js", ".jsx", ".mjs", ".py", ".md", ".json", ".css", ".html", ".yml", ".yaml", ".toml", ".txt"}
FORBIDDEN = ("SIRChart", "EX01_subcritical", "EX02_epidemic", "CTRL_degenerate", "PENDING-training", "CAOS product template")
PATHS = ("data/derived/EX01_", "data/derived/EX02_", "data/derived/EX03_", "data/derived/EX04_", "data/derived/manifests/EX0", "architecture.ts.txt")


def main() -> int:
    files = [line for line in subprocess.run(["git", "ls-files"], cwd=ROOT, capture_output=True, text=True, check=True).stdout.splitlines() if line]
    hits = []
    for rel in files:
        if rel == "scripts/check_template_residue.py":
            continue
        if any(token in rel for token in PATHS):
            hits.append(f"path: {rel}")
            continue
        if Path(rel).suffix.lower() not in TEXT:
            continue
        content = (ROOT / rel).read_text(encoding="utf-8", errors="ignore")
        for token in FORBIDDEN:
            if token in content:
                hits.append(f"content: {rel} contains {token}")
    if hits:
        print("template residue found:"); print("\n".join(f"  {h}" for h in hits)); return 1
    print(f"template residue: OK ({len(files)} tracked files)"); return 0


if __name__ == "__main__":
    sys.exit(main())
