# Ablation study and page tabs design

## The ablation study

An ablation is a counterfactual: the same case with one mechanism of the engine taken away, at the nominal state.
Four of the five mechanisms already have a parameter that removes them, so their switch is a transformation of
the case definition, applied once in `methods/ablations.py`:

| Switch | Transformation | Applies to |
|---|---|---|
| `entrainment` | every bank's `wash_factor` set to 0: no water-borne recovery (Savassi) | every flotation circuit |
| `composite_classes` | every valuable mineral's `composite_content` set to 0: every grain liberated | every case with composites |
| `regrind` | `regrind_energy_kwh_t` set to 0 | the cases that regrind |
| `gravity_bleed` | the operating point's `gravity_bleed` set to 0 | the gravity circuit |
| `cleaner_recirculation` | a new engine flag, `FlotationPlant.cleaner_tail_to_rougher`, set false: the cleaner tail joins the final tail instead of returning to the rougher feed | every flotation circuit with a cleaner |

Only the last one changes the engine. The flag defaults to true, which gives today's circuit exactly (AB-01). With it
false:
- the recycle loop stops feeding the cleaner tail back;
- the topology gains an edge from the cleaner tail to the final tail;
- the audit balances the new node.

The browser engine gains the same flag.

A case without a mechanism is recorded as `not_applicable`, never as a zero effect (AB-03). The record per case and
switch:
- recovery, grade, specific energy and recovered metal, with the switch on and off;
- the differences;
- the flags;
- the balance closure of the ablated state.

## The uncertainty seed study

The Experiments uncertainty tab asks how much of a record's spread is the design's own sampling error. For every
nominal state, the bake re-runs the uncertainty record at eight seeds with the default 128 samples, and records how
far P05, P50, P95 and the joint probability move between seeds. This costs about 12,000 engine runs, a minute on 12
workers.

## Records

Both studies go to `data/derived/studies.json`, written by a new bake stage, `studies`, after the benchmark. The
checks in `scripts/check_artifacts.py`:
- every switch is on in the case records;
- the ablated states close their balances;
- `not_applicable` is used where a mechanism is absent;
- the seed study's seeds are distinct and its records use the declared design.

## Pages

- Experiments: design, data, splits, metrics, variant effects, uncertainty (the protocol, the live re-run and the
  seed study), ablations (the study). The old Protocols tab's kinetic paragraph moves to Metrics.
- Implementation: the six tabs of 0.06, and the model registry, the GPU lane and deployment (done, e2b0661).
