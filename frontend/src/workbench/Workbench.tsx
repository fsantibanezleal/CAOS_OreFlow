/**
 * The App route (design §12.1): the workbench inside the shell's contained page (`.page-body.wide`,
 * ADR-0071 rules 1 and 2). It loads the case index, the operating contract and the benchmark once, the
 * case artifact per case, and holds the state in the URL (case, variant, view and the changed inputs),
 * so a state can be shared and the focus route opens on exactly this one. Every point is validated
 * against the contract before the engine sees it; the engine runs in the Web Worker, and a newer state
 * supersedes an evaluation still on its way. The source (RS-07) is a synthetic case, a GeoMet sample run in the
 * soft porphyry's circuit on its own ore, or an iron-plant hour, which is shown and never simulated.
 */
import { useShellLang } from '@fasl-work/caos-app-shell';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { evaluateInWorker, RefusedState } from '../engine/client';
import type { ContractError, OperatingContract } from '../engine/contract';
import type { OperatingPoint } from '../engine/model';
import type { Trace } from '../engine/trace';
import { loadBenchmark, loadCase, loadContract, loadIndex, loadIronPlant, loadRealSamples, type IronPlant, type RealSamples } from '../lib/artifacts';
import type { Benchmark, CaseArtifact, CaseIndex } from '../lib/artifacts.types';
import type { Lang } from '../lib/format';
import { t, UI } from '../lib/i18n';
import { checkPoint, Rail } from './Rail';
import { Readout } from './Readout';
import { changedInputs, parseSet, SOURCES, sourceQuery, stateQuery, useWorkbench, VIEWS, type Source, type View } from './state';
import { ViewTabs } from './ViewTabs';
import { CircuitView } from './views/CircuitView';
import { CaseView } from './views/CaseView';
import { GrindingView } from './views/GrindingView';
import { MethodsView } from './views/MethodsView';
import { ResponseView } from './views/ResponseView';
import { SeparationView } from './views/SeparationView';
import { HourReadout, HourView, SampleView, SourceStatement } from './views/SourceViews';

/** The case whose plant and operating point run the GeoMet samples (RS-05). */
export const SAMPLE_CASE = 'copper_porphyry_soft';

export type Loaded = { index: CaseIndex; contract: OperatingContract; benchmark: Benchmark | null };

/** Index, contract and benchmark, loaded once per page (the benchmark only feeds the Compare view). */
export function useLoaded(): { loaded: Loaded | null; failure: string | null } {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  useEffect(() => {
    Promise.all([loadIndex(), loadContract(), loadBenchmark().catch(() => null)])
      .then(([index, contract, benchmark]) => setLoaded({ index, contract, benchmark }), error => setFailure(String(error)));
  }, []);
  return { loaded, failure };
}

/** A record the current source needs, loaded the first time it is needed. */
function useRecord<T>(wanted: boolean, load: () => Promise<T>): T | null {
  const [value, setValue] = useState<T | null>(null);
  useEffect(() => {
    if (!wanted || value) return;
    let live = true;
    load().then(next => { if (live) setValue(next); }, () => undefined);
    return () => { live = false; };
    // the loader is a module-level function; it never changes between renders
  }, [wanted, value]); // eslint-disable-line react-hooks/exhaustive-deps
  return value;
}

/**
 * The case artifact and the engine trace of the current state, driven by the store; the URL's state is
 * applied once, when the page opens. With a GeoMet sample as the source, the case is the soft porphyry and the
 * engine runs the sample's ore; the sample's head grade and work index are validated apart from the synthetic
 * envelope, which the samples' assays lie outside (RS-08). An iron-plant hour is never simulated.
 */
export function useCaseState(loaded: Loaded | null, params: URLSearchParams) {
  const { caseId, variantId, point, source, sampleId, setCase, setVariant, setPoint, setView, setSource, setSample, setHour } = useWorkbench();
  const samples = useRecord<RealSamples>(source === 'sample', loadRealSamples);
  const lane = useRecord<IronPlant>(source === 'hour', loadIronPlant);
  const sample = source === 'sample' ? samples?.samples.find(s => s.id === sampleId) ?? null : null;
  const [artifact, setArtifact] = useState<CaseArtifact | null>(null);
  const [trace, setTrace] = useState<Trace | null>(null);
  const [accepted, setAccepted] = useState<OperatingPoint | null>(null);
  const [errors, setErrors] = useState<ContractError[]>([]);
  const [computing, setComputing] = useState(false);
  const pending = useRef<{ variant: string | null; set: Partial<Record<keyof OperatingPoint, number>> } | null>(null);
  const opened = useRef(false);

  // the URL's state, once
  useEffect(() => {
    if (!loaded || opened.current) return;
    opened.current = true;
    const ids = loaded.index.cases.map(c => c.case_id);
    const wanted = params.get('case');
    const target = wanted && ids.includes(wanted) ? wanted : ids[0];
    const view = params.get('view') as View | null;
    if (view && VIEWS.includes(view)) setView(view);
    const wantedSource = params.get('source') as Source | null;
    if (wantedSource && SOURCES.includes(wantedSource) && wantedSource !== useWorkbench.getState().source) setSource(wantedSource);
    if (params.get('sample')) useWorkbench.setState({ sampleId: params.get('sample') });
    if (params.get('hour')) setHour(params.get('hour') as string);
    // back from the focus route the store already holds this state; the URL only mirrors it
    const held = useWorkbench.getState();
    if (held.caseId === target && held.point) return;
    pending.current = { variant: params.get('variant'), set: parseSet(params.get('set')) };
    setCase(target);
  }, [loaded, params, setCase, setView, setSource, setHour]);

  // the case artifact; a reply for a case the user has already left is dropped
  useEffect(() => {
    if (!caseId) return;
    let live = true;
    setArtifact(current => (current?.case_id === caseId ? current : null));
    loadCase(caseId).then(next => {
      if (!live) return;
      setArtifact(next);
      const want = pending.current;
      pending.current = null;
      const held = useWorkbench.getState();
      if (!want && held.point && next.variants.some(v => v.id === held.variantId)) return;
      const variant = next.variants.find(v => v.id === (want?.variant ?? 'nominal')) ?? next.variants[0];
      setVariant(variant.id, variant.point);
      if (want && Object.keys(want.set).length) setPoint({ ...variant.point, ...want.set });
    }, () => { if (live) setArtifact(null); });
    return () => { live = false; };
  }, [caseId, setVariant, setPoint]);

  // a sample runs in the soft porphyry's circuit: the case follows the source, and the sample's point is the base
  const appliedSample = useRef<string | null>(null);
  useEffect(() => {
    if (source !== 'sample') {
      // back to a synthetic case: the variant's own point is the base again
      if (appliedSample.current && artifact) {
        appliedSample.current = null;
        const variant = artifact.variants.find(v => v.id === useWorkbench.getState().variantId) ?? artifact.variants[0];
        setVariant(variant.id, variant.point);
      }
      return;
    }
    if (caseId !== SAMPLE_CASE) { setCase(SAMPLE_CASE); return; }
    if (!samples || !artifact || artifact.case_id !== SAMPLE_CASE) return;
    const wanted = samples.samples.find(s => s.id === sampleId) ?? samples.samples[0];
    if (appliedSample.current !== wanted.id) { appliedSample.current = wanted.id; setSample(wanted.id, wanted.point); }
  }, [source, caseId, samples, artifact, sampleId, setCase, setSample, setVariant]);

  // validate, then evaluate in the worker; only the newest state's trace is kept
  useEffect(() => {
    if (!loaded || !artifact || !point || artifact.case_id !== caseId || source === 'hour') return;
    if (source === 'sample' && (!sample || appliedSample.current !== sample.id)) return;
    const nominal = loaded.contract.cases[caseId].nominal;
    // RS-08: the datum is the sample's; the contract judges the operating controls against the case's envelope
    const judged = sample ? { ...point, head_grade: nominal.head_grade, work_index_kwh_t: nominal.work_index_kwh_t } : point;
    const verdict = checkPoint(loaded.contract, caseId, judged);
    setErrors(verdict.errors);
    if (!verdict.accepted || !verdict.point) return;
    const valid = (sample ? { ...verdict.point, head_grade: sample.point.head_grade, work_index_kwh_t: sample.point.work_index_kwh_t }
      : verdict.point) as unknown as OperatingPoint;
    setComputing(true);
    evaluateInWorker(sample ? sample.ore : artifact.definition.ore, artifact.definition.plant, valid).then(
      next => { setTrace(next); setAccepted(valid); setComputing(false); },
      error => {
        // a state the engine refuses (E-01) is a rejection like the contract's: its error shows, no result is current
        if (error instanceof RefusedState) { setErrors([error.error]); setComputing(false); return; }
        if (String(error?.message ?? error) !== 'superseded') setComputing(false);
      },
    );
  }, [loaded, artifact, point, caseId, source, sample]);

  const variant = artifact?.variants.find(v => v.id === variantId) ?? null;
  return { artifact, variant, trace: source === 'hour' ? null : trace, accepted, errors, computing, samples, lane, sample };
}

export default function Workbench() {
  const lang = useShellLang() as Lang;
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { caseId, variantId, base, point, view, selectedUnit, source, sampleId, hourKey, setView, selectUnit } = useWorkbench();
  const { loaded, failure } = useLoaded();
  const { artifact, variant, trace, accepted, errors, computing, samples, lane, sample } = useCaseState(loaded, params);
  const [cursor, setCursor] = useState<string | null>(null);

  // the state travels in the URL (replace, so the back button leaves the page instead of undoing a slider)
  useEffect(() => {
    if (!caseId || !base) return;
    const query = `${stateQuery(caseId, variantId, base, point, view)}${sourceQuery(source, sampleId, hourKey)}`;
    if (query !== params.toString()) setParams(query, { replace: true });
  }, [caseId, variantId, base, point, view, source, sampleId, hourKey, params, setParams]);
  useEffect(() => setCursor(null), [view, caseId]);

  if (failure) return <div className="page-body wide of-bench"><p className="of-failure" role="alert">{failure}</p></div>;
  if (!loaded || !artifact || !variant || !point || artifact.case_id !== caseId) {
    return <div className="page-body wide of-bench"><p className="of-hint" role="status">{t(UI.loading, lang)}</p></div>;
  }
  const { index, contract, benchmark } = loaded;
  const primary = contract.cases[caseId].primary;
  const modified = Object.keys(changedInputs(base, point)).length > 0;
  const openFocus = () => navigate(`/focus/${caseId}?${stateQuery(caseId, variantId, base, point, view)}${sourceQuery(source, sampleId, hourKey)}`);
  const names = Object.fromEntries(VIEWS.map(v => [v, t(UI.views[v], lang)])) as Record<View, string>;

  let body: React.ReactNode = <p className="of-hint" role="status">{t(UI.loading, lang)}</p>;
  if (source === 'hour') {
    // RS-07: an hour of the iron plant is shown, never simulated
    body = view === 'case' ? (lane ? <HourView lane={lane} hourKey={hourKey} lang={lang} onCursor={setCursor} /> : body) : <SourceStatement kind="hour" lang={lang} />;
  } else if (source === 'sample' && trace && accepted && sample && samples) {
    if (view === 'circuit') body = <CircuitView trace={trace} primary={primary} lang={lang} selected={selectedUnit} onSelect={selectUnit} />;
    else if (view === 'grinding') body = <GrindingView trace={trace} ore={sample.ore} lang={lang} onCursor={setCursor} />;
    else if (view === 'separation') body = <SeparationView trace={trace} primary={primary} lang={lang} onCursor={setCursor} />;
    else if (view === 'response') body = <SourceStatement kind="sample-response" lang={lang} />;
    else if (view === 'methods') body = <SourceStatement kind="sample-methods" lang={lang} />;
    else body = <SampleView record={samples} sample={sample} recovery={trace.metrics.recovery_pct ?? null} lang={lang} />;
  } else if (source === 'case' && trace && accepted) {
    if (view === 'circuit') body = <CircuitView trace={trace} primary={primary} lang={lang} selected={selectedUnit} onSelect={selectUnit} />;
    else if (view === 'grinding') body = <GrindingView trace={trace} ore={artifact.definition.ore} lang={lang} onCursor={setCursor} />;
    else if (view === 'separation') body = <SeparationView trace={trace} primary={primary} lang={lang} onCursor={setCursor} />;
    else if (view === 'response') body = <ResponseView contract={contract} artifact={artifact} optimization={variant.methods.optimization} point={accepted} lang={lang} onCursor={setCursor} />;
    else if (view === 'methods') body = <MethodsView contract={contract} artifact={artifact} variant={variant} point={accepted} trace={trace} modified={modified} lang={lang} onCursor={setCursor} />;
    else body = <CaseView contract={contract} artifact={artifact} index={index} benchmark={benchmark} variantId={variantId} lang={lang} onCursor={setCursor} />;
  }

  return (
    <div className="page-body wide of-bench">
      <Rail index={index} contract={contract} artifact={artifact} lang={lang} errors={errors} onFocus={openFocus} samples={samples} lane={lane} />
      <section className="of-main" aria-label={artifact.title[lang]}>
        {source === 'hour' && lane ? <HourReadout lane={lane} hourKey={hourKey} lang={lang} cursor={cursor} />
          : <Readout trace={trace} lang={lang} computing={computing} cursor={cursor} />}
        <ViewTabs views={VIEWS} active={view} onChange={setView} label={t(UI.viewsLabel, lang)} names={names} />
        <div className="of-view-host" role="tabpanel" aria-label={names[view]}>{body}</div>
      </section>
    </div>
  );
}
