# Live uncertainty design

- **Generator.** `splitmix64(state)`:
  - add `0x9e3779b97f4a7c15` modulo 2^64;
  - mix with `(z ^ z>>30) * 0xbf58476d1ce4e5b9`, `(z ^ z>>27) * 0x94d049bb133111eb` and `z ^ z>>31`, all modulo
    2^64.

  Python uses integers masked to 64 bits. TypeScript uses `BigInt` with `BigInt.asUintN(64, ...)`, on 128 x 4
  draws, which costs microseconds.
- **Uniforms.** `Number(z >> 11n) * 2 ** -53` in TypeScript and `(z >> 11) * 2.0 ** -53` in Python. Both are exact
  in IEEE doubles.
- **Permutation.** Fisher-Yates from the last index down: `j = floor(u * (i + 1))`, with `u` the next uniform.
  Using the uniform, not a modulo of the integer, keeps both languages on the same arithmetic.
- **Design.** For each input in the declared order (`work_index`, `head_grade`, `liberation_size`,
  `floatability`), first the permutation of `0..n-1`, then `n` uniforms. Sample `i` of input `k` is
  `(perm_k[i] + U_k[i]) / n`, and the factor is `1 - h_k + 2 h_k u`.
- **Quantiles.** P05, P50 and P95 with linear interpolation (NumPy's default), implemented in TypeScript with the
  same formula `x[floor(q (n-1))] + frac * (next - that)`.
- **Records.** `design: "SplitMix64 Latin hypercube"`, `generator`, `seed`, `samples`, and the 0.06 fields. The
  bake's default seed stays `uncertainty.seed`.
- **Worker.** An `uncertainty` request streams per sample, like `sweep`. The Methods view's uncertainty record
  gains seed and sample-count inputs and a run button. The live result is drawn beside the baked one and labelled
  live.

## UQ-09: output-specific notebook comparison

The level-3 lesson explicitly retains level 2's seed 20261031, independent input ranges,
nominal circuit, 32-row propagation and N8/N16 Saltelli baseline. Its additional analysis
consumes `indices.recovery_pct` and `indices.specific_energy_grinding_kwh_t` separately
from each existing `sensitivity` response. Both outputs therefore share the same N,
48/96 evaluations, inputs and physical assumptions; the comparison makes no new solve.

Notebook helpers validate computed response status, complete factor keys and finite ST
and ST_conf vectors. Descending point-estimate ranks use shared ranks for ties. A paired
table keeps both output vectors, their individual half-widths, ranks and signed
`ST_recovery - ST_energy` for every factor and budget. A focused N16 horizontal figure
shows the two ST vectors with their own bootstrap half-widths, including negative or
out-of-range endpoints. Each normalized index is dimensionless; the underlying recovery
is measured in percent and grinding energy in kWh/t. An index difference is not a
physical recovery/energy difference. Individual intervals cannot supply a paired
difference interval without joint resamples, which this response does not expose.

A missing target, invalid status or malformed vector fails with sensitivity-contract
context. A production `constant: true` target retains absent values/ranks/differences and
an explicit state; it is never replaced by zeros. A numeric Results binding is refused
if its required comparison is unavailable. The named regression executes the actual
notebook helper definitions with reversed two-target rankings, negative and above-one
estimates, wide half-widths, missing targets and a constant target. It catches recovery
array reuse for energy, clamping and invented numeric constant-output comparisons.

Existing cell IDs/order and original numeric bindings remain intact. New cells have
stable `uq-compare-*` IDs before Results; only the two level-3 companions are regenerated.
