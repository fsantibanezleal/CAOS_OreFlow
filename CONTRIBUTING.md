# Contributing

Thanks for your interest in this project. It is maintained by Felipe Santibanez-Leal. Contributions,
issues, and suggestions are welcome.

## Reporting issues

Please open a GitHub issue before starting non-trivial work, so intent is visible and effort is not
duplicated. A good issue states:

- What you observed (or want), with steps to reproduce for a bug.
- The environment (OS, versions) when relevant.
- One logical topic per issue.

## Development flow

This project uses a three-level branch flow:

1. Branch from `develop` as `task/<short-slug>`.
2. Commit in small, focused units (one logical change per commit).
3. Open a pull request from your `task/<slug>` branch **into `develop`** (never straight into `main`).
4. `develop` is promoted to `main` via its own pull request when a change is release-ready.

`main` is the deployed/released branch; it is never committed to directly.

## Pull requests

- Reference the issue it addresses (for example `Fixes #123`).
- Describe what changed and how you verified it.
- Keep pull requests small and frequent rather than large and batched.
- Do not disable commit hooks or force-push shared branches.

## How this repository works

- **Design before code** (ADR-0075). A change to the engine, a method or a page starts as requirements in
  `docs/design/features/<slug>/requirements.md`, each stated with SHALL and naming the test or check that fails when
  it is violated, then a design and tasks. The feature closes with a convergence verdict in its `tasks.md`.
  `scripts/check_sdd.py` rejects a requirement whose gate does not exist.
- **The records are part of the change.** Anything that changes what the engine computes is followed by a bake into
  a sandbox (`data-pipeline/run.py --output DIR --models DIR`), a comparison with the committed records, and the
  adopted records committed with the code (`docs/guides/02_bake-and-gpu.md`). A test never writes the committed
  records.
- **Every number a page states is a test.** The pages, the methodology docs and the manuscript quote the records,
  and their claim tests format each quoted number from the records; a changed record fails them until the text is
  updated.
- **The local gate.** CI runs only the cheap checks (ADR-0074: no training, no bake, no suite). Before a pull request
  run `scripts/smoke.ps1` (or `.sh`): every guard, ruff, the Python suite, every framework example, and the
  frontend typecheck, tests and build. A change to the interface also runs the browser gate (`frontend/gate.mjs`)
  and its screenshots are read.
- **Content rules.** No em dash, no emoji, no arrow characters in interface text, and no local disk paths in tracked
  files (`scripts/check_content_standards.py`). Interface strings are bilingual, English and neutral Spanish.

## Code conventions

- Code, identifiers, comments, and commit messages are written in **English**.
- User-facing UI strings may be localized (bilingual where the product is bilingual).
- Match the style of the surrounding code (naming, formatting, comment density).
- Add or update tests and documentation alongside the change.

## Local setup

See the project `README.md` for how to install dependencies and run the app and its tests locally.
Dependencies are installed into an isolated environment (a project-local virtualenv for Python, a local
`node_modules` for Node), never globally.

## License of contributions

By contributing, you agree that your contributions are licensed under the same license as this repository
(see `LICENSE`).
