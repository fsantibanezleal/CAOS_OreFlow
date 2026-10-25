# OreFlow system architecture

The simulator has three distinct computational lanes. The offline Python pipeline owns the authoritative bake and the measured-data studies. The browser TypeScript engine recomputes bounded process changes and is checked against Python. The FastAPI endpoint validates and solves one requested state; it does not train or mutate artifacts.

The data path is `data-pipeline/pipeline/cases` to `pipeline/engine` and the named stages, then versioned documents under `data/derived/`. The web consumes those records and calls the browser engine for interactive changes.

The learning lane trains against engine-generated designs and separately evaluates GeoMet, HZDR particles and an iron-plant time series. These results do not calibrate the circuit simulator.
