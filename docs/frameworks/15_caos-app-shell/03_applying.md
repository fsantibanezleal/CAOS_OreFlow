# The CAOS app shell: applying it

Read order: [01 Installation](01_installation.md), [02 Usage](02_usage.md), **you are on 03**.
Return to [15 The CAOS app shell](../15_caos-app-shell.md).

## Adopting a shell release

1. Read the shell release notes and adoption instructions. Compare the installed JavaScript, type
   declarations and stylesheet with the product's current composition and retained customizations.
2. Update the exact npm version in `frontend/package.json` and regenerate `frontend/package-lock.json`
   with `npm install` from `frontend/`. Review the resolved registry URL and integrity entry together
   with the manifest. Use `npm ci` for subsequent reproducible installations.
3. Adopt the shared APIs required by the release. Compose `AppShell`, `WorkbenchLayout` and
   `FocusShell` rather than recreating their structure. For a document surface, use `SurfacePage document`
   without a duplicate `page-body` wrapper; keep its tabs, Focus and plain-text lede. Keep canonical selector IDs consistent with
   URL state and the workbench markers. Keep language-dependent citation preprocessing tied to the
   current language. Preserve the product's disabled-view semantics when evaluating a replacement
   for `ViewTabs`: the installed `TabDef` has no disabled option, while measured-hour analytical views
   must stay visible, disabled and excluded from keyboard navigation.
4. Review every retained product helper and style. A historical comment does not justify keeping an
   override: verify the current upstream behavior first, then remove redundant code in a separately
   reviewed implementation change. Use product classes and supported shell tokens for domain styling.
5. Run typechecking, tests, build and the measured gates, inspect their final summaries and captures,
   and retain evidence for the exact candidate. A documentation update is not release validation.

## Current verification commands

From `frontend/`:

```powershell
npm run typecheck
npm test
npm run build
npm run gate
```

`npm run gate` is the framework gate, implemented by `frontend/scripts/gate.mjs`. It resolves the
installed shell gate, serves `dist/` with deployment-aware arguments, checks the expected product
brand, and requires Focus for this workbench. A focused development pass can use
`npm run gate -- --sizes 1280x800 --themes light`; it does not replace the full default run.
For a deployed origin, use `npm run gate -- --url https://your-deployment.example`.

The detailed OreFlow process gate is `npm run gate:oreflow` (`frontend/gate.mjs`). Serve the built
app through the real service before running it. For example, from the repository root in a separate
terminal:

```powershell
.venv/Scripts/uvicorn.exe app.main:app --host 127.0.0.1 --port 4914
```

Then, from `frontend/`, run its full desktop matrix:

```powershell
$env:OF_MATRIX = 'full'
npm run gate:oreflow
Remove-Item Env:OF_MATRIX
$env:OF_BASE = 'http://127.0.0.1:4914'
npm run gate:walkthrough
Remove-Item Env:OF_BASE
```

The walkthrough gate defaults to port 5914; the explicit `OF_BASE` above targets the built service
on port 4914 instead.

The actual full desktop matrix is four widths (1280, 1600, 1920 and 2560 px), both themes and both
languages. Phone/tablet combinations and the review pass have separate defaults in `gate.mjs`;
`OF_SMALL` controls the small-screen combinations. `OF_BASE` changes the process gate's target
(default `http://127.0.0.1:4914`), and `OF_QA` changes its output directory. Read those settings before
claiming coverage. A preview server alone does not validate the service's direct-route handling.

No gate pass is asserted here. The release owner runs and reviews the complete gates for the candidate.

## When a shell defect is found

Reproduce it against the exact installed release and distinguish a shell problem from product state,
composition or styles. Report the cause and reproducer to the
[shell repository](https://github.com/fsantibanezleal/CAOS_APP_SHELL). A necessary temporary product
override must be narrowly scoped, explain its reason beside the code and have a check that exposes the
failure without it. Fix shared behavior upstream, adopt the published release, then remove the
superseded override and repeat the checks. Do not copy shell structure or restyle shared classes as a
routine substitute for adopting the shared API.
