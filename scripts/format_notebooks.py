"""Format Python code cells in the authored bilingual notebooks with the repository's Ruff config."""

from __future__ import annotations

import json
import subprocess
import sys
import textwrap
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main() -> int:
    paths = sorted((ROOT / "notebooks").glob("*/*/*.ipynb"))
    changed = 0
    for path in paths:
        notebook = json.loads(path.read_text(encoding="utf-8"))
        dirty = False
        for cell in notebook.get("cells", []):
            if cell.get("cell_type") != "code":
                continue
            source = "".join(cell.get("source", []))
            result = subprocess.run(
                [sys.executable, "-m", "ruff", "format", "--config", "line-length=100", "--stdin-filename", "notebook_cell.py", "-"],
                input=source,
                text=True,
                encoding="utf-8",
                capture_output=True,
                cwd=ROOT,
                check=False,
            )
            if result.returncode:
                raise RuntimeError(f"Ruff could not format {path.relative_to(ROOT)}: {result.stderr.strip()}")
            formatted = result.stdout
            lines = []
            for line in formatted.splitlines(keepends=True):
                body = line.rstrip("\r\n")
                ending = line[len(body):]
                if len(body) > 100 and body.lstrip().startswith("#"):
                    indent = body[: len(body) - len(body.lstrip())]
                    comment = body.lstrip()[1:].strip()
                    wrapped = textwrap.wrap(comment, width=max(40, 98 - len(indent)), break_long_words=False)
                    lines.extend(f"{indent}# {part}{ending}" for part in wrapped)
                else:
                    lines.append(line)
            formatted = "".join(lines)
            if formatted != source:
                cell["source"] = formatted.splitlines(keepends=True)
                dirty = True
        if dirty:
            path.write_text(json.dumps(notebook, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
            changed += 1
    print(f"format_notebooks: formatted code cells in {changed} notebooks")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
