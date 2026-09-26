# Frameworks

Every library OreFlow depends on, documented the same way: what it is, how it is installed here, how
OreFlow uses it (with the modules and the settings), and how to apply it to other data or another
circuit. Each node has its own folder with three pages, `01_installation.md`, `02_usage.md` and
`03_applying.md`, and each Python node has a runnable `example.py` built on OreFlow's own code, which
checks what it prints.

The numbering is a reading order: the engine's numerical core first, then the methods built on it,
the learned lane, data ingestion, the service and the Python quality tools, and last the interface and
its gates.

Run a Python example from the repository root with the repository's environment, never a global
interpreter:

```powershell
.venv-gpu\Scripts\python.exe docs\frameworks\01_numpy\example.py
```

## The engine and its methods (offline bake; NumPy also serves the API)

1. [**01 NumPy**](frameworks/01_numpy.md): the engine's arrays: 63 size classes by mineral, the
   Whiten crusher and the mill as matrix solves, the Gauss-Laguerre table.
2. [**02 SciPy**](frameworks/02_scipy.md): COBYLA for the constrained optimizer, the scrambled Latin
   hypercube of the uncertainty record and the Sobol sequence of the learning design.
3. [**03 SALib**](frameworks/03_salib.md): the Saltelli design and the first-order and total Sobol
   indices of the sensitivity record.

## The learned lane and the measured lanes (offline bake)

4. [**04 scikit-learn**](frameworks/04_scikit-learn.md): ridge, random forest, gradient boosting and
   the Gaussian process of the surrogate benchmark; the particle and GeoMet models; joblib for the
   GeoMet checkpoint.
5. [**05 PyTorch**](frameworks/05_pytorch.md): the MLP surrogate, the autoencoder guard and the
   particle network, on CUDA when present.
6. [**06 ONNX and ONNX Runtime**](frameworks/06_onnx.md): the export of the three networks, the
   reference inference in Python and the same files run in the browser with onnxruntime-web.
7. [**07 pandas and openpyxl**](frameworks/07_pandas.md): reading the HZDR workbook and the GeoMet
   tables.

## The service and the Python quality tools

8. [**08 FastAPI**](frameworks/08_fastapi.md): the service, with uvicorn and pydantic: the artifact
   routes and the contract-validated live simulation.
9. [**09 pytest and ruff**](frameworks/09_pytest.md): the 340-test Python suite, the API tests
   through httpx, and the linter.

## The interface and its gates (browser)

10. [**10 React**](frameworks/10_react.md): the interface, with react-router for the routes and
    zustand for the workbench state.
11. [**11 Vite, TypeScript and Vitest**](frameworks/11_vite.md): the build and its data overlay, the
    port's language and the 165 frontend tests.
12. [**12 uPlot**](frameworks/12_uplot.md): every line chart, through one themed host.
13. [**13 KaTeX**](frameworks/13_katex.md): every equation, in both languages.
14. [**14 Playwright**](frameworks/14_playwright.md): the browser gate.
15. [**15 The CAOS app shell**](frameworks/15_caos-app-shell.md): the shared shell, its components,
    its known defects and the overrides OreFlow applies.

| Node | Package(s) | Version | Licence | Declared in |
|---|---|---|---|---|
| 01 | numpy | 2.2.6 | BSD-3-Clause | `requirements.txt` |
| 02 | scipy | 1.17.1 | BSD-3-Clause | `requirements-precompute.txt` |
| 03 | SALib | 1.6.0 | MIT | `requirements-precompute.txt` |
| 04 | scikit-learn, joblib | 1.5.2, 1.4.2 | BSD-3-Clause | `requirements-precompute.txt` |
| 05 | torch | 2.12.0+cu126 | BSD-3-Clause | `requirements-gpu.txt` |
| 06 | onnx, onnxruntime, onnxruntime-web | 1.20.0, 1.24.2, 1.29.0 | Apache-2.0, MIT, MIT | `requirements-gpu.txt`, `frontend/package.json` |
| 07 | pandas, openpyxl | 2.2.3, 3.1.5 | BSD-3-Clause, MIT | `requirements-precompute.txt` |
| 08 | fastapi, uvicorn, pydantic | 0.116.1, 0.35.0, 2.11.7 | MIT, BSD-3-Clause, MIT | `requirements-api.txt` |
| 09 | pytest, ruff, httpx | 9.1.1, 0.15.18, 0.28.1 | MIT, MIT, BSD-3-Clause | `requirements-dev.txt` |
| 10 | react, react-dom, react-router, zustand | 19.3.0, 19.3.0, 8.3.1, 5.0.15 | MIT | `frontend/package.json` |
| 11 | vite, typescript, vitest | 8.2.2, 7.0.2, 5.0.0 | MIT, Apache-2.0, MIT | `frontend/package.json` |
| 12 | uplot | 1.6.32 | MIT | `frontend/package.json` |
| 13 | katex | 0.16.47 | MIT | `frontend/package.json` |
| 14 | playwright | 1.61.0 | Apache-2.0 | `frontend/package.json` |
| 15 | @fasl-work/caos-app-shell, lucide-react | 0.6.11 (tag v0.06.011), 1.43.0 | MIT, ISC | `frontend/package.json` |

The requirement files nest by where the code runs: `requirements.txt` (NumPy, the engine) and
`requirements-api.txt` (the service) are all the VPS installs; `requirements-precompute.txt` adds the
offline methods; `requirements-gpu.txt` adds PyTorch with the CUDA 12.6 wheel index and ONNX;
`requirements-dev.txt` adds the test and lint tools on top of the API lane. `scripts/setup.ps1` builds
both local environments from them.
