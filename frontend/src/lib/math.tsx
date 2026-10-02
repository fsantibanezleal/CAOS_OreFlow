/**
 * Symbols in prose (U-32 of the review of 2026-10-02). A caption, paragraph, limit or parameter cell writes a
 * symbol as inline TeX between dollar signs ("water bypass $R_f$"), and it is typeset with KaTeX through the
 * shell's InlineMath, so no reader meets "R_f", "x_opt" or "tau_bank" as raw text. SVG labels, which KaTeX cannot
 * reach, carry a real subscript instead.
 */
import { InlineMath } from '@fasl-work/caos-app-shell';
import type { ReactNode } from 'react';
import { localizeTex, type Lang } from './format';

// a formula opens and closes on a non-space, so a stray dollar sign in prose is never read as one
const INLINE = /\$([^$\s](?:[^$]*[^$\s])?)\$/g;

/** Prose with its inline formulas typeset; text without a dollar sign comes back unchanged. */
export function withMath(text: string, lang: Lang): ReactNode {
  if (!text.includes('$')) return text;
  return text.split(INLINE).map((part, i) => (i % 2 ? <InlineMath key={i} tex={localizeTex(part, lang)} /> : part));
}

/** The inline formulas of a prose string, for the test that every one of them renders. */
export function inlineFormulas(text: string): string[] {
  return [...text.matchAll(INLINE)].map(m => m[1]);
}

/**
 * A subscript inside SVG text: a dy shift (baseline-shift is not honoured by every browser), then a zero-width
 * space shifted back, so any text after it returns to the baseline.
 */
export function SvgSub({ base, sub }: { base: string; sub: string }) {
  return <>{base}<tspan dy="0.3em" fontSize="72%">{sub}</tspan><tspan dy="-0.3em">{'​'}</tspan></>;
}
