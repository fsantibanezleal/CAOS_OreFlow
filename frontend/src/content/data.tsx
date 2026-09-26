/**
 * Artifact-bound content for the pages: a loader hook and the loading and error states, so a table or
 * chart on a content page reads the committed artifacts at run time and never retypes their numbers.
 */
import { useEffect, useState, type ReactNode } from 'react';
import type { Lang } from '../lib/format';

type State<T> = { value: T | null; error: string | null };

/** Loads once per mount; the loaders are memoized per file, so pages that share an artifact share one request. */
export function useArtifact<T>(load: () => Promise<T>): State<T> {
  const [state, setState] = useState<State<T>>({ value: null, error: null });
  useEffect(() => {
    let live = true;
    load().then(value => { if (live) setState({ value, error: null }); }, (error: unknown) => { if (live) setState({ value: null, error: String(error) }); });
    return () => { live = false; };
    // the loader is a module-level function; it never changes between renders
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return state;
}

const TEXT = {
  loading: { en: 'Loading the baked results', es: 'Cargando los resultados horneados' },
  failed: { en: 'The baked results could not be loaded', es: 'No se pudieron cargar los resultados horneados' },
};

/** Renders `children` once every value has loaded, and says so while loading or when a load failed. */
export function Loaded({ lang, errors, ready, children }: { lang: Lang; errors: Array<string | null>; ready: boolean; children: () => ReactNode }) {
  const error = errors.find(Boolean);
  if (error) return <div className="of-doc-state" role="alert">{`${TEXT.failed[lang]}: ${error}`}</div>;
  if (!ready) return <div className="of-doc-state" role="status">{`${TEXT.loading[lang]}...`}</div>;
  return <>{children()}</>;
}
