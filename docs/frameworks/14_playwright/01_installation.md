# Playwright: installation

Read order for this node: **you are on 01.** Next: [02 Usage](02_usage.md), then
[03 Applying](03_applying.md). The landing page is [../14_playwright.md](../14_playwright.md).

## The pin

```json
"playwright": "1.61.0"
```

in `frontend/package.json` (devDependencies); `npm ci` installs the library. The browsers are a separate
download, matched to the library version:

```powershell
cd frontend
npx playwright install chromium
```

## Where the browsers go

Playwright keeps its browsers outside the project, in `%LOCALAPPDATA%\ms-playwright` on Windows by
default, a few hundred megabytes per version. Point it somewhere with room with `PLAYWRIGHT_BROWSERS_PATH`
before installing and before every run:

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH = '<a folder with room>'      # optional: keep the browser cache off a full system drive
npx playwright install chromium
node gate.mjs
```

The library looks for the browser build its own version expects (for 1.61.0, `chromium-1228` and
`chromium_headless_shell-1228`); a mismatch fails at launch with the command to install the right one.

## Running

The gate needs the build served as the VPS serves it, by the service:

```powershell
npm run build
# from the repository root, in its own terminal: the service on 127.0.0.1:4914
.venv/Scripts/uvicorn app.main:app --host 127.0.0.1 --port 4914
node gate.mjs            # in another; OF_MATRIX=full for the release matrix
```

`npm run preview` serves the same files on the same port and is enough while developing, but it answers every
route with the app on its own, so a release gate runs against the service: 0.08.000's direct routes answered 404
on the VPS while the gate, run against the preview, passed. Stop the server when you are done; the gate does not
start or stop it.
