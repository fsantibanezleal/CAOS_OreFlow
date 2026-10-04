#!/usr/bin/env python3
"""Guard that the public product does not ship the template's SIR example."""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TEXT = {".ts", ".tsx", ".js", ".jsx", ".mjs", ".py", ".md", ".json", ".css", ".html", ".yml", ".yaml", ".toml", ".txt"}
# W-01 (review of 2026-10-02): the template's stage list and its kernel file outlived the template in the pipeline
# README, which gave a bake command that fails
FORBIDDEN = ("SIRChart", "EX01_subcritical", "EX02_epidemic", "CTRL_degenerate", "PENDING-training", "CAOS product template",
             "preprocess -> dataset -> feature_extraction", "pipeline/model/process.py", "run.py all --seed")
# OreFlow's one deploy path is its VPS (vps-service, the plan): the template's Pages workflow published a second copy
# from 0.02.001 to 0.07.000, against the rule that a repo carries only the deploy path it declares
PATHS = ("data/derived/EX01_", "data/derived/EX02_", "data/derived/EX03_", "data/derived/EX04_", "data/derived/manifests/EX0", "architecture.ts.txt",
         ".github/workflows/deploy-pages.yml")
# nor may a page or a doc send readers to that copy; the release history records it as it was
DEPLOY_COPY = "fsantibanezleal.github.io/CAOS_OreFlow"
# and no page, diagram or doc describes two deployments: the 0.08 sweep missed "the two deployments" in the modal
# and "the two builds" in a caption, which a search for the URL alone cannot find
TWO_HOSTS = ("two deployments", "dos despliegues", "two public hosts", "dos hosts públicos", "two builds", "dos compilaciones",
             "both hosts", "ambos hosts", "built twice", "compila dos veces", "Pages mirror")
HISTORY = {"CHANGELOG.md", "docs/release-verification.md"}


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
        if rel not in HISTORY and DEPLOY_COPY in content:
            hits.append(f"content: {rel} points to the removed Pages copy ({DEPLOY_COPY})")
        if rel not in HISTORY and not rel.endswith("/tasks.md"):
            lowered = content.lower()
            hits.extend(f"content: {rel} describes two deployments ({p})" for p in TWO_HOSTS if p.lower() in lowered)
    if hits:
        print("template residue found:")
        print("\n".join(f"  {h}" for h in hits))
        return 1
    print(f"template residue: OK ({len(files)} tracked files)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
