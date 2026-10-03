#!/usr/bin/env python3
"""Fail the build if tracked product content contains an EM-DASH or an EMOJI (ADR-0067), a banned ARROW in
interface source, or a LOCAL DISK PATH (ADR-0057 item 13).

Felipe's standing rule for every product: no emojis and no em-dashes in repo content. Both read as
an AI tell and are banned from product content (code, docs, UI strings, commit-tracked files alike), ADR-0067.
This guard enforces it structurally so no product, and the template itself, can drift.

What it flags (precise, to avoid punishing legitimate glyphs):
  - EM-DASH  U+2014  and HORIZONTAL BAR U+2015  (the banned dashes).
  - EMOJI: any codepoint in the Supplementary emoji/pictograph planes U+1F000..U+1FAFF, plus the
    emoji-presentation selector U+FE0F. This catches the pictographic emojis while intentionally
    NOT touching functional glyphs products do use: the info mark U+24D8 (the ADR-0058 modal button),
    the middot U+00B7 (Felipe's preferred separator), arrows like U+2197, check/cross marks, stars.

Not flagged: the ASCII double hyphen "--" (ubiquitous and legitimate in CLI flags and code) and the
en-dash U+2013. The rule as stated is em-dash + emoji; keep enforcement to exactly that.

ADR-0067's amendment of 2026-07-29 also bans the arrow characters in interface source (frontend/src): U+2190,
U+2192, U+2194, U+21D0, U+21D2, U+27F5 and U+27F6. The review of 0.07.000 (2026-10-02) found the guard had never
checked them (none existed), and three public docs carrying a development machine's temp folder (W-23): a drive
letter followed by a known machine folder, or a temp folder named for that machine, is flagged in every tracked
text file. The same review found references a public reader cannot follow (W-44, W-45, W-57): the private management
repository's paths, its research dossier's section numbers, a bare PubMed Central id in place of a citation, and a
vendor manual on a third-party document host. They are flagged in the current-state content; the CHANGELOG and the
release verification, which record their own releases, are left as they were written.

Scanned set = git-tracked text files only. Exit 1 on any hit, printing file:line:col.
"""
from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SELF = "scripts/check_content_standards.py"

BANNED_DASHES = {0x2014, 0x2015}  # em dash, horizontal bar
EMOJI_SELECTOR = 0xFE0F
BANNED_ARROWS = {0x2190, 0x2192, 0x2194, 0x21D0, 0x21D2, 0x27F5, 0x27F6}
ARROW_SCOPE = "frontend/src/"
# a drive path into a machine folder (E:\_Temp, C:/Users) or a bare temp folder; a URL scheme is not a drive
LOCAL_PATH = re.compile(r"(?<![A-Za-z])[A-Za-z]:[\\/](?:_Temp|Users|_Repos|Program Files|Windows)\b|(?<![\w./-])_Temp[\\/]", re.I)
PRIVATE_REFERENCE = re.compile(r"CAOS_MANAGE|wip/oreflow|plans/oreflow|conventions/shell-known-defects|dossier sections? \d"
                               r"|(?<![\w/])PMC\d{6,}|pdfcoffee\.com")
HISTORY = {"CHANGELOG.md", "docs/release-verification.md"}


def is_emoji(cp: int) -> bool:
    return 0x1F000 <= cp <= 0x1FAFF or cp == EMOJI_SELECTOR


TEXT_SUFFIXES = {
    ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".py", ".md", ".json",
    ".css", ".html", ".yml", ".yaml", ".toml", ".txt", ".cfg", ".ini", ".svg",
}


def tracked_files() -> list[str]:
    out = subprocess.run(
        ["git", "ls-files"], cwd=ROOT, capture_output=True, text=True, check=True
    )
    return [ln.strip() for ln in out.stdout.splitlines() if ln.strip()]


def main() -> int:
    hits: list[str] = []
    for rel in tracked_files():
        if rel == SELF or Path(rel).suffix.lower() not in TEXT_SUFFIXES:
            continue
        try:
            lines = (ROOT / rel).read_text(encoding="utf-8").splitlines()
        except (OSError, UnicodeDecodeError):
            continue
        for lineno, line in enumerate(lines, 1):
            for col, ch in enumerate(line, 1):
                cp = ord(ch)
                if cp in BANNED_DASHES:
                    hits.append(f"  {rel}:{lineno}:{col}  em-dash (U+{cp:04X})")
                elif is_emoji(cp):
                    hits.append(f"  {rel}:{lineno}:{col}  emoji (U+{cp:04X} {ch!r})")
                elif cp in BANNED_ARROWS and rel.startswith(ARROW_SCOPE):
                    hits.append(f"  {rel}:{lineno}:{col}  arrow (U+{cp:04X})")
            for match in LOCAL_PATH.finditer(line):
                hits.append(f"  {rel}:{lineno}:{match.start() + 1}  local path ({match.group(0)!r})")
            if rel not in HISTORY:
                for match in PRIVATE_REFERENCE.finditer(line):
                    hits.append(f"  {rel}:{lineno}:{match.start() + 1}  private or unfollowable reference ({match.group(0)!r})")

    if not hits:
        print("check_content_standards: OK, no em-dash, emoji, interface arrow, local path or private reference in "
              "tracked content.")
        return 0

    print("::error::banned characters found (no em-dash, no emoji in product content, ADR-0067):")
    for h in hits:
        print(h)
    print("\nReplace an em-dash with a comma, colon, semicolon, period, parentheses, or a middot "
          "as the sense requires. Remove emojis. Write an arrow in words. Replace a local path with a "
          "placeholder or a path relative to the repository. Replace a private reference with the public page "
          "that transcribes it, and a bare id with the full citation and its DOI. This applies to code, docs, and UI strings alike.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
