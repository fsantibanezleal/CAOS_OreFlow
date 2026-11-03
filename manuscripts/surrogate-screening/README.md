# Surrogate screening evaluation

This paper evaluates the screened and unscreened constrained searches recorded in
`data/derived/cases/*.json`. It is a finite comparison on twelve authored
scenarios, not a plant-performance study.

## Rebuild

From the repository root, with the pinned notebook environment installed:

```powershell
\.venv-gpu\Scripts\python.exe manuscripts\surrogate-screening\run_guard_ablations.py models manuscripts\surrogate-screening\guard-ablation.json
\.venv-notebooks\Scripts\python.exe manuscripts\surrogate-screening\generate_evidence.py --guard-ablation manuscripts\surrogate-screening\guard-ablation.json
Set-Location manuscripts\surrogate-screening
latexmk -pdf -halt-on-error -interaction=nonstopmode main.tex
```

The evidence generator checks the 72 paired records and derives six vector
figures, four result tables and the summary from the same case records and
committed nominal radius ablation. The optimizer counters measure distinct
cached trial states in fixed-weight multistart runs, including refusals. They
exclude the later weight path, uncached base/endpoint audits, model fitting and
screening inference. They do not instrument every simulator invocation or
measure elapsed time. A separate four-case filter-removal run is kept outside
the paired result until all twenty case-policy rows pass validation. The source
uses pdfLaTeX-compatible packages because the CAOS publication workflow rebuilds
the manuscript with pdfLaTeX after reserving its version DOI.

The results, source TeX and figure generator are released with OreFlow under the
repository's MIT license. The deposited article PDF is CC BY 4.0.
