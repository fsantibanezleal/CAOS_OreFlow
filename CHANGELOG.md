# Changelog

## 0.02.000, 2026-09-23

- Rebuilt the fixed-viewport instrument: quantitative circuit, response curves, selectable grind-by-collector decision surface, method-specific plots, variant comparison and mobile control view. Added bilingual linked readouts and light/dark responsive layouts.
- Corrected the classifier to partition size-bin masses, normalized the overflow cumulative distribution, connected classifier split to overall recovery and capped concentrate mass pull by rougher feed.
- Recomputed all 12 cases, 72 variants and 1,368 method records; neural models were trained with CUDA on the local RTX 4070 Laptop GPU. Added browser/Python parity checks, classifier sensitivity tests and separate autoencoder reconstruction diagnostics.
- Replaced unsupported plant, uncertainty and OOD claims with explicit simulator-only interpretation, and revised the manuscript as a proposed transfer study rather than a completed novel result.
- Repaired direct document-route serving on the VPS and GitHub Pages; project-site builds now carry the correct base path and a 404 fallback document.
- Emit real GitHub Pages route files so direct document links return HTTP 200, not merely rendered fallback content with status 404.

## 0.01.000, 2026-09-13

- Initial OreFlow release with six-route visual workbench, 12 x 6 case matrix, 19 process and learned methods, HZDR source summary, reproducible pipeline, manuscript proposal, GitHub Pages workflow and ML VPS service files.
