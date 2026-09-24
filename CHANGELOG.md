# Changelog

## 0.03.000, 2026-09-24

- Rebuilt the contained workbench around selectable, mass-linked circuit operations and an explicit walkthrough with playback, stage selection and local-versus-baked state.
- Added distinct gravity/rougher, magnetite magnetic-separation and phosphate-desliming process paths alongside generic rougher scenarios; exported applicability status for 21 method records in all 72 variants.
- Added process-family-specific controls, size-by-size classification and magnetic views, a material-balance diagram, and method-applicability evidence visualization.
- Recomputed the artifact matrix and ONNX exports with local CUDA training; the public browser remains a simulator explorer, not a plant predictor.
- Added an independent HZDR particle-learning lane with original-sheet train/test separation, L1 and CUDA-capable MLP models, common-row missingness handling, calibration and threshold artifacts, and on-demand browser ONNX inference. Constructed probabilities are not plant recovery.
- Reworked research pages, assumptions, sources and mobile workbench access. Pinned CAOS App Shell v0.06.009 for a single-row mobile header and footer.

## 0.02.001, 2026-09-23

- Version and bypass browser caches for baked artifact requests, preventing old case JSON from persisting after a shell deployment.

## 0.02.000, 2026-09-23

- Rebuilt the fixed-viewport instrument: quantitative circuit, response curves, selectable grind-by-collector decision surface, method-specific plots, variant comparison and mobile control view. Added bilingual linked readouts and light/dark responsive layouts.
- Corrected the classifier to partition size-bin masses, normalized the overflow cumulative distribution, connected classifier split to overall recovery and capped concentrate mass pull by rougher feed.
- Recomputed all 12 cases, 72 variants and 1,368 method records; neural models were trained with CUDA on the local RTX 4070 Laptop GPU. Added browser/Python parity checks, classifier sensitivity tests and separate autoencoder reconstruction diagnostics.
- Replaced unsupported plant, uncertainty and OOD claims with explicit simulator-only interpretation, and revised the manuscript as a proposed transfer study rather than a completed novel result.
- Repaired direct document-route serving on the VPS and GitHub Pages; project-site builds now carry the correct base path and a 404 fallback document.
- Emit real GitHub Pages route files so direct document links return HTTP 200, not merely rendered fallback content with status 404.

## 0.01.000, 2026-09-13

- Initial OreFlow release with six-route visual workbench, 12 x 6 case matrix, 19 process and learned methods, HZDR source summary, reproducible pipeline, manuscript proposal, GitHub Pages workflow and ML VPS service files.
