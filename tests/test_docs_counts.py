"""The documentation's counts and tables against the records (review of 2026-10-02, W-11 to W-16, W-24, W-54).

Docs drifted from 0.05 to 0.07 while every gate passed: "six stages" above a table of eight, "two measured lanes"
when there were three, "72 variants" when there were 96. This holds the prose that describes the current product to
the contract, the index, the validation record and the case records. Historical records (the CHANGELOG, the release
verification, the superseded design sections) are left alone: they describe their own release.
"""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DERIVED = ROOT / "data" / "derived"


def _read(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def _cases() -> list[dict]:
    index = _read(DERIVED / "manifests" / "index.json")
    return [_read(DERIVED / "cases" / f"{entry['case_id']}.json") for entry in index["cases"]]


MECHANISMS = (
    ("Gravity bleed", lambda units, pays: "gravity_split" in units),
    ("Desliming", lambda units, pays: "deslime" in units),
    ("LIMS drums", lambda units, pays: "lims_rougher" in units),
    ("Flotation", lambda units, pays: "rougher" in units),
    ("Regrind", lambda units, pays: "regrind" in units),
    ("Recleaner", lambda units, pays: "recleaner" in units),
    ("Second payable", lambda units, pays: len(pays) > 1),
)
COMMON = {"nominal", "harder_ore", "coarser_grind", "higher_throughput", "more_collector", "more_air", "cut_nominal", "cut_finer"}


def test_the_sdd_coverage_matrix_is_the_records():
    """W-54: SDD section 5's case-by-mechanism matrix, row by row, from each case's nominal circuit and variants."""
    text = (ROOT / "docs" / "design" / "SDD.md").read_text(encoding="utf-8")
    header = "| Case | " + " | ".join(name for name, _ in MECHANISMS) + " | Levers of its own |"
    assert header in text
    rows = {}
    for line in text[text.index(header):].splitlines()[2:]:
        if not line.startswith("|"):
            break
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        rows[cells[0]] = cells[1:]
    cases = _cases()
    assert sorted(rows) == sorted(a["case_id"] for a in cases)
    for artifact in cases:
        units = {u["unit"] for u in artifact["variants"][0]["trace"]["topology"]}
        pays = artifact["definition"]["ore"]["payables"]
        own = ", ".join(v["id"] for v in artifact["variants"] if v["id"] not in COMMON)
        expected = ["yes" if has(units, pays) else "" for _, has in MECHANISMS] + [own]
        assert rows[artifact["case_id"]] == expected, artifact["case_id"]
    # and every harder-ore and higher-throughput variant is power-limited, as the section says
    for artifact in cases:
        limited = {v["id"] for v in artifact["variants"] if v["trace"]["metrics"]["power_limited"]}
        assert {"harder_ore", "higher_throughput"} <= limited, artifact["case_id"]
    assert re.search(r"every harder-ore and higher-throughput\s+variant is power-limited", text)


def test_the_unit_and_kinetic_pages_quote_the_records():
    """W-24, W-43: page 11's fit count (it said 330 after the bake had 440), page 03's design load (phosphate is
    220%, not 250%) and page 02's feed F80 (a millimetre value in a micrometre column)."""
    def flat(page: str) -> str:
        return " ".join((ROOT / "docs" / "methodologies" / page).read_text(encoding="utf-8").split())

    kinetics = _read(DERIVED / "benchmark.json")["kinetics"]
    per_model = {v["fits"] for v in kinetics.values()}
    assert len(per_model) == 1 and all(v["converged_share"] == 1.0 for v in kinetics.values())
    fits = sum(v["fits"] for v in kinetics.values())
    cases = _cases()
    flotation = [a for a in cases if "rougher" in {u["unit"] for u in a["variants"][0]["trace"]["topology"]}]
    variants = sum(len(a["variants"]) for a in flotation)
    assert variants == per_model.pop()
    words = {5: "five", 11: "eleven", 12: "twelve"}
    eleven = flat("11_kinetic-fits.md")
    assert f"All {fits} fits on the baked flotation variants converge ({variants} variants, {words[len(kinetics)]} models each" in eleven
    assert f"On the {words[len(flotation)]} flotation cases' nominal states" in eleven
    loads = {a["case_id"]: round(100 * a["nominal"]["circulating_load"]) for a in cases}
    common = max(set(loads.values()), key=list(loads.values()).count)
    others = {k: v for k, v in loads.items() if v != common}
    assert (common, others) == (250, {"phosphate_clay": 220})
    assert f"| design circulating load | {common}% nominal ({others['phosphate_clay']}% in the phosphate case) (control) |" in flat("03_grinding-circuit.md")
    feed = {a["definition"]["plant"]["crusher"]["feed_f80_um"] for a in cases}
    assert feed == {60000.0}
    assert "| crusher feed F80, slope | 60,000 (60 mm), 0.9 | um, 1 |" in flat("02_crushing.md")
    # E-04: page 03 quoted the 0.07 oracle (a net engine energy against the gross published one) after it changed
    molycop = _read(DERIVED / "benchmark.json")["oracles"]["molycop"]
    net, gross = molycop["comparison"]["net_specific_energy_kwh_t"], molycop["comparison"]["gross_specific_energy_kwh_t"]
    assert molycop["within_tolerance"] and molycop["tolerance"]["net_specific_energy_kwh_t"] == 0.2
    page = flat("03_grinding-circuit.md")
    assert (f"the net specific energy is {net['engine']:.2f} kWh/t against the published {net['published']:.2f}, "
            f"{abs(100 * net['relative_error']):.1f}% below, inside the 20% tolerance") in page
    assert f"the gross is {gross['engine']:.2f} against {gross['published']:.2f}" in page
    assert "moves the net energy from 7.12 to 7.45 kWh/t" in page and "7.12 to 7.45 kWh/t" in molycop["parameters"]["note"]


RETIRED = {
    r"\btwo measured(?:-data)? lanes\b": "three measured lanes since 0.07.000",
    r"\bboth measured lanes\b": "three measured lanes since 0.07.000",
    r"\bsix stages\b": "the bake runs eight stages since 0.07.000",
    r"\bindependent (?:browser|second) implementation\b": "the port is a line-by-line translation (W-26)",
    r"\btwelve contract inputs\b": "thirteen inputs since 0.07.000",
    r"\b12 x 6\b|\btwelve by six\b": "eight variants per case since 0.07.000",
    r"\bcyclone_pressure\b(?! flag)": "the flag retired in 0.08.000",
    r"\bPMC9572913\b": "cite Castellon et al. 2022 (W-44)",
}


def test_current_docs_carry_no_retired_phrase():
    """W-11, W-13, W-16, W-26: phrases the product outgrew, swept from the documents that describe the current
    release. The design records, the CHANGELOG, the release verification and the rendered use cases describe their
    own releases and are left alone."""
    current = [ROOT / "README.md", ROOT / "STRUCTURE.md", ROOT / "CONTRIBUTING.md", *(ROOT / "docs").glob("*.md")]
    for folder in ("architecture", "guides", "methodologies", "data-contract", "frameworks"):
        current += sorted((ROOT / "docs" / folder).rglob("*.md"))
    current.append(ROOT / "manuscript" / "oreflow-digital-twin.md")
    hits = []
    for path in current:
        if path.name in ("release-verification.md",):
            continue
        text = " ".join(path.read_text(encoding="utf-8").split())
        for pattern, why in RETIRED.items():
            for m in re.finditer(pattern, text, re.I):
                context = text[max(0, m.start() - 60):m.end() + 60]
                if re.search(r"\b(?:until|before|retired|was|were|in 0\.0[1-7])\b", context, re.I):
                    continue  # a sentence about the past names the retired thing on purpose
                hits.append(f"{path.relative_to(ROOT)}: {m.group(0)!r} ({why})")
    assert not hits, hits


def test_the_bake_times_are_the_validation_records():
    """Guide 02's stage table, architecture 02's first measurement and the manuscript quoted the 0.07 bake's times a
    release after the bake that wrote the committed records. They are held to `validation.json` here."""
    v = _read(DERIVED / "validation.json")
    s, version = v["seconds"], v["engine_version"]
    guide = (ROOT / "docs" / "guides" / "02_bake-and-gpu.md").read_text(encoding="utf-8")
    rows = {line.split("|")[1].strip(): line.split("|")[-2].strip() for line in guide.splitlines() if line.startswith("| ") and line.count("|") == 4}
    for stage in v["stages"]:
        quoted = rows[stage]
        if quoted.startswith("under 1 s"):
            assert s[stage] < 1.0, stage
        else:
            assert quoted.startswith(f"{s[stage]:.1f} s"), (stage, quoted, s[stage])
    assert f"in the committed {version} bake" in guide
    arch = " ".join((ROOT / "docs" / "architecture" / "02_bake-pipeline.md").read_text(encoding="utf-8").split())
    assert f"- {s['cases']:.0f} s and {s['learning']:.0f} s for the committed {version} bake" in arch
    paper = " ".join((ROOT / "manuscript" / "oreflow-digital-twin.md").read_text(encoding="utf-8").split())
    assert f"took {s['cases']:.0f} s for the cases on {v['workers']} workers and {s['learning']:.0f} s for the learned lane" in paper


def test_every_relative_link_resolves():
    """W-05, W-06: the wiki's pages are reachable by links, and every relative link in a tracked Markdown file names
    a file or folder that exists (the review's link checker, kept)."""
    import subprocess

    tracked = subprocess.run(["git", "ls-files", "*.md"], cwd=ROOT, capture_output=True, text=True, check=True).stdout.split()
    broken = []
    for name in tracked:
        page = ROOT / name
        for m in re.finditer(r"\]\(([^)\s]+)\)", page.read_text(encoding="utf-8")):
            target = m.group(1).split("#")[0]
            if target and not re.match(r"[a-z]+:", m.group(1)) and not (page.parent / target).resolve().exists():
                broken.append(f"{name}: {m.group(1)}")
    assert len(tracked) > 100 and not broken, broken


def test_the_changelog_has_one_entry_per_release_in_one_format():
    """W-28, W-50: three tagged releases had no entry, and the entries before 0.05.000 used another heading format.
    The tags are read where the checkout has them (a shallow CI clone has none, and then the format alone is held)."""
    import subprocess

    text = (ROOT / "CHANGELOG.md").read_text(encoding="utf-8")
    headings = re.findall(r"^## (.+)$", text, re.M)
    assert headings[0] == "[Unreleased]"
    versions = []
    for heading in headings[1:]:
        match = re.fullmatch(r"\[(\d\.\d\d\.\d\d\d)\] - \d{4}-\d\d-\d\d", heading)
        assert match, heading
        versions.append(match.group(1))
    assert versions == sorted(versions, reverse=True) and len(set(versions)) == len(versions)
    tags = subprocess.run(["git", "tag", "-l", "v*"], cwd=ROOT, capture_output=True, text=True).stdout.split()
    released = {t[1:] for t in tags if re.fullmatch(r"v\d\.\d\d\.\d\d\d", t)}
    assert released <= set(versions), sorted(released - set(versions))


def test_the_guide_snippets_print_what_their_comments_say(monkeypatch, capsys):
    """W-41: guide 03's two Python snippets run as written from the repository root, and their output agrees with the
    numbers their comments state (one had drifted by 0.01 and named a flag the engine had retired)."""
    text = (ROOT / "docs" / "guides" / "03_use-on-other-data.md").read_text(encoding="utf-8")
    blocks = re.findall(r"```python\n(.*?)```", text, re.S)
    assert len(blocks) == 2
    first = re.search(r"# ([\d.]+) \[([^\]]*)\]", blocks[0])
    second = re.search(r"# ([\d.]+)% recovery", blocks[1])
    assert first and second
    monkeypatch.chdir(ROOT)
    namespace: dict = {}
    exec(compile(blocks[0], "guide03-block1", "exec"), namespace)  # noqa: S102 - the guide's own code
    printed = capsys.readouterr().out.strip()
    value, flags = printed.split(" ", 1)
    assert round(float(value), 2) == float(first.group(1))
    assert flags == f"[{first.group(2)}]"
    exec(compile(blocks[1], "guide03-block2", "exec"), namespace)  # noqa: S102
    assert round(namespace["result"].metrics["recovery_pct"], 2) == float(second.group(1))
    assert namespace["result"].metrics["balance_max_relative_error"] <= 1e-9
