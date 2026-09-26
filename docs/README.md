# OreFlow documentation

The documentation is a wiki with one folder per theme, each with a landing page and numbered pages. Start
with the landing page of the theme you need.

| Theme | Landing page | What is in it |
|---|---|---|
| Architecture | [architecture.md](architecture.md) | 01 the system and what it is not, 02 the bake, 03 the browser engine and its parity gates, 04 the web app and the browser gate, 05 release and deployment |
| Methodologies | [methodologies.md](methodologies.md) | 01 to 10 the unit models (grid and streams, crushing, grinding, classification, flotation, gravity, magnetic separation, desliming, energy, the balance audit), 11 to 14 the methods (kinetic fits, optimization, uncertainty and sensitivity, the learned lane), each with equations, parameters, sources and tests |
| Data contract | [data-contract.md](data-contract.md) | 01 the operating contract, 02 the trace and the live API, 03 the case artifacts and the records, 04 the particle lane, 05 the GeoMet lane: fields, units, and how missing and invalid data are handled |
| Frameworks | [frameworks.md](frameworks.md) | fifteen nodes, one per library, each with installation, usage and applying pages; runnable examples for the Python nodes |
| Guides | [guides.md](guides.md) | 01 run it locally, 02 bake the artifacts, 03 use it on other data, 04 add a case, 05 read the workbench |
| Use cases | [use-cases.md](use-cases.md) | the twelve cases, rendered from the committed records by `scripts/render_use_cases.mjs` |
| Design | [design/SDD.md](design/SDD.md) | the software design document; `design/features/` holds each feature's requirements (with the test or check that gates each), design and tasks |

Records of past work:

- [release-verification.md](release-verification.md): what was checked, where and when, for each release.
- [`../manuscript/`](../manuscript/): the manuscript draft (not deposited; no DOI).
- [`../CHANGELOG.md`](../CHANGELOG.md): the releases, newest first.

The interface's own pages (Introduction, Methodology, Implementation, Experiments, Benchmark) carry the same
science in both languages; these pages are the English reference they are written from.
