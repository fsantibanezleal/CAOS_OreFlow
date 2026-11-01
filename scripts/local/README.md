# Local workflow

Run commands from any directory using the entrypoint's absolute path, or from the repository root as below.
The numbered steps share workflow.py and the declarative workflow.json. Flat setup/dev/precompute scripts remain compatible.

## 00: system prerequisites

PowerShell: ./scripts/local/00_install-prereqs.ps1

Bash: bash scripts/local/00_install-prereqs.sh

The default checks Python>=3.12, Node ^22.12.0 || ^24.0.0 || >=26.0.0 and git. Newer compatible installations are accepted.
Only -Install / --install requests installation of missing prerequisites, through winget on Windows or Homebrew
where available. Otherwise the command explains the manual repair. No global Python package is installed.
PYTHON can select an existing interpreter path, including one containing spaces.

## 01: initialize

PowerShell: ./scripts/local/01_init.ps1

Bash: bash scripts/local/01_init.sh

Initialization copies nonsecret .env.example defaults only if .env is absent. Existing .env bytes are preserved;
dotenv assignments are literal values, never shell commands. Exported process variables take precedence.
Declared ignored venvs and locked frontend dependencies are provisioned. Recursive requirements and package-lock
fingerprints are stamped only after a successful install; a matching installation is reused. A failed native
process is a failure, while successful native stderr warnings remain warnings.

Optional -Notebooks / --notebooks provisions the notebook environment. See the product notes below for the optional GPU lane.
Complete shipped artifacts avoid acquisition or generation. If required artifacts are genuinely absent, initialization
runs the complete external sandbox generation path and reports the explicit promotion command needed before dev.
It never silently replaces committed artifacts or starts a science bake as part of an ordinary complete checkout.

## 02: external data generation and explicit promotion

Configure CAOS_TEMP_ROOT as an external scratch root before generation. No system-temp or repository fallback is used.
PowerShell: ./scripts/local/02_generate-data.ps1

Bash: bash scripts/local/02_generate-data.sh

Each invocation creates a fresh external caos-local-* stage. All measured summaries, process records, exported models
and local checkpoints remain there. The complete real producer plan is in workflow.json; no stage inherits a
repository output default. Pinned source caches, when needed, use external CAOS_DATA_ROOT. This operation can be
expensive and may require source acquisition and generation dependencies; opening shipped artifacts does not.

After generation, the command prints the stage and next command. Promotion requires explicit intent:

PowerShell: ./scripts/local/02_generate-data.ps1 -Release -FromStage '<external stage>'

Bash: bash scripts/local/02_generate-data.sh --release --from-stage '<external stage>'

Without a supplied stage, explicit release mode first generates a fresh complete stage. It rechecks current source
and payload fingerprints, versions, whole catalog/readiness, and the existing semantic/schema validators before
replacement. Mixed, partial, changed or invalid candidates cannot replace old files. Prepared incoming trees and
backups support rollback if any artifact/model-directory promotion fails. Every recoverable target is attempted;
if restoration fails, the error names original and restoration failures and all retained recovery paths.
Preserve those paths until recovery is complete; never delete backups merely to silence an error. Checkpoints are never release payloads.
Here release means local artifact promotion; it creates no Git tag, software release, deployment or publication.

## 03: development services

PowerShell: ./scripts/local/03_dev.ps1

Bash: bash scripts/local/03_dev.sh

The helper verifies initialized dependencies, the frontend lock fingerprint, shipped artifacts and free loopback
ports. It runs the existing frontend predev copy, starts Vite directly, and supervises an active API where declared.
The API must answer health before the frontend starts. Child failure exits nonzero; Ctrl+C stops only this
workflow's process trees. It does not kill a pre-existing process or install dependencies during startup.

## Checks

Run the focused behavioral suite with the initialized pipeline interpreter:

python -m pytest tests/test_local_bootstrap.py tests/test_bootstrap_regressions.py -q

The fixtures execute fake producers and local HTTP/frontend subprocesses in external temporary repositories,
not training or release promotion in this checkout. Use the existing smoke scripts for the full product gates.
Actual installed app launch, API operations, release publication and deployment require their own observed receipts.

## OreFlow adaptation

The active FastAPI service runs from the ignored .venv on 127.0.0.1:8146; Vite uses 5914.
APP_PORT in the process environment or literal .env can change the API port. The frontend still solves its
browser engine; the supervised API separately exposes its bounded validation/simulation operations and /docs.
-Gpu / --gpu explicitly provisions .venv-gpu; generation prefers that environment, then .venv, and refuses
missing generation modules before source acquisition. This does not assert CUDA availability. No environment is
moved. Generation verifies all pinned measured sources, runs particles with explicit derived/ONNX/checkpoint
paths, calls GeoMet's existing build and checkpoint APIs with explicit destinations, runs the iron-plant lane,
and runs the full process producer with explicit derived/models/checkpoint arguments. It then computes staged
readiness and runs the original artifact and document validators.


## Admission and runtime details

Receipts bind recursive requirement/constraint files, current contract catalog and schemas, producer code,
validator scripts and schema registry, plus every payload byte. Admission refuses a stale staged catalog
or a source change during generation. Readiness requires the exact producer inventory: the template excludes
its own readiness row (six rows); OreFlow includes it (17 rows). Shipped readiness must bind the current catalog.

Declared ignored venv directory aliases may point outside the checkout. Initialization and generation use
those aliases; missing interpreter errors retain the declared path and resolved cause. Artifact destinations,
stages and recursive cleanup retain their separate strict containment checks. Recursive cleanup refuses junctions
and symlinks before deletion.

Development compares current recursive Python requirement fingerprints for both the primary and active API
runtimes before frontend preparation. It never repairs dependencies implicitly. Windows service trees use
their own console process groups. Cleanup signals the recorded group even after its leader exits, and always
attempts taskkill on the tracked PID/tree. POSIX cleanup likewise addresses the owned process group after
leader exit. Existing venvs, including Windows app-execution base aliases, remain supported. No broad
process-name cleanup or environment migration is used.

The existing CI base-integrity guard checks Git index mode100755 for every tracked .sh file, including old
and new entrypoints. File executable bits on a Windows filesystem do not replace this index check.

## OreFlow compact-data selection

The unchanged frontend/copy-data.mjs uses OF_DERIVED for a compact record tree and OF_MODELS for its matching
model exports. Without these preview selectors it copies local data/derived and models. CAOS_DATA_ROOT remains
the global raw store; CAOS_MODELS_ROOT and CAOS_TEMP_ROOT keep their storage roles. Raw-store contents are not
interpreted as web manifests. OreFlow retains strict17-row readiness and its active API configuration.

The shared helper supports optional frontend_environment overrides for frontend preparation and startup.
OreFlow's workflow.json intentionally has no such declaration. Default global/preview values therefore remain
identical for frontend, API and caller. An explicit declaration can select different frontend-only OF_DERIVED
and OF_MODELS values without changing API/generation inputs or mutating the caller. Generation retains its
existing external checkpoint sandbox. An alternate frontend selection must be an already validated compact
record/model set; the overlay does not generate or validate a new scientific bake.

The product tests exercise actual Node copying in external fixtures, local defaults, explicit preview providers,
and a fixture-only frontend override. The template's legacy CAOS_DATA_ROOT consumer mapping is not enabled or
copied into the product.
