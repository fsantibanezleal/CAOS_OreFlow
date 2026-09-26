# KaTeX: usage in OreFlow

Read order: [01 Installation](01_installation.md), **you are on 02**, then [03 Applying](03_applying.md).

## Where the TeX lives

A topic's equations are data (`frontend/src/content/doc.tsx`):

```ts
equations?: Array<{ tex: string | Bi; caption: Bi }>;
```

and the page renders each with the shell's component:

```tsx
<Equation key={tex(eq.tex)} tex={formula(eq.tex, lang)} caption={eq.caption[lang]} />
```

where `formula` picks the language's TeX and localizes its decimals. The Case view renders the
family's formulas from `content/equations.ts` the same way.

## A formula in two languages

Most formulas are symbols only, and one string serves both languages:

```ts
{ tex: r`S_i = \frac{V\left[E(Y \mid X_i)\right]}{V(Y)}`, caption: { en: '...', es: '...' } }
```

A formula that needs a word carries both:

```ts
{ tex: { en: r`\max \ \dots \quad \text{s.t.} \ \dots`, es: r`\max \ \dots \quad \text{s.a.} \ \dots` }, ... }
```

`tex-language.test.ts` holds the rule: a formula written once may not contain a word inside `\text`,
`\mathrm` or `\operatorname` other than units (`kPa`, `t/h`, `kWh`...), the `RMSE` acronym and the `diag`
operator; a formula written twice must differ between the languages. When it was added it found two
English words in single-language formulas (a confidence interval written `CI`, which Spanish writes `IC`,
and `median`, which is `mediana`), now bilingual.

Word subscripts are avoided altogether: a bank recovery is `R_N`, not `R_{bank}`; a critical size is
`d_{crit}`, a notation both languages read.

## Decimals

TeX sets `0.71` with a point. On the Spanish pages `localizeTex` rewrites every decimal point between
digits as a braced comma, `0{,}71`: the braces make KaTeX set the comma as part of the number, with no
space after it, as Spanish typesetting does. English pages get the TeX unchanged. The locale tests cover
the function; the gate's locale probe fails any decimal point inside a rendered equation on a Spanish
page.

## Fitting the column

A narrow figure's topic puts the equations in the text column beside the figure, and a long equation would
be wider than its box. Long forms are stacked with `\begin{gathered} ... \\ ... \end{gathered}` or split into
two lines at a natural break. The browser gate measures every `.katex-display` on every tab of every page,
in each viewport, and fails when one is wider than its box (it could only be read by scrolling inside it),
and fails on any `.katex-error`, which KaTeX renders for TeX it cannot parse.

## Captions

Every equation has a caption in both languages that names its symbols and their units, so a reader does
not need the surrounding paragraph to read the equation.
