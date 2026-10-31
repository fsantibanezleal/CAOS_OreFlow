# Guides

Task-oriented pages: each starts from something you want to do and gives the commands, the files and the
checks, in order. For what the pieces are and why, see [architecture](architecture.md) and
[frameworks](frameworks.md); for the science, the [methodologies](methodologies.md).

| Guide | For when you want to |
|---|---|
| [00 Instantiate from the product template](guides/00_instantiate.md) | start a new CAOS product from the governed repository template |
| [01 Run it locally](guides/01_run-locally.md) | set up the environments, open the workbench and the service on your machine, and run the local release gate and the browser gate |
| [02 Bake the artifacts (and the GPU lane)](guides/02_bake-and-gpu.md) | regenerate the committed records after changing the engine, the catalog or a method, on a GPU or without one |
| [03 Use it on other data](guides/03_use-on-other-data.md) | run the engine on your own ore, plant or operating point, call the live API, score your own assays with the GeoMet model, read the records as tables |
| [04 Add a case](guides/04_add-a-case.md) | add a thirteenth scenario to the catalog, with its prose, its tests and its pages |
| [05 Read the workbench](guides/05_read-the-workbench.md) | understand what each view shows, what the flags mean, and how far each number can be trusted |
| [08 Build and maintain the notebooks](guides/08_notebooks.md) | run the bilingual lessons, reproduce their outputs, and check the notebook contract |
| [09 Methods and manuscripts](guides/09_method-tiers.md) | understand the internal method ladder and the evidence and Zenodo records required for release |

Every command is given for PowerShell on Windows, the development platform; each script has a bash twin
with the same name and behaviour (`scripts/*.sh`).
