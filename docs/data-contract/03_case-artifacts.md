# 03 Case artifacts (Contract 2)

This page describes the case artifacts as shipped in 0.04.000. The pipeline rewrite of the
process-engine v2 feature (task T16) replaces them with artifacts that embed the ore and plant
definitions and one `oreflow.trace/v2` record per variant ([02 Trace and live API](02_trace-and-live-api.md));
this page is rewritten in the same commit.

The output case schema is `oreflow.case/v1`. A case artifact contains six variants and an explicit
`process_family`. Each variant stores the complete size grid, feed, crushed, ground and overflow
cumulative passing curves, a kinetic curve (zero for the magnetic circuit), metric dictionary and all
21 method records. Records distinguish `precomputed`, `not-applicable`, and `unavailable`. The
manifest points to the artifact, records its byte count, engine version, seed, lane and evaluation
summary. `frontend/src/lib/contract.types.ts` mirrors the shape.
