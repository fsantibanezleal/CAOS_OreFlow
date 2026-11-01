# Technical-report build design

This is an authoring tool, not a publisher. The complete scientific artifact/claim gate and rendered-page review
remain necessary before Zenodo publication. The build reads the report's Markdown, template and public metadata,
plus VERSION; the caller supplies the reserved version DOI and date. The concept DOI comes from product.json.
The authored Zenodo metadata names the intended release version. The product's report entry may still name its
previously published version while a candidate is built; that declared version is recorded and must be valid and
no newer than the intended release. The builder never relabels the published entry to make a candidate pass.

An external scratch root is resolved and checked against the repository, including symlinks. A fresh child
directory holds all intermediate files. Python subprocess argument lists carry every path without shell
interpolation. Pandoc renders the existing template with highlighting disabled, then XeLaTeX runs twice with an
explicit output directory. Final logs must contain no overfull/underfull boxes or LaTeX/package warnings.
Poppler verifies page count and the PDF's version/DOI/author/license text. Failures never install partial files.

A JSON receipt identifies the exact inputs, tools, parameters and candidate bytes. Successful compilation is a
bounded build result, not scientific review or publication approval. An explicit write flag copies only the
validated .tex and .pdf to the canonical report tree. No metadata, DOI record, software release or remote service
is changed, and no browser access is needed. A README documents both ordinary candidate builds and canonical
installation. Tests exercise malformed identities/paths, partial compiler output, bad logs/PDF text, source drift
and preservation of existing canonical files using the actual builder functions.
