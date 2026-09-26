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
$env:PLAYWRIGHT_BROWSERS_PATH = 'E:\_Temp\ms-playwright'     # the development machine's rule: caches on E:
npx playwright install chromium
node gate.mjs
```

The library looks for the browser build its own version expects (for 1.61.0, `chromium-1228` and
`chromium_headless_shell-1228`); a mismatch fails at launch with the command to install the right one.

## Running

The gate needs a served build:

```powershell
npm run build
npm run preview          # 127.0.0.1:4914, in its own terminal
node gate.mjs            # in another; OF_MATRIX=full for the release matrix
```

Stop the preview server when you are done; the gate does not start or stop it.
