# Guide: make a product from this template

The product's research and plan come first, and its SDD (`docs/design/SDD.md`) is written before any code
(ADR-0075). This guide starts after that.

## 1. Create the repository and instantiate

Create the repository from the template on GitHub (`gh repo create <owner>/<Repository> --template
fsantibanezleal/CAOS_PRODUCT_TEMPLATE`), clone it, set up the pipeline environment (`scripts/setup.sh`), and run:

```bash
python scripts/instantiate.py --slug <slug> --name "<Name>" --repo <Repository> \
  --deploy pages --domain <slug>.fasl-work.com --visibility public \
  --tagline-en "<one line>" --tagline-es "<una línea>"
```

- `--deploy` is the one deploy place, decided now: `pages` (a static site) or `vps` (only for a product with an
  active backend). The other place's files are removed; `scripts/check_deploy_place.py` keeps it that way.
- `--visibility private` hides every source link in the app.
- `--domain` writes a CNAME file into `frontend/public/` for Pages; without it the site is a project page under the repository
  name, and the deploy builds with that base path.

The script writes `product.json`, the frontend package name, `VERSION` (0.01.000), a fresh `CHANGELOG.md`, the MIT
`LICENSE`, `deploy/TARGET` and a product `README.md`; it deletes `.template-source` and `.vscode/`;
then it bakes, tests and builds once and runs `scripts/check_template_residue.py`. That list is the work that
follows.

### `product.json` and the App's kind

`product.json` holds the product's identity (`name`, `slug`, `tagline`, `repo`, `visibility`, `license`, `holder`, `year`) and, since
0.09.000, what its App is. `instantiate.py` writes a workbench; to change it, edit the file and keep the three fields below.

| Field | Values | Meaning |
|---|---|---|
| `app` | `"workbench"` (the default when absent) or `"surface"` | `workbench`: the App is one case's instrument (`CaseWorkbench`, the template's example). `surface`: the App is not one case's, it is a hub, an explorer or a console (`SurfacePage`). Any other value fails `scripts/check_sdd.py` and the gate runner. |
| `focus` | `true` (the default when absent) or `false` | `false` waives Focus mode and is valid only on a surface App without any simulation. |
| `focus_reason` | text, at least 8 words, no placeholder | Required with `"focus": false`: why ADR-0070 does not apply. The same text stands on the SDD's ADR-0070 row as `not applicable: <reason>`. |

From 0.13.000 it also declares the product's Zenodo manuscripts in `manuscripts` (one technical report at least; the fields, the
release step and the three method tiers behind them are in [guide 09](09_method-tiers.md)). `instantiate.py` writes
`"manuscripts": []`, which `scripts/check_manuscripts.py` fails until the technical report is declared.

Choosing the kind: if the App is the instrument for one case at a time (pick a case, read its views, change its parameters),
it is a workbench and `product.json` needs no field. If it lists studies, explores a catalogue or drives a console of several
views, it is a surface: set `"app": "surface"`. The gate runner then passes `--workbench ''` to the shell gate, which measures the
App route as a surface (`/app`, or the route you pass with `--app-route`).

Focus mode (ADR-0070) stays required for every App. A surface gives each view that has a stage (a simulation, a drawing, a live
run) `focus` on its `TabDef`, and the surface takes `focus`; a list or a form sets nothing. The shell's own example, transcribed
from the views chapter of its documentation:

```tsx
<SurfacePage
  title={{ en: 'Console', es: 'Consola' }}
  tabs={[
    { id: 'tasks', label: 'Tasks', content: <TaskList /> },                      // no stage: no Focus control
    {
      id: 'engine',
      label: 'Engine',
      focus: {
        title: { en: 'Engine run', es: 'Corrida del motor' },                   // default: the view's label
        hud: [{ label: { en: 'Peak', es: 'Pico' }, value: peak }],              // readouts over the stage
        rail: <><Knob ... /><ChipGroup ... /></>,                              // the parameter column (ADR-0070 requirement 2)
      },
      content: <SubTabs ... />,                                                // the stage; its sub-tab is kept across Focus
    },
  ]}
  focus={{ onChange: (on) => record(on) }}
/>
```

The `rail` is the view's parameter column in Focus; without one the stage is the whole frame and the view keeps its controls in
its body. A surface with no focusable view fails the gate (`--require-focus`, G18).

The one waiver: a hub that only links studies has no simulation or dynamic synthetic scenario, so ADR-0070 does not bind it. It
sets `"app": "surface"`, `"focus": false` and a `focus_reason`, and writes the same reason on the SDD's ADR-0070 row as
`not applicable: <reason>`. `scripts/check_sdd.py` fails a waiver on a workbench, without a reason (or with fewer than 8 words or a
placeholder), without the row or with a row that gives another reason, and a row that says `not applicable` while `product.json`
records no waiver. `npm run gate` reads the same two places and refuses to run when they disagree; it never drops
`--require-focus` otherwise, whatever extra arguments a run passes. While Focus is required it also refuses an argument that would make the check measure nothing: `--workbench`, `--app-route` on a workbench, or a `--routes` list that leaves out the App route. When `deploy/TARGET` is `vps`, the runner also passes
`--spa-fallback`, so the build is served as nginx serves it (`try_files $uri $uri/ /index.html`).

## 2. Write the specification area, then fix the contracts

The product design and requirement map is [`docs/design/SDD.md`](../design/SDD.md). In this order, each step with its guard
(`scripts/check_sdd.py`, `check_tech_matrix.py`, `check_contract_versions.py`, `check_contracts.py`,
`check_readiness.py`, `check_skeleton.py`; CI runs them all):

1. **Research basis.** Before the plan, research the real state of the art and persist it. In
   [`docs/design/SDD.md`](../design/SDD.md) replace the example's `Research basis`: what was decided, each claim with
   a DOI or URL (at least three distinct works), and a line starting `UNVERIFIED:` (`UNVERIFIED: none` if so). Never write it
   from memory. The research covers the three method tiers ([guide 09](09_method-tiers.md)): the classical methods, the
   current state of the art and the room for the product's own proposals beyond it.
2. **Executive view.** The first thing the product writes after its research and before its sizing, and the first
   thing to do after instantiating: `instantiate.py` leaves the example's `content/executive.json` and its three
   illustrations in `frontend/public/executive/` in place, to be replaced, not kept. Frame the problem space the
   product works in, for a decision maker, general (never a client, never a pitch): the title, the key statement, two or
   three headline figures, the five sub-tabs (the pain, the context, the current situation, the trends, the proposal with
   the 4 C's), a linked source for every figure and claim, and three illustrations (the pain, the situation, the
   proposal). Point the SDD's `Executive brief` section at the file with `Data file: content/executive.json` (it restates
   nothing). It is the core of the product ("anyone can write code and release an app, but tailored on a real problem
   context is the expected core"), `scripts/check_sdd.py` fails without a valid file, and the product lands on it: the
   root opens the Introduction's executive view, the App is at `/app` and stays the leftmost tab (the header order is always
   App, Introduction, Methodology, Implementation, Experiments, Benchmark; every documentation route takes the full width). The bearers, roles, approaches and 4 C's are small flip cards (a title of
   at most 8 words and a back of at most 40, in Spanish 10 and 50; a group of five is a carousel), and an illustration that
   explains a change is animated with a `prefers-reduced-motion` block that shows its final frame. How to write it: [guide 06](06_executive-brief.md);
   the technical view and the other pages: [guide 07](07_documentation-pages.md).
3. **Sizing.** Contract-first parallel delivery (ADR-0080): size the product (repositories, components, modules with
   their owner units, every boundary, the machine limits, the parallel units with disjoint write scopes) in the
   coordination records, and summarise it in `Sizing and contracts`. Fill `Technology and versions` with every pinned
   dependency (`| component | package | version | use | alternative considered |`; Python pins exact with `==`, a
   package.json range only with a lock that records it, and the table holds the locked version; an npm alias such as
   `"zz-typescript5": "npm:typescript@5.9.3"` pins an exact version and is listed under its own name, `zz-typescript5`, with that
   version) and `Resources`
   with one row each for the bake, the training (if any), the tests, the build and the deploy payload, memory, disk
   and time measured or bounded (no TBD, no placeholder cell).
4. **Contracts.** Write them in [`docs/contracts/catalog.md`](../contracts/catalog.md): one row per boundary and per
   model slot, each with its schema file, an example, its `documents` (the globs of the committed files that schema
   governs, `-` for none; `scripts/check_documents.py` reads them and is taken verbatim, never ported by hand; the cell
   format is in the catalog), the tests of both sides, its missing-data behavior and a
   provider (a fixture, a simulator, a stub, or a baseline for a model slot). Replace the example's rows, schemas
   and provider tree with the product's, add a History row per contract, and run
   `python scripts/check_contract_versions.py --update` to create the lock. Regenerate the web's types
   (`cd frontend && npm run contracts:types`), recompute the readiness (`python data-pipeline/run.py readiness`), and
   run `scripts/check_contracts.py` until it passes. From now on a schema change needs a version bump and a History
   row whose kind is the semver step, and a breaking change needs a major one; CI checks it against the base ref
   (`check_contract_versions.py --base`, which needs the `fetch-depth: 0` checkout the workflow has). The rules are
   in the catalog.
5. **Requirements and tests, red first.** Per feature, `docs/design/features/<feature>/requirements.md` (SHALL, each
   with its gate); write the tests and watch them fail for the right reason before the code.
6. **Adversarial validation.** Per feature, `validation.md`: for every requirement the check that tries to break it
   (what was planted or refuted) and the test that does it, which must be adversarial: under `tests/adversarial/`, or
   named `test_adversarial_...` (`it('adversarial: ...')` in TypeScript). A requirement and a validation row never
   name a test that is skipped, only a name in a string or comment, or a prefix of a title. A feature whose status is
   planned or superseded is listed with its reason in `docs/design/features/.status-allow`. Add the planted-defect tests
   of the product's own guards to `tests/adversarial/`.

   **The template's own tests (`tests/template/`).** The base's own planted-defect tests that need the example (they plant
   into its notebooks, its requirement rows, its catalog rows or its case ids, or read this guide) live in `tests/template/`,
   and `scripts/instantiate.py` removes the folder with the example. The guards a product takes verbatim (the list under
   "Files a product takes verbatim") are tested there, once, in the template, whose CI runs `tests/template/adversarial` beside `tests/adversarial`; instantiate drops
   that path from the product's workflow, and a product does not run them again. A product
   writes the planted-defect tests of its own guards and of its own features under `tests/adversarial/`, on its own rows,
   notebooks and cases. `tests/test_guards.py` fails any test module outside `tests/template/` that exercises a base guard and
   holds a string the residue guard treats as example residue, so a base test cannot leak out of the folder.

The walking skeleton comes next: the site built on the provider tree
(`CAOS_DATA_ROOT=docs/contracts/fixtures/data/derived npm run build`) and the API serving it, deployed so the UI and
the integration are checked from the first week. Every provider is labelled on the site by the readiness document
and listed by `scripts/check_skeleton.py` until its real producer replaces it; none may remain at a release.

## 3. Replace the example, unit by unit

Build vertically: each unit (a method, a case family, a page) is finished, with its code, tests and documentation,
before the next starts; units whose write scopes are disjoint are built at once, against the fixed contracts.

1. **The engine.** Replace `data-pipeline/pipeline/model/` and the stage bodies with the method ladder of the SDD: a
   method of each tier (classical, state of the art, and at least one proposal beyond it, `BS-1`), none left out
   ([guide 09](09_method-tiers.md)). A fresh product fails `scripts/check_sdd.py` on this until its SDD proposes its
   beyond method. Each method meets its acceptance criterion (ADR-0069) and gets a card in `docs/frameworks/`, its
   dependency pinned in `data-pipeline/requirements.txt` (or the precompute or GPU file). Write the technical report on
   Zenodo and declare it in `product.json` `manuscripts`.
2. **Contract 1.** Rewrite `data-pipeline/pipeline/io/contract.py` for the product's raw data (columns, units,
   ranges, outlier policy) with a sample in `data/examples/`, to the params-record schema the catalog fixed (the
   test holds the schema's bounds equal to the code's); update `tests/test_contract.py`,
   `tests/contracts/test_params_record.py` and `data/README.md`.
3. **The cases.** Rewrite `data-pipeline/pipeline/cases/` and the registry: bilingual titles, categories and expected
   bands, and numeric expected ranges for every case (`core/expect.py` fails the bake outside them). Set the default
   case. Document the coverage matrix in `docs/cases/`.
4. **Contract 2.** Rename the schema ids (`example.*`) to the product's and change the trace and manifest shapes as
   the method needs, in the schema files first (bump the catalog row's version), then the producers, the generated
   types (`npm run contracts:types`) and the descriptors in `frontend/src/lib/contract.types.ts`: the build fails
   while the generated types are not current, and `tests/contracts/` and `contract.test.ts` fail on any key or type
   that one side has and the other does not.
5. **The live engine.** If a method runs live, port it to `frontend/src/engine/` and hold it to the baked artifacts
   with a parity test, as `sir.parity.test.ts` does. If none can, the workbench replays only and declares
   `replayOnly`.
6. **The workbench.** Rewrite `frontend/src/workbench/`: the case's question groups, its variants, its parameters
   and live values in the rail. Views are `PlotCard`s with lane, provenance and the selection key; curves go in a
   `UPlotChart`, categories in a `BarChart`, anything else in a `Stage` whose labels are measured with the shell's text
   kit (`fitLabel`, `niceTicks`); a table sits above the drawing of the same numbers. A product that is not about
   cases (a hub, an explorer, a console) replaces the workbench with the shell's `SurfacePage` and runs the gate with
   `--workbench ''`. The structure, tokens, icons and numbers are the shell's (its `docs/`); write CSS only for the
   product's own widgets, never for a shell class (`check_web_baseline.py`). **The App opens Focus mode** (ADR-0070): for a
   workbench, `CaseWorkbench` takes `focus`, which puts a Focus button in the rail head that opens the open group in the
   full viewport (`?focus=1` beside `?case=` and `?view=`; Escape or the exit button returns to the same case, group and
   sub-view); for a surface (`"app": "surface"` in `product.json`, shell 0.19.1), `SurfacePage` takes `focus` and each view
   with a stage takes `TabDef.focus` (see "`product.json` and the App's kind" above). `npm run gate` always passes
   `--require-focus`, so an App without Focus mode fails the gate (G18); only a surface without any simulation waives it, with
   its reason recorded.
7. **The pages and the diagrams.** Rewrite `frontend/src/pages/` from the product's dossiers (equations with
   captions, references with DOIs that resolve) and the five diagrams in `frontend/src/architecture/` (bilingual,
   shell tokens only).
8. **The SDD requirements.** Replace `docs/design/features/workbench/` with the product's features; every
   requirement names a test or guard that exists, and every feature has its `validation.md`.

## 4. Verify, then release

In separate steps: the sandboxed tests, the canonical bake (`scripts/precompute.sh`), `scripts/check_artifacts.py`,
`npm run build`, `npm test`, `npm run gate`, and every guard in `.github/workflows/ci.yml`. Read the gate's
captures yourself (`frontend/gate-output/index.html` shows every capture by route, the failures first): the gate
measures, it does not judge content.

Two guards take what a product commits by design, declared and never exempted in the product's own CI (a product takes
both scripts verbatim and keeps no variant):

- **Model files.** `scripts/check_base_integrity.py` still fails on a tracked real `.env`, a venv, a native or heavy binary,
  raw or heavy data and a local machine path. A small model file (`.pt`, `.pth`, `.onnx`) passes only when a catalog
  row's `documents` cell names it (`data/models/*.pt`) and it is at most 5 MB, all such files together at most 50 MB. A
  product with no catalog admits none. Anything bigger lives in the models root, not in the repository.
- **Third-party notices.** A notice file copied unmodified from upstream (an ONNX Runtime or licence text with em-dashes) is
  listed in `scripts/.content_standards_allow` as `<path> <sha256> <source URL>`; `scripts/check_content_standards.py` skips
  it only while the digest of its content (line endings normalised to LF) matches, so an edited notice fails. The product's
  own text is never listed.

A committed document that is not JSON (a model file such as `.onnx` or `.pt`, a CSV table) named by a catalog row's `documents`
cell has no schema to validate: `scripts/check_documents.py` validates the JSON documents against their schemas and leaves the
others to the row's own contract test (its `model io` column describes the contract), and requires the row's `producer test` or
`consumer test` column to be filled. The content-standards guard reads every tracked text file, including one with no suffix
(`LICENSE`, `VERSION`, `deploy/TARGET`, a dotfile) that decodes as UTF-8.

### Files a product takes verbatim

A product takes these scripts from the template as they are and keeps no variant; they hold nothing that names a person (the GitHub
handle `fsantibanezleal`, the repositories' owner identifier, may stand in a source URL) or a product, and `tests/template/adversarial/test_guard_gaps_example.py` fails when one of them names the owner in the template:

- `scripts/check_sdd.py`
- `scripts/check_tech_matrix.py`
- `scripts/check_manuscripts.py`
- `scripts/check_documents.py`
- `scripts/check_contracts.py`
- `scripts/check_base_integrity.py`
- `scripts/check_content_standards.py`
- `frontend/scripts/gate.mjs`

Before a release that changes a method, a data source or a result, publish the new version of the product's technical report on
Zenodo and run `python scripts/check_manuscripts.py --release` (`--zenodo` also reads the records online; a local step, never CI;
[guide 09](09_method-tiers.md)).

A release bumps `VERSION`, `frontend/package.json` and the top of `CHANGELOG.md` together, merges `develop` into
`main` through a pull request, and tags `vX.XX.XXX`. The deploy runs after CI succeeds on `main` and checks the live
site; after it, run the gate against the deployed origin: `npm run gate -- --url https://<domain>`.

On GitHub Pages, before the first deploy, enable Pages with the Actions source and set the custom domain by API
(the Pages runbook in `deploy/`, kept only in a Pages product).
