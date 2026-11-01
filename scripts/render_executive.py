"""Render the bilingual executive diagrams from shared geometry and explicit display labels."""
from __future__ import annotations

import argparse
from html import escape
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LABELS = {
    "en": {
        "pain": "One change reaches the whole circuit",
        "pain_desc": "Feed, grinding, separation and product quality are coupled by flows and recycle.",
        "feed": ["Feed", "Size / grade", "Hardness"],
        "mill": ["Grinding", "Mill / classifier", "Power", "Achieved P80"],
        "separate": ["Separation", "Recovery", "Concentrate", "grade"],
        "product": ["Products", "Recovered", "metal", "Tailings metal"],
        "recycle": "Recycle changes the mill load",
        "constraint": ["A requested grind must fit installed power.", "Recovery, grade, water and throughput stay connected."],
        "situation": "Different evidence answers different questions",
        "situation_desc": "Simulator states, measured samples and plant hours retain separate targets and validation splits.",
        "simulated": ["Simulator states", "Declared inputs", "Simulator targets", "Hold out ores"],
        "samples": ["Measured samples", "Assay observations", "Respect groups", "Sample uncertainty"],
        "hours": ["Plant hours", "Past observations", "Next-hour target", "Forward time split"],
        "past": "Past", "future": "Next",
        "boundary": ["Keep the target, split and source with each result.", "A closed simulator balance is not plant calibration."],
        "proposal": "A controlled comparison preserves context",
        "proposal_desc": "Declare a bounded change, solve the circuit, compare evidence and state the limitations.",
        "declare": ["Define a change", "Case / input", "Operating bounds"],
        "solve": ["Solve the circuit", "Mass / water", "Equipment limits"],
        "compare": ["Compare results", "Baseline / model", "Held-out target"],
        "limit": ["State the limit", "Simulation scope", "Next validation"],
        "inspect": ["Inspect the consequences", "Recovery / grade / energy / water"],
        "trial": "Use the result to define the next controlled test.",
    },
    "es": {
        "pain": "Un cambio alcanza al circuito completo",
        "pain_desc": "La alimentación, molienda, separación y calidad se conectan mediante flujos y recirculación.",
        "feed": ["Alimentación", "Tamaño y ley", "Dureza"],
        "mill": ["Molienda", "Molino / ciclón", "Potencia", "P80 alcanzado"],
        "separate": ["Separación", "Recuperación", "Ley del", "concentrado"],
        "product": ["Productos", "Metal", "recuperado", "Metal en", "relaves"],
        "recycle": "La recirculación cambia la carga del molino",
        "constraint": ["La molienda solicitada debe respetar la potencia instalada.", "Ley, recuperación, agua y tratamiento están conectados."],
        "situation": "Cada evidencia responde una pregunta distinta",
        "situation_desc": "Los estados simulados, muestras y horas de planta conservan sus propios objetivos y validaciones.",
        "simulated": ["Estados simulados", "Entradas declaradas", "Objetivos simulados", "Reservar minerales"],
        "samples": ["Muestras medidas", "Ensayos de muestras", "Respetar grupos", "Incertidumbre"],
        "hours": ["Horas de planta", "Datos anteriores", "Hora siguiente", "Partición temporal"],
        "past": "Antes", "future": "Luego",
        "boundary": ["Cada resultado conserva su objetivo, partición y fuente.", "Cerrar un balance simulado no calibra una planta."],
        "proposal": "Una comparación controlada conserva el contexto",
        "proposal_desc": "Se declara un cambio acotado, se resuelve el circuito, se compara evidencia y se explicitan límites.",
        "declare": ["Definir cambio", "Caso / entrada", "Límites"],
        "solve": ["Resolver circuito", "Masa / agua", "Límites del equipo"],
        "compare": ["Contrastar datos", "Modelo / referencia", "Objetivo reservado"],
        "limit": ["Definir límites", "Alcance simulado", "Próxima validación"],
        "inspect": ["Inspeccionar las consecuencias", "Recuperación / ley / energía / agua"],
        "trial": "El resultado permite definir la próxima prueba controlada.",
    },
}


def text(x: float, y: float, value: str, cls: str = "body", anchor: str = "start") -> str:
    return f'<text x="{x:g}" y="{y:g}" class="{cls}" text-anchor="{anchor}">{escape(value)}</text>'


def panel(x: int, y: int, width: int, height: int, lines: list[str]) -> str:
    parts = [f'<rect class="panel" x="{x}" y="{y}" width="{width}" height="{height}" rx="12"/>']
    parts.append(text(x + 16, y + 35, lines[0], "heading"))
    parts += [text(x + 16, y + 78 + 35 * i, line) for i, line in enumerate(lines[1:])]
    return "".join(parts)


def arrow(path: str, prefix: str, recycle: bool = False) -> str:
    return f'<path class="flow{" recycle" if recycle else ""}" d="{path}" marker-end="url(#{prefix}-arrow)"/>'


def styles(prefix: str) -> str:
    # Inline SVG styles share the document cascade; scope every selector to this unique root.
    rules = {
        "text": "font:26px var(--font-sans,system-ui);fill:var(--color-fg)",
        ".title": "font-size:30px;font-weight:650",
        ".heading": "font-size:27px;font-weight:650",
        ".panel": "fill:var(--color-surface);stroke:var(--color-border);stroke-width:2",
        ".soft": "fill:var(--color-surface-2);stroke:var(--color-border);stroke-width:2",
        ".line": "fill:none;stroke:var(--color-fg-subtle);stroke-width:3",
        ".flow": "fill:none;stroke:var(--color-accent);stroke-width:3;stroke-dasharray:9 7;"
                 f"animation:{prefix}-flow 2s linear 5",
        ".recycle": "stroke-dasharray:5 5",
        ".accent": "fill:var(--color-accent);stroke:none",
    }
    return ("".join(f"#{prefix} {selector}{{{value}}}" for selector, value in rules.items())
            + f"@keyframes {prefix}-flow{{to{{stroke-dashoffset:-32}}}}"
            + f"@media(prefers-reduced-motion:reduce){{#{prefix} .flow{{animation:none}}}}")


def document(kind: str, language: str) -> str:
    labels = LABELS[language]
    prefix = f"oreflow-{kind}-{language}"
    parts = [f'<svg xmlns="http://www.w3.org/2000/svg" id="{prefix}" viewBox="0 0 960 520" role="img" '
             f'aria-labelledby="{prefix}-title {prefix}-desc" lang="{language}">',
             f'<title id="{prefix}-title">{escape(labels[kind])}</title>',
             f'<desc id="{prefix}-desc">{escape(labels[kind + "_desc"])}</desc>',
             f'<defs><style>{styles(prefix)}</style>'
             f'<marker id="{prefix}-arrow" viewBox="0 0 10 10" refX="9" refY="5" '
             'markerWidth="8" markerHeight="8" orient="auto-start-reverse">'
             '<path class="accent" d="M0 0 10 5 0 10Z"/></marker></defs>',
             text(24, 40, labels[kind], "title")]
    if kind == "pain":
        for x, key in ((24, "feed"), (258, "mill"), (492, "separate"), (726, "product")):
            parts.append(panel(x, 78, 210, 218, labels[key]))
        for x in (234, 468, 702):
            parts.append(arrow(f"M{x} 180H{x + 24}", prefix))
        parts += [arrow("M450 296V335H276V299", prefix, True),
                  text(480, 380, labels["recycle"], anchor="middle"),
                  '<rect class="soft" x="24" y="412" width="912" height="94" rx="12"/>',
                  text(44, 450, labels["constraint"][0]), text(44, 486, labels["constraint"][1])]
    elif kind == "situation":
        for x, key in ((24, "simulated"), (336, "samples"), (648, "hours")):
            parts.append(panel(x, 78, 288, 300, [labels[key][0]]))
            parts += [text(x + 16, 278 + 36 * i, value) for i, value in enumerate(labels[key][1:])]
        # Icons describe evidence types; they do not pretend to be measured points or numerical plots.
        for x in (54, 130, 206):
            parts.append(f'<rect class="soft" x="{x}" y="156" width="58" height="48" rx="6"/>')
        parts += [arrow("M112 180H130", prefix), arrow("M188 180H206", prefix),
                  arrow("M234 204V224H82V208", prefix, True)]
        for x in (382, 454, 526):
            parts.append(f'<path class="line" d="M{x} 148h24v28l12 38q0 10-12 10h-24q-12 0-12-10l12-38Z"/>')
            parts.append(f'<path class="flow" d="M{x - 4} 200h32"/>')
        parts += ['<rect class="soft" x="672" y="154" width="110" height="70" rx="6"/>',
                  '<rect class="soft" x="808" y="154" width="104" height="70" rx="6"/>',
                  '<path class="line" d="M795 142V236" stroke-dasharray="6 6"/>',
                  text(727, 198, labels["past"], anchor="middle"),
                  text(860, 198, labels["future"], anchor="middle"),
                  '<rect class="soft" x="24" y="412" width="912" height="94" rx="12"/>',
                  text(44, 450, labels["boundary"][0]), text(44, 486, labels["boundary"][1])]
    else:
        for x, key in ((24, "declare"), (350, "solve"), (676, "compare")):
            parts.append(panel(x, 78, 260, 170, labels[key]))
        parts += [arrow("M284 163H350", prefix), arrow("M610 163H676", prefix),
                  arrow("M806 248V306", prefix), panel(676, 306, 260, 170, labels["limit"]),
                  panel(24, 306, 586, 170, labels["inspect"]),
                  arrow("M676 390H610", prefix), arrow("M154 306V252", prefix, True),
                  text(480, 513, labels["trial"], anchor="middle")]
    return "\n".join(parts) + "\n</svg>\n"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--output", type=Path, default=ROOT / "frontend/public/executive")
    args = parser.parse_args()
    failures = []
    for language in LABELS:
        for kind in ("pain", "situation", "proposal"):
            path = args.output / f'{kind}{"-es" if language == "es" else ""}.svg'
            wanted = document(kind, language).encode("utf-8")
            current = path.read_bytes().replace(b"\r\n", b"\n") if path.exists() else None
            if current == wanted:
                continue
            if args.check:
                failures.append(str(path))
            else:
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(wanted)
    if failures:
        print("Executive diagrams stale: " + ", ".join(failures))
        return 1
    print("Executive diagrams: six bilingual SVGs " + ("current" if args.check else "rendered"))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
