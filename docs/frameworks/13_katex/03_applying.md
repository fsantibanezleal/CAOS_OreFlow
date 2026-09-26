# KaTeX: applying it

Read order: [01 Installation](01_installation.md), [02 Usage](02_usage.md), **you are on 03**.

## Writing a new equation

1. **Start from the methodology page** that states it (`docs/methodologies/`), so the interface and the
   documentation carry the same form. Write it as the engine solves it, with the engine's symbols.
2. **Use `String.raw`** (`r` in the content modules) so backslashes reach KaTeX as written:
   ``r`\frac{a}{b}` ``, not `'\\frac{a}{b}'`.
3. **Symbols, not words.** Prefer a subscript letter or index to a word; when a word is unavoidable (a
   condition such as "subject to"), give the formula both languages: `{ en: r`...`, es: r`...` }`.
4. **Decimals with a point.** Write `0.71`; `localizeTex` sets `0{,}71` on the Spanish pages. Never
   write the comma yourself, or the English page gets it too.
5. **Stack long forms** with `\begin{gathered} ... \\ ... \end{gathered}`, so the equation fits a side
   column at 1280 px.
6. **Caption it** in both languages, naming each symbol and its unit.
7. **Run the checks**: `npm run test` (the language test) and the gate against a build (no KaTeX error,
   no equation wider than its box, no decimal point on a Spanish page).

## Traps

- **An unknown command renders red, not an exception.** KaTeX draws a `.katex-error` span and the page
  keeps working, which is why the gate counts them.
- **`\text` and `\mathrm` differ.** `\text{}` uses the surrounding text font and spacing; `\mathrm{}` is
  upright math. Use `\mathrm` for unit symbols and operator-like names, `\operatorname` for a named
  operator that should get operator spacing.
- **Braces in template literals.** `${...}` in a template string is interpolation; TeX that needs a
  literal `${` must escape it, or build the string without a template.
- **Copying from the Markdown docs.** `$$...$$` delimiters and Markdown escaping (`\\` before `_` or `*`
  that some editors add) do not belong in the interface's TeX; paste the formula body only.
