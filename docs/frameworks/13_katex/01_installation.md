# KaTeX: installation

Read order for this node: **you are on 01.** Next: [02 Usage](02_usage.md), then
[03 Applying](03_applying.md). The landing page is [../13_katex.md](../13_katex.md).

```json
"katex": "0.16.47"
```

The shell lists KaTeX as a peer dependency (`^0.16.0`), so the version the product pins is the one the
shell's `Equation` uses. It installs with the frontend (`npm ci`). The build copies KaTeX's fonts
(`KaTeX_Main`, `KaTeX_Math`, `KaTeX_AMS` and the others, as `.woff2`, `.woff` and `.ttf`) into
`frontend/dist/assets/` with hashed names, and its stylesheet into the main CSS bundle; the site loads
nothing from a CDN.

The Markdown pages of `docs/` use `$...$` and `$$...$$`, which GitHub renders with its own math support;
the equations there and in the interface are kept the same by hand, from the same methodology source.
