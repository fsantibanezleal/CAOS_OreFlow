/**
 * Experiments, the uncertainty and ablations tabs (PG-01, AB-03): the uncertainty protocol with its live re-run and
 * the seed study, and the mechanism ablations. Both read studies.json, the record of the bake's studies stage; the
 * numbers in the prose are held to it by experiments-claims.test.ts.
 */
import { useState } from 'react';
import type uPlot from 'uplot';
import { Chart } from '../components/charts/Chart';
import { loadIndex, loadStudies, type AblationRecord } from '../lib/artifacts';
import { formatFixed, type Lang } from '../lib/format';
import { codes, Reading } from './benchmark';
import { Loaded, useArtifact } from './data';
import type { Bi, Topic } from './doc';
import { pick } from './figures';

const r = String.raw;
export const SWITCH_LABEL: Record<string, Bi> = {
  entrainment: { en: 'Entrainment', es: 'Arrastre' },
  composite_classes: { en: 'Composite classes', es: 'Clases mixtas' },
  cleaner_recirculation: { en: 'Cleaner recirculation', es: 'Recirculación del cleaner' },
  regrind: { en: 'Regrind', es: 'Remolienda' },
  gravity_bleed: { en: 'Gravity bleed', es: 'Purga gravimétrica' },
};
const signed = (value: number, lang: Lang, decimals: number) => `${value > 0 ? '+' : ''}${formatFixed(value, lang, decimals)}`;

function SeedStudy({ lang }: { lang: Lang }) {
  const index = useArtifact(loadIndex);
  const studies = useArtifact(loadStudies);
  const [reading, setReading] = useState<string | null>(null);
  const p = (en: string, es: string) => pick(lang, en, es);
  return (
    <Loaded lang={lang} errors={[index.error, studies.error]} ready={Boolean(index.value && studies.value)}>
      {() => {
        const code = codes(index.value!), cases = index.value!.cases.map(c => c.case_id), S = studies.value!.cases;
        const title = (id: string) => index.value!.cases.find(c => c.case_id === id)?.title[lang] ?? id;
        const spread = (q: string) => cases.map(id => S[id].seed_study.spread.recovery_pct[q]);
        const seeds = S[cases[0]].seed_study.seeds;
        return (
          <div className="of-doc-panel">
            <div className="of-doc-chart of-doc-chart-narrow">
              <Chart data={[cases.map((_, i) => i), spread('p05'), spread('p50'), spread('p95')] as uPlot.AlignedData} categories={cases.map(id => code[id])}
                xLabel={p('Case', 'Caso')} yLabel={p('Range over the seeds (points)', 'Rango entre semillas (puntos)')}
                title={p(`Recovery quantiles across ${seeds.length} seeds`, `Cuantiles de recuperación entre ${seeds.length} semillas`)}
                summary={p('How far each nominal recovery quantile moves between the seeds of the study.', 'Cuánto se mueve cada cuantil de recuperación nominal entre las semillas del estudio.')}
                series={[{ label: 'P05', colour: 'warn', bars: true, group: { index: 0, count: 3 } }, { label: 'P50', colour: 'accent', bars: true, group: { index: 1, count: 3 } }, { label: 'P95', colour: 'good', bars: true, group: { index: 2, count: 3 } }]}
                format={(v, axis) => (axis === 'x' ? '' : formatFixed(v, lang, 2))}
                onCursor={c => setReading(c ? `${title(cases[c.index])}: P05 ${formatFixed(c.values[0], lang, 2)}, P50 ${formatFixed(c.values[1], lang, 2)}, P95 ${formatFixed(c.values[2], lang, 2)} ${p('points', 'puntos')}` : null)} />
            </div>
            <Reading text={reading} lang={lang} />
            <table className="of-doc-table of-doc-table-data">
              <thead><tr>{[p('Case', 'Caso'), p('Recovery P05', 'Recuperación P05'), 'P50', 'P95', p('Grade P50', 'Ley P50'), p('All constraints', 'Todas las restricciones')].map(h => <th key={h} scope="col">{h}</th>)}</tr></thead>
              <tbody>{cases.map(id => {
                const s = S[id].seed_study.spread;
                return (
                  <tr key={id}><th scope="row" className="of-doc-soft">{`${code[id]} ${title(id)}`}</th>
                    <td>{formatFixed(s.recovery_pct.p05, lang, 2)}</td><td>{formatFixed(s.recovery_pct.p50, lang, 2)}</td><td>{formatFixed(s.recovery_pct.p95, lang, 2)}</td>
                    <td>{formatFixed(s.concentrate_grade.p50, lang, 2)}</td><td>{`${formatFixed(100 * s.all_constraints, lang, 1)} ${p('points', 'puntos')}`}</td></tr>
                );
              })}</tbody>
            </table>
            <p className="of-footnote">{p(`The range, maximum minus minimum, of each statistic over seeds ${seeds.join(', ')}, with 128 samples each; recovery in percentage points, grade in its own unit, the joint probability in percentage points.`,
              `El rango, máximo menos mínimo, de cada estadístico entre las semillas ${seeds.join(', ')}, con 128 muestras cada una; la recuperación en puntos porcentuales, la ley en su propia unidad, la probabilidad conjunta en puntos porcentuales.`)}</p>
          </div>
        );
      }}
    </Loaded>
  );
}

export const UNCERTAINTY: Topic = {
  id: 'uncertainty',
  title: { en: 'Uncertainty', es: 'Incertidumbre' },
  paragraphs: [
    { en: 'The uncertainty record holds the operating point fixed and varies what nobody knows exactly about the ore: the work index, the head grade, the liberation size and the floatability, each a uniform factor within an authored spread. A Latin hypercube of 128 samples, drawn from one SplitMix64 stream that the bake and the browser run identically, gives the quantiles of every output and the probability of meeting each constraint. The workbench re-runs the record at another seed or sample count on request; the Sobol indices of the same inputs are baked at the nominal states only, with Saltelli\'s design of N = 256.',
      es: 'El registro de incertidumbre fija el punto de operación y varía lo que nadie conoce con exactitud del mineral: el índice de trabajo, la ley de cabeza, el tamaño de liberación y la flotabilidad, cada uno un factor uniforme dentro de un rango de autor. Un hipercubo latino de 128 muestras, sorteado desde un flujo SplitMix64 que el horneado y el navegador corren de forma idéntica, da los cuantiles de cada salida y la probabilidad de cumplir cada restricción. El laboratorio vuelve a correr el registro con otra semilla o número de muestras cuando se pide; los índices de Sobol de las mismas entradas se hornean solo en los estados nominales, con el diseño de Saltelli de N = 256.' },
    { en: 'A single seed hides how much of a record is its own sampling error, so the bake re-runs every nominal record at eight more seeds with the same 128 samples. Between seeds the recovery P05 moves by 0.17 points in the magnetite case to 0.94 in the hard porphyry, the median by at most 0.65 (zinc), and the probability of meeting every constraint by 0.8 to 8.6 percentage points, the most in oxide copper, whose grade sits close to its specification. A difference between two records smaller than that is not a result.', es: 'Una sola semilla oculta cuánto de un registro es su propio error de muestreo, así que el horneado vuelve a correr cada registro nominal con ocho semillas más y las mismas 128 muestras. Entre semillas el P05 de la recuperación se mueve de 0,17 puntos en el caso de magnetita a 0,94 en el pórfido duro, la mediana a lo más 0,65 (zinc), y la probabilidad de cumplir todas las restricciones de 0,8 a 8,6 puntos porcentuales, más en el cobre oxidado, cuya ley está cerca de su especificación. Una diferencia entre dos registros menor que eso no es un resultado.' },
  ],
  equations: [
    { tex: r`u_{ik} = \frac{\pi_k(i) + U_{ik}}{n},\qquad x_{ik} = 1 - h_k + 2 h_k\,u_{ik}`, caption: { en: 'Sample i of input k: its stratum from the permutation $\\pi_k$, a uniform U inside it, and the factor within the half width $h_k$.', es: 'La muestra i de la entrada k: su estrato de la permutación $\\pi_k$, un uniforme U dentro de él, y el factor dentro del semiancho $h_k$.' } },
    { tex: r`\Delta q = \max_{s} q_s - \min_{s} q_s`, caption: { en: 'The seed study: the range of a statistic q over the seeds s of the study.', es: 'El estudio de semillas: el rango de un estadístico q entre las semillas s del estudio.' } },
  ],
  limits: [
    { en: 'The spreads are authored and the inputs independent by construction; the seed study measures the design\'s sampling error, not whether the spreads are right.', es: 'Los rangos son de autor y las entradas independientes por construcción; el estudio de semillas mide el error de muestreo del diseño, no si los rangos son correctos.' },
  ],
  data: lang => <SeedStudy lang={lang} />,
  refs: ['mckay1979', 'splitmix2014', 'saltelli2010', 'salib2017'],
};

function AblationStudy({ lang }: { lang: Lang }) {
  const index = useArtifact(loadIndex);
  const studies = useArtifact(loadStudies);
  const [reading, setReading] = useState<string | null>(null);
  const p = (en: string, es: string) => pick(lang, en, es);
  return (
    <Loaded lang={lang} errors={[index.error, studies.error]} ready={Boolean(index.value && studies.value)}>
      {() => {
        const code = codes(index.value!), cases = index.value!.cases.map(c => c.case_id), S = studies.value!;
        const switches = Object.keys(S.switches);
        const title = (id: string) => index.value!.cases.find(c => c.case_id === id)?.title[lang] ?? id;
        const delta = (rec: AblationRecord, key: string) => (rec.status === 'computed' ? rec.delta[key] : null);
        // U-10: magenta, not accent-2 beside accent (0.098 apart in OKLab in the dark theme)
        const colours = ['accent', 'warn', 'bad', 'magenta', 'good'] as const;
        return (
          <div className="of-doc-panel">
            <div className="of-doc-chart">
              <Chart data={[cases.map((_, i) => i), ...switches.map(s => cases.map(id => delta(S.cases[id].ablations[s], 'recovery_pct')))] as uPlot.AlignedData}
                categories={cases.map(id => code[id])} xLabel={p('Case', 'Caso')} yLabel={p('Recovery change (points)', 'Cambio de recuperación (puntos)')}
                title={p('Recovery with each mechanism taken away', 'La recuperación sin cada mecanismo')}
                summary={p('The change of each case\'s nominal recovery when one mechanism of the engine is taken away; a gap is a mechanism the case does not have.', 'El cambio de la recuperación nominal de cada caso cuando se quita un mecanismo del motor; un hueco es un mecanismo que el caso no tiene.')}
                series={switches.map((s, k) => ({ label: SWITCH_LABEL[s][lang], colour: colours[k], bars: true, group: { index: k, count: switches.length } }))}
                format={(v, axis) => (axis === 'x' || v === null ? '' : signed(v, lang, 1))}
                onCursor={c => setReading(c ? `${title(cases[c.index])}: ${switches.map((s, k) => `${SWITCH_LABEL[s][lang]} ${c.values[k] === null || c.values[k] === undefined ? p('n/a', 'n/a') : signed(c.values[k] as number, lang, 1)}`).join('; ')}` : null)} />
            </div>
            <Reading text={reading} lang={lang} />
            <table className="of-doc-table of-doc-table-data">
              <thead><tr><th scope="col">{p('Case', 'Caso')}</th>{switches.map(s => <th key={s} scope="col">{SWITCH_LABEL[s][lang]}</th>)}</tr></thead>
              <tbody>{cases.map(id => (
                <tr key={id}><th scope="row" className="of-doc-soft">{`${code[id]} ${title(id)}`}</th>
                  {switches.map(s => {
                    const rec = S.cases[id].ablations[s];
                    return <td key={s}>{rec.status === 'computed' ? `${signed(rec.delta.recovery_pct, lang, 1)} / ${signed(rec.delta.specific_energy_total_kwh_t, lang, 2)}` : p('not applicable', 'no aplica')}</td>;
                  })}</tr>
              ))}</tbody>
            </table>
            <p className="of-footnote">{p('Each cell: the change of recovery in points, then of specific energy in kWh/t, with the mechanism taken away at the nominal state. Every ablated state closes its balances within 1e-9.', 'Cada celda: el cambio de la recuperación en puntos, luego de la energía específica en kWh/t, sin el mecanismo en el estado nominal. Cada estado ablacionado cierra sus balances dentro de 1e-9.')}</p>
          </div>
        );
      }}
    </Loaded>
  );
}

export const ABLATIONS: Topic = {
  id: 'ablations',
  title: { en: 'Ablations', es: 'Ablaciones' },
  paragraphs: [
    { en: 'An ablation takes one mechanism of the engine away and runs the same case at its nominal state again, which says how much of the result that mechanism carries. Five mechanisms are taken away in turn: entrainment, by setting every bank\'s wash factor to zero; composite classes, by liberating every grain of a valuable mineral; the return of the cleaner tail to the rougher, which then joins the final tail; the regrind of the rougher concentrate; and the gravity bleed. A case without a mechanism is not applicable, never a zero effect, and every ablated state closes its balances like any other.',
      es: 'Una ablación quita un mecanismo del motor y corre de nuevo el mismo caso en su estado nominal, lo que dice cuánto del resultado lleva ese mecanismo. Se quitan cinco mecanismos por turno: el arrastre, poniendo en cero el factor de lavado de cada banco; las clases mixtas, liberando cada grano de un mineral valioso; el retorno de la cola del cleaner al rougher, que entonces se une a la cola final; la remolienda del concentrado rougher; y la purga gravimétrica. Un caso sin un mecanismo no aplica, nunca es un efecto cero, y cada estado ablacionado cierra sus balances como cualquier otro.' },
    { en: 'The return of the cleaner tail carries the most: without it every flotation case loses recovery, from 3.1 points in the gravity gold to 11.2 in the zinc, because the particles the cleaner rejects never get a second pass. Liberating every grain raises the grade in all twelve cases and the recovery in eleven, by up to 8.9 points in oxide copper, and lowers the magnetite circuit\'s recovery by 0.6. Without the regrind the grade falls in all eight cases that regrind and the recovery in seven, by up to 6.7 points, for 0.40 to 1.37 kWh/t less energy. The gravity bleed is worth 2.3 points of the gold case\'s recovery.', es: 'El retorno de la cola del cleaner es lo que más pesa: sin él cada caso de flotación pierde recuperación, de 3,1 puntos en el oro gravimétrico a 11,2 en el zinc, porque las partículas que rechaza el cleaner nunca tienen una segunda pasada. Liberar cada grano sube la ley en los doce casos y la recuperación en once, hasta 8,9 puntos en el cobre oxidado, y baja en 0,6 la recuperación del circuito de magnetita. Sin la remolienda la ley baja en los ocho casos que remuelen y la recuperación en siete, hasta 6,7 puntos, por 0,40 a 1,37 kWh/t menos de energía. La purga gravimétrica vale 2,3 puntos de la recuperación del caso de oro.' },
    { en: 'Entrainment is the one that surprises: taking it away changes recovery by -0.14 to +0.67 points and raises it in most cases. It adds no payable here; it loads the circuit. In oxide copper, without it the rougher pulls 28.5% of the feed instead of 34.3%, the recycle falls from 176 to 142 t/h, and the cleaner, whose volume is fixed, holds its smaller feed 6.5 minutes instead of 5.6 and recovers 75.5% instead of 72.2%.', es: 'El arrastre es el que sorprende: quitarlo cambia la recuperación entre -0,14 y +0,67 puntos y la sube en la mayoría de los casos. Aquí no agrega pagable; carga el circuito. En el cobre oxidado, sin él el rougher extrae 28,5% de la alimentación en vez de 34,3%, la recirculación baja de 176 a 142 t/h, y el cleaner, de volumen fijo, retiene su alimentación menor 6,5 minutos en vez de 5,6 y recupera 75,5% en vez de 72,2%.' },
  ],
  equations: [
    { tex: r`\Delta_j m = m\big(\mathcal{A}_j(x^{(0)})\big) - m\big(x^{(0)}\big)`, caption: { en: 'The effect of taking mechanism j away: the metric m of the ablated nominal state A_j(x) minus the nominal one.', es: 'El efecto de quitar el mecanismo j: la métrica m del estado nominal ablacionado A_j(x) menos la nominal.' } },
  ],
  limits: [
    { en: 'An ablation attributes a result to the engine\'s own structure; a real plant cannot switch a mechanism off, and its mechanisms interact differently.', es: 'Una ablación atribuye un resultado a la propia estructura del motor; una planta real no puede apagar un mecanismo, y sus mecanismos interactúan de otra forma.' },
    { en: 'Each mechanism is taken away alone; the effects do not add up to the whole, because the mechanisms interact.', es: 'Cada mecanismo se quita solo; los efectos no suman el total, porque los mecanismos interactúan.' },
  ],
  data: lang => <AblationStudy lang={lang} />,
  refs: ['savassi1998', 'king1979', 'laplante-staunton'],
};
