# 02 Trace and live API

## The trace

One circuit evaluation produces one trace (schema `oreflow.trace/v2`, built by
`pipeline.engine.trace.trace`). The live API returns it, each baked case artifact stores one per
variant, and the browser engine must reproduce its metrics and curves within 1e-6 relative
(PE-31). Every number in a trace is finite: a non-finite value would become `null` and raise the
`non_finite_output` flag with its path, so it can never pass silently.

| Key | Content |
|---|---|
| `family` | circuit family of the case |
| `point` | the full operating point that was simulated (after validation) |
| `metrics`, `metric_units` | scalar results and the unit of each (table below) |
| `concentrates`, `tails` | names of the streams that leave the circuit as products |
| `topology` | every unit as `{unit, inputs, outputs, water_added_tph}` with stream names, in flowsheet order |
| `streams` | every stream as a record (below) |
| `curves` | size-resolved results (below) |
| `balance` | `units`: the worst relative closure error of each unit; `max_relative_error`: the worst over the circuit |
| `flags` | `{code, message}` for every condition the engine reports (below) |

**Stream record.** `solids_tph`, `water_tph`, `solids_pct` (mass percent solids), `p80_um` (`null`
for an empty stream), `minerals_tph` (dry flow of each mineral) and `grades` (every payable and
quality species, in its unit: % or g/t).

**Topology.** The units are `crusher`, `mill_feed_junction` (new feed plus recycle, with mill water),
`mill`, `sump` (with dilution water), `cyclone`, then either `underflow_return` or `gravity_split`
(the gravity concentrate leaves; the rest returns as `recycle`). Separation follows: `lims_link`,
`lims_rougher`, `lims_cleaner` for magnetite; optionally `deslime`; then `flotation_link` (rougher
feed dilution), `rougher_junction` (fresh flotation feed plus cleaner tails), `rougher`, optionally
`regrind`, `cleaner_junction` (with cleaner dilution and, where present, recleaner tails), `cleaner`,
and optionally `recleaner_dilution` and `recleaner`. Recycle streams are therefore explicit edges:
`recycle` into `mill_feed_junction`, `cleaner_tail` into `rougher_junction`, `recleaner_tail` into
`cleaner_junction`. The stream `gravity_feed` is the bleed itself, reported for the circuit view; the
gravity tails return with the recycle. The whole-circuit envelope is audited as the unit `circuit`
in `balance` and is not a topology node.

**Metrics.** Grade metrics carry the unit of the case's primary payable (% or g/t).

| Group | Keys |
|---|---|
| Products | `throughput_tph`, `head_grade`, `recovery_pct` (primary payable, overall), `concentrate_grade`, `tail_grade`, `concentrate_tph`, `mass_pull_pct`, `recovered_primary_tph`; per species `head_<S>`, `concentrate_<S>`; per payable `recovery_<S>_pct` |
| Grinding | `crusher_feed_f80_um`, `crusher_p80_um` (mill new feed), `target_p80_um`, `p80_um` (achieved), `circulating_load_pct`, `cyclone_cut_um`, `cyclone_bypass_pct`, `mill_power_kw`, `required_mill_power_kw`, `installed_mill_power_kw`, `power_limited` (1 or 0) |
| Cyclone sizing (Plitt) | `cyclones_required`, `cyclone_pressure_kpa`, `plitt_cut_um`, `plitt_sharpness`, `cyclone_feed_solids_vol_pct` |
| Energy | `specific_energy_crushing_kwh_t`, `specific_energy_grinding_kwh_t`, `specific_energy_regrind_kwh_t`, `specific_energy_total_kwh_t` (their sum), `bond_energy_kwh_t`, `operating_work_index_kwh_t`, `bond_efficiency_ratio`, and the comparison laws `energy_rittinger_kwh_t`, `energy_kick_kwh_t` (never summed) |
| Water | `water_use_m3_h`, `water_intensity_m3_t` (fresh water per tonne of ore) |
| Flotation | `flotation_recovery_pct` (on the flotation feed), `rougher_recovery_pct`, `cleaner_recovery_pct`, `recleaner_recovery_pct`, `rougher_concentrate_grade`, `rougher_mass_pull_pct`, `rougher_residence_min`, `cleaner_residence_min`, `rougher_water_recovery_pct`, `cleaner_water_recovery_pct`, `bubble_surface_flux_s`, `cleaner_recycle_tph`, `recycle_iterations`, `entrained_gangue_share_pct`, `regrind_power_kw` |
| Gravity | `gravity_recovery_pct`, `gold_circulating_load_pct` |
| Magnetite | `magnetite_recovery_pct` (magnetic Fe); `recovery_pct` is total Fe |
| Desliming | `slimes_mass_pct`, `slimes_loss_pct` (primary payable lost to slimes) |
| Audit | `balance_max_relative_error`, `species_consistency_error` |

**Curves.** All size-resolved curves share `size_um` (representative size of each of the 63
classes) and `upper_um` (class upper bounds).

| Key | Content |
|---|---|
| `psd` | cumulative passing of the main streams (crusher feed, new feed, mill discharge, cyclone underflow and overflow, final concentrate and tail, and where present slimes, deslime underflow, gravity concentrate) |
| `partition` | cyclone partition to underflow, with bypass, for the host gangue and each valuable mineral |
| `liberation` | liberated fraction of each valuable mineral by size |
| `composite_scale` | host-limited composite scale by size (1 where the host suffices; methodology page 03) |
| `recovery_by_size` | rougher recovery by size of the primary payable, of free host gangue, and the entrained share of that gangue |
| `bank_profile` | cumulative grade and recovery cell by cell down the rougher bank |
| `capture` | LIMS capture by size and particle class (magnetite) |
| `deslime_partition` | desliming cyclone partition by particle class (phosphate) |

**Flags.**

| Code | Meaning |
|---|---|
| `power_limited` | required mill power exceeds installed power; the circuit runs at installed power and the product is coarser than the target |
| `target_unreachable` | the target P80 cannot be met within the energy search range |
| `circulating_load_unreachable` | the design circulating load cannot be held at this energy |
| `cyclone_pressure` | the Plitt pressure falls outside the 35 to 200 kPa practical window |
| `mill_water_negative`, `sump_water_negative` | the declared densities leave no room for water addition at the mill or the sump |
| `recycle_not_converged` | the flotation recycle did not meet its absolute and relative tolerances |
| `composite_scale_not_converged` | the host-limited composite fixed point did not converge |
| `negative_mass` | a class mass is negative beyond round-off |
| `non_finite_output` | a non-finite number was replaced by `null` |

## The live API

The service (`app/`) serves the static build, the baked artifacts and a bounded live simulation.
Routes, all under the service origin:

| Route | Response |
|---|---|
| `GET /healthz` (also `/health`) | `{status, service, version}` |
| `GET /api/contract` | the exported Contract 1 document, the same file the static build serves |
| `POST /api/simulate` | a validated simulation (below) |
| `GET /api/cases`, `GET /api/cases/{id}`, `GET /api/cases/{id}/manifest`, `GET /api/benchmark` | baked artifacts ([03 Case artifacts](03_case-artifacts.md)) |

`POST /api/simulate` takes `{"case_id": "...", "point": {...}}`; `point` may be partial, and missing
inputs take the case nominal.

- **200**: `{"schema": "oreflow.live/v2", "lane": "live-api", "contract_digest", "case_id", "trace"}`.
- **422, rejected state**: `{"schema": "oreflow.rejection/v1", "contract_digest", "case_id",
  "errors": [{"code", "input", "value", "min", "max", "message"}]}` with the codes of
  [01 Operating contract](01_operating-contract.md). The browser rejects the same states with the
  same codes before it runs its own engine.
- **422, malformed request**: a body that is not an object with a string `case_id` and an object
  `point` (at most 64 keys) is rejected by the request schema with FastAPI's standard error body.
- **500**: `{"schema": "oreflow.engine-error/v1", "case_id", "point", "message"}` if the engine raises
  on an accepted state. The envelope gate exists so that this never happens; if it does, the failure
  is reported with the state that caused it, not hidden.

Example:

```json
{"case_id": "copper_porphyry_soft", "point": {"target_p80_um": 120, "collector_gpt": 35}}
```

Gates: `tests/test_live_api.py::test_api_and_contract_agree` replays every contract probe through the
HTTP API and compares status and error codes; `test_live_trace_equals_engine` checks that the API
trace for each nominal case equals the engine's trace exactly; `test_engine_failure_is_reported`
checks the 500 envelope.
