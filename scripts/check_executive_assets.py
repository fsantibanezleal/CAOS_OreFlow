#!/usr/bin/env python3
"""Check that every executive illustration has valid, localized SVG assets."""

from __future__ import annotations

import json
import sys
import xml.etree.ElementTree as ET
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "content" / "executive.json"
PUBLIC = ROOT / "frontend" / "public"
SPANISH_ONLY = ("OreFlow research path", "Crushing", "Grinding", "Separation")


def findings() -> list[str]:
    """Return one actionable finding for each invalid executive illustration asset."""
    data = json.loads(DATA.read_text(encoding="utf-8"))
    illustrations = data.get("illustrations", {})
    errors: list[str] = []

    if set(illustrations) != {"pain", "situation", "proposal"}:
        errors.append("content/executive.json must define pain, situation and proposal illustrations")
        return errors

    for name, illustration in illustrations.items():
        files = illustration.get("file")
        if not isinstance(files, dict) or set(files) != {"en", "es"}:
            errors.append(f"{name}: file must map both en and es to distinct SVG assets")
            continue
        if files["en"] == files["es"]:
            errors.append(f"{name}: English and Spanish use the same SVG")

        for language, relative in files.items():
            path = PUBLIC / relative
            if not path.is_file():
                errors.append(f"{name}/{language}: missing {relative}")
                continue
            try:
                root = ET.parse(path).getroot()
            except ET.ParseError as error:
                errors.append(f"{name}/{language}: invalid SVG XML in {relative}: {error}")
                continue
            namespace = "{http://www.w3.org/2000/svg}"
            if root.tag != f"{namespace}svg" or root.find(f"{namespace}title") is None or root.find(f"{namespace}desc") is None:
                errors.append(f"{name}/{language}: SVG needs a root, accessible title and description")
            if language == "es":
                text = " ".join((element.text or "").strip() for element in root.iter())
                if any(label in text for label in SPANISH_ONLY):
                    errors.append(f"{name}/es: untranslated English wording remains in {relative}")

    return errors


def main() -> int:
    errors = findings()
    if errors:
        print("executive assets: FAILED")
        for error in errors:
            print(f"  - {error}")
        return 1
    print("executive assets: OK, three accessible illustrations with distinct English and Spanish SVGs")
    return 0


if __name__ == "__main__":
    sys.exit(main())
