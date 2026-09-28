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
