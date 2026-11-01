import type { ScreenRecord } from '../engine/optimization-record';

export const close = (a: number | null | undefined, b: number | null | undefined): boolean =>
  a == null || b == null ? a === b : Number.isFinite(a) && Number.isFinite(b)
    && Math.abs(a - b) <= 1e-6 * Math.max(Math.abs(a), Math.abs(b), 1e-12);

/** A subtraction of near-equal dimensionless objectives, never a physical absolute tolerance.
 * With unit roundoff u=EPSILON/2, four rounded operands across two runtimes have budget 4u*S.
 * Near-equal same-sign operands satisfy Sterbenz's condition: their subtraction adds no rounding.
 * This diagnostic-only budget does not bound or relax upstream prediction/objective comparisons.
 */
export function marginClose(a: number | null, b: number | null, selectedA: number, selectedB: number): boolean {
  if (a === null || b === null) return a === b;
  if (![a, b, selectedA, selectedB].every(Number.isFinite)) return false;
  if (close(a, b)) return true;
  const runnerA = selectedA - a, runnerB = selectedB - b;
  if (![runnerA, runnerB].every(Number.isFinite)) return false;
  const scale = Math.max(Math.abs(selectedA), Math.abs(selectedB), Math.abs(runnerA), Math.abs(runnerB));
  const zeroBudget = 2 * Number.EPSILON * scale;
  return Math.abs(a) <= zeroBudget && Math.abs(b) <= zeroBudget && Math.abs(a - b) <= zeroBudget;
}

type ScreenEvidence = Omit<ScreenRecord, 'proposals'> & { proposals?: ScreenRecord['proposals'] };
export function compareScreen(where: string, mine: ScreenEvidence, baked: ScreenEvidence, problems: string[]): void {
  const counts = (s: ScreenEvidence) => [s.iterations, s.screened, s.rejected.guard, s.rejected.interval, s.proposed, s.improved];
  if (JSON.stringify(counts(mine)) !== JSON.stringify(counts(baked))) problems.push(`${where} screen: ${counts(mine)} vs ${counts(baked)}`);
  if ((mine.proposals?.length ?? 0) !== (baked.proposals?.length ?? 0)) problems.push(`${where} proposal count differs`);
  (baked.proposals ?? []).forEach((b, i) => {
    const m = mine.proposals?.[i];
    if (!m || m.length !== b.length || m[0] !== b[0] || m[6] !== b[6]) {
      problems.push(`${where} proposal ${i}: ${JSON.stringify(m)} vs ${JSON.stringify(b)}`); return;
    }
    for (const c of [1, 2, 3, 4]) if (!close(m[c] as number | null, b[c] as number | null)) problems.push(`${where} proposal ${i}[${c}]: ${m[c]} vs ${b[c]}`);
    if (!marginClose(m[5], b[5], m[3], b[3])) problems.push(`${where} proposal ${i}[5]: ${m[5]} vs ${b[5]}`);
  });
}
