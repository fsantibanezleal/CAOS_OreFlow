# Surrogate screening evaluation

This paper evaluates the screened and unscreened constrained searches recorded in
`data/derived/cases/*.json`. It is a finite comparison on twelve authored
scenarios, not a plant-performance study.

## Rebuild

From the repository root, with the pinned notebook environment installed:

```powershell
.\.venv-notebooks\Scripts\python.exe manuscripts\surrogate-screening\figure_results.py
Set-Location manuscripts\surrogate-screening
xelatex -interaction=nonstopmode -halt-on-error main.tex
xelatex -interaction=nonstopmode -halt-on-error main.tex
```

The figure generator checks the 72 paired records and their aggregate engine
counts before writing `figure-results.pdf`. The article uses only the committed
case records and cites its optimization and mineral-processing sources in
`main.tex`.

The results, source TeX and figure generator are released with OreFlow under the
repository's MIT license. The deposited article PDF is CC BY 4.0.
