"""Author topic-specific worked extensions and optimization/uncertainty lessons.

The generator contains all authored source. Notebook outputs are written only by
scripts/run_notebooks.py in a fresh kernel.
"""
from __future__ import annotations
import ast
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LABELS_ES = {
    'Nominal P80 (µm)': 'P80 nominal (µm)', 'Requested fine P80 (µm)': 'P80 fino solicitado (µm)',
    'Achieved fine P80 (µm)': 'P80 fino alcanzado (µm)', 'Fine required power (kW)': 'Potencia fina requerida (kW)',
    'Bond work (kWh/t)': 'Trabajo Bond (kWh/t)', 'Rittinger work (kWh/t)': 'Trabajo Rittinger (kWh/t)',
    'Kick work (kWh/t)': 'Trabajo Kick (kWh/t)', 'Short-bank overall recovery (%)': 'Recuperación global del banco corto (%)',
    'Short-bank true recovery (%)': 'Recuperación verdadera del banco corto (%)',
    'First-order batch RMSE (pp)': 'RMSE batch de primer orden (pp)', 'Kelsall batch RMSE (pp)': 'RMSE batch de Kelsall (pp)',
    'First-order bank error (pp)': 'Error de banco de primer orden (pp)', 'Kelsall bank error (pp)': 'Error de banco de Kelsall (pp)',
    'Design rows': 'Filas del diseño', 'Ridge interpolation RMSE (pp)': 'RMSE interpolado de Ridge (pp)',
    'Ridge case RMSE (pp)': 'RMSE de caso de Ridge (pp)', 'Forest case RMSE (pp)': 'RMSE de caso del bosque (pp)',
    'GP case RMSE (pp)': 'RMSE de caso del proceso gaussiano (pp)', 'GP group RMSE (pp)': 'RMSE de grupo del proceso gaussiano (pp)',
    'GP group R2': 'R2 de grupo del proceso gaussiano', 'Negative group R2 models': 'Modelos con R2 de grupo negativo',
    'Unscreened count': 'Conteo sin filtro', 'Selected recovery (%)': 'Recuperación seleccionada (%)',
    'Selected energy (kWh/t)': 'Energía seleccionada (kWh/t)', 'Selected P80 (µm)': 'P80 seleccionado (µm)',
    'Metal-only recovered (t/h)': 'Recuperado al preferir metal (t/h)',
    'Energy-only recovered (t/h)': 'Recuperado al preferir energía (t/h)',
    'Screened count': 'Conteo con filtro', 'Additional count': 'Conteo adicional', 'Proposal count': 'Cantidad de propuestas',
    'Archived pair count': 'Cantidad de parejas archivadas', 'Archived extra count': 'Conteo adicional archivado',
    'Recovery P05 (%)': 'P05 de recuperación (%)', 'Recovery P95 (%)': 'P95 de recuperación (%)',
    'Solved count': 'Cantidad resuelta', 'Refused count': 'Cantidad rechazada', 'Joint feasibility (1)': 'Factibilidad conjunta (1)',
    'Same total-effect order (1=yes)': 'Mismo orden total (1=sí)',
    'Largest total-effect half-width (1)': 'Máxima semiamplitud de efecto total (1)',
    'Prediction range (%):': 'Rango de predicción (%):', 'Reference range (%):': 'Rango de referencia (%):',
    'Held-out-case predictions': 'Predicciones del caso reservado',
    'Archived pairs:': 'Parejas archivadas:', 'Archived screened total:': 'Total archivado con filtro:',
    'Archived unscreened total:': 'Total archivado sin filtro:',
    'Archived additional evaluations:': 'Evaluaciones adicionales archivadas:',
    'Missing archived paired optimization records': 'Faltan registros archivados de optimización pareada',
    'family:': 'familia:', 'throughput:': 'tratamiento:', 'feed F80:': 'F80 de alimentación:',
    'product P80:': 'P80 de producto:', 'grinding energy:': 'energía de molienda:',
    'Particle size (µm)': 'Tamaño de partícula (µm)', 'Cumulative passing (%)': 'Pasante acumulado (%)',
    'Comminution response at the nominal operating point': 'Conminución en el punto operativo nominal',
    'Crusher feed F80': 'F80 de alimentación a trituración', 'Crusher product P80': 'P80 de trituración',
    'Circuit product P80': 'P80 de producto del circuito', 'Specific grinding energy': 'Energía específica de molienda',
    'Maximum relative balance error': 'Error relativo máximo de balance', 'metric': 'métrica',
    'value': 'valor',
    'mill power (kW):': 'potencia del molino (kW):', 'required power (kW):': 'potencia requerida (kW):',
    'classifier cut (µm):': 'corte del clasificador (µm):', 'circulating load (%):': 'carga circulante (%):',
    'power limited:': 'limitado por potencia:', 'Share to underflow': 'Fracción a descarga inferior',
    'Solved classifier partition (host mineral)': 'Partición resuelta del clasificador (mineral huésped)',
    'kWh/t or dimensionless': 'kWh/t o adimensional', 'Product P80 (µm)': 'P80 de producto (µm)',
    'Specific energy (kWh/t)': 'Energía específica (kWh/t)',
    'Three laws at the same feed and work index': 'Tres leyes con igual alimentación e índice de trabajo',
    'Wi (kWh/t):': 'Wi (kWh/t):', '| feed F80 (µm):': '| F80 de alimentación (µm):',
    '| achieved P80 (µm):': '| P80 alcanzado (µm):', 'calibrated Kick constant:': 'constante calibrada de Kick:',
    'calibrated Rittinger constant:': 'constante calibrada de Rittinger:',
    'Bond at reference 150 µm (kWh/t):': 'Bond en referencia de 150 µm (kWh/t):',
    'reference P80': 'P80 de referencia', 'Product P80 (µm; finer to the right)': 'P80 de producto (µm; fino a la derecha)',
    'Classical energy-law comparison (F80 = ': 'Comparación de leyes de energía (F80 = ',
    'Energy-law comparison (F80 = ': 'Comparación de leyes de energía (F80 = ',
    'law': 'ley', 'relative_to_bond': 'relativo_a_bond',
    'Virtual batch': 'Batch virtual', 'Virtual batch test': 'Prueba batch virtual',
    'Continuous bank': 'Banco continuo', 'Continuous-bank profile': 'Perfil del banco continuo',
    'Batch time (min)': 'Tiempo batch (min)', 'Bank cell number': 'Número de celda',
    'Payable recovery (%)': 'Recuperación del componente pagable (%)', 'Stream': 'Flujo',
    'Solids (t/h)': 'Sólidos (t/h)', ' grade (%)': ' ley (%)', 'status:': 'estado:',
    'model': 'modelo', 'Model': 'Modelo', 'at bound': 'en límite',
    'RMSE (points)': 'RMSE (puntos)', 'bank projection (%)': 'proyección al banco (%)',
    'error vs exact (points)': 'error frente al exacto (puntos)', 'ultimate gap (points)': 'brecha asintótica (puntos)',
    'Virtual batch data': 'Datos batch virtuales', 'Recovery (%)': 'Recuperación (%)',
    'Five fitted forms on one batch record': 'Cinco formas ajustadas al mismo registro batch',
    'batch RMSE (points)': 'RMSE batch (puntos)', 'bank error (points)': 'error de banco (puntos)',
    'bank prediction (%)': 'predicción del banco (%)', 'extrapolation gap (points)': 'brecha de extrapolación (puntos)',
    'Virtual observations': 'Observaciones virtuales', 'Fitted kinetic models on virtual batch data':
    'Modelos cinéticos ajustados a datos batch virtuales', 'Exact reference': 'Referencia exacta',
    'Residence time (min)': 'Tiempo de residencia (min)', 'Bank recovery (%)': 'Recuperación del banco (%)',
    'Projection to continuous cells': 'Proyección a celdas continuas', 'bank residence (min):': 'residencia del banco (min):',
    'exact bank recovery (%):': 'recuperación exacta del banco (%):', '| payable:': '| componente pagable:',
    '| fitted models:': '| modelos ajustados:', 'engine rougher recovery (%):': 'recuperación rougher del motor (%):',
    'Design rows:': 'Filas del diseño:', 'Features:': 'Variables:', 'Targets:': 'Objetivos:',
    'Reference case:': 'Caso de referencia:', 'Reference recovery (%):': 'Recuperación de referencia (%):',
    'Reference energy (kWh/t):': 'Energía de referencia (kWh/t):', 'Interpolation': 'Interpolación',
    'Case holdout': 'Caso reservado', 'Ore-group holdout': 'Grupo mineral reservado',
    'Training cases:': 'Casos de entrenamiento:', 'Test cases:': 'Casos de prueba:',
    'Random forest': 'Bosque aleatorio', 'Histogram boosting': 'Refuerzo por histogramas',
    'Gaussian process': 'Proceso gaussiano', 'Protocol': 'Protocolo', 'Estimator': 'Estimador',
    'Recovery RMSE (pp)': 'RMSE de recuperación (pp)', 'Common-design validation error': 'Error con diseño común',
    'Computed RMSE rows:': 'Filas RMSE calculadas:', 'Engine recovery (%)': 'Recuperación del motor (%)',
    'Predicted recovery (%)': 'Recuperación predicha (%)', 'Absent-ore-group predictions': 'Predicciones del grupo ausente',
    'Batch RMSE (pp)': 'RMSE batch (pp)', 'Bank error (pp)': 'Error de banco (pp)',
    'Short-bank recovery (%):': 'Recuperación del banco corto (%):',
    'Exact short-bank recovery (%):': 'Recuperación exacta del banco corto (%):',
    'Dosed-bank recovery (%):': 'Recuperación con dosis modificada (%):',
    'Kinetic form': 'Forma cinética', 'Recovery error (pp)': 'Error de recuperación (pp)',
    'Fit versus projection after dose change': 'Ajuste y proyección después del cambio de dosis',
    'Fitted models:': 'Modelos ajustados:', 'Achieved mill F80 (µm):': 'F80 alcanzado del molino (µm):',
    'Requested product P80 (µm):': 'P80 solicitado (µm):', 'Achieved product P80 (µm):': 'P80 alcanzado (µm):',
    'Required power (kW):': 'Potencia requerida (kW):', 'Coarse recovery (%):': 'Recuperación con molienda gruesa (%):',
    'Coarse required power (kW):': 'Potencia con molienda gruesa (kW):',
    'Maximum Rittinger / Bond:': 'Máximo Rittinger / Bond:', 'Energy / Bond (1)': 'Energía / Bond (1)',
    'Calibration and divergence': 'Calibración y divergencia', 'Base recovery (%):': 'Recuperación base (%):',
    'Decision bounds:': 'Límites de decisión:', 'Unscreened status:': 'Estado sin filtro:',
    'Unscreened evaluations:': 'Evaluaciones sin filtro:', 'Stopping reasons:': 'Motivos de detención:',
    'Constraint slack': 'Holgura de restricción', 'Preference:': 'Preferencia:',
    'Recovered metal (t/h):': 'Metal recuperado (t/h):', 'Energy (kWh/t):': 'Energía (kWh/t):',
    'Screened status:': 'Estado con filtro:', 'Screened evaluations:': 'Evaluaciones con filtro:',
    'Paired unscreened evaluations:': 'Evaluaciones pareadas sin filtro:', 'Proposals:': 'Propuestas:',
    'Additional evaluations:': 'Evaluaciones adicionales:', 'Screened engine recovery (%):': 'Recuperación exacta con filtro (%):',
    'Screened constraint slacks:': 'Holguras con filtro:', 'Unscreened engine recovery (%):': 'Recuperación exacta sin filtro (%):',
    'Unscreened engine energy (kWh/t):': 'Energía exacta sin filtro (kWh/t):',
    'Exact evaluations (count)': 'Evaluaciones exactas (cantidad)', 'Normalized objective (1)': 'Objetivo normalizado (1)',
    'Incumbent progress': 'Progreso del incumbente', 'Iteration (count)': 'Iteración (cantidad)',
    'Mesh width (1)': 'Ancho de malla (1)', 'Progressive mesh': 'Malla progresiva',
    'Unscreened': 'Sin filtro', 'Screened': 'Con filtro', 'Search method': 'Método de búsqueda',
    'Fresh paired engine cost': 'Costo pareado nuevo del motor', 'Recovered metal (t/h)': 'Metal recuperado (t/h)',
    'Computed preference trade-off': 'Compromiso de preferencias calculado', 'Proposal (count)': 'Propuesta (cantidad)',
    'Prediction minus engine (pp)': 'Predicción menos motor (pp)', 'Fresh proposal errors': 'Errores de propuestas nuevas',
    'Trace iterations:': 'Iteraciones de la traza:', 'Nominal recovery (%):': 'Recuperación nominal (%):',
    'Liberation factor:': 'Factor de liberación:', 'Conditional recovery (%):': 'Recuperación condicional (%):',
    'Solved draws:': 'Sorteos resueltos:', 'Refused draws:': 'Sorteos rechazados:',
    'Factor half-widths:': 'Semiamplitudes de factores:', 'All-constraint probability:': 'Probabilidad de todas las restricciones:',
    'Nominal': 'Nominal', 'Solved draws (count)': 'Sorteos resueltos (cantidad)',
    'Ore-factor uncertainty propagation': 'Propagación de incertidumbre mineral', 'Sobol base rows:': 'Filas base Sobol:',
    'Sobol engine evaluations:': 'Evaluaciones del motor Sobol:', 'Sobol status:': 'Estado Sobol:',
    'Ore factor': 'Factor mineral', 'Total Sobol index (1)': 'Índice Sobol total (1)',
    'Finite-design sensitivity stability': 'Estabilidad de sensibilidad en diseño finito',
    'Sensitivity design contains refused draws': 'El diseño de sensibilidad contiene sorteos rechazados',
    'Recovery is constant at the declared tolerance': 'La recuperación es constante con la tolerancia declarada',
}
LABELS_ES.update({
    'Physical mill feed: F80=': 'Alimentación física al molino: F80=',
    'Calibration: F80=': 'Calibración: F80=', 'Mill-feed energy-law ratios': 'Relaciones de leyes para alimentación al molino',
    'Cohort files:': 'Archivos de la cohorte:',
    'Quantity': 'Magnitud', 'Value': 'Valor', 'Unit': 'Unidad',
    'Training rows': 'Filas de entrenamiento', 'Interpolation test rows': 'Filas de prueba interpolada',
    'Achieved mill-feed comparison': 'Comparación con alimentación alcanzada al molino',
    'Separate reference calibration': 'Calibración de referencia separada',
    'Nominal bank (%)': 'Banco nominal (%)', 'Short refit (%)': 'Banco corto reajustado (%)',
    'Short frozen (%)': 'Banco corto congelado (%)', 'Short exact (%)': 'Banco corto exacto (%)',
    'Refit signed error (pp)': 'Error con signo de reajuste (pp)', 'Frozen signed error (pp)': 'Error con signo congelado (pp)',
    'Refit absolute error (pp)': 'Error absoluto de reajuste (pp)', 'Frozen absolute error (pp)': 'Error absoluto congelado (pp)',
    'Projection minus exact recovery (pp)': 'Proyección menos recuperación exacta (pp)',
    'Changed-residence projection errors': 'Errores de proyección con residencia modificada',
    'Short Kelsall refit error (pp)': 'Error de Kelsall reajustado en banco corto (pp)',
    'Short Kelsall frozen error (pp)': 'Error de Kelsall congelado en banco corto (pp)',
    'Nominal batch RMSE (pp)': 'RMSE batch nominal (pp)', 'Dosed batch RMSE (pp)': 'RMSE batch con dosis modificada (pp)',
    'Nominal signed bank error (pp)': 'Error nominal de banco con signo (pp)',
    'Dosed signed bank error (pp)': 'Error de banco con dosis modificada y signo (pp)',
    'Batch RMSE change (pp)': 'Cambio de RMSE batch (pp)',
    'Dosed Kelsall batch RMSE (pp)': 'RMSE batch de Kelsall con dosis modificada (pp)',
    'Dosed Kelsall bank error (pp)': 'Error de banco de Kelsall con dosis modificada (pp)',
    'Dosed first-order batch RMSE (pp)': 'RMSE batch de primer orden con dosis modificada (pp)',
    'Dosed overall recovery (%)': 'Recuperación global con dosis modificada (%)',
    'Nominal overall recovery (%)': 'Recuperación global nominal (%)',
    'Run': 'Corrida', 'Status': 'Estado', 'Feasible': 'Factible', 'Converged': 'Convergencia',
    'Stops': 'Detenciones', 'Decisions': 'Decisiones', 'Slacks': 'Holguras', 'Exact calls': 'Llamadas exactas',
    'Equal weight': 'Pesos iguales', 'Metal only': 'Solo metal', 'Energy only': 'Solo energía',
    'Decision': 'Decisión', 'Physical delta': 'Diferencia física', 'Normalized delta (1)': 'Diferencia normalizada (1)',
    'Tolerance (1)': 'Tolerancia (1)', 'Within tolerance': 'Dentro de tolerancia',
    'Feasible audited decision agreement:': 'Acuerdo de decisiones factibles auditadas:',
    'Recovery delta (pp)': 'Diferencia de recuperación (pp)', 'Energy delta (kWh/t)': 'Diferencia de energía (kWh/t)',
    'Screened minus unscreened': 'Con filtro menos sin filtro',
    'Unscreened audit refusal:': 'Rechazo de auditoría sin filtro:', 'Screened audit refusal:': 'Rechazo de auditoría con filtro:',
    'Unscreened audit available:': 'Auditoría sin filtro disponible:', 'Screened audit available:': 'Auditoría con filtro disponible:',
    'Computed preference endpoints': 'Extremos de preferencias calculados',
    'No evaluated proposals: no accuracy estimate': 'Sin propuestas evaluadas: no existe estimación de precisión',
    'Evaluated proposal (count)': 'Propuesta evaluada (cantidad)', 'Evaluated proposal errors': 'Errores de propuestas evaluadas',
    'Evaluated proposals:': 'Propuestas evaluadas:', 'Cohort engine version:': 'Versión del motor de la cohorte:',
    'Cohort contract digest:': 'Digest contractual de la cohorte:', 'Cohort SHA-256:': 'SHA-256 de la cohorte:',
    'Cohort source:': 'Fuente de la cohorte:', 'Fresh search code version:': 'Versión del código de búsqueda nueva:',
    'No current cohort case files': 'No existen archivos de casos de la cohorte actual',
    'Mixed or missing cohort version/contract identity': 'Identidad de versión o contrato mezclada o ausente',
    'No paired screened records in identified cohort': 'No existen registros pareados con filtro en la cohorte',
    'Fewer exact calls': 'Menos llamadas exactas', 'Additional exact calls': 'Llamadas exactas adicionales',
    'Equal exact calls': 'Llamadas exactas iguales', 'Observed cohort cost direction:': 'Sentido de costo observado en la cohorte:',
    'Screened total': 'Total con filtro', 'Unscreened total': 'Total sin filtro', 'Signed excess': 'Exceso con signo',
    'Saving pairs': 'Parejas con ahorro', 'Equal pairs': 'Parejas iguales', 'Additional-work pairs': 'Parejas con trabajo adicional',
    'Reported target P80 (µm)': 'P80 objetivo informado (µm)', 'Selected feasible (1=yes)': 'Extremo factible (1=sí)',
    'Convergence reported (1=yes)': 'Convergencia informada (1=sí)',
    'Metal endpoint feasible (1=yes)': 'Extremo de metal factible (1=sí)',
    'Energy endpoint feasible (1=yes)': 'Extremo de energía factible (1=sí)',
    'Screened feasible (1=yes)': 'Extremo con filtro factible (1=sí)',
    'Audited decision agreement (1=yes)': 'Acuerdo de decisiones auditadas (1=sí)',
    'Largest normalized decision delta (1)': 'Máxima diferencia normalizada de decisión (1)',
    'Current cohort pair count': 'Cantidad de parejas de cohorte actual',
    'Current cohort signed excess': 'Exceso con signo de cohorte actual',
    'Current cohort saving pairs': 'Parejas actuales con ahorro',
    'Current cohort additional-work pairs': 'Parejas actuales con trabajo adicional',
})


def md(text):
    return {"cell_type": "markdown", "metadata": {}, "source": text.splitlines(keepends=True)}


def code(text):
    return {"cell_type": "code", "metadata": {}, "execution_count": None, "outputs": [],
            "source": text.splitlines(keepends=True)}


def pair(en, es, lang):
    return es if lang == "es" else en


def step(cells, lang, en, es, program):
    from build_didactic_notebooks import spanish_code
    instruction = pair(en, es, lang)
    # The Spanish comment explains this particular step, rather than a generic method placeholder.
    if lang == "es":
        program = spanish_code(program)
        program = re.sub(r"(?m)^\s*#.*\n?", "", program)
    program = "# " + instruction.split(". ")[0] + ".\n" + program.lstrip()
    cells.extend([md(instruction), code(program)])


def figure(cells, lang, en, es, program, reading_en, reading_es):
    step(cells, lang, en, es, program)
    cells.append(md(pair(reading_en, reading_es, lang)))


def learning_steps(lang, level):
    cells = []
    step(cells, lang,
         "Build the learning design from physical circuit outputs. Select two related chalcopyrite cases plus oxide copper and magnetite, so an ore-group holdout removes both related examples together. Each case contributes sixteen seeded states inside its operating contract. The design has 64 simulator labels, not 64 measured plant samples. Keep this small domain visible when interpreting every fitted score.",
         "Construye el diseño de aprendizaje desde las salidas físicas del circuito. Selecciona dos casos relacionados de calcopirita, además de cobre oxidado y magnetita, para que la reserva de un grupo mineral retire juntos ambos ejemplos relacionados. Cada caso aporta dieciséis estados con semilla dentro de su contrato operativo. Son 64 etiquetas del simulador, no 64 muestras medidas de planta. Conserva este dominio pequeño al interpretar cada puntuación ajustada.",
         """from pipeline.cases.catalog import CASE_BY_ID
from pipeline.engine.circuit import simulate
from pipeline.methods.learning import build_design, interpolation_split, leave_one_case_out
from pipeline.methods.learning import leave_one_group_out, transfer_groups, FEATURES, TARGETS
import contextlib
import io
contract = json.loads((repo / 'data/derived/contract/operating_contract.json').read_text(encoding='utf-8'))
case_ids = ('copper_porphyry_soft', 'copper_porphyry_hard', 'copper_oxide', 'iron_magnetite_fine')
selected = tuple(CASE_BY_ID[name] for name in case_ids)
with contextlib.redirect_stdout(io.StringIO()):
    design = build_design(contract, cases=selected, per_case=16, seed=20261031)
x, y, case_of = design['x'], design['y'], design['case']
print('Design rows:', len(x))
print('Features:', len(FEATURES))
print('Targets:', TARGETS)"""
    )
    # Physical reference calculations at levels 1/2 inspect label provenance and case heterogeneity.
    # Level 3 needs only one: its other method steps actually fit the pinned reference estimators.
    probes = (['copper_porphyry_soft', 'copper_oxide', 'iron_magnetite_fine'] if level == 1 else
              ['copper_porphyry_soft', 'copper_porphyry_hard', 'copper_oxide', 'iron_magnetite_fine',
               'copper_porphyry_soft'] if level == 2 else ['copper_porphyry_soft', 'iron_magnetite_fine'])
    for index, case_id in enumerate(probes):
        altered = index == 4
        step(cells, lang,
             f"Inspect the {'finer-grind response' if altered else 'nominal label'} of {case_id.replace('_', ' ')} before pooling its rows. Recovery percentages have the same units across cases, but mineral properties and flowsheets can create different conditional means. " +
             ("The finer target changes only grinding demand and its downstream consequences. It tests whether a feature change has a physically computed target, rather than a copied label." if altered else "Read energy beside recovery: a model can reduce one target's residual while missing the other, and an aggregate score cannot express that trade-off."),
             f"Inspecciona {'la respuesta a molienda más fina' if altered else 'la etiqueta nominal'} de {case_id.replace('_', ' ')} antes de agrupar sus filas. Los porcentajes de recuperación comparten unidades, pero las propiedades minerales y los diagramas de proceso generan medias condicionales distintas. " +
             ("El objetivo más fino cambia la demanda de molienda y sus consecuencias posteriores. Así se comprueba que un cambio de variable tenga un objetivo calculado físicamente, en vez de una etiqueta copiada." if altered else "Lee la energía junto a la recuperación: un modelo puede reducir el residuo de una salida y fallar en otra, y una puntuación agregada no expresa ese compromiso."),
             f"""case = CASE_BY_ID[{case_id!r}]
point = case.nominal{'.with_values(target_p80_um=case.nominal.target_p80_um * 0.9)' if altered else ''}
reference = simulate(case.ore, case.plant, point)
print('Reference case:', case.id)
print('Reference recovery (%):', round(reference.metrics['recovery_pct'], 3))
print('Reference energy (kWh/t):', round(reference.metrics['specific_energy_total_kwh_t'], 3))"""
        )
    step(cells, lang,
         "Construct three validation questions on exactly the same design. Interpolation reserves one quarter of each case. The whole-case fold withholds soft porphyry while its hard sibling remains available. The ore-group fold removes both chalcopyrite cases. Print the train/test sizes and identities before fitting: this is where leakage would enter if a sibling accidentally crossed the group boundary. Do not tune on any reserved row.",
         "Construye tres preguntas de validación sobre exactamente el mismo diseño. La interpolación reserva un cuarto de cada caso. El pliegue por caso retira el pórfido blando y conserva su par duro. El pliegue por grupo mineral retira ambos casos de calcopirita. Presentar tamaños e identidades antes del ajuste permite detectar una fuga si un caso relacionado cruza accidentalmente la frontera del grupo. No ajustes hiperparámetros con filas reservadas.",
         """train, test = interpolation_split(case_of, test_fraction=0.25, seed=20261031)
case_fold = next(f for f in leave_one_case_out(case_of) if f[0] == 'copper_porphyry_soft')
group_fold = leave_one_group_out(case_of, transfer_groups(selected))[0]
splits = {'Interpolation': (train, test), 'Case holdout': case_fold[1:], 'Ore-group holdout': group_fold[1:]}
for protocol, (training, testing) in splits.items():
    print(protocol, len(training), len(testing))
    print('Training cases:', sorted(set(case_of[training].tolist())))
    print('Test cases:', sorted(set(case_of[testing].tolist())))
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import Ridge
from sklearn.ensemble import RandomForestRegressor, HistGradientBoostingRegressor
from sklearn.gaussian_process import GaussianProcessRegressor
from sklearn.gaussian_process.kernels import RBF
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score
scores, predictions = [], {}"""
    )
    if level < 3:
        split_code = cells[-1]
        source = ''.join(split_code['source'])
        if level == 1:
            source += "\nsplits = {list(splits)[0]: next(iter(splits.values()))}\n"
        else:
            source += "\nsplits = dict(list(splits.items())[:2])\n"
        split_code['source'] = source.splitlines(keepends=True)
    models = [
        ('Ridge', "make_pipeline(StandardScaler(), Ridge(alpha=1.0))",
         "Ridge penalizes squared coefficients after scaling. Its linear response is a useful test of whether nonlinear complexity earns its place on these features. The scaler is fitted inside each training fold, so even an extreme held-out mineral cannot alter its means or variances. Alpha stays fixed at one, rather than being selected using the displayed test errors.",
         "Ridge penaliza los coeficientes al cuadrado después de escalar. Su respuesta lineal permite comprobar si la complejidad no lineal aporta algo con estas variables. El escalador se ajusta dentro de cada pliegue de entrenamiento, por lo que un mineral extremo reservado no modifica sus medias ni varianzas. Alpha permanece en uno, sin seleccionarlo mediante los errores de prueba mostrados."),
        ('Random forest', "RandomForestRegressor(n_estimators=40, min_samples_leaf=2, random_state=20261031, n_jobs=1)",
         "Random forest averages forty trees with a minimum leaf size of two. It can represent interactions without feature scaling, but its leaves predict averages of training labels and cannot extrapolate a smooth trend beyond them. Compare its transfer error with Ridge using identical training indices and recovery labels. Fixed tree count bounds the lesson without substituting a different fitting algorithm.",
         "El bosque aleatorio promedia cuarenta árboles con un mínimo de dos filas por hoja. Representa interacciones sin escalar variables, pero sus hojas predicen promedios de etiquetas de entrenamiento y no extrapolan una tendencia suave fuera de ellas. Compara su error de transferencia con Ridge usando los mismos índices y etiquetas de recuperación. La cantidad fija de árboles acota la lección sin sustituir el algoritmo de ajuste."),
        ('Histogram boosting', "HistGradientBoostingRegressor(max_iter=40, min_samples_leaf=4, early_stopping=False, random_state=20261031)",
         "Histogram gradient boosting fits successive corrections to the recovery residual. A leaf minimum of four is declared because the default would prevent informative splits in these tiny folds. Forty iterations are a teaching budget, not the production tuning. Early stopping is disabled so all folds follow the same explicit iteration rule and no test row becomes an implicit stopping signal.",
         "El refuerzo por histogramas ajusta correcciones sucesivas al residuo de recuperación. Se declara un mínimo de cuatro filas por hoja porque el valor predeterminado impediría divisiones informativas en estos pliegues pequeños. Cuarenta iteraciones constituyen el presupuesto didáctico, no el ajuste de producción. Se desactiva la detención anticipada para que todos los pliegues sigan la misma regla explícita y ninguna fila de prueba determine cuándo parar."),
        ('Gaussian process', "make_pipeline(StandardScaler(), GaussianProcessRegressor(kernel=RBF(2.0), alpha=1.0, normalize_y=True, optimizer=None))",
         "The Gaussian process uses a fixed radial-basis kernel after training-only standardization. Disabling hyperparameter optimization avoids convergence warnings and makes the bounded reference reproducible, but it also limits what can be concluded about the best attainable GP. Alpha is observation regularization on simulator labels. This run compares point predictions, and it makes no calibrated predictive-interval claim.",
         "El proceso gaussiano usa un núcleo radial fijo después de estandarizar solo con entrenamiento. Desactivar la optimización de hiperparámetros evita advertencias de convergencia y hace reproducible la referencia acotada, aunque limita las conclusiones sobre el mejor proceso gaussiano alcanzable. Alpha regulariza las etiquetas del simulador. Esta corrida compara predicciones puntuales y no afirma que los intervalos predictivos estén calibrados."),
    ]
    if level < 3:
        models = models[:level]
    for name, estimator, en, es in models:
        step(cells, lang, en, es,
             f"""for protocol, (training, testing) in splits.items():
    model = {estimator}
    model.fit(x[training], y[training, 0])
    predicted = model.predict(x[testing])
    print('Prediction range (%):', np.round([predicted.min(), predicted.max()], 3))
    print('Reference range (%):', np.round([y[testing, 0].min(), y[testing, 0].max()], 3))
    predictions[({name!r}, protocol)] = (testing, predicted)
    scores.append({{'Model': {name!r}, 'Protocol': protocol,
                   'RMSE (pp)': float(np.sqrt(mean_squared_error(y[testing, 0], predicted))),
                   'MAE (pp)': float(mean_absolute_error(y[testing, 0], predicted)),
                   'R2': float(r2_score(y[testing, 0], predicted))}})
display(pd.DataFrame(scores).tail(3).round(3))"""
        )
    figure(cells, lang,
           "Compare recovery RMSE within each validation question. Every bar comes from a new fit, not the production archive.",
           "Compara el RMSE de recuperación dentro de cada pregunta de validación. Cada barra procede de un ajuste nuevo, no del archivo de producción.",
           """score = pd.DataFrame(scores)
fig, ax = plt.subplots(figsize=(9, 4.5))
score.pivot(index='Model', columns='Protocol', values='RMSE (pp)').plot.bar(ax=ax)
ax.set(xlabel='Estimator', ylabel='Recovery RMSE (pp)', title='Common-design validation error')
ax.tick_params(axis='x', rotation=15)
fig.tight_layout()
print('Computed RMSE rows:', len(score))""",
           "The bars separate interpolation from case and ore-group transfer. Compare estimators inside one colour first, because each colour has a different training population. A larger group-holdout error is evidence of difficulty on this particular missing mineral group. Four cases and sixteen rows each cannot establish a universal estimator ranking, and a negative R² is retained as a meaningful failure relative to predicting the test mean.",
           "Las barras separan interpolación de transferencia por caso y por grupo mineral. Compara primero los estimadores dentro de un color: cada color tiene una población de entrenamiento distinta. Un error mayor al reservar el grupo evidencia dificultad con ese grupo ausente concreto. Cuatro casos de dieciséis filas no establecen un orden universal de estimadores, y un R² negativo se conserva como una falla frente a predecir la media de prueba.")
    if level > 1:
        figure(cells, lang,
               "Inspect residual structure on the ore group absent from training. The identity line is the exact simulator target.",
               "Inspecciona la estructura residual del grupo mineral ausente del entrenamiento. La diagonal representa el objetivo exacto del simulador.",
               """fig, ax = plt.subplots(figsize=(7, 4.5))
for name in sorted({key[0] for key in predictions}):
    testing, predicted = predictions[(name, 'Ore-group holdout')]
    ax.scatter(y[testing, 0], predicted, label=name, s=20)
limits = [float(y[testing, 0].min()), float(y[testing, 0].max())]
ax.plot(limits, limits, '--', color='black')
ax.set(xlabel='Engine recovery (%)', ylabel='Predicted recovery (%)', title='Absent-ore-group predictions')
ax.legend()
fig.tight_layout()""",
               "Points away from the diagonal show the direction of transfer bias, which a single RMSE cannot reveal. A horizontal cluster suggests a learner reverting toward training labels when the missing ore occupies a new feature region. Recovery units are shared on both axes, so vertical distances are percentage-point errors. These predictions remain approximations to the circuit equations rather than comparisons against independently measured flotation or magnetic-separation recoveries.",
               "Los puntos alejados de la diagonal muestran el sentido del sesgo de transferencia que un RMSE único no revela. Una nube horizontal sugiere que el modelo vuelve hacia etiquetas conocidas cuando el mineral ausente ocupa otra región de variables. Ambos ejes usan recuperación, por lo que las distancias verticales son errores en puntos porcentuales. Las predicciones siguen aproximando las ecuaciones del circuito, sin compararse con recuperaciones medidas independientemente en flotación o separación magnética.")
    if level == 2:
        for cell in cells:
            if cell['cell_type'] == 'code':
                cell['source'] = ''.join(cell['source']).replace("predictions[(name, 'Ore-group holdout')]", "predictions[(name, 'Case holdout')]").splitlines(keepends=True)
    return cells


def comminution_steps(lang, level):
    cells = []
    step(cells, lang,
         "Resolve the nominal circuit before evaluating alternative energy hypotheses. The achieved mill feed and product sizes, rather than the requested target alone, define a physical reduction. Bond, Rittinger and Kick all use the same work index and endpoints in this experiment. Their reference calibration agrees at a specified reduction, but that agreement is imposed and does not validate their response elsewhere.",
         "Resuelve el circuito nominal antes de evaluar hipótesis alternativas de energía. Los tamaños de alimentación y producto alcanzados, además del objetivo solicitado, definen una reducción física. Bond, Rittinger y Kick usan el mismo índice de trabajo y los mismos extremos en este experimento. Su calibración coincide en una reducción especificada, pero esa coincidencia es impuesta y no valida su respuesta fuera de ella.",
         """from pipeline.cases.catalog import CASE_BY_ID
from pipeline.engine.circuit import simulate
from pipeline.engine.energy import law_curves
case = CASE_BY_ID['copper_porphyry_soft']
nominal = simulate(case.ore, case.plant, case.nominal)
f80 = nominal.grinding.feed_f80_um
wi = case.nominal.work_index_kwh_t
print('Achieved mill F80 (µm):', round(f80, 2))"""
    )
    step(cells, lang,
         "Calculate the calibrated work at the achieved product size. These are three alternative requirements, not energy components that should be added. Comparing them to net grinding energy requires a consistent circuit and efficiency basis. Keep the returned values in kWh per tonne of fresh feed so a downstream power comparison does not accidentally use circulating mill tonnage.",
         "Calcula el trabajo calibrado al tamaño de producto alcanzado. Son tres requerimientos alternativos, no componentes de energía que deban sumarse. Compararlos con energía neta de molienda exige bases coherentes de circuito y eficiencia. Conserva los valores en kWh por tonelada de alimentación fresca para que una comparación posterior de potencia no use por accidente el tonelaje recirculante del molino.",
         """at_product = law_curves(wi, f80, np.array([nominal.grinding.p80_um]))
display(pd.DataFrame(at_product).round(3))"""
    )
    step(cells, lang,
         "Ask the engine to achieve a finer product while holding the fresh feed and ore fixed. This isolates liberation demand from throughput. A power-limited mill may fail to reach the requested target, which is why both requested and achieved sizes belong in the table. A finer target is a controlled model perturbation, not an operating recommendation for this ore.",
         "Pide al motor un producto más fino manteniendo fijos alimentación fresca y mineral. Así se aísla la demanda de liberación del tratamiento. Un molino limitado por potencia puede no alcanzar el objetivo solicitado; por eso la tabla conserva tamaños solicitado y alcanzado. El objetivo más fino es una perturbación controlada del modelo, no una recomendación operativa para este mineral.",
         """fine_point = case.nominal.with_values(target_p80_um=case.nominal.target_p80_um * 0.8)
fine = simulate(case.ore, case.plant, fine_point)
print('Requested product P80 (µm):', fine_point.target_p80_um)
print('Achieved product P80 (µm):', round(fine.grinding.p80_um, 3))
print('Required power (kW):', round(fine.grinding.required_power_kw, 3))"""
    )
    if level > 1:
        step(cells, lang,
             "Repeat with a coarser target to bracket the nominal operating point. Coarsening can lower grinding demand while leaving more valuable mineral locked. The full circuit computes that downstream consequence rather than assigning recovery from an energy curve. A ranking by energy alone would miss the loss of recovered metal, so retain recovery and power together for the final comparison.",
             "Repite con un objetivo más grueso para rodear el punto nominal. Engrosar puede reducir la demanda de molienda y dejar más mineral valioso sin liberar. El circuito completo calcula esa consecuencia, en vez de asignar recuperación desde una curva de energía. Ordenar solo por energía omitiría la pérdida de metal recuperado; la comparación final requiere también recuperación y potencia.",
             """coarse_point = case.nominal.with_values(target_p80_um=case.nominal.target_p80_um * 1.2)
coarse = simulate(case.ore, case.plant, coarse_point)
print('Coarse recovery (%):', round(coarse.metrics['recovery_pct'], 3))
print('Coarse required power (kW):', round(coarse.grinding.required_power_kw, 3))"""
        )
        step(cells, lang,
             "Evaluate the three laws along the same logarithmic product-size sweep. The feed endpoint is fixed and every requested product is smaller than it. Normalize each alternative by Bond only after calculating its energy, since ratios hide the absolute demand. A crossing is agreement of calibrated equations at one size, not a physical phase transition or evidence that their assumptions become interchangeable.",
             "Evalúa las tres leyes en el mismo barrido logarítmico de producto. La alimentación queda fija y cada producto solicitado es más pequeño. Normaliza cada alternativa por Bond después de calcular su energía: los cocientes ocultan la demanda absoluta. Un cruce representa acuerdo de ecuaciones calibradas en un tamaño, no una transición física ni evidencia de que sus supuestos sean intercambiables.",
             """products = np.geomspace(max(50.0, f80 / 30), f80 / 1.1, 40)
sweep = law_curves(wi, f80, products)
ratio = {name: np.asarray(sweep[name]) / np.asarray(sweep['bond']) for name in ('rittinger', 'kick')}
print('Maximum Rittinger / Bond:', round(float(max(ratio['rittinger'])), 3))"""
        )
        figure(cells, lang,
               "Plot relative energy-law divergence to distinguish calibration agreement from the shape of each reduction hypothesis.",
               "Grafica la divergencia relativa de las leyes para distinguir coincidencia de calibración y forma de cada hipótesis de reducción.",
               """fig, ax = plt.subplots(figsize=(7, 4))
for name, values in ratio.items():
    ax.plot(products, values, label=name.title())
ax.axhline(1.0, color='black', linestyle='--', label='Bond')
ax.set(xscale='log', xlabel='Product P80 (µm)', ylabel='Energy / Bond (1)', title='Calibration and divergence')
ax.legend()
fig.tight_layout()""",
               "The ratio curves identify where a surface-area or reduction-ratio hypothesis predicts a different demand from Bond. Unity is a comparison baseline, not a confidence interval. The sweep deliberately holds feed and work index fixed, so it cannot explain geological hardness changes. Use the solved fine and coarse circuits to judge whether the desired product is reachable under installed power before treating an equation's energy requirement as an achievable process state.",
               "Los cocientes muestran dónde una hipótesis de superficie o de razón de reducción predice una demanda distinta de Bond. La unidad es referencia comparativa, no intervalo de confianza. El barrido mantiene fijos alimentación e índice de trabajo, por lo que no explica cambios geológicos de dureza. Usa los circuitos fino y grueso resueltos para evaluar si el producto deseado es alcanzable con la potencia instalada antes de tratar un requerimiento de energía como estado realizable.")
    return cells


def flotation_steps(lang, level):
    cells = []
    step(cells, lang,
         "Recalculate the nominal copper-molybdenum rougher and fit its virtual batch response with the production kinetic routine. The exact reference is the distribution of particle-class rates returned by the circuit, not an independently measured laboratory curve. Every named model therefore sees the same times and recovery labels, while its projection to a continuous bank tests a different residence-time assumption.",
         "Recalcula el rougher de cobre y molibdeno nominal y ajusta su respuesta batch virtual con la rutina cinética de producción. La referencia exacta es la distribución de tasas por clase que entrega el circuito, no una curva de laboratorio independiente. Cada modelo ve los mismos tiempos y etiquetas de recuperación, mientras su proyección a un banco continuo prueba otro supuesto de residencia.",
         """from pipeline.cases.catalog import CASE_BY_ID
from pipeline.engine.circuit import simulate
from pipeline.engine.kinetics import kinetic_record
case = CASE_BY_ID['copper_molybdenum']
nominal = simulate(case.ore, case.plant, case.nominal)
fits = kinetic_record(nominal.flotation, nominal.ore, case.nominal.rougher_cells,
                     nominal.metrics['rougher_recovery_pct'])
display(pd.DataFrame([{'Model': m['id'], 'Batch RMSE (pp)': m['rmse_pct'],
                      'Bank error (pp)': m['lumping_error_pct']} for m in fits['models']]))"""
    )
    step(cells, lang,
         "Reduce the number of continuous cells by one without changing the feed or reagent dose. This changes total bank residence while retaining a clear physical interpretation. A batch asymptote does not directly predict the resulting bank recovery: a tank residence distribution includes material leaving early, unlike a batch in which all particles share the same exposure duration.",
         "Reduce en una la cantidad de celdas continuas sin cambiar alimentación ni dosis de reactivo. Así cambia la residencia total del banco con una interpretación física clara. Una asíntota batch no predice directamente esa recuperación: la distribución de residencia del tanque incluye material que sale temprano, a diferencia del batch donde todas las partículas comparten la duración de exposición.",
         """short_point = case.nominal.with_values(rougher_cells=max(1, case.nominal.rougher_cells - 1))
short = simulate(case.ore, case.plant, short_point)
print('Short-bank recovery (%):', round(short.metrics['rougher_recovery_pct'], 3))"""
    )
    step(cells, lang,
         "Fit and project the same kinetic family after shortening the bank. Keep the two fit records separate so a change in residence cannot silently overwrite the baseline used for comparison. Compare error against each bank's own exact distributed-rate result. A low batch residual can coexist with a biased bank projection because fitting finite exposure observations does not identify the entire underlying rate distribution.",
         "Ajustar la misma familia cinética al banco acortado y proyectar cada ajuste sobre su geometría. Mantén separados los dos registros para que el cambio de residencia no sobrescriba la referencia comparativa. Compara el error con el resultado exacto de tasas distribuidas de cada banco. Un residuo batch pequeño puede coexistir con una proyección sesgada porque las observaciones de exposición finita no identifican toda la distribución de tasas.",
         """short_fits = kinetic_record(short.flotation, short.ore, short_point.rougher_cells,
                           short.metrics['rougher_recovery_pct'])
print('Exact short-bank recovery (%):', round(short_fits['bank']['exact_true_flotation_pct'], 3))"""
    )
    if level > 1:
        step(cells, lang,
             "Increase the collector dose by ten percent and rerun the full circuit. This perturbation changes modeled collection kinetics rather than fresh-feed throughput. It may change gangue collection as well as valuable recovery, so a gain in rougher recovery is not by itself an improvement in concentrate quality. Keep this conditional chemical response distinct from changing the number of tanks.",
             "Aumenta diez por ciento la dosis de colector y vuelve a ejecutar el circuito completo. La perturbación modifica la cinética de colección, no la alimentación fresca. Puede cambiar la colección de ganga además de la recuperación valiosa, por lo que aumentar recuperación rougher no implica mejorar calidad de concentrado. Distingue esta respuesta química condicional del cambio de cantidad de tanques.",
             """dose_point = case.nominal.with_values(collector_g_t=case.nominal.collector_g_t * 1.1)
dosed = simulate(case.ore, case.plant, dose_point)
print('Dosed-bank recovery (%):', round(dosed.metrics['rougher_recovery_pct'], 3))"""
        )
        step(cells, lang,
             "Project the fitted kinetic forms under the new collector condition and retain both errors for each form. First-order, fast/slow and distributed-rate approximations may change rank between batch fit and bank projection. The comparison asks about approximation error within one simulator, not which model is most accurate for every plant. Parameters at bounds remain part of the returned fit diagnostics and deserve inspection before extrapolation.",
             "Proyectar las formas ajustadas con la nueva condición de colector y conservar, para cada forma, el error batch y el error de banco. Las aproximaciones de primer orden, rápida/lenta y tasas distribuidas pueden cambiar de orden entre ajuste batch y proyección al banco. Se pregunta por error de aproximación dentro de un simulador, no por el modelo más preciso para todas las plantas. Los parámetros en sus límites permanecen en los diagnósticos y deben inspeccionarse antes de extrapolar.",
             """dose_fits = kinetic_record(dosed.flotation, dosed.ore, dose_point.rougher_cells,
                          dosed.metrics['rougher_recovery_pct'])
errors = pd.DataFrame([{'Model': m['id'], 'Batch RMSE (pp)': m['rmse_pct'],
                       'Bank error (pp)': abs(m['lumping_error_pct'])} for m in dose_fits['models']])
display(errors.round(4))"""
        )
        figure(cells, lang,
               "Compare batch fitting and continuous-bank projection errors under the controlled collector change.",
               "Compara errores de ajuste batch y proyección al banco continuo con el cambio controlado de colector.",
               """fig, ax = plt.subplots(figsize=(8, 4))
errors.set_index('Model').plot.bar(ax=ax)
ax.set(xlabel='Kinetic form', ylabel='Recovery error (pp)', title='Fit versus projection after dose change')
ax.tick_params(axis='x', rotation=20)
fig.tight_layout()""",
               "The paired bars show that matching a batch curve and projecting a bank are separate tasks. Absolute bank error is plotted so a negative projection bias does not look like a benefit, while the preceding table retains model identities and magnitudes. Both axes use percentage points. A small error here measures compression of the engine's rate distribution, and supplies no evidence about laboratory sampling error, froth calibration or performance at a producing site.",
               "Las barras pareadas muestran que ajustar una curva batch y proyectar un banco son tareas distintas. Se grafica el error absoluto de banco para que un sesgo negativo no parezca beneficio; la tabla conserva identidades y magnitudes. Ambos errores usan puntos porcentuales. Un error pequeño mide la compresión de la distribución de tasas del motor y no informa sobre muestreo de laboratorio, calibración de espuma ni desempeño en una planta productiva.")
    return cells


def optimization_steps(lang, level):
    cells = []
    step(cells, lang,
         "Use the authored magnetite circuit as a bounded one-dimensional search example. Its only optimization decision is the grind target, so the default multistart and progressive-barrier rules remain affordable without changing their settings. Read the committed contract and evaluate the nominal engine state first. Grade and installed-power constraints still apply even when a single decision makes the geometry easy to visualize.",
         "Usa el circuito de magnetita de autoría propia como búsqueda acotada de una dimensión. Su única decisión es el objetivo de molienda, lo que permite conservar las reglas multicomienzo y de barrera progresiva sin modificar sus ajustes. Lee el contrato comprometido y evalúa primero el estado nominal. Las restricciones de ley y potencia instalada siguen vigentes aunque una sola decisión simplifique la geometría.",
         """from pipeline.cases.catalog import CASE_BY_ID
from pipeline.engine.circuit import simulate
from pipeline.methods.optimization import optimize, Problem
from pipeline.methods.pattern_search import pattern_search
from pipeline.engine.constants import constant
case = CASE_BY_ID['iron_magnetite_fine']
contract = json.loads((repo / 'data/derived/contract/operating_contract.json').read_text(encoding='utf-8'))
base = simulate(case.ore, case.plant, case.nominal)
print('Base recovery (%):', round(base.metrics['recovery_pct'], 3))
print('Decision bounds:', contract['cases'][case.id]['inputs']['target_p80_um'])"""
    )
    step(cells, lang,
         "Run the production multistart search without a learned screen, with equal weights on normalized recovered metal and energy. The physical engine evaluates every candidate. The API returns an optimum only if a feasible terminal point exists, otherwise it retains the least-violating point. Feasibility and convergence are different: an evaluation-budget stop must not be described as reaching the minimum mesh.",
         "Ejecuta la búsqueda multicomienzo de producción sin filtro aprendido, con pesos iguales en metal recuperado y energía normalizados. El motor físico evalúa cada candidato. La API entrega un óptimo solo si existe un punto terminal factible; en caso contrario conserva el de menor violación. Factibilidad y convergencia son distintas: detenerse por presupuesto no significa alcanzar la malla mínima.",
         """plain = optimize(case, case.nominal, contract, weight=0.5, path=False, screen=None)
print('Unscreened status:', plain['status'])
print('Unscreened evaluations:', plain['evaluations'])
print('Stopping reasons:', [r['stop'] for r in plain['starts']])
plain_end = plain['optimum'] or plain['least_violating']
display(pd.Series(plain_end['slacks'], name='Constraint slack').to_frame())"""
    )
    if level == 2:
        for name, weight in [('metal', 1.0), ('energy', 0.0)]:
            step(cells, lang,
                 f"Change the objective to {'recovered metal alone' if weight else 'specific energy alone'} while retaining the same bounds, starts and physical constraints. This is a genuine preference experiment rather than a new optimizer. A candidate that improves this score can sacrifice the other outcome, so compare the endpoints in process units before drawing a decision. The weights are dimensionless because each term is scaled by the nominal state.",
                 f"Cambia el objetivo a {'solo metal recuperado' if weight else 'solo energía específica'} conservando límites, comienzos y restricciones físicas. Es un experimento de preferencias con el mismo optimizador. Un candidato que mejora esta puntuación puede sacrificar la otra salida; compara extremos en unidades de proceso antes de decidir. Los pesos son adimensionales porque cada término se divide por su valor nominal.",
                 f"""{name}_search = optimize(case, case.nominal, contract, weight={weight}, path=False, screen=None)
{name}_end = {name}_search['optimum'] or {name}_search['least_violating']
print('Preference:', {weight})
print('Recovered metal (t/h):', round({name}_end['recovered_tph'], 6))
print('Energy (kWh/t):', round({name}_end['values']['energy_kwh_t'], 3))"""
            )
    if level >= 3:
        step(cells, lang,
             "Load the committed float64 screen and run the same production optimizer with screening enabled. The case, base point, contract and weight are identical to the unscreened call. Its returned paired reference also runs an independent unscreened search with a fresh cache. Count exact engine evaluations rather than prediction speed: a proposal can add work even when it looks promising to the surrogate.",
             "Carga el filtro float64 comprometido y ejecuta el mismo optimizador de producción con filtro. Caso, punto inicial, contrato y peso son idénticos a la llamada sin filtro. La referencia pareada devuelta ejecuta además una búsqueda independiente sin filtro con caché nueva. Cuenta evaluaciones exactas del motor, no velocidad de predicción: una propuesta puede añadir trabajo aunque parezca prometedora al modelo.",
             """from pipeline.methods.screen import Screen
screen = Screen(repo / 'models')
screened = optimize(case, case.nominal, contract, weight=0.5, path=False, screen=screen)
screened_end = screened['optimum'] or screened['least_violating']
print('Screened status:', screened['status'])
print('Screened evaluations:', screened['evaluations'])
print('Paired unscreened evaluations:', screened['without_screen']['evaluations'])
proposals = [row for run in screened['starts'] for row in run['screen']['proposals']]
proposal_table = pd.DataFrame(proposals, columns=screened['proposal_columns'])
display(proposal_table.head(8))
print('Proposals:', len(proposals))
print('Additional evaluations:', screened['evaluations'] - plain['evaluations'])"""
        )
        step(cells, lang,
             "Re-evaluate the selected screened decision using a new circuit solve. This checks physical feasibility without trusting the search cache or treating the surrogate's prediction as a measured recovery. Retain a non-feasible endpoint if the search failed, and inspect its slacks rather than silently dropping that outcome. The extra audit solve is not included in the optimizer's reported candidate count.",
             "Reevalúa la decisión seleccionada con filtro mediante un circuito nuevo. Así se revisa factibilidad física sin confiar en la caché ni tratar la predicción como recuperación medida. Conserva el extremo no factible si la búsqueda falla e inspecciona sus holguras, en lugar de descartar ese resultado. La resolución adicional de auditoría no integra el conteo de candidatos informado por el optimizador.",
             """screened_point = case.nominal.with_values(**screened_end['decisions'])
screened_check = simulate(case.ore, case.plant, screened_point)
print('Screened engine recovery (%):', round(screened_check.metrics['recovery_pct'], 3))
print('Screened constraint slacks:', screened_end['slacks'])"""
        )
    step(cells, lang,
         "Evaluate the selected unscreened endpoint through the circuit independently. Compare its recovery and specific energy with the nominal state. The point may sit on a grade or power boundary, so an attractive objective is not enough to conclude that the choice is operationally robust. A feasible simulated point has no measured campaign evidence, economic calibration or allowance for uncertainty in the ore parameters.",
         "Evalúa el extremo sin filtro por el circuito de forma independiente. Compara recuperación y energía específica con el nominal. El punto puede quedar en una frontera de ley o potencia; un objetivo atractivo no basta para concluir robustez operativa. Un punto simulado factible carece todavía de evidencia de campaña medida, calibración económica y tolerancia a incertidumbre de los parámetros minerales.",
         """plain_point = case.nominal.with_values(**plain_end['decisions'])
plain_check = simulate(case.ore, case.plant, plain_point)
print('Unscreened engine recovery (%):', round(plain_check.metrics['recovery_pct'], 3))
print('Unscreened engine energy (kWh/t):', round(plain_check.metrics['specific_energy_total_kwh_t'], 3))"""
    )
    figure(cells, lang,
           "Plot the recorded incumbent objective and mesh history of the winning unscreened start. The trace exposes how progress changes as the mesh contracts.",
           "Grafica el objetivo incumbente y la malla del comienzo seleccionado sin filtro. La traza muestra cómo cambia el progreso al contraerse la malla.",
           """history = pd.DataFrame(plain['trace'], columns=['Outcome', 'Mesh', 'Barrier', 'Objective', 'Evaluations'])
fig, axes = plt.subplots(1, 2, figsize=(10, 4))
axes[0].plot(history['Evaluations'], history['Objective'], marker='.')
axes[0].set(xlabel='Exact evaluations (count)', ylabel='Normalized objective (1)', title='Incumbent progress')
axes[1].step(range(len(history)), history['Mesh'], where='post')
axes[1].set(xlabel='Iteration (count)', ylabel='Mesh width (1)', title='Progressive mesh')
fig.tight_layout()""",
           "A plateau records iterations without a better feasible incumbent and can coexist with evaluations that reduce constraint violation. The mesh panel shows when the search narrows its local poll. These traces describe the selected start rather than a pooled history of all multistarts. Read their last point with the printed stop reason: satisfying the feasibility tolerance does not prove a global optimum, and a finite evaluation budget can stop before the mesh criterion is reached.",
           "Una meseta registra iteraciones sin mejor incumbente factible y puede coexistir con evaluaciones que reducen violación de restricciones. La malla muestra cuándo se estrecha la búsqueda local. Las trazas describen el comienzo seleccionado, no la historia acumulada de todos. Lee el último punto junto al motivo de detención: satisfacer la tolerancia de factibilidad no demuestra optimalidad global, y un presupuesto finito puede parar antes del criterio de malla.")
    if level > 1:
        if level >= 3:
            program = """fig, ax = plt.subplots(figsize=(7, 4))
ax.bar(['Unscreened', 'Screened'], [plain['evaluations'], screened['evaluations']])
ax.set(xlabel='Search method', ylabel='Exact evaluations (count)', title='Fresh paired engine cost')
fig.tight_layout()"""
        else:
            program = """ends = [energy_end, plain_end, metal_end]
fig, ax = plt.subplots(figsize=(7, 4))
ax.plot([e['values']['energy_kwh_t'] for e in ends], [e['recovered_tph'] for e in ends], 'o-')
ax.set(xlabel='Specific energy (kWh/t)', ylabel='Recovered metal (t/h)', title='Computed preference trade-off')
fig.tight_layout()"""
        figure(cells, lang,
               "Compare the completed runs in the unit that the experiment actually measures, keeping all outcomes in view.",
               "Compara las corridas terminadas en la unidad que mide el experimento, conservando todos los resultados.", program,
               "For the screening comparison, a higher bar means more exact engine work on the identical one-dimensional problem. It says nothing about elapsed time or a different ore. For the preference experiment, the coordinates preserve recovered metal and specific energy rather than hiding their trade-off in a weighted score. In either view the simulated grade, power and water slacks remain essential: a favourable visual position cannot rescue an infeasible terminal state.",
               "En la comparación del filtro, una barra mayor significa más trabajo exacto del motor para el mismo problema unidimensional, sin afirmar tiempo de reloj ni otro mineral. En el experimento de preferencias, las coordenadas conservan metal recuperado y energía en lugar de ocultar el compromiso en una puntuación. En ambas vistas son esenciales las holguras de ley, potencia y agua: una posición visual favorable no rescata un extremo infactible.")
    if level == 4:
        figure(cells, lang,
               "Inspect every evaluated screen proposal against the engine, preserving proposals that were never evaluated as missing values.",
               "Inspecciona cada propuesta del filtro frente al motor, conservando como ausentes las que no llegaron a evaluarse.",
               """fig, ax = plt.subplots(figsize=(7, 4))
if not proposal_table.empty:
    residual = proposal_table['surrogate_recovery_pct'] - proposal_table['engine_recovery_pct']
    ax.scatter(np.arange(len(residual)), residual)
ax.axhline(0, color='black', linestyle='--')
ax.set(xlabel='Proposal (count)', ylabel='Prediction minus engine (pp)', title='Fresh proposal errors')
fig.tight_layout()
print('Trace iterations:', len(screened['trace']))""",
               "The proposal residual is a prediction diagnostic, not the quantity used to claim a computation saving. Small residuals can still lead to extra accepted search steps and therefore more engine calls. Missing engine values mean the search stopped before evaluating a proposal and must not become zero error. Compare this plot with the paired counts and terminal slacks, including the possibility of no useful proposals or a negative cost result on this bounded circuit.",
               "El residuo de propuesta diagnostica la predicción, no la cantidad con que se afirma ahorro computacional. Residuos pequeños pueden conducir a pasos adicionales y más llamadas al motor. Un valor exacto ausente significa que la búsqueda se detuvo antes de evaluar la propuesta y no debe convertirse en error cero. Lee el gráfico junto a conteos y holguras, incluida la posibilidad de ninguna propuesta útil o un costo desfavorable en este circuito acotado.")
    return cells


def uncertainty_steps(lang, level):
    cells = []
    step(cells, lang,
         "Start with the authored soft-porphyry circuit and its nominal ore. The uncertainty method varies ore properties over declared independent uniform ranges, rather than perturbing an operating throughput. A nominal solve establishes the deterministic reference from which the random output spread departs. Distinguish uncertainty about selected factors from uncertainty about the model equations: this lesson samples the former only.",
         "Parte del circuito de pórfido blando y su mineral nominal. El método varía propiedades minerales en rangos uniformes independientes declarados, en vez de perturbar el tratamiento operativo. Una resolución nominal establece la referencia determinista de la dispersión aleatoria. Distingue incertidumbre de los factores seleccionados e incertidumbre de las ecuaciones: esta lección muestrea únicamente la primera.",
         """from pipeline.cases.catalog import CASE_BY_ID
from pipeline.engine.circuit import simulate
from pipeline.methods.uncertainty import uncertainty, sensitivity, perturbed
case = CASE_BY_ID['copper_porphyry_soft']
nominal = simulate(case.ore, case.plant, case.nominal)
print('Nominal recovery (%):', round(nominal.metrics['recovery_pct'], 3))"""
    )
    for name, factor in [('low', 0.9), ('high', 1.1)]:
        step(cells, lang,
             f"Resolve the {'lower' if name == 'low' else 'upper'} liberation-size factor of {factor} while holding other ore factors at unity. This one-factor calculation explains the physical direction of an input effect before global sampling mixes effects together. Liberation modifies mineral accessibility and downstream separation. It is not equivalent to multiplying final recovery by the factor, and it need not produce a linear response around the nominal case.",
             f"Resuelve el factor {'inferior' if name == 'low' else 'superior'} de tamaño de liberación de {factor}, manteniendo los demás factores en uno. Este cálculo aislado explica el sentido físico antes de mezclar efectos mediante muestreo global. La liberación modifica accesibilidad mineral y separación posterior. No equivale a multiplicar recuperación final por el factor ni exige una respuesta lineal alrededor del caso nominal.",
             f"""{name}_ore, {name}_point = perturbed(case, case.nominal, {{'liberation_size': {factor}}})
{name} = simulate({name}_ore, case.plant, {name}_point)
print('Liberation factor:', {factor})
print('Conditional recovery (%):', round({name}.metrics['recovery_pct'], 3))"""
        )
    step(cells, lang,
         "Propagate 32 Latin-hypercube draws through the production engine using a fixed seed. Each factor occupies every marginal stratum once, but this does not remove interaction uncertainty or make 32 draws sufficient for tail risk. Inspect refusals explicitly. Output quantiles describe solved states, whereas the probability of satisfying every constraint uses every draw, including refusals as failures, so the two summaries have different denominators.",
         "Propaga 32 sorteos de hipercubo latino por el motor de producción con semilla fija. Cada factor ocupa una vez cada estrato marginal, sin eliminar incertidumbre de interacción ni hacer suficientes 32 sorteos para riesgo de colas. Inspecciona rechazos. Los cuantiles describen estados resueltos, mientras la probabilidad de cumplir todas las restricciones usa cada sorteo y cuenta los rechazados como fallas; los resúmenes tienen denominadores distintos.",
         """experiment = uncertainty(case, case.nominal, samples=32, seed=20261031)
print('Solved draws:', len(experiment['solved']))
print('Refused draws:', experiment['refused'])
print('Factor half-widths:', experiment['inputs'])
summary = pd.DataFrame(experiment['outputs']).T[['p05', 'p50', 'p95', 'std']]
display(summary.round(4))
print('All-constraint probability:', round(experiment['probabilities']['all_constraints'], 4))"""
    )
    figure(cells, lang,
           "Plot the recovery draws and nominal reference so the sampled distribution is visible rather than reduced to three quantiles.",
           "Grafica sorteos de recuperación y referencia nominal para mostrar la distribución sin reducirla a tres cuantiles.",
           """recovery = np.asarray(experiment['outputs']['recovery_pct']['values'])
fig, ax = plt.subplots(figsize=(7, 4))
ax.hist(recovery, bins=8, edgecolor='white')
ax.axvline(nominal.metrics['recovery_pct'], color='darkred', label='Nominal')
ax.set(xlabel='Recovery (%)', ylabel='Solved draws (count)', title='Ore-factor uncertainty propagation')
ax.legend()
fig.tight_layout()""",
           "The histogram is conditional on the declared ore ranges and the cases the engine could solve. Its shape can be asymmetric even when inputs have symmetric uniform ranges because the circuit is nonlinear and constrained. The nominal line is one deterministic setting rather than the expected value. A small set of bins cannot establish a rare-event probability or a plant forecast, so preserve the draw count and refusals with any quoted interval.",
           "El histograma está condicionado por los rangos minerales declarados y los estados que pudo resolver el motor. Puede ser asimétrico aunque las entradas sean uniformes simétricas, porque el circuito es no lineal y restringido. La línea nominal es una configuración determinista, no el valor esperado. Pocos intervalos gráficos no establecen probabilidades raras ni pronósticos de planta; cada intervalo debe acompañarse del conteo y los rechazos.")
    if level > 1:
        for name, count, seed in [('small', 8, 20261031), ('larger', 16, 20261031)]:
            step(cells, lang,
                 f"Calculate the Saltelli/Sobol variance decomposition at base N={count}. The design requires N times the number of factors plus two engine evaluations. Compare first-order effects, which isolate individual contributions, with total-order effects, which include interactions. The returned bootstrap half-widths describe estimator variability for this design. Small negative estimates can occur from finite sampling and must remain visible rather than being silently clipped to a tidy ranking.",
                 f"Calcula la descomposición Saltelli/Sobol con base N={count}. El diseño requiere N por la cantidad de factores más dos evaluaciones del motor. Compara primer orden, que aísla contribuciones individuales, y orden total, que incluye interacciones. Las semiamplitudes bootstrap describen variabilidad del estimador para este diseño. Estimaciones negativas pequeñas pueden surgir del muestreo finito y deben conservarse, sin recortarlas para presentar un orden más prolijo.",
                 f"""{name}_indices = sensitivity(case, case.nominal, base_samples={count}, seed={seed})
print('Sobol base rows:', {name}_indices['base_samples'])
print('Sobol engine evaluations:', {name}_indices['evaluations'])
print('Sobol status:', {name}_indices['status'])
if {name}_indices['status'] != 'computed':
    raise RuntimeError('Sensitivity design contains refused draws')
effects = {name}_indices['indices']['recovery_pct']
if effects.get('constant'):
    raise RuntimeError('Recovery is constant at the declared tolerance')
display(pd.DataFrame({{key: effects[key] for key in ('S1', 'ST', 'ST_conf')}}))"""
            )
        figure(cells, lang,
               "Compare total-order sensitivity at the two sample budgets, including the production bootstrap half-widths.",
               "Compara sensibilidad de orden total con ambos presupuestos, incluidas las semiamplitudes bootstrap de producción.",
               """names = list(larger_indices['inputs'])
fig, ax = plt.subplots(figsize=(8, 4))
for offset, record in ((-0.1, small_indices), (0.1, larger_indices)):
    effect = record['indices']['recovery_pct']
    values = [effect['ST'][name] for name in names]
    widths = [effect['ST_conf'][name] for name in names]
    ax.errorbar(np.arange(len(names)) + offset, values, yerr=widths, fmt='o',
                label='N=' + str(record['base_samples']))
ax.set_xticks(range(len(names)), names, rotation=15)
ax.set(xlabel='Ore factor', ylabel='Total Sobol index (1)', title='Finite-design sensitivity stability')
ax.legend()
fig.tight_layout()""",
               "Differences between the two budgets reveal finite-design instability instead of a change in the underlying physical equations. Wide bootstrap bars prevent confident ranking when they overlap. They are not error bars for the true plant, and their scale does not account for omitted ore correlations or structural model error. These deliberately small designs teach the estimator and its limitations; release-scale claims must use the archived larger study and its own settings.",
               "Las diferencias entre presupuestos revelan inestabilidad del diseño finito, no cambios de ecuaciones físicas. Las barras bootstrap amplias impiden ordenar con confianza cuando se superponen. No son barras de error de la planta y no contemplan correlaciones minerales omitidas ni error estructural. Estos diseños pequeños enseñan el estimador y sus límites; las afirmaciones de escala de versión requieren el estudio archivado más grande y sus propios ajustes.")
    return cells


QUESTIONS = {
    '01-comminution': (
        ('How do requested grind targets change achieved size and grinding demand in one closed circuit?',
         '¿Cómo cambian el tamaño alcanzado y la demanda de molienda al modificar el objetivo de un circuito cerrado?'),
        ('How do classifier recycle and calibrated energy laws explain a finer-product power requirement?',
         '¿Cómo explican la recirculación y las leyes calibradas el requerimiento de potencia de un producto más fino?'),
        ('Where do Bond, Rittinger and Kick agree, and how do their predictions diverge away from calibration?',
         '¿Dónde coinciden Bond, Rittinger y Kick y cómo divergen sus predicciones fuera de la calibración?')),
    '02-flotation': (
        ('Why does shortening a continuous bank change recovery differently from extending a batch test?',
         '¿Por qué acortar un banco continuo cambia la recuperación de manera distinta de prolongar una prueba batch?'),
        ('How does a collector change affect fitted kinetics and continuous-bank projection error?',
         '¿Cómo afecta un cambio de colector a la cinética ajustada y al error de proyección del banco?'),
        ('Which named kinetic fits preserve both batch response and bank recovery under a residence change?',
         '¿Qué ajustes cinéticos conservan la respuesta batch y la recuperación del banco al cambiar la residencia?')),
    '03-learning': (
        ('What physical labels and interpolation errors does a small simulator-trained Ridge model produce?',
         '¿Qué etiquetas físicas y errores de interpolación produce un Ridge pequeño entrenado con el simulador?'),
        ('How does withholding a complete porphyry case change the ranking of fitted estimators?',
         '¿Cómo cambia el orden de los estimadores ajustados al reservar un caso completo de pórfido?'),
        ('How do four fitted estimators change between interpolation, missing-case and missing-ore-group tests?',
         '¿Cómo cambian cuatro estimadores entre pruebas de interpolación, caso ausente y grupo mineral ausente?')),
    '04-optimization': (
        ('Which feasible grind setting does the production search select on the authored magnetite circuit?',
         '¿Qué molienda factible selecciona la búsqueda de producción para el circuito de magnetita de autoría propia?'),
        ('How do objective weights and progressive-barrier stopping affect the selected magnetite setting?',
         '¿Cómo afectan los pesos y la detención con barrera progresiva a la configuración de magnetita seleccionada?'),
        ('Does the learned search step change exact-engine cost and selected decisions on a common problem?',
         '¿Cambia el paso aprendido el costo del motor exacto y las decisiones de un problema común?'),
        ('Do fresh paired searches save engine calls, and what do intermediate screen proposals explain?',
         '¿Ahorran llamadas las búsquedas pareadas nuevas y qué explican sus propuestas intermedias?')),
    '05-uncertainty': (
        ('What recovery spread follows from the declared ore-factor ranges in 32 Latin-hypercube draws?',
         '¿Qué dispersión de recuperación producen los rangos minerales declarados en 32 sorteos de hipercubo latino?'),
        ('How do quantile denominators and finite-design Sobol estimates affect uncertainty interpretation?',
         '¿Cómo afectan los denominadores de cuantiles y las estimaciones finitas de Sobol a la interpretación?'),
        ('How stable are Saltelli/Sobol total-effect rankings when the base design doubles?',
         '¿Qué estabilidad tienen los órdenes de efecto total Saltelli/Sobol al duplicar el diseño base?')),
}

# Each paragraph belongs to one particular operation or figure at this level.
# Higher lessons retain the longer comparison instructions in their method builders.
NARRATIVES = {
('05-uncertainty', 1): (
"""Establish one deterministic recovery reference before drawing uncertain ore states. The soft-porphyry circuit's operating controls stay nominal throughout this lesson. Its work index, head grade, liberation size and floatability are the ore factors varied by the production propagator. These declared distributions describe an authored scenario, not a measured frequency distribution from a mine. Keeping the controls fixed lets the sampled spread be interpreted as conditional ore-factor response.

Reduce the liberation-size factor by ten percent and solve the circuit. This isolates one physical mechanism before combining four uncertain factors. A smaller liberation scale can change how readily valuable mineral becomes accessible after grinding, but the engine must determine the resulting recovery. Multiplying the nominal recovery by 0.9 would skip that mechanism and would not reproduce the intended model experiment.

Increase liberation size by ten percent for the opposite conditional response. The two deterministic perturbations bracket one factor only and therefore are not the endpoints of a full uncertainty interval. Other factors can reinforce or offset their effects when sampled together. Compare both values with nominal to see whether response is symmetric; a nonlinear circuit need not map symmetric input factors into symmetric output changes.

Run 32 seeded Latin-hypercube draws through the real circuit. Each marginal factor interval is stratified, which reduces empty stretches along an individual input but does not eliminate interaction or tail-sampling error. Read solved and refused counts first. The quantile table uses solved states, while the all-constraint probability counts every attempted draw, treating a refused physical state as a failure. Those denominators answer different questions and should remain explicit.

Plot all solved recovery values as a histogram and mark nominal. The distribution contains engine outputs rather than measurements. Eight bins are a compact view of only 32 draws, so apparent gaps or modes should not be interpreted as geological subpopulations. The nominal reference is not guaranteed to equal the median, because even independent symmetric ore ranges pass through nonlinear separation and power constraints.

The histogram describes the chosen scenario conditional on successful solves. It does not include uncertainty in the equations, correlated geology, assay error or sensor drift. A wide range indicates sensitivity to the declared factors; a narrow range can simply reflect narrow assumptions. Report the seed, sample count and factor half-widths with the quantiles, and preserve refusals separately so a convenient-looking interval cannot conceal physically unsolved states.""",
"""Establece una recuperación determinista antes de sortear estados minerales inciertos. Los controles del pórfido blando quedan nominales. Índice de trabajo, ley, tamaño de liberación y flotabilidad son los factores del propagador. Las distribuciones describen un escenario de autoría, no frecuencias medidas en una mina. Mantener controles permite interpretar dispersión como respuesta condicional al mineral.

Reduce diez por ciento el factor de tamaño de liberación y resuelve. Se aísla un mecanismo antes de combinar cuatro factores. Una escala menor puede cambiar accesibilidad del mineral tras moler, pero el motor determina la recuperación. Multiplicar el nominal por 0.9 omitiría ese mecanismo y no reproduce el experimento previsto.

Aumenta diez por ciento la liberación para observar el sentido contrario. Ambas perturbaciones rodean un factor y no son extremos de un intervalo completo. Los otros factores pueden reforzar o compensar efectos al sortearse juntos. Compara ambos valores con nominal para revisar simetría: un circuito no lineal no exige cambios de salida simétricos.

Ejecuta 32 sorteos con semilla e hipercubo latino mediante el circuito real. Cada intervalo marginal queda estratificado, sin eliminar error de interacción o colas. Lee primero resueltos y rechazados. Los cuantiles usan estados resueltos; la probabilidad conjunta cuenta intentos y considera el rechazo físico como falla. Los denominadores responden preguntas distintas y deben quedar explícitos.

Grafica todas las recuperaciones resueltas y marca nominal. Son salidas del motor, no mediciones. Ocho intervalos resumen solo 32 sorteos: huecos o modos aparentes no identifican subpoblaciones geológicas. El nominal puede diferir de la mediana porque rangos independientes simétricos atraviesan separación y restricciones no lineales.

El histograma describe el escenario condicionado a resoluciones exitosas. Excluye incertidumbre de ecuaciones, geología correlacionada, ensayes y deriva de sensores. Un rango ancho indica sensibilidad a factores declarados; uno estrecho puede reflejar supuestos estrechos. Informa semilla, cantidad y semiamplitudes junto a cuantiles, preservando rechazos para no ocultar estados físicamente no resueltos detrás de un intervalo cómodo."""),
('05-uncertainty', 2): (
"""Fix the nominal operating point while examining two different uncertainty summaries. Propagation estimates a conditional output distribution, whereas Sobol analysis decomposes its variance among independent factors. Both use the same authored ore ranges and exact circuit engine. They do not use the same sampling matrix or answer the same question. Start with nominal recovery so the later distribution and variance contributions have a common physical reference.

Compute a lower liberation-scale response to expose how one factor enters the physical model. The perturbation changes mineral accessibility, not the final output directly. This deterministic control is useful when a later total-effect index appears large: it helps distinguish a plausible physical pathway from a feature that was merely given a wide input range. It cannot estimate a global variance share by itself.

Compute the upper liberation-scale response independently. Keeping all other factors at unity makes these two controls locally interpretable. Their difference from nominal is neither a confidence interval nor a sensitivity derivative averaged over the entire domain. Interactions with head grade, work index and floatability appear only when those factors also vary. The comparison therefore motivates a global design rather than replacing it.

Propagate the 32-draw Latin hypercube and preserve both output and constraint summaries. P05 and P95 are empirical quantiles of solved states. The constraint probability includes rejected draws as failures, so it may deteriorate even when the conditional recovery interval looks harmless. Report the actual solved denominator and refusal reasons whenever a downstream reader might compare intervals between operating points.

Show the solved recovery distribution before reducing it to moments. A standard deviation and a P05-P95 interval retain different aspects of shape. The histogram can reveal asymmetry caused by nonlinear response or limits, though 32 draws cannot support detailed tail modeling. Its nominal marker is an engine reference only and does not supply an observed expected recovery.

Read the shape as conditional on these independent uniform factors. A plant distribution would require geological dependence and measurement calibration, neither supplied by stratification. A concentration near one edge can arise from model constraints rather than evidence for an ore regime. Retain the factor definitions with this figure, because widening one range can change the apparent importance of every other factor through the total output variance.

Run the first Saltelli design with eight base rows. Each factor's hybrid rows enable separation of first-order contribution and total contribution including interactions. Every row must be physically solved; dropping a refused row would break the estimator's matrix structure. The production method therefore refuses to report indices when a draw is unsolved. Keep that refusal as a scientific result instead of patching the design with a nominal output.

Double the base design to sixteen using the same seed and factor ranges. This changes the sampling budget without changing the physical model. Finite estimates can move substantially at these deliberately small sizes, and a small negative first-order value is sampling error rather than a negative physical variance. Bootstrap half-widths quantify this estimator variability, not uncertainty about the true operating plant.

Plot total-order indices from both budgets with their reported bootstrap half-widths. Shared factor names and unitless vertical scale make shifts directly comparable. Do not normalize the bars to sum to one: total effects include interactions and their sum need not equal unity. The design's exact evaluation count is printed separately so the cost of a more stable estimate remains visible.

Overlapping wide intervals prevent a confident ranking even if the point estimates appear ordered. A consistent large total effect suggests a useful factor to examine further under these assumptions, not an independently established causal driver. This lesson combines distribution interpretation, refusal handling and finite-design stability. A decision study needs larger repeated designs and defensible joint ore distributions before quoting a robust risk or importance ordering.""",
"""Fija el punto nominal para examinar dos resúmenes distintos. Propagación estima distribución condicional; Sobol descompone varianza entre factores independientes. Ambos usan rangos minerales de autoría y motor exacto, pero matrices y preguntas diferentes. Parte de recuperación nominal para dar una referencia física común a distribución y contribuciones.

Calcula la respuesta inferior de escala de liberación para mostrar cómo entra el factor al modelo. Cambia accesibilidad, no la salida directamente. El control ayuda si luego un efecto total resulta grande: distingue una vía física plausible de una variable con rango ancho. No estima por sí solo participación de varianza global.

Calcula independientemente la respuesta superior. Mantener los demás factores en uno hace interpretables los controles localmente. Su diferencia del nominal no es confianza ni derivada promediada sobre todo el dominio. Interacciones con ley, dureza y flotabilidad aparecen al variar también esos factores. La comparación motiva un diseño global, sin reemplazarlo.

Propaga el hipercubo de 32 sorteos y conserva salidas y restricciones. P05 y P95 son cuantiles empíricos de estados resueltos. La probabilidad cuenta rechazos como fallas y puede empeorar aunque el intervalo condicional parezca inofensivo. Informa denominador real y motivos de rechazo cuando otro lector compare intervalos entre puntos operativos.

Muestra la distribución antes de reducirla a momentos. Desviación estándar e intervalo P05-P95 conservan aspectos distintos de forma. El histograma puede revelar asimetría por no linealidad o límites, aunque 32 sorteos no modelan colas detalladamente. Su marca nominal es referencia del motor y no recuperación esperada observada.

Lee la forma condicionada a uniformes independientes. Una distribución de planta necesitaría dependencia geológica y calibración que la estratificación no entrega. Concentrarse en un extremo puede provenir de restricciones, no de un régimen mineral. Conserva definiciones: ensanchar un rango cambia importancia aparente de otros mediante la varianza total.

Ejecuta Saltelli con ocho filas base. Filas híbridas separan contribución individual y total con interacciones. Todas deben resolverse físicamente; eliminar un rechazo rompe la matriz del estimador. Por ello producción rehúsa informar índices si un sorteo falla. Conserva ese resultado científico sin rellenar el diseño con salidas nominales.

Duplica a dieciséis filas con iguales semilla y rangos. Cambia presupuesto, no modelo físico. Estimaciones finitas pueden moverse mucho con tamaños pequeños; un primer orden negativo pequeño es error de muestreo, no varianza física negativa. Las semiamplitudes bootstrap cuantifican variabilidad del estimador, no incertidumbre de planta real.

Grafica índices totales de ambos presupuestos con bootstrap. Nombres y escala adimensional compartidos permiten comparar desplazamientos. No normalices para sumar uno: los efectos totales incluyen interacciones y no deben necesariamente sumar unidad. El conteo exacto se imprime aparte para mostrar costo de estabilizar la estimación.

Intervalos amplios superpuestos impiden ordenar con confianza aun con estimaciones puntuales ordenadas. Un efecto grande consistente sugiere examinar el factor bajo estos supuestos, no establece un impulsor causal independiente. La lección integra distribución, rechazos y estabilidad finita. Decidir requiere diseños mayores repetidos y distribuciones conjuntas defendibles antes de citar riesgo u orden robustos."""),
('04-optimization', 1): (
"""Begin with a one-decision magnetite circuit. Its grind target is bounded by the committed operating contract, and its nominal state supplies the scales for recovered metal and energy. One decision makes the search inspectable while preserving real grade, power and water constraints. The engine, rather than a fitted curve drawn for illustration, computes the baseline recovery. No throughput sweep is needed to understand what decision the optimizer actually controls.

Call the production optimizer with equal normalized metal and energy weights and no screen. It starts from its declared multistart points and uses a progressive barrier to reduce violations. Read the terminal status, exact evaluation count and stop reason before looking for a best setting. A feasible endpoint is not a proof of global optimality, and a budget stop is not the same as satisfying the minimum-mesh rule.

Re-solve the selected endpoint with a fresh circuit calculation. This exposes recovery and specific energy in process units rather than a dimensionless objective alone. The constraint-slack table should accompany these outcomes: a negative slack means a physical requirement is missed even if the objective looks attractive. The extra check solve is an audit outside the optimizer's candidate count, and it does not convert an authored simulation into measured plant performance.

Draw the selected start's incumbent history together with its mesh size. The horizontal count in the first panel records exact objective evaluations within that start. The second panel records iterations, so its coordinates should not be confused with engine calls. A shrinking mesh tells you the local poll is becoming finer, while a flat feasible objective can coexist with attempts to improve an infeasible point.

The history explains how the reported terminal setting was reached. Sudden objective gains reflect accepted improvements, whereas a plateau can mean rejected poll points or constraint work. Only the selected start is traced here; the printed multistart count covers the complete run. Interpret the last mesh alongside the stop reason, and keep the nominal scales in mind when comparing objective values with the recovery and energy printed above.""",
"""Parte de un circuito de magnetita con una decisión. El contrato limita molienda y el nominal entrega escalas de metal y energía. Una dimensión permite inspeccionar la búsqueda conservando restricciones reales de ley, potencia y agua. El motor calcula recuperación base, no una curva ajustada para ilustración. No hace falta barrer tratamiento para entender qué decisión controla el optimizador.

Llama al optimizador con pesos normalizados iguales y sin filtro. Usa los comienzos declarados y barrera progresiva para reducir violaciones. Lee estado terminal, conteo exacto y motivo de detención antes de buscar la mejor configuración. Un extremo factible no prueba óptimo global; detener por presupuesto tampoco equivale a satisfacer malla mínima.

Resuelve nuevamente el extremo elegido con un circuito fresco. Así ves recuperación y energía en unidades de proceso, no solo un objetivo adimensional. Acompaña con holguras: una negativa indica incumplimiento aunque la puntuación resulte atractiva. La resolución adicional audita fuera del conteo de candidatos y no convierte simulación de autoría en desempeño medido de planta.

Dibuja historia incumbente y malla del comienzo seleccionado. El conteo horizontal del primer panel registra evaluaciones exactas dentro de ese comienzo. El segundo registra iteraciones, no llamadas al motor. Contraer malla indica una exploración local más fina; un objetivo factible plano puede coexistir con intentos de mejorar un punto infactible.

La historia explica cómo se alcanzó la configuración terminal. Saltos son mejoras aceptadas; mesetas pueden reflejar rechazos o trabajo de restricciones. Aquí se traza solo un comienzo y el conteo impreso cubre toda la corrida. Interpretar la última malla junto al motivo de detención y conservar las escalas nominales al comparar objetivo, recuperación y energía."""),
('04-optimization', 2): (
"""Set up the magnetite problem to examine objective construction rather than surrogate cost. The nominal recovered mass and specific energy define separate normalization constants. Without those constants a weighted sum would mix tonnes per hour and kWh per tonne arbitrarily. All experiments below share the same bounded grind decision and physical constraints. This controlled setup makes a change in selected operating point attributable to preference weights rather than a changed process definition.

First solve the equal-weight problem. Inspect the start-by-start stop reasons and the selected endpoint's grade, power and water slacks. The progressive barrier permits progress toward feasibility when a start is infeasible instead of assigning every such point one indistinguishable penalty. Its objective and violation ordering still require exact process evaluations. A useful terminal point needs both an admissible physical state and a clearly recorded stopping condition.

Run the metal-only preference next. This weight does not remove constraints or grant more installed power; it simply removes specific energy from the objective. The resulting endpoint can therefore increase recovered mass only within the same physical feasible region. Keep its energy consumption in the printed comparison, because a solver's definition of better follows its requested objective and does not represent every operating stakeholder's priorities.

Run the energy-only preference from the same multistart configuration. Energy minimization remains subject to concentrate specification and other physical limits. The outcome is therefore not permission to stop grinding regardless of product quality. Compare its recovered tonnes per hour with the metal-only endpoint to expose what is sacrificed. The three weights are a small computed preference sample, not an exhaustive Pareto frontier or a fitted economic utility function.

Independently evaluate the equal-weight endpoint through the circuit. Read its achieved recovery and energy with the slacks already shown. This separates checking physical outputs from trusting the objective's normalized summary. A result near the grade boundary may be especially sensitive to uncertain ore properties; that uncertainty is not included in this deterministic optimization. No monetary value is attached to recovered mass or electricity in this lesson.

Inspect the equal-weight start's objective and mesh histories. Accepted improvements can expand or maintain mesh, while unsuccessful iterations contract it. The two panels distinguish physical-evaluation work from iteration count. Because multistarts can reuse the problem's cache, summing per-start histories should not be substituted for the total unique engine-call count reported by the optimizer. Read each count according to the quantity it actually records.

The trace supports a narrow convergence statement: the selected start stopped under the printed rule after its recorded sequence of evaluations. It cannot demonstrate global optimality on every possible target, nor establish robustness against a different ore or uncertain work index. A flat objective near the end may reflect the declared improvement tolerance rather than a physically exact plateau. Preserve the stop reason when quoting the terminal recovery and energy.

Plot the three computed endpoints in energy and recovered-metal coordinates. A weighted score hides this relationship, whereas process units let a reader see the trade-off directly. Connecting the three markers only guides reading order. It does not fill in uncomputed weights, guarantee convexity or establish that every point on the line is feasible. The endpoint slacks remain the evidence for each computed candidate's admissibility.

The preference path is bounded by this circuit's grind range and nominal normalization. A different baseline can change the effective exchange between the two normalized terms even with the same numeric weight. Interpret apparent energy savings alongside recovered mass and concentrate constraints. These deterministic model results teach how to formulate and inspect a constrained objective; choosing an operating policy still requires calibrated observations, economic values and uncertainty margins appropriate to the site.""",
"""Prepara magnetita para examinar construcción del objetivo, no costo del filtro. Masa recuperada y energía nominales definen constantes separadas de normalización. Sin ellas, una suma ponderada mezclaría arbitrariamente toneladas por hora y kWh por tonelada. Los experimentos comparten decisión acotada y restricciones. Así un cambio de configuración se atribuye a preferencias, no a redefinir el proceso.

Resuelve primero pesos iguales. Inspecciona detención por comienzo y holguras de ley, potencia y agua. La barrera permite avanzar hacia factibilidad desde un comienzo infactible, en lugar de asignar a todos esos puntos una penalización indistinguible. Ordenar objetivo y violación sigue exigiendo motor exacto. Un extremo útil necesita estado admisible y condición de detención registrada.

Ejecuta preferencia de solo metal. El peso no elimina restricciones ni concede potencia adicional; retira energía del objetivo. El extremo solo aumenta masa dentro de la misma región física. Conserva consumo energético en la comparación: mejor para el solver significa mejorar el objetivo pedido, no representar todas las prioridades operativas.

Ejecuta preferencia de solo energía con iguales comienzos. Minimizar energía conserva especificación del concentrado y límites físicos; no autoriza dejar de moler sin importar calidad. Compara toneladas recuperadas para mostrar el sacrificio. Tres pesos son una muestra pequeña de preferencias, no una frontera Pareto exhaustiva ni utilidad económica ajustada.

Evalúa independientemente el extremo de pesos iguales mediante el circuito. Lee recuperación y energía junto a las holguras. Separa revisar salidas físicas y confiar en el resumen normalizado. Un punto cerca de la frontera de ley puede ser sensible a propiedades minerales inciertas; esta optimización determinista no las incluye. No se asigna valor monetario a masa ni electricidad.

Inspecciona historias de objetivo y malla del comienzo de pesos iguales. Las mejoras pueden mantener o expandir malla y los fracasos contraerla. Los paneles distinguen evaluaciones e iteraciones. Como los comienzos pueden reutilizar caché del problema, sumar sus historias no reemplaza el conteo total de llamadas únicas. Interpreta cada conteo según la cantidad registrada.

La traza sostiene una afirmación acotada: el comienzo seleccionado terminó bajo la regla impresa después de su secuencia registrada. No demuestra óptimo global ni robustez a otro mineral o índice incierto. Un objetivo plano final puede reflejar tolerancia de mejora, no una meseta física exacta. Conserva motivo de detención al citar recuperación y energía terminales.

Grafica los tres extremos en coordenadas energéticas y de metal. Una puntuación ponderada oculta la relación; unidades físicas hacen visible el compromiso. Conectar marcas solo guía lectura, sin calcular pesos intermedios, garantizar convexidad ni establecer factibilidad sobre toda la línea. Las holguras siguen siendo evidencia de admisibilidad de cada candidato calculado.

La trayectoria depende del rango de molienda y normalización nominal. Otra base puede cambiar el intercambio efectivo incluso con igual peso numérico. Lee ahorro energético junto a masa y restricciones del concentrado. El modelo enseña formulación e inspección; escoger una política requiere observaciones calibradas, valores económicos y márgenes de incertidumbre específicos del sitio."""),
('04-optimization', 3): (
"""Construct an identical magnetite optimization problem for two named search configurations: progressive-barrier pattern search with and without the learned proposal step. The common nominal state determines objective scales and the operating contract determines admissible grind targets. This comparison restricts dimensionality to keep the complete production search affordable. It does not shorten the declared stopping rule or substitute an analytic stand-in for the process engine.

Execute the unscreened reference first and keep its result intact. Its candidate count establishes the cost baseline, while its endpoint supplies physical outcomes and slacks. Record all start stop reasons so a feasible budget-limited result is not confused with mesh convergence. Exact engine evaluations are the comparison unit; the lesson does not use elapsed seconds, which would mix algorithmic work with host load, caches and numerical-library startup.

Enable the committed screen without changing case, base, weight or bounds. The proposal step uses a learned model to prioritize an unvisited point, but the exact engine must still judge it. A poor proposal can add work before the normal poll continues. The returned independent unscreened pair uses a fresh cache, providing an internal paired reference as well as the explicit reference call already performed.

Check the screened selected decision using a separate engine solve. The surrogate's expected recovery does not certify either physical recovery or constraint feasibility. If no feasible optimum exists, the least-violating endpoint remains visible rather than disappearing from the comparison. Report the final slacks with any apparent objective advantage. The audit solve is deliberately separate from the candidate counts used to measure search cost.

Check the unscreened selected decision the same way. Equal terminal decisions can coexist with unequal engine work because proposal ordering changes the route to the endpoint. Conversely, equal evaluation counts would not prove equal decisions. These are separate comparison questions, and recovery, energy and slacks preserve their physical interpretation when a normalized objective alone would obscure the difference.

Plot the reference incumbent objective and mesh. The curve records the selected start, so it should not be read as a chronological merge of all starts. A plateau does not mean that the engine was idle: rejected candidates and feasibility improvements still cost evaluations. This is the mechanism through which adding a prediction step can change total cost without changing the final feasible operating point.

Interpret the late iterations with the reported mesh stop and feasibility tolerance. The production algorithm's convergence criterion is an explicit computational rule, not an empirical proof that the selected grind is the best possible plant decision. The circuit has authored mineral parameters and no independently calibrated uncertainty margin. Preserve those limits when comparing a method's search efficiency with its physical usefulness.

Place screened and unscreened exact counts side by side. Both bars include a complete production multistart solve on the same one-dimensional contract. A higher screened bar is a negative result for the proposed cost benefit on this example. A lower bar would be a local saving, not a claim that the learned model makes every circuit search faster. Inspect the proposal table before attributing the direction to prediction accuracy alone.

The cost comparison is paired on inputs and settings but covers one authored circuit. It measures exact objective work and does not include model-training cost, audit solves or wall-clock inference overhead. A matching terminal recovery therefore supports only physical agreement within the displayed precision. The next evidence lesson examines individual proposal errors and compares this fresh bounded run with the current committed cohort, identified separately by engine version, contract digest and file SHA-256. Pair counts and signed costs come from the records actually read.""",
"""Construye el mismo problema de magnetita para búsqueda con barrera progresiva con y sin propuesta aprendida. El nominal fija escalas y el contrato los objetivos de molienda admisibles. Acotar dimensiones hace asequible la búsqueda completa, sin reducir reglas de detención ni sustituir el motor por una función analítica.

Ejecuta primero la referencia sin filtro y conserva su resultado. El conteo establece costo base y el extremo aporta salidas y holguras. Registra motivos por comienzo para no confundir factibilidad limitada por presupuesto y convergencia de malla. Se comparan evaluaciones exactas, no segundos que mezclarían trabajo con carga del equipo, cachés e inicio de bibliotecas.

Activa el filtro comprometido sin cambiar caso, base, peso ni límites. La propuesta prioriza un punto no visitado mediante aprendizaje, pero el motor debe juzgarlo. Una propuesta mala añade trabajo antes de continuar la exploración normal. La pareja independiente devuelta usa caché nueva y complementa la referencia explícita ya ejecutada.

Revisa la decisión con filtro resolviendo aparte el motor. La recuperación esperada no certifica recuperación física ni factibilidad. Si no existe óptimo factible, conserva el extremo de menor violación. Informa holguras junto a cualquier ventaja de objetivo. La auditoría queda separada de los conteos que miden costo de búsqueda.

Revisa del mismo modo el extremo sin filtro. Decisiones terminales iguales pueden exigir trabajo distinto porque el orden de propuestas cambia la ruta. Conteos iguales tampoco prueban decisiones iguales. Son preguntas separadas; recuperación, energía y holguras conservan significado físico donde un objetivo normalizado ocultaría diferencias.

Grafica objetivo incumbente y malla de referencia. La curva registra el comienzo seleccionado, no una mezcla cronológica de todos. Una meseta no significa motor inactivo: candidatos rechazados y mejoras de factibilidad también cuestan. Este mecanismo permite cambiar costo sin cambiar el extremo factible al agregar predicción.

Interpreta últimas iteraciones con detención de malla y tolerancia. El criterio es una regla computacional explícita, no prueba empírica de la mejor decisión de planta posible. El circuito usa parámetros de autoría y carece de margen incierto calibrado independientemente. Conserva esos límites al comparar eficiencia de búsqueda y utilidad física.

Muestra conteos exactos con y sin filtro juntos. Ambas barras cubren multicomienzo completo en el mismo contrato unidimensional. Una barra mayor con filtro es resultado negativo para el beneficio de costo en este ejemplo. Una menor sería ahorro local, no universal. Revisa propuestas antes de atribuir el sentido solo a precisión predictiva.

La comparación empareja entradas y ajustes de un circuito de autoría. Mide trabajo exacto y excluye entrenamiento, auditorías y costo temporal de inferencia. Recuperaciones coincidentes solo apoyan acuerdo físico a la precisión mostrada. La lección de evidencia examina errores individuales y compara esta corrida acotada con la cohorte comprometida actual, identificada por separado mediante versión del motor, digest contractual y SHA-256 de archivos. Las cantidades de parejas y los costos con signo proceden de los registros efectivamente leídos."""),
('03-learning', 1): (
"""Create a first supervised dataset from sixty-four bounded engine solves. Four authored circuits contribute sixteen states each. The feature builder uses physical ore and operating descriptors and excludes the case identifier. The target builder returns recovery, log-upgrade and total specific energy. This lesson fits recovery only, keeping one understandable prediction task while showing where the other labels originate. The state generator enforces the operating contract, and its fixed seed makes the input design repeatable.

Inspect a nominal soft-porphyry label directly. Recovery is a fraction of valuable material recovered, whereas specific energy is normalized by treated mass. A learner sees both only if you explicitly choose them as targets; here it receives recovery. This separate circuit solve demonstrates the label's physical provenance before the matrix is passed into a statistical estimator. It also establishes that there is no measured plant response hidden behind the word training.

Resolve the oxide-copper case with its own nominal definition. Its mineral properties differ from porphyry, so two nearby operating settings need not imply nearby recovery labels across the cases. Case identity is absent from the feature vector, but physical properties can still encode strong case signatures. This is why a good random-row test cannot automatically be called generalization to an unfamiliar mineral.

Compute the magnetite example using its separation flowsheet rather than forcing it through a flotation-only model. The resulting feature vector includes indicators of the installed process stages. Comparing this label with the copper examples teaches what a common supervised representation can and cannot mean. Shared recovery units permit one regression target, but do not make the underlying mineral and separation mechanisms identical.

Reserve one quarter of each case's rows with the production interpolation splitter. Training and test both contain all four cases, so this first experiment asks about unseen operating states among represented circuits. The printed case inventory exposes that limitation before any scores appear. Scaling belongs in the training pipeline: using the full design's means would allow test information to influence the fitted representation even without leaking a target value.

Fit Ridge after training-only standardization and predict the reserved recovery labels. Its coefficient penalty stabilizes a linear fit when physical features are correlated. Keep alpha fixed rather than searching it against the displayed test scores. Compute RMSE, MAE and R² directly from the predictions. R² can be negative if the model performs worse than a test-mean reference, which is an informative result rather than a reason to hide a fold.

Draw the interpolation error for this single estimator. There is one validation protocol and one fitted model in the entry lesson, making the bar a summary of a concrete prediction calculation rather than a literature ranking. The plot uses percentage points because it measures recovery differences, not relative percent change. Read it alongside the displayed prediction and target ranges to judge whether the magnitude is meaningful.

The error bar is descriptive and has no confidence interval because this experiment uses one deterministic split. Its sixty-four labels were generated from four shared case definitions, so they are not independent geological observations. The model has learned an approximation to the process engine. Before adding nonlinear estimators, first confirm the label units, the case representation in both partitions and the fact that the standardizer saw training rows only.""",
"""Crea un primer conjunto supervisado con sesenta y cuatro resoluciones acotadas. Cuatro circuitos aportan dieciséis estados cada uno. Las variables describen mineral y operación sin incluir identificador de caso. Los objetivos son recuperación, enriquecimiento logarítmico y energía total. Aquí se ajusta solo recuperación, una tarea comprensible que muestra de dónde provienen las otras etiquetas. El generador respeta contrato y usa semilla fija para repetir el diseño.

Inspecciona directamente una etiqueta nominal del pórfido blando. Recuperación es fracción de material valioso recuperado; energía específica se normaliza por masa tratada. El aprendiz recibe una salida solo si la eliges como objetivo: aquí recuperación. Resolver por separado demuestra procedencia física antes de entregar matrices al estimador. También establece que entrenamiento no oculta una respuesta medida de planta.

Resuelve cobre oxidado con su propia definición nominal. Sus propiedades difieren del pórfido; configuraciones operativas cercanas no implican etiquetas cercanas entre casos. Aunque falta el identificador, las propiedades físicas pueden codificar señales fuertes de identidad. Por eso una buena prueba aleatoria por filas no equivale automáticamente a generalizar a un mineral desconocido.

Calcula magnetita con su diagrama de separación, sin imponer un modelo exclusivo de flotación. El vector incluye indicadores de etapas instaladas. Comparar la etiqueta con los ejemplos de cobre enseña el alcance de una representación común. Unidades de recuperación compartidas permiten un objetivo de regresión, pero no vuelven idénticos los mecanismos minerales y de separación.

Reserva un cuarto de las filas de cada caso mediante el particionador de interpolación. Entrenamiento y prueba contienen los cuatro casos: se pregunta por estados nuevos de circuitos ya representados. El inventario impreso revela el límite antes de puntuar. Escala dentro del entrenamiento; usar medias del diseño completo introduciría información de prueba en la representación aun sin filtrar una etiqueta objetivo.

Ajusta Ridge después de estandarizar solo con entrenamiento y predice las etiquetas reservadas. La penalización estabiliza un ajuste lineal con variables correlacionadas. Conserva alpha fijo, sin buscarlo con puntuaciones de prueba. Calcula RMSE, MAE y R² desde predicciones. Un R² negativo indica peor desempeño que la referencia de media de prueba y es informativo; no justifica ocultar el pliegue.

Dibuja el error de interpolación de este único estimador. La lección inicial contiene un protocolo y un modelo ajustado; la barra resume una predicción concreta, no una clasificación bibliográfica. Usa puntos porcentuales porque mide diferencias de recuperación, no cambio porcentual relativo. Lee junto a rangos de predicción y referencia para juzgar la magnitud.

La barra es descriptiva y no tiene intervalo de confianza: se usa una partición determinista. Las sesenta y cuatro etiquetas comparten cuatro definiciones y no son observaciones geológicas independientes. El modelo aproxima el motor. Antes de agregar estimadores no lineales, confirmar unidades, representación de casos en ambas particiones y uso exclusivo de filas de entrenamiento al ajustar el estandarizador."""),
('03-learning', 2): (
"""Generate a common 64-row design for two estimators and two validation protocols. The practical question concerns a complete missing porphyry case, so keep its hard sibling as a deliberate near-neighbour during training. This is less strict than removing their shared ore group. The design size is chosen for a worked lesson and does not reproduce the release's full learning experiment. All features and targets still come from the production builders.

Evaluate soft porphyry at nominal to make the held-out case's recovery and energy concrete. This reference is not a training shortcut: it is a separate displayed example of the simulator quantities that populate the design. The fold below removes every sampled state belonging to this case before fitting. A reader can therefore distinguish inspecting an example from allowing its rows to update an estimator.

Evaluate hard porphyry next. Its shared dominant valuable mineral makes it a related training case rather than a genuinely different ore group. Keeping it in training can improve prediction for the missing soft case, which is why the validation unit matters scientifically. The inventory of case identities makes that remaining relationship explicit instead of presenting a whole-case result as transfer across every mineral boundary.

Inspect oxide copper as a contrasting training population. Its recovery label uses the same percentage convention, but physical floatability and liberation descriptors differ. A regression model may rely strongly on those descriptors to recognize a region of feature space. When evaluating transfer, consider whether the test region lies between known populations or outside them; a pooled average error alone cannot reveal that geometry.

Inspect the magnetite label to retain a non-flotation population in the training design. Its process-stage indicators are legitimate physical features, whereas a case-name category would provide an artificial shortcut. The engine supplies its target through the same interface. If this case has a very different recovery mean, a model can achieve a respectable pooled score by separating cases while still predicting operating variations poorly inside each case.

Perturb only soft porphyry's grind target for a fifth provenance check. This time the label changes because the circuit is solved again, rather than because the case name changes. The example separates within-case response from between-case offsets. It helps explain why a learner that recognizes mean case behaviour can still miss the variation an operator would care about when choosing a grind setting.

Build interpolation and soft-case holdout partitions and print their membership. The same sampled rows support both questions, with the holdout boundary changed intentionally. Fit all transformations on each protocol's training indices. Compare estimators within a protocol before comparing protocols: interpolation and whole-case tests have equal row counts here but different information available, so sample count alone cannot explain a performance difference.

Fit the scaled Ridge reference on each partition and calculate its recovery residuals. A single fixed penalty avoids using held-out errors to select complexity. The pipeline refits the standardizer for each protocol, preserving numerical-constant handling even when a feature varies only in the missing case. Print the prediction range beside the target range, because an extreme extrapolation should remain visible rather than being reduced to one large score.

Fit a forty-tree random forest on exactly those same training indices. Its nonlinear partitions can improve interpolation but its leaf averages constrain extrapolation beyond training labels. The comparison is fair on rows, target and protocol while allowing the named estimators to use their usual representations. Forty trees and minimum leaf size two are stated lesson settings, not evidence that either method has been exhaustively tuned.

Plot RMSE by model and protocol using the newly computed score table. The practical comparison has two models, so it is possible to read whether the order changes when soft porphyry is entirely missing. Every plotted error uses recovery percentage points. Keep MAE and R² in the table to distinguish broad bias from occasional large residuals; a method with similar RMSE can still distribute mistakes differently.

The grouped bars test the claim that interpolation ranking survives removal of a complete case. Any reversal is a result for these fixed cases and settings, not a universal preference for Ridge or forests. A worse holdout score is retained. Because hard porphyry remains available, this panel is explicitly a near-neighbour transfer question. Removing both related cases is reserved for the next lesson's ore-group experiment.

Plot predicted against exact recovery for the soft-case holdout. Both estimators see identical reference values along the horizontal axis, so a vertical bias is directly comparable. The diagonal marks perfect reproduction of the simulator. Do not mistake a dense cluster for independent replication: the sixteen points share one ore definition and their differences reflect sampled operating states inside that authored contract.

The scatter reveals whether a model compresses the recovery range or offsets the whole held-out case. Those patterns can have similar aggregate error yet imply different failure mechanisms. The reference is still generated by the process engine; no external assays validate it here. Use the case inventory, training-only scaler and residual pattern together to describe exactly what the missing-case comparison demonstrated and where its transfer claim ends.""",
"""Genera un diseño común de 64 filas para dos estimadores y dos protocolos. La pregunta práctica retira un pórfido completo y conserva su par duro como vecino deliberado. Es menos exigente que retirar el grupo mineral compartido. El tamaño sirve a una lección y no reproduce el experimento completo de versión. Variables y objetivos siguen viniendo de los constructores de producción.

Evalúa el pórfido blando nominal para concretar recuperación y energía del caso reservado. Esta referencia no es atajo de entrenamiento, sino ejemplo separado de cantidades que pueblan el diseño. El pliegue retira todos sus estados antes del ajuste. Se distingue así inspeccionar un ejemplo de permitir que actualice un estimador.

Evalúa el pórfido duro. Compartir mineral valioso dominante lo convierte en caso relacionado de entrenamiento, no en otro grupo mineral. Conservarlo puede ayudar a predecir el caso blando; por eso importa científicamente la unidad de validación. El inventario explicita esa relación sin presentar reserva de caso como transferencia a cualquier mineral.

Inspecciona cobre oxidado como población de entrenamiento contrastante. Su etiqueta usa el mismo porcentaje y sus descriptores de flotabilidad y liberación difieren. La regresión puede apoyarse fuertemente en ellos para reconocer una región. Evalúa si la región de prueba queda entre poblaciones conocidas o fuera de ellas: un error agregado no revela esa geometría.

Inspecciona magnetita para conservar una población sin flotación en el diseño. Indicadores de etapas son variables físicas legítimas; una categoría con el nombre del caso daría un atajo artificial. El motor entrega el objetivo por la misma interfaz. Si su media difiere mucho, un modelo puede puntuar bien separando casos y predecir mal variaciones operativas dentro de cada uno.

Perturba solo la molienda del pórfido blando como quinta revisión de procedencia. La etiqueta cambia porque se resuelve el circuito, no porque cambia un nombre. El ejemplo separa respuesta interna y desplazamientos entre casos. Ayuda a explicar por qué reconocer medias no basta para predecir la variación que importa al escoger una molienda.

Construye interpolación y reserva del caso blando e imprime membresía. Las mismas filas sostienen ambas preguntas cambiando deliberadamente la frontera. Ajusta transformaciones solo con índices de entrenamiento de cada protocolo. Compara estimadores dentro de un protocolo primero: ambas pruebas tienen igual cantidad de filas y distinta información disponible, así que el tamaño solo no explica diferencias.

Ajusta Ridge escalado en cada partición y calcula residuos de recuperación. Una penalización fija evita escoger complejidad con errores reservados. El pipeline reajusta el estandarizador por protocolo, incluida gestión numérica de constantes cuando una variable solo cambia en el caso ausente. Presentar el rango predicho junto a la referencia permite reconocer una extrapolación extrema además de su puntuación agregada.

Ajusta un bosque de cuarenta árboles sobre los mismos índices. Sus particiones no lineales pueden ayudar a interpolar; los promedios de hojas limitan extrapolación. Se igualan filas, objetivo y protocolo permitiendo las representaciones propias de cada método. Cuarenta árboles y dos filas mínimas por hoja son ajustes didácticos declarados, no una búsqueda exhaustiva de hiperparámetros.

Grafica RMSE por modelo y protocolo desde la tabla nueva. Con dos modelos se puede leer si cambia el orden al faltar todo el caso blando. Cada error usa puntos porcentuales. Conserva MAE y R² para distinguir sesgo amplio y residuos ocasionales grandes: RMSE similares pueden esconder distribuciones de error distintas.

Las barras preguntan si el orden interpolado se conserva al retirar un caso. Cualquier inversión pertenece a estos casos y ajustes, sin preferencia universal por Ridge o bosques. Se conserva el empeoramiento. Como sigue disponible el pórfido duro, la pregunta es de transferencia a un vecino; retirar ambos se reserva al experimento por grupo de la lección siguiente.

Grafica predicción y recuperación exacta del caso blando. Ambos estimadores comparten referencias horizontales y sus sesgos verticales son comparables. La diagonal indica reproducción perfecta del simulador. Una nube densa no es replicación independiente: dieciséis puntos comparten una definición mineral y sus diferencias provienen de estados operativos muestreados dentro del contrato.

La dispersión revela compresión del rango o desplazamiento del caso completo. Esos patrones pueden tener errores agregados similares y mecanismos distintos. La referencia sigue siendo del motor; no la validan ensayos externos. Usa inventario, escalador de entrenamiento y patrón residual para describir exactamente el alcance de la comparación y dónde termina su afirmación de transferencia."""),
('01-comminution', 1): (
"""Connect the size curves above to an actual mill-feed endpoint. Solve the soft porphyry again and take its achieved F80 directly from the grinding result. The crusher feed is a different stream, so substituting its coarser F80 would exaggerate the mill reduction. Keep the work index in kWh/t and the sizes in micrometres. These quantities let you compare an energy requirement with a solved circuit without guessing which stream an endpoint represents.

Evaluate Bond, Rittinger and Kick at the achieved nominal product. The returned columns are alternative estimates, each expressed in kWh per tonne. They are not three pieces of the mill's energy bill. Bond uses inverse square-root size, Rittinger inverse size, and Kick the logarithm of a size ratio. Their differences already matter at one point, even before a sweep reveals their shapes. Retain the values beside the independently computed grinding energy rather than selecting whichever happens to look closest.

Now request a product twenty percent finer, keeping ore, water and fresh feed unchanged. The circuit must resolve its classifier recycle instead of simply replacing the printed P80. Read requested and achieved size separately: installed power can prevent the target being reached. The reported required power answers whether the request is physically achievable in this authored configuration. A size target is therefore an input to an interconnected calculation, and cannot be interpreted as a guaranteed output or an instruction to a real plant.""",
"""Conecta las curvas anteriores con un extremo real de alimentación al molino. Resuelve nuevamente el pórfido blando y toma el F80 alcanzado desde la molienda. La alimentación al triturador es otro flujo; usar su F80 más grueso exageraría la reducción del molino. Conserva el índice en kWh/t y los tamaños en micrómetros. Así puedes comparar requerimiento de energía y circuito resuelto sin adivinar a qué flujo pertenece cada extremo.

Evalúa Bond, Rittinger y Kick al producto nominal alcanzado. Las columnas son estimaciones alternativas en kWh por tonelada, no tres partes de la cuenta energética. Bond usa raíz cuadrada inversa del tamaño, Rittinger tamaño inverso y Kick logaritmo de la razón de tamaños. Sus diferencias importan incluso en un punto, antes de que un barrido revele las formas. Conserva los valores junto a la energía de molienda calculada independientemente, sin elegir solo el que parezca más cercano.

Solicita ahora un producto veinte por ciento más fino, sin cambiar mineral, agua ni alimentación fresca. El circuito debe resolver su recirculación en lugar de sustituir el P80 impreso. Lee por separado tamaño solicitado y alcanzado: la potencia instalada puede impedir llegar al objetivo. La potencia requerida responde si la solicitud es realizable en esta configuración de autoría propia. Un objetivo es una entrada a un cálculo interconectado; no garantiza una salida ni constituye una instrucción para una planta real."""),
('01-comminution', 2): (
"""The classifier partition above is meaningful only with its solved mill feed. Re-establish the nominal state and extract that feed's F80 before calculating work. This ties the energy explanation to the same mass-balanced circuit as the partition table. A large underflow fraction recycles material and changes internal load, but it does not multiply the fresh-feed basis on which specific energy is reported. Keep those bases separate when moving between the partition and power calculations.

Use the achieved product to obtain a three-law energy table. The purpose here is accounting discipline: do not add the diagnostic Rittinger or Kick requirements to Bond or to the simulated net grinding energy. They describe competing hypotheses with a common calibration. The resulting table supports checking units and endpoints before any finer-target experiment. An operating work index inferred from actual net energy would answer a different question from predicting that energy with an ore work index.

Tighten the requested grind and inspect the power demand returned by the full engine. Classifier recycle is solved again, so the response includes changes in the flow network as well as the energy-size relation. A failure to achieve the target is part of the answer. Check whether the achieved size remains close to the request and whether required power exceeds installation before interpreting any improvement in recovery as an available operating option.

Move in the opposite direction with a coarser target. Comparing both sides of nominal prevents a one-direction experiment from masquerading as a general trend. Coarsening can release a power constraint while reducing liberation and recovery. The printed recovery therefore complements the power requirement rather than replacing it. No economics are assigned to either outcome, and the nominal authored point is not asserted to be economically optimal.

Generate a common product-size domain for the energy-law comparison. The lower product bound stays positive, and the upper bound remains below mill feed so every ratio represents size reduction. Calculate all three laws through the pipeline, then divide each diagnostic alternative by Bond. Ratios emphasize differences of shape, whereas the earlier energy table preserves absolute kWh/t. Both views are needed to avoid treating a small relative difference at tiny demand as operationally important.

Draw the normalized comparison with logarithmic size and a unit Bond baseline. This panel asks how the competing reduction hypotheses depart as a finer product is requested. It deliberately fixes the work index instead of mixing an ore-hardness experiment into a size experiment. Use the nominal, fine and coarse solved states as physical anchors, and treat the continuous connecting curves as equation evaluations rather than extra circuit solves.

The relative curves expose where the inverse-size and logarithmic assumptions differ most from inverse square-root scaling. Their intersection is constrained by calibration and does not certify either model for a new ore. A ratio near unity can coexist with an unattainable target if installed power is insufficient. Combine this figure with achieved P80, required power and the classifier partition to explain the complete fine-product calculation rather than choosing an equation solely from its visual closeness to Bond.""",
"""La partición anterior tiene sentido junto a la alimentación resuelta al molino. Restablecer el nominal y obtener su F80 antes de calcular trabajo. Así la explicación energética usa el mismo circuito balanceado que la tabla de partición. Una fracción alta a descarga inferior recircula material y cambia carga interna, pero no multiplica la base fresca de energía específica. Separa esas bases al pasar de partición a potencia.

Obtén una tabla de tres leyes con el producto alcanzado. Aquí importa la disciplina contable: no sumes los requerimientos diagnósticos Rittinger o Kick a Bond ni a la energía neta simulada. Son hipótesis competidoras con calibración común. La tabla permite revisar unidades y extremos antes de afinar el objetivo. Inferir un índice operativo desde energía neta responde otra pregunta que predecir energía con el índice del mineral.

Solicita molienda más fina e inspecciona la demanda que devuelve el motor completo. La recirculación se resuelve de nuevo; la respuesta incluye cambios de red además de la relación energía-tamaño. No alcanzar el objetivo integra la respuesta. Revisa cercanía entre tamaños y si la potencia requerida supera la instalación antes de interpretar una mejora de recuperación como opción operativa disponible.

Muévete en sentido contrario con un objetivo más grueso. Comparar ambos lados evita presentar un experimento unidireccional como tendencia general. Engrosar puede liberar la restricción de potencia y reducir liberación y recuperación. La recuperación impresa complementa la demanda, no la reemplaza. No se asigna economía a las salidas ni se afirma que el nominal sea económicamente óptimo.

Genera un dominio común de tamaños para las leyes. El límite inferior permanece positivo y el superior por debajo de la alimentación: cada cociente representa reducción. Calcula las tres leyes mediante el pipeline y divide las alternativas diagnósticas por Bond. Los cocientes destacan formas, mientras la tabla anterior conserva kWh/t absolutos. Ambas vistas evitan considerar importante una diferencia relativa pequeña con demanda casi nula.

Dibuja la comparación normalizada con tamaño logarítmico y referencia Bond unitaria. El panel pregunta cómo divergen las hipótesis al pedir un producto más fino. Mantiene fijo el índice de trabajo, sin mezclar dureza y tamaño. Usa los estados nominal, fino y grueso como anclas físicas; las curvas continuas evalúan ecuaciones, no representan resoluciones adicionales del circuito.

Las curvas relativas muestran dónde difieren más las hipótesis inversa y logarítmica respecto de raíz cuadrada inversa. Su intersección está condicionada por calibración y no certifica un modelo para otro mineral. Un cociente cercano a uno puede coexistir con un objetivo inalcanzable por falta de potencia. Integrar figura, P80 alcanzado, potencia y partición para explicar el cálculo completo, sin escoger una ecuación solo por cercanía visual a Bond."""),
('02-flotation', 1): (
"""Return to the copper-molybdenum rougher and generate a fresh kinetic record from its particle-class rates. Five named forms are fitted to the same virtual batch observations. The recorded continuous-bank recovery uses a residence model rather than the batch's single exposure time. This fresh fit connects the two views above without treating either curve as laboratory data. Notice that true flotation and overall rougher recovery need not coincide because entrainment contributes to the latter; the exact kinetic reference intentionally isolates true flotation.

Remove one continuous cell, leaving feed and collector at their nominal settings. There is now less installed tank volume and less total residence time for that flow. The engine calculates the shortened bank instead of truncating the batch curve. Inspect its recovery before fitting any approximation. This order matters because a fitted equation cannot supply an independent physical reference for its own projection. The calculation remains local to this authored bank and does not imply that one cell always has the same recovery contribution elsewhere.

Fit the shortened-bank kinetic record and print its exact true-flotation reference. A particle with a small rate may remain poorly recovered over the available bank residence even when a long batch test would approach a high ultimate recovery. This explains why extending batch time and adding a continuous cell are different interventions. Compare the two exact references and their fitted forms while preserving the distinction between valuable recovery, solids recovery and concentrate grade. The lesson teaches residence modeling, not plant-scale tank sizing or a recommended cell count.""",
"""Vuelve al rougher de cobre y molibdeno y genera un registro cinético nuevo desde sus tasas por clase. Cinco formas se ajustan a las mismas observaciones batch virtuales. La recuperación del banco usa residencia distribuida, no la exposición única del batch. El ajuste conecta ambas vistas sin tratar curvas como laboratorio. Flotación verdadera y recuperación rougher total pueden diferir porque el arrastre contribuye a la segunda; la referencia cinética aísla intencionalmente flotación verdadera.

Retira una celda continua y conserva alimentación y colector nominales. Disminuyen volumen de tanques instalado y residencia total para ese flujo. El motor calcula el banco corto en vez de truncar una curva batch. Inspecciona recuperación antes de ajustar aproximaciones: una ecuación ajustada no entrega una referencia física independiente para su propia proyección. El cálculo es local a este banco y no implica que una celda aporte siempre la misma recuperación en otros circuitos.

Ajusta el registro del banco corto e imprime la referencia exacta de flotación verdadera. Una partícula lenta puede recuperarse poco en la residencia disponible, aunque un batch prolongado alcance una recuperación última alta. Así se explica por qué extender tiempo batch y agregar una celda son intervenciones diferentes. Compara referencias y formas conservando distinciones entre recuperación valiosa, recuperación de sólidos y ley. Se enseña residencia, no dimensionamiento de tanques de planta ni una cantidad recomendada de celdas."""),
('02-flotation', 2): (
"""Rebuild the nominal fit as a physical anchor for the reagent experiment. Each model receives the exact same time coordinates and recovery values, allowing differences in fit error to reflect its functional form. A flexible model may describe the observed window well yet misrepresent a slow tail. That distinction is central to projecting the fitted kinetics into continuous cells, where the residence distribution weights the rate classes differently from a batch exposure.

Shorten the bank first as a geometric control. Holding chemistry fixed makes this a comparison of residence availability. The engine's rougher recovery retains entrainment and other circuit contributions, so it should not be inserted blindly into an equation for true flotation. The full kinetic record will supply the corresponding exact true-flotation reference in the next step. Keep the overall process response and its isolated kinetic component separately labeled.

Calculate the short-bank projections with the same kinetic family used at nominal. This controlled contrast tests whether fitting quality survives a change of residence without requiring a different ore dataset. The bank reference comes from the known particle rates. Examine whether the smallest batch residual also gives the smallest bank residual, and keep signed projection differences when diagnosing overprediction versus underprediction rather than retaining only a winning model name.

Change collector dosage by ten percent while returning to the nominal bank geometry. The nominal, short-bank and increased-dose calculations now isolate two distinct mechanisms. Dose changes collection response, whereas cell count changes exposure geometry. More collector can also increase gangue collection; recovery alone does not establish concentrate quality. The circuit calculation is required because a scalar adjustment of fitted recovery would skip the modeled mineral and water coupling.

Refit and project all implemented forms under the changed dose. Reusing the old fit parameters would answer how the old model extrapolates, not how the kinetic approximations perform on the new response. Here each form gets the same new observations and the same exact-bank benchmark. The table preserves both error definitions in percentage points. Inspect parameter bounds and convergence in the returned record before interpreting any small numerical advantage as a reliable physical distinction.

Plot batch RMSE next to absolute bank error after the dose change. The common vertical unit makes magnitudes comparable, but the quantities measure different tasks: fitting time samples and projecting a residence distribution. Absolute bank error is useful for magnitude ranking, while its sign remains available in the kinetic record. A form that wins one task has not automatically won the other.

Read the separation between each pair of bars as evidence about approximation portability. Nearly overlapping batch fits can have visibly different bank projections, especially when slow classes contribute beyond the observed window. All observations and the reference share the same engine assumptions, which isolates representation error but excludes laboratory noise and plant drift. The next comparison lesson focuses on that ranking mismatch rather than presenting additional collector sweeps as independent validation.""",
"""Reconstruye el ajuste nominal como ancla del experimento de reactivo. Cada modelo recibe exactamente los mismos tiempos y recuperaciones, de modo que el error refleja su forma funcional. Un modelo flexible puede describir la ventana observada y representar mal una cola lenta. Esa diferencia importa al proyectar a celdas continuas, donde la residencia pondera clases de tasa de otra manera que la exposición batch.

Acorta primero el banco como control geométrico. Mantener química fija permite comparar residencia disponible. La recuperación rougher del motor conserva arrastre y otras contribuciones; no se introduce directamente en una ecuación de flotación verdadera. El registro cinético entregará la referencia correspondiente en el paso siguiente. Identificar por separado la respuesta global y el componente cinético aislado.

Calcula proyecciones del banco corto con la misma familia nominal. El contraste prueba si la calidad del ajuste se mantiene al cambiar residencia sin usar otro conjunto mineral. La referencia proviene de tasas conocidas por clase. Examina si el menor residuo batch entrega también menor residuo de banco y conserva signos al diagnosticar sobrepredicción o subpredicción, en vez de guardar solo un nombre ganador.

Cambia diez por ciento la dosis y vuelve a la geometría nominal. Los cálculos nominal, banco corto y dosis aumentada aíslan dos mecanismos. La dosis modifica colección; la cantidad de celdas cambia exposición. Más colector puede aumentar ganga y no establece calidad del concentrado. Hace falta resolver el circuito: ajustar escalarmente una recuperación omitiría acoplamiento mineral y de agua.

Reajustar todas las formas implementadas a la respuesta con dosis modificada y proyectarlas al banco correspondiente. Reusar parámetros anteriores preguntaría por extrapolación del ajuste viejo, no por desempeño de las aproximaciones sobre la respuesta nueva. Cada forma recibe las mismas observaciones y referencia exacta. La tabla conserva dos errores en puntos porcentuales. Revisa límites y convergencia antes de atribuir significado físico a una ventaja numérica pequeña.

Grafica RMSE batch junto al error absoluto de banco después de cambiar dosis. La unidad vertical común permite comparar magnitudes, pero son tareas distintas: ajustar tiempos y proyectar residencia. El absoluto sirve para ordenar magnitudes; el signo sigue disponible en el registro. Ganar una tarea no significa ganar automáticamente la otra.

La separación de cada par de barras informa sobre portabilidad de la aproximación. Ajustes batch casi superpuestos pueden proyectar bancos distintos, especialmente cuando clases lentas aportan fuera de la ventana observada. Datos y referencia comparten supuestos del motor, lo que aísla error de representación y excluye ruido de laboratorio y deriva de planta. La lección siguiente se centra en ese cambio de orden, sin presentar más barridos de dosis como validación independiente."""),
}


BASE_READINGS = {
    ('01-comminution', 1): (
        "The three cumulative curves refer to distinct streams in one solved recycle circuit. Their horizontal separation identifies size reduction, while curvature shows that equal P80 values need not imply equal fine fractions. The mill product is not a new independent sample of ore. Read the stream table with these curves to preserve the fresh-feed basis and the balance audit before comparing the finer requested grind below.",
        "Las tres curvas acumuladas corresponden a flujos distintos del mismo circuito con recirculación. Su separación horizontal identifica reducción de tamaño; la curvatura muestra que igual P80 no implica igual fracción fina. El producto no es otra muestra independiente de mineral. Lee la tabla de flujos junto a las curvas para conservar la base de alimentación fresca y la auditoría antes de comparar la molienda más fina."),
    ('01-comminution', 2): (
        "The partition separates particles sent to underflow from those leaving in overflow. Its vertical axis is a fraction, not a cumulative size percentage. The energy-law panel uses common endpoints to compare alternative size-reduction hypotheses. Neither a sharp partition nor agreement of energy formulas establishes plant calibration: circulating load, bypass and the required mill power must remain consistent with the solved flow network.",
        "La partición separa partículas que van a descarga inferior y rebose. Su eje vertical es una fracción, no porcentaje acumulado de tamaño. El panel energético usa extremos comunes para comparar hipótesis de reducción. Ni una partición marcada ni la coincidencia de fórmulas establece calibración de planta: recirculación, desvío y potencia requerida deben ser coherentes con la red resuelta."),
    ('01-comminution', 3): (
        "All three curves use the same feed and ore work index, making their disagreement interpretable as a difference of hypotheses rather than a change of data. A marker at the reference size highlights the imposed calibration. The actual product calculation should be read separately: closeness to that marker alone cannot establish that any one formula predicts this circuit's net measured energy.",
        "Las tres curvas usan igual alimentación e índice de trabajo, de modo que el desacuerdo refleja hipótesis y no cambios de datos. La marca de referencia destaca una calibración impuesta. El cálculo del producto real se lee aparte: estar cerca de esa marca no establece que una fórmula prediga la energía neta medida del circuito."),
    ('02-flotation', 1): (
        "Batch time and continuous-cell position are different exposure coordinates. The batch curve lets every particle experience the stated duration, whereas a bank mixes residence times and transfers material between stages. Consequently similar-looking curves do not justify equating their x axes. The following stream table tracks valuable grade and solids so a recovery change can be distinguished from simple dilution or extra gangue collection.",
        "Tiempo batch y posición de celda continua son coordenadas de exposición distintas. En batch cada partícula experimenta la duración indicada; el banco mezcla residencias y transfiere material entre etapas. Curvas parecidas no justifican igualar sus ejes horizontales. La tabla posterior conserva ley valiosa y sólidos para distinguir un cambio de recuperación de dilución o mayor colección de ganga."),
    ('02-flotation', 2): (
        "A tight overlay on virtual batch observations demonstrates fitting within the chosen time window. It cannot determine the complete tail of the rate distribution, so bank projections and ultimate recovery may disagree even for visually similar fits. Inspect the reported convergence and bound flags before interpreting extra parameters as useful detail. These observations were generated by the same circuit engine and contain no laboratory measurement noise.",
        "Una superposición estrecha sobre observaciones batch virtuales demuestra ajuste en la ventana temporal elegida. No determina toda la cola de tasas, por lo que proyecciones y recuperación última pueden diferir aun con curvas similares. Inspecciona convergencia y parámetros en límites antes de interpretar parámetros adicionales como detalle útil. Las observaciones proceden del mismo motor y carecen de ruido de medición de laboratorio."),
    ('02-flotation', 3): (
        "The paired error measures distinguish interpolation in batch time from projection into a mixed-residence bank. A good batch rank need not remain a good bank rank. The exact-rate reference is available because this is a simulator experiment, a convenience that would require independent kinetic characterization in a laboratory study. Do not interpret the best virtual fit as a universally preferred flotation model.",
        "Las medidas pareadas distinguen interpolación temporal batch y proyección a un banco con residencias mezcladas. Un buen orden batch puede no conservarse en el banco. La referencia exacta existe porque es un experimento de simulador; en laboratorio exigiría caracterización cinética independiente. No interpretes el mejor ajuste virtual como modelo universalmente preferido de flotación."),
}

DISCUSSION = {
('02-flotation', 1): (
    "The exact bank reference excludes mechanical entrainment, while the stream recovery includes every route by which valuable mass reaches concentrate. Those quantities can differ without an arithmetic error. To diagnose a discrepancy, identify the payable species, the residence basis and whether water carries fines into concentrate. A batch kinetic equation models collection exposure; it cannot by itself reconstruct all water and solids transfers in the circuit. That is why this lesson keeps the process solve alongside its kinetic summary.",
    "La referencia exacta excluye arrastre mecánico y la recuperación del flujo incluye todas las rutas de masa valiosa al concentrado. Pueden diferir sin error aritmético. Identifica especie pagable, base de residencia y si el agua lleva finos al concentrado. Una ecuación batch modela exposición de colección, pero no reconstruye por sí sola transferencias de agua y sólidos. Por eso se conserva la resolución de proceso junto al resumen cinético. Una auditoría de masa cerrada demuestra consistencia interna de esas transferencias, no calibración experimental de cada mecanismo."),
('02-flotation', 3): (
    "This comparison deliberately refits the named kinetic forms instead of trusting the committed score table. The freshly solved bank defines the common rate distribution, and every approximation receives the same virtual time samples. Comparing bank projection errors then measures what is lost when that distribution is compressed into each parametric form. No downloaded experiment or fabricated measurement is introduced, and the exact-rate reference remains a simulator reference throughout.",
    "Aquí se reajustan las formas cinéticas en lugar de confiar en puntuaciones guardadas. El banco recién resuelto define la distribución común y cada aproximación recibe los mismos tiempos virtuales. Comparar errores de proyección mide qué se pierde al comprimir tasas en cada forma paramétrica. No se agrega experimento descargado ni medición inventada; la referencia exacta sigue siendo del simulador."),
('04-optimization', 1): (
    "A positive power slack means installed capacity exceeds required mill power at the candidate. A positive grade slack means the concentrate meets its specification. These slacks have different physical units, so the barrier works with their normalized counterparts rather than adding raw values. The recovered-metal and energy objective uses its own nominal scales. Keeping feasibility normalization separate from preference normalization prevents a reader from interpreting a large power margin as a reason the objective should improve.",
    "Holgura positiva de potencia significa que la capacidad supera demanda; holgura positiva de ley significa cumplir especificación. Tienen unidades distintas y la barrera usa contrapartes normalizadas, sin sumar valores crudos. El objetivo metal-energía tiene sus propias escalas nominales. Separar normalización de factibilidad y preferencias evita interpretar un margen grande de potencia como motivo para que mejore el objetivo. Una holgura pequeña tampoco mide probabilidad de incumplir: la búsqueda es determinista y no propaga distribuciones minerales en esta lección."),
('05-uncertainty', 1): (
    "Constraint probabilities use the same attempted factor rows for grade, power and water. The joint event is counted directly rather than approximated by multiplying marginal probabilities, since all three outputs are coupled by each circuit solve. A recovery draw inside the central quantile range can still miss concentrate specification. Therefore a recovery interval and a joint feasibility probability are complementary summaries, not substitutes for one another when assessing a proposed operating point.",
    "Las probabilidades de ley, potencia y agua usan las mismas filas intentadas. El evento conjunto se cuenta directamente, sin multiplicar probabilidades marginales, porque el circuito acopla las tres salidas. Una recuperación dentro del rango central puede incumplir especificación. Intervalo y probabilidad conjunta son complementarios y no sustitutos al evaluar una operación. El muestreo tampoco observa decisiones humanas, por lo que no permite inferir cómo cambiaría una política real de control ante el mineral incierto."),
('01-comminution', 3): (
    "A calibration equality needs two declared endpoints, not just a work index. OreFlow determines Rittinger and Kick constants from the same reference reduction used for Bond, then keeps those constants fixed for the case sweep. Changing the reference would change their numerical disagreement without changing the mathematical hypotheses. When reproducing this comparison with an ore test, record feed and product size conventions, the energy basis and the calibration reduction together. Agreement at a point selected for calibration supplies no additional independent observation.",
    "Una igualdad de calibración exige dos extremos declarados, no solo índice de trabajo. OreFlow determina constantes Rittinger y Kick con la misma reducción de referencia Bond y las conserva en el barrido. Cambiar la referencia cambiaría el desacuerdo numérico sin cambiar hipótesis matemáticas. Al repetir con un ensayo mineral, registra convenciones de tamaños, base energética y reducción de calibración. Coincidir en un punto elegido para calibrar no aporta una observación independiente adicional."),
('02-flotation', 2): (
    "The fitted record also retains convergence and parameters at bounds. A nearly zero rate or a fast/slow fraction at its limit can make a nominally richer form behave like a simpler one. That degeneracy matters when projecting beyond the last batch time: a visually excellent fit may identify several parameter combinations equally well. Diagnose it by reading the bound flags together with the ultimate-recovery gap and bank error, rather than selecting solely by batch RMSE. A laboratory comparison would also need a sampling-error model before treating tiny residual differences as meaningful.",
    "El registro conserva convergencia y parámetros en límites. Una tasa casi nula o una fracción rápida/lenta en su frontera puede hacer que una forma rica se comporte como otra simple. Esa degeneración importa fuera del último tiempo batch: un ajuste visualmente excelente puede admitir varias combinaciones equivalentes. Lee límites junto a brecha de recuperación última y error de banco, sin seleccionar solo por RMSE batch. En laboratorio también haría falta un modelo de error de muestreo antes de considerar importantes diferencias pequeñas de residuos. Una advertencia de convergencia es información del ajuste, no evidencia automática de mala física ni permiso para descartar el modelo sin revisar sus predicciones."),
('04-optimization', 2): (
    "Constraint violation is formed from normalized negative slacks beyond the declared feasibility tolerance. Squaring and summing these violations gives the barrier quantity used by pattern search. It is distinct from the energy/metal objective: a candidate can improve feasibility while worsening the weighted objective. This distinction explains why a trace may spend evaluations without raising its feasible incumbent. The multistart cache records unique physical decision vectors shared across starts, while the displayed winning trace counts work within one search. Do not infer the total by multiplying its length by the number of starts.",
    "La violación se forma con holguras normalizadas negativas fuera de la tolerancia de factibilidad. Sus cuadrados sumados constituyen la cantidad de barrera que usa la búsqueda. Es distinta del objetivo energía/metal: un candidato puede mejorar factibilidad y empeorar preferencia. Así se explica gastar evaluaciones sin elevar el incumbente factible. La caché multicomienzo registra vectores físicos únicos compartidos entre comienzos, mientras la traza seleccionada cuenta trabajo dentro de uno. No infieras el total multiplicando longitud por cantidad de comienzos. Si cambias límites contractuales, también cambias la conversión entre coordenadas unitarias y molienda física; ese cambio exigiría otro experimento y no sería comparable directamente con los extremos actuales.\n\nEl peso cero minimiza energía entre candidatos admisibles, no maximiza una supuesta eficiencia económica. El peso uno maximiza metal normalizado y no convierte tonelaje en ingreso. El punto intermedio permite observar un compromiso físico calculado. Para convertirlo en preferencia de negocio faltan precios, costos variables, límites ambientales y una calibración de sus incertidumbres; esos términos no se inventan al interpretar la figura."),
('04-optimization', 3): (
    "The independent unscreened reference returned inside the screened call is useful for checking that the explicit baseline used the same problem. Compare its engine count with the separate plain call and inspect the common decision bounds and start inventory. A difference would require explaining settings or state, not averaging the two counts. The proposal table records surrogate and engine objectives separately because a prediction can rank well and still fail the exact improvement test. A trusted prediction interval constrains model use but is not an oracle for optimization benefit.",
    "La referencia independiente devuelta dentro de la llamada con filtro permite revisar que la base explícita use el mismo problema. Compara su conteo con la llamada separada e inspecciona límites y comienzos comunes. Una diferencia exigiría explicar ajustes o estado, no promediar conteos. La tabla separa objetivos predichos y exactos: una predicción bien ordenada puede fallar la prueba exacta de mejora. Un intervalo predictivo admisible limita uso del modelo, pero no garantiza beneficio al optimizar. Tampoco deben contarse propuestas rechazadas por el filtro como llamadas exactas evitadas: quizá la exploración normal nunca habría visitado esos puntos. Solo la corrida pareada completa mide esa diferencia."),
('05-uncertainty', 2): (
    "A useful consistency check is to distinguish the number of attempted factor rows from the number of solved recoveries. If every draw solves, both denominators coincide and the distinction is easy to miss. If a state is refused, conditioning the entire constraint calculation on successful solves would make the operating point appear more reliable than the attempted scenario design supports. The production propagator instead preserves refusal counts and evaluates joint feasibility over attempts. Do not multiply marginal constraint probabilities to reconstruct joint feasibility: grade, power and water are coupled through the same draws.",
    "Conviene distinguir cantidad de filas intentadas y recuperaciones resueltas. Si todas se resuelven, coinciden denominadores y es fácil olvidar la diferencia. Si un estado se rechaza, condicionar toda restricción a éxito haría parecer más confiable la operación de lo que sostiene el diseño. El propagador conserva rechazos y calcula factibilidad conjunta sobre intentos. No multipliques probabilidades marginales para reconstruir la conjunta: ley, potencia y agua se acoplan mediante los mismos sorteos. La tabla de cuantiles describe por su parte salidas resueltas; no asigna recuperación cero a un estado para el cual el modelo no encontró solución física.\n\nUn índice de sensibilidad grande tampoco implica gran dispersión absoluta. Puede explicar casi toda una varianza muy pequeña. Por eso se conserva primero la tabla de cuantiles y desviación de cada salida y después la descomposición adimensional. Al cambiar de recuperación a energía se debe volver a comprobar constancia numérica antes de interpretar un orden de factores."),
('05-uncertainty', 3): (
    "Saltelli's design pairs base matrices with hybrid rows that replace one factor at a time. The estimator uses their structured correspondence; it is not a collection of interchangeable random recovery samples. Consequently a single refused row invalidates the decomposition rather than merely reducing sample size. The method also suppresses rankings for outputs constant at its declared relative numerical tolerance. Otherwise rounding noise in a power-limited output could produce impressive-looking indices for a variance with no physical meaning.\n\nBootstrap widths should be interpreted together with the gap between first and total effects. A large gap can reflect interactions, but at very small N it can also reflect estimator noise. Repeating a larger design at additional seeds would test stability more seriously than declaring the largest point estimate dominant. The current N=8 and N=16 computations are intentionally exploratory and leave their uncertainty visible.",
    "El diseño Saltelli empareja matrices base y filas híbridas que reemplazan un factor cada vez. El estimador necesita su correspondencia estructurada: no son muestras intercambiables de recuperación. Un rechazo invalida la descomposición, en lugar de solo reducir el tamaño. El método también suprime órdenes de salidas constantes a su tolerancia numérica relativa; de otro modo el redondeo de una salida limitada por potencia podría producir índices vistosos para una varianza sin significado físico.\n\nInterpreta bootstrap junto a la brecha entre efectos individuales y totales. Una brecha amplia puede reflejar interacciones y, con N pequeño, ruido del estimador. Repetir un diseño mayor con otras semillas probaría estabilidad mejor que declarar dominante la mayor estimación puntual. Los cálculos actuales N=8 y N=16 son exploratorios deliberadamente y conservan su incertidumbre visible."),
}


def enrich(notebook):
    """Replace generic extensions with computed, topic-specific method steps."""
    from build_didactic_notebooks import PINS
    meta = notebook['metadata']['caos']
    lang, topic, level = meta['language'], meta['topic'], meta['level']
    cells = notebook['cells']
    def heading(en, es):
        return '## ' + pair(en, es, lang)
    for cell in cells:
        source = ''.join(cell['source'])
        if cell['cell_type'] == 'markdown' and source.startswith(heading('Setup', 'Preparación')):
            cell['source'] = re.sub(r'pip install[^\n]+', 'pip install ' + ' '.join(PINS), source).splitlines(keepends=True)
    if topic in ('04-optimization', '05-uncertainty'):
        titles = {
            '04-optimization': (
                ('Search for a feasible magnetite grind', 'Buscar una molienda factible para magnetita'),
                ('Inspect objective weights and progressive barriers', 'Inspecciona pesos y barreras progresivas'),
                ('Compare screened and unscreened pattern search', 'Compara búsqueda de patrones con y sin filtro'),
                ('Measure proposal errors and paired search cost', 'Mide errores de propuesta y costo pareado')),
            '05-uncertainty': (
                ('Propagate declared ore uncertainty', 'Propaga incertidumbre mineral declarada'),
                ('Read quantiles, refusals and variance effects', 'Lee cuantiles, rechazos y efectos de varianza'),
                ('Compare finite-design Sobol estimates', 'Compara estimaciones Sobol de diseño finito')),
        }
        title = pair(*titles[topic][level - 1], lang)
        meta['title'] = title
        opening = ''.join(cells[0]['source'])
        cells[0]['source'] = ('# ' + title + '\n' + opening.partition('\n')[2]).splitlines(keepends=True)
    if topic in ('03-learning', '04-optimization', '05-uncertainty'):
        for c in cells:
            if ''.join(c['source']).startswith(heading('Data', 'Datos')):
                description = pair(
                    "Owner: OreFlow authors. The case definitions in `data-pipeline/pipeline/cases/catalog.py` and the physical method constants are authored simulator inputs under the MIT project licence, not measured plant records. The learning and optimizer examples read `data/derived/contract/operating_contract.json`. Screening additionally loads the committed `models/process_screen.json` and its companion model files. The level-4 archived context reads the committed case records separately. No new dataset is fetched. Source: https://github.com/fsantibanezleal/CAOS_OreFlow.",
                    "Responsable: autores de OreFlow. Los casos de `data-pipeline/pipeline/cases/catalog.py` y las constantes físicas son entradas de simulador de autoría propia con licencia MIT, no registros medidos de planta. Aprendizaje y optimización leen `data/derived/contract/operating_contract.json`. El filtro carga además `models/process_screen.json` y sus archivos compañeros comprometidos. El contexto archivado de nivel 4 lee por separado los registros de casos. No se descarga otro conjunto. Fuente: https://github.com/fsantibanezleal/CAOS_OreFlow.", lang)
                c['source'] = (heading('Data', 'Datos') + '\n\n' + description).splitlines(keepends=True)
    result_index = next(i for i, c in enumerate(cells)
                        if ''.join(c['source']).startswith(heading('Results', 'Resultados')))
    method_index = next(i for i, c in enumerate(cells)
                        if ''.join(c['source']).startswith(heading('Method', 'Método')))
    if topic in ('03-learning', '04-optimization', '05-uncertainty'):
        # Keep authored sections, but none of their score-reading code carries the method.
        prefix = [c for c in cells[:result_index] if c['cell_type'] == 'markdown']
        setup_cell = next(c for c in cells if c['cell_type'] == 'code')
        setup_index = next(i for i, c in enumerate(prefix)
                           if ''.join(c['source']).startswith(heading('Data', 'Datos')))
        prefix.insert(setup_index, setup_cell)
        # Original step instructions described removed code. Keep section prose only.
        prefix = [c for c in prefix if c['cell_type'] == 'code' or
                  ''.join(c['source']).startswith(('#', '```'))]
    else:
        prefix = cells[:result_index]
        if level == 3 and topic == '02-flotation':
            first_method = next(c for c in prefix[method_index + 1:] if c['cell_type'] == 'code')
            first_method['source'] = """# Fit the named kinetic models afresh on the common exact circuit response.
from pipeline.cases.catalog import CASE_BY_ID
from pipeline.engine.circuit import simulate
from pipeline.engine.kinetics import kinetic_record
case = CASE_BY_ID['copper_molybdenum']
result = simulate(case.ore, case.plant, case.nominal)
kinetics = kinetic_record(result.flotation, result.ore, case.nominal.rougher_cells,
                         result.metrics['rougher_recovery_pct'])
models = kinetics['models']
print('Fitted models:', len(models))""".splitlines(keepends=True)
        interpreted = []
        plots_seen = 0
        for c in prefix:
            interpreted.append(c)
            source = ''.join(c['source'])
            if c['cell_type'] == 'code' and ('plt.subplots' in source):
                reading = pair(*BASE_READINGS[(topic, level)], lang)
                # Different figures receive a different interpretation rather than repeated generic captions.
                if plots_seen:
                    reading = pair(*BASE_READINGS[(topic, level)], lang) if topic == '01-comminution' else pair(
                        "The bank projection uses the fitted rate representation under mixed residence rather than replaying batch time. Separation of model predictions around the exact reference exposes projection bias that a batch fit can conceal. A model close to the reference on this bank has not been validated on a different cell geometry or ore. Preserve the residence assumptions when transferring a fitted kinetic form to another process calculation.",
                        "La proyección usa tasas ajustadas con residencia mezclada, en vez de repetir tiempo batch. La separación alrededor de la referencia exacta expone sesgo oculto por el ajuste temporal. Acertar en este banco no valida otro mineral o geometría. Conserva supuestos de residencia al transferir una forma cinética a otro cálculo de proceso.", lang)
                interpreted.append(md(reading))
                plots_seen += 1
        prefix = interpreted
    steps = {'01-comminution': comminution_steps, '02-flotation': flotation_steps,
             '03-learning': learning_steps, '04-optimization': optimization_steps,
             '05-uncertainty': uncertainty_steps}[topic](lang, level)
    narratives = NARRATIVES.get((topic, level))
    if narratives:
        paragraphs = pair(*narratives, lang).split('\n\n')
        notes = [c for c in steps if c['cell_type'] == 'markdown']
        if len(notes) != len(paragraphs):
            raise ValueError((topic, level, len(notes), len(paragraphs)))
        for cell, text in zip(notes, paragraphs):
            cell['source'] = text.splitlines(keepends=True)
    if topic == '03-learning' and level == 2:
        for c in steps:
            if c['cell_type'] == 'code':
                source = ''.join(c['source'])
                source = source.replace("predictions[(name, 'Ore-group holdout')]", "predictions[(name, 'Case holdout')]")
                source = source.replace("predictions[(name, 'Grupo mineral reservado')]", "predictions[(name, 'Caso reservado')]")
                source = source.replace('Absent-ore-group predictions', 'Held-out-case predictions')
                source = source.replace('Predicciones del grupo ausente', 'Predicciones del caso reservado')
                if 'ax.scatter' in source:
                    source = source.replace('Ore-group holdout', 'Case holdout')
                    source = source.replace('Grupo mineral reservado', 'Caso reservado')
                c['source'] = source.splitlines(keepends=True)
    if (topic, level) in DISCUSSION:
        steps.append(md(pair(*DISCUSSION[(topic, level)], lang)))
    if topic == '04-optimization' and level == 4:
        # The archived cohort is context, calculated from committed records separately from the fresh pair.
        step(steps, lang,
             "Aggregate the archived 72-pair cohort separately from the fresh magnetite experiment. These counts describe the earlier fixed release settings, so they neither train a new screen nor replace today's paired searches. Keeping the cohorts separate prevents a small tutorial result from being presented as the full multi-case benchmark.",
             "Agrega por separado la cohorte archivada de 72 parejas. Los conteos describen ajustes fijos de la versión anterior: no entrenan otro filtro ni reemplazan las búsquedas actuales. Separar cohortes evita presentar un resultado didáctico pequeño como benchmark completo de varios casos.",
             """archive_counts = []
for path in sorted((repo / 'data/derived/cases').glob('*.json')):
    artifact = json.loads(path.read_text(encoding='utf-8'))
    for variant in artifact['variants']:
        result = variant['methods']['optimization']
        if result.get('screened') and 'without_screen' in result:
            archive_counts.append((result['evaluations'], result['without_screen']['evaluations']))
if not archive_counts:
    raise RuntimeError('Missing archived paired optimization records')
archive = np.asarray(archive_counts)
print('Archived pairs:', len(archive))
print('Archived screened total:', int(archive[:, 0].sum()))
print('Archived unscreened total:', int(archive[:, 1].sum()))
print('Archived additional evaluations:', int((archive[:, 0] - archive[:, 1]).sum()))"""
        )
    suffix = cells[result_index:]
    summary_code, answer = result_contract(topic, level, lang)
    suffix[0] = md(heading('Results', 'Resultados') + '\n\n' +
                   pair('**Answer:** ', '**Respuesta:** ', lang) + answer)
    summary = code(pair('# Summarize the computed outcomes used in this lesson\'s interpretation.\n',
                        '# Resumir las salidas calculadas que sostienen la interpretación de esta lección.\n', lang)
                   + summary_code)
    summary['metadata'] = {'tags': ['answer-values']}
    suffix.insert(1, summary)
    notebook['cells'] = prefix + steps + suffix
    if lang == 'es' and topic == '05-uncertainty' and level > 1:
        setup = next(c for c in notebook['cells'] if c['cell_type'] == 'code')
        source = ''.join(setup['source']) + """
# Separa los nombres físicos de presentación de los identificadores de la API.
factor_labels = {
    'work_index': 'Índice de trabajo', 'head_grade': 'Ley de cabeza',
    'liberation_size': 'Tamaño de liberación', 'floatability': 'Flotabilidad',
}
"""
        setup['source'] = source.splitlines(keepends=True)
    opening = ''.join(notebook['cells'][0]['source']).rstrip() + '\n\n'
    if 'Level:' not in opening and 'Nivel:' not in opening:
        opening += pair(f'Level: {level}. Prerequisites: earlier lessons in this topic. Reading time: 30 minutes.\n\n',
                        f'Nivel: {level}. Requisitos previos: lecciones anteriores del tema. Lectura: 30 minutos.\n\n', lang)
    opening = re.sub(r'\*\*(?:Question|Pregunta):\*\*[^\n]*\n*', '', opening)
    question = pair(*QUESTIONS[topic][level - 1], lang)
    marker = pair('**Question:**', '**Pregunta:**', lang)
    notebook['cells'][0]['source'] = opening.replace('\n\n', f'\n\n{marker} {question}\n\n', 1).splitlines(keepends=True)
    for c in notebook['cells']:
        if c['cell_type'] == 'code':
            source = ''.join(c['source']).replace('collector_g_t', 'collector_gpt')
            c['source'] = source.splitlines(keepends=True)
    # Only Setup receives an import explanation; numeric summaries describe their own computation.
    for i in range(len(notebook['cells']) - 1, -1, -1):
        c = notebook['cells'][i]
        if c['cell_type'] == 'code' and i and ''.join(notebook['cells'][i - 1]['source']).startswith('## '):
            if 'answer-values' in c.get('metadata', {}).get('tags', []):
                note = summary_explanation(topic, level, lang)
            else:
                note = pair('Import the pinned analysis tools once and resolve inputs relative to the notebook folder.',
                            'Importar las herramientas fijadas y resolver las entradas relativas a la carpeta del notebook.', lang)
            notebook['cells'].insert(i, md(note))
    review_fixes(notebook)
    for index, c in enumerate(notebook['cells'], 1):
        c['id'] = f'lesson-{index:03d}'
    if topic == '03-learning' and level == 3:
        released_learning_challenge(notebook)
    readable_figures(notebook)
    final_output_fixes(notebook)
    finalize(notebook)
    return notebook



def finalize(notebook):
    """Format authored code, restore useful comments and keep language scopes identical."""
    import subprocess
    import sys
    import textwrap
    lang = notebook['metadata']['caos']['language']
    for index, cell in enumerate(notebook['cells']):
        if cell['cell_type'] != 'code':
            continue
        source = ''.join(cell['source'])
        if lang == 'es':
            from build_didactic_notebooks import spanish_code
            comments = [line.lstrip('# ') for line in source.splitlines() if line.lstrip().startswith('#')]
            source = spanish_code(source)
            prior = ''.join(notebook['cells'][index - 1]['source'])
            english = ('Import ', 'Load ', 'Record ', 'Fit ', 'Run ', 'Summarize ', 'Resolve ', 'Re-run ',
                       'Evaluate ', 'Separate ', 'Collect ', 'Audit ', 'Preserve ', 'Qualify ',
                       'Interpret ', 'Identify ', 'Count ', 'Compare ', 'Plot ', 'Keep ', 'Overlay ')
            if comments and not comments[0].startswith(english):
                comment = comments[0]
            else:
                comment = prior.split('. ')[0].replace('\n', ' ').lstrip('# ')
            comment = formal_copy(comment, lang)
            source = '\n'.join('# ' + line for line in textwrap.wrap(comment, 97)) + '\n' + source
        else:
            comments = [line for line in source.splitlines() if line.lstrip().startswith('#')]
            source = ast.unparse(ast.parse(source))
            comment = comments[0].lstrip('# ') if comments else 'Execute the method explained immediately above.'
            source = '\n'.join('# ' + line for line in textwrap.wrap(comment, 97)) + '\n' + source
        formatted = subprocess.run([sys.executable, '-m', 'ruff', 'format', '--config', 'line-length=100',
                                    '--stdin-filename', 'lesson.py', '-'], input=source,
                                   text=True, encoding='utf-8', capture_output=True, check=True)
        cell['source'] = formatted.stdout.splitlines(keepends=True)


def result_contract(topic, level, lang):
    """An explicit computed summary and authored prose, with persistent numeric bindings."""
    def value(label):
        localized = LABELS_ES.get(label, label) if lang == 'es' else label
        return f'<!-- result:{localized} -->0<!-- /result -->'

    if topic == '01-comminution':
        program = """answer_values = {
    'Nominal P80 (µm)': nominal.grinding.p80_um,
    'Requested fine P80 (µm)': fine_point.target_p80_um,
    'Achieved fine P80 (µm)': fine.grinding.p80_um,
    'Fine required power (kW)': fine.grinding.required_power_kw,
    'Bond work (kWh/t)': at_product['bond'][0],
    'Rittinger work (kWh/t)': at_product['rittinger'][0],
    'Kick work (kWh/t)': at_product['kick'][0],
}"""
        en = (f"The nominal achieved P80 is {value('Nominal P80 (µm)')} µm. Requesting "
              f"{value('Requested fine P80 (µm)')} µm yields {value('Achieved fine P80 (µm)')} µm "
              f"and requires {value('Fine required power (kW)')} kW. ")
        es = (f"El P80 nominal alcanzado es {value('Nominal P80 (µm)')} µm. Solicitar "
              f"{value('Requested fine P80 (µm)')} µm produce {value('Achieved fine P80 (µm)')} µm "
              f"y requiere {value('Fine required power (kW)')} kW. ")
        if level > 1:
            en += (f"At the same nominal endpoints Bond, Rittinger and Kick require "
                   f"{value('Bond work (kWh/t)')}, {value('Rittinger work (kWh/t)')} and "
                   f"{value('Kick work (kWh/t)')} kWh/t respectively. Their common calibration does not "
                   "make the reduction hypotheses equivalent across the plotted size domain.")
            es += (f"Con los mismos extremos nominales Bond, Rittinger y Kick requieren "
                   f"{value('Bond work (kWh/t)')}, {value('Rittinger work (kWh/t)')} y "
                   f"{value('Kick work (kWh/t)')} kWh/t. Su calibración común no vuelve equivalentes "
                   "las hipótesis en todo el dominio de tamaños graficado.")
    elif topic == '02-flotation':
        program = """kinetic_by_name = {model['id']: model for model in fits['models']}
answer_values = {
    'Short-bank overall recovery (%)': short.metrics['rougher_recovery_pct'],
    'Short-bank true recovery (%)': short_fits['bank']['exact_true_flotation_pct'],
    'First-order batch RMSE (pp)': kinetic_by_name['first_order']['rmse_pct'],
    'Kelsall batch RMSE (pp)': kinetic_by_name['kelsall']['rmse_pct'],
    'First-order bank error (pp)': abs(kinetic_by_name['first_order']['lumping_error_pct']),
    'Kelsall bank error (pp)': abs(kinetic_by_name['kelsall']['lumping_error_pct']),
}"""
        en = (f"The shortened bank gives overall recovery {value('Short-bank overall recovery (%)')} percent "
              f"and true-flotation recovery {value('Short-bank true recovery (%)')} percent. "
              "They differ because the process total includes mechanisms outside the true-flotation kinetic reference. ")
        es = (f"El banco corto entrega recuperación global {value('Short-bank overall recovery (%)')} por ciento "
              f"y flotación verdadera {value('Short-bank true recovery (%)')} por ciento. "
              "Difieren porque el total incluye mecanismos externos a la referencia cinética de flotación verdadera. ")
        if level > 1:
            en += (f"First-order and Kelsall batch RMSE are {value('First-order batch RMSE (pp)')} and "
                   f"{value('Kelsall batch RMSE (pp)')} pp, versus bank errors "
                   f"{value('First-order bank error (pp)')} and {value('Kelsall bank error (pp)')} pp. "
                   "A small fit residual is therefore separate from projection accuracy.")
            es += (f"RMSE batch de primer orden y Kelsall: {value('First-order batch RMSE (pp)')} y "
                   f"{value('Kelsall batch RMSE (pp)')} pp; errores de banco: "
                   f"{value('First-order bank error (pp)')} y {value('Kelsall bank error (pp)')} pp. "
                   "Un residuo pequeño es distinto de precisión al proyectar.")
    elif topic == '03-learning':
        program = """score_by_key = {(row['Model'], row['Protocol']): row for row in scores}
answer_values = {
    'Design rows': len(x),
    'Ridge interpolation RMSE (pp)': score_by_key[('Ridge', 'Interpolation')]['RMSE (pp)'],
}"""
        en = (f"Ridge interpolation RMSE is {value('Ridge interpolation RMSE (pp)')} pp on "
              f"{value('Design rows')} freshly simulated states. ")
        es = (f"El RMSE interpolado de Ridge es {value('Ridge interpolation RMSE (pp)')} pp en "
              f"{value('Design rows')} estados recién simulados. ")
        if level > 1:
            program += """
answer_values.update({
    'Ridge case RMSE (pp)': score_by_key[('Ridge', 'Case holdout')]['RMSE (pp)'],
    'Forest case RMSE (pp)': score_by_key[('Random forest', 'Case holdout')]['RMSE (pp)'],
})"""
            en += (f"With soft porphyry absent, Ridge and random-forest RMSE are "
                   f"{value('Ridge case RMSE (pp)')} and {value('Forest case RMSE (pp)')} pp. ")
            es += (f"Al faltar pórfido blando, Ridge y bosque tienen RMSE "
                   f"{value('Ridge case RMSE (pp)')} y {value('Forest case RMSE (pp)')} pp. ")
        if level == 3:
            program += """
answer_values.update({
    'GP case RMSE (pp)': score_by_key[('Gaussian process', 'Case holdout')]['RMSE (pp)'],
    'GP group RMSE (pp)': score_by_key[('Gaussian process', 'Ore-group holdout')]['RMSE (pp)'],
    'GP group R2': score_by_key[('Gaussian process', 'Ore-group holdout')]['R2'],
    'Negative group R2 models': sum(row['R2'] < 0 for row in scores if row['Protocol'] == 'Ore-group holdout'),
})"""
            en += (f"The fixed-kernel GP has case/group RMSE {value('GP case RMSE (pp)')}/"
                   f"{value('GP group RMSE (pp)')} pp and group R² {value('GP group R2')}. "
                   f"{value('Negative group R2 models')} estimators have negative group R². "
                   "The holdout question changes the ranking on these authored circuits, without establishing plant transfer.")
            es += (f"El proceso gaussiano fijo tiene RMSE de caso/grupo {value('GP case RMSE (pp)')}/"
                   f"{value('GP group RMSE (pp)')} pp y R² de grupo {value('GP group R2')}. "
                   f"{value('Negative group R2 models')} estimadores tienen R² de grupo negativo. "
                   "La reserva cambia el orden en estos circuitos, sin establecer transferencia de planta.")
        elif level == 2:
            en += 'Hard porphyry remains in training, so this is a near-neighbour test rather than a whole-ore-group claim.'
            es += 'El pórfido duro sigue en entrenamiento: es prueba de un vecino, sin afirmar transferencia de grupo completo.'
        else:
            en += 'All cases are represented in training. This first fit establishes label provenance and interpolation only.'
            es += 'Todos los casos están representados al entrenar. El primer ajuste establece procedencia e interpolación.'
    elif topic == '04-optimization':
        program = """answer_values = {
    'Unscreened count': plain['evaluations'],
    'Selected recovery (%)': plain_check.metrics['recovery_pct'],
    'Selected energy (kWh/t)': plain_check.metrics['specific_energy_total_kwh_t'],
    'Selected P80 (µm)': plain_point.target_p80_um,
}"""
        en = (f"The equal-weight search selects P80 {value('Selected P80 (µm)')} µm with checked recovery "
              f"{value('Selected recovery (%)')} percent and energy {value('Selected energy (kWh/t)')} kWh/t "
              f"after {value('Unscreened count')} exact candidate evaluations. ")
        es = (f"La búsqueda de pesos iguales elige P80 {value('Selected P80 (µm)')} µm con recuperación "
              f"{value('Selected recovery (%)')} por ciento y energía {value('Selected energy (kWh/t)')} kWh/t "
              f"tras {value('Unscreened count')} evaluaciones exactas de candidatos. ")
        if level == 2:
            program += """
answer_values.update({
    'Metal-only recovered (t/h)': metal_end['recovered_tph'],
    'Energy-only recovered (t/h)': energy_end['recovered_tph'],
})"""
            en += (f"Metal-only and energy-only preferences recover {value('Metal-only recovered (t/h)')} and "
                   f"{value('Energy-only recovered (t/h)')} t/h. Compare the accompanying energy coordinates and slacks.")
            es += (f"Preferir solo metal o energía recupera {value('Metal-only recovered (t/h)')} y "
                   f"{value('Energy-only recovered (t/h)')} t/h. Compara además coordenadas energéticas y holguras.")
        if level >= 3:
            program += """
answer_values.update({
    'Screened count': screened['evaluations'],
    'Additional count': screened['evaluations'] - plain['evaluations'],
    'Proposal count': len(proposals),
})"""
            en += (f"Screening uses {value('Screened count')} evaluations and {value('Proposal count')} proposals, "
                   f"a signed increase of {value('Additional count')} evaluations. Positive means extra work. ")
            es += (f"El filtro usa {value('Screened count')} evaluaciones y {value('Proposal count')} propuestas, "
                   f"un aumento con signo de {value('Additional count')}. Un valor positivo significa trabajo adicional. ")
        if level == 4:
            program += """
answer_values.update({
    'Archived pair count': len(archive),
    'Archived extra count': int((archive[:, 0] - archive[:, 1]).sum()),
})"""
            en += (f"Separately, {value('Archived pair count')} archived pairs add {value('Archived extra count')} "
                   "evaluations under their own settings. Neither cohort supports a saving in the observed run.")
            es += (f"Por separado, {value('Archived pair count')} parejas archivadas añaden "
                   f"{value('Archived extra count')} evaluaciones con sus ajustes. Ninguna cohorte apoya ahorro en esta corrida.")
    else:
        program = """answer_values = {
    'Recovery P05 (%)': experiment['outputs']['recovery_pct']['p05'],
    'Recovery P95 (%)': experiment['outputs']['recovery_pct']['p95'],
    'Solved count': len(experiment['solved']),
    'Refused count': sum(experiment['refused'].values()),
    'Joint feasibility (1)': experiment['probabilities']['all_constraints'],
}"""
        en = (f"The {value('Solved count')} solved draws span empirical recovery P05/P95 "
              f"{value('Recovery P05 (%)')}/{value('Recovery P95 (%)')} percent, with "
              f"{value('Refused count')} refusals and joint feasibility {value('Joint feasibility (1)')}. ")
        es = (f"Los {value('Solved count')} sorteos resueltos tienen P05/P95 de recuperación "
              f"{value('Recovery P05 (%)')}/{value('Recovery P95 (%)')} por ciento, con "
              f"{value('Refused count')} rechazos y factibilidad conjunta {value('Joint feasibility (1)')}. ")
        if level > 1:
            program += """
order_small = sorted(small_indices['inputs'], key=small_indices['indices']['recovery_pct']['ST'].get)
order_large = sorted(larger_indices['inputs'], key=larger_indices['indices']['recovery_pct']['ST'].get)
answer_values.update({
    'Same total-effect order (1=yes)': int(order_small == order_large),
    'Largest total-effect half-width (1)': max(larger_indices['indices']['recovery_pct']['ST_conf'].values()),
})"""
            en += (f"Doubling Sobol base N from 8 to 16 gives order agreement "
                   f"{value('Same total-effect order (1=yes)')} (1=yes) and largest N=16 total-effect half-width "
                   f"{value('Largest total-effect half-width (1)')}. This exploratory design does not establish a stable plant ranking.")
            es += (f"Duplicar la base Sobol de 8 a 16 da acuerdo de orden "
                   f"{value('Same total-effect order (1=yes)')} (1=sí) y máxima semiamplitud total de N=16 "
                   f"{value('Largest total-effect half-width (1)')}. El diseño exploratorio no establece un orden estable de planta.")
    # Each answer addresses its own curriculum question rather than repeating a topic-wide conclusion.
    interpretations = {
    ('01-comminution', 1): (
        f"Requesting {value('Requested fine P80 (µm)')} µm produces an achieved grind of "
        f"{value('Achieved fine P80 (µm)')} µm, compared with nominal {value('Nominal P80 (µm)')} µm. "
        f"The fine request requires {value('Fine required power (kW)')} kW. The solved recycle circuit, "
        "rather than the requested input alone, determines whether that product is reached.",
        f"Solicitar {value('Requested fine P80 (µm)')} µm produce molienda alcanzada "
        f"{value('Achieved fine P80 (µm)')} µm frente a {value('Nominal P80 (µm)')} µm nominales. "
        f"La solicitud fina requiere {value('Fine required power (kW)')} kW. Es el circuito resuelto "
        "con recirculación, y no la entrada solicitada por sí sola, el que determina alcanzar ese producto."),
    ('01-comminution', 2): (
        f"The finer-product circuit requires {value('Fine required power (kW)')} kW and reaches "
        f"{value('Achieved fine P80 (µm)')} µm after solving classification and recycle. At nominal endpoints "
        f"the diagnostic work values are Bond {value('Bond work (kWh/t)')}, Rittinger "
        f"{value('Rittinger work (kWh/t)')} and Kick {value('Kick work (kWh/t)')} kWh/t. They are alternative "
        "requirements, while the partition and achieved-size results explain the physical circuit response.",
        f"El circuito fino requiere {value('Fine required power (kW)')} kW y alcanza "
        f"{value('Achieved fine P80 (µm)')} µm tras resolver clasificación y recirculación. Con extremos "
        f"nominales los trabajos diagnósticos son Bond {value('Bond work (kWh/t)')}, Rittinger "
        f"{value('Rittinger work (kWh/t)')} y Kick {value('Kick work (kWh/t)')} kWh/t. Son requerimientos "
        "alternativos; partición y tamaño alcanzado explican la respuesta física del circuito."),
    ('01-comminution', 3): (
        f"For the same nominal feed/product pair, Bond predicts {value('Bond work (kWh/t)')} kWh/t, "
        f"Rittinger {value('Rittinger work (kWh/t)')} and Kick {value('Kick work (kWh/t)')}. The common "
        "reference equality is imposed by calibration; the size-sweep figure shows the hypotheses diverging "
        "elsewhere. That disagreement is an equation comparison on authored ore, without measured-energy validation.",
        f"Con el mismo par alimentación/producto nominal, Bond predice {value('Bond work (kWh/t)')} kWh/t, "
        f"Rittinger {value('Rittinger work (kWh/t)')} y Kick {value('Kick work (kWh/t)')}. La igualdad de "
        "referencia se impone al calibrar; el barrido muestra divergencia fuera de ella. Se comparan ecuaciones "
        "en mineral de autoría, sin validación contra energía medida."),
    ('02-flotation', 1): (
        f"Removing one cell leaves overall rougher recovery {value('Short-bank overall recovery (%)')} "
        f"percent and a true-flotation reference of {value('Short-bank true recovery (%)')} percent. "
        "Batch exposure and continuous-bank residence therefore remain distinct calculations; entrainment "
        "also separates overall recovery from the kinetic reference.",
        f"Retirar una celda deja recuperación rougher global {value('Short-bank overall recovery (%)')} "
        f"por ciento y referencia de flotación verdadera {value('Short-bank true recovery (%)')} por ciento. "
        "Exposición batch y residencia continua siguen siendo cálculos distintos; el arrastre separa "
        "además recuperación global y referencia cinética."),
    ('02-flotation', 2): (
        f"The nominal first-order fit has batch RMSE {value('First-order batch RMSE (pp)')} pp, compared "
        f"with Kelsall {value('Kelsall batch RMSE (pp)')} pp. Their bank errors are "
        f"{value('First-order bank error (pp)')} and {value('Kelsall bank error (pp)')} pp. The separately "
        "recomputed dose-change panel shows why reagent response must be fitted and projected again, "
        "rather than inferred from the original batch rank.",
        f"El ajuste nominal de primer orden tiene RMSE batch {value('First-order batch RMSE (pp)')} pp "
        f"frente a {value('Kelsall batch RMSE (pp)')} pp de Kelsall; sus errores de banco son "
        f"{value('First-order bank error (pp)')} y {value('Kelsall bank error (pp)')} pp. El panel "
        "recalculado de dosis muestra por qué hay que reajustar y proyectar la respuesta al reactivo, "
        "sin inferirla del orden batch inicial."),
    ('02-flotation', 3): (
        f"Kelsall compresses the nominal batch response to RMSE {value('Kelsall batch RMSE (pp)')} pp "
        f"but still has bank projection error {value('Kelsall bank error (pp)')} pp. First-order bank "
        f"error is {value('First-order bank error (pp)')} pp. The fresh model fits and shortened-bank "
        f"reference {value('Short-bank true recovery (%)')} percent expose the distinction between "
        "curve fitting and preserving a mixed-residence prediction.",
        f"Kelsall comprime la respuesta batch nominal a RMSE {value('Kelsall batch RMSE (pp)')} pp "
        f"y conserva error de proyección {value('Kelsall bank error (pp)')} pp. El error de banco de "
        f"primer orden es {value('First-order bank error (pp)')} pp. Los ajustes nuevos y la referencia "
        f"del banco corto {value('Short-bank true recovery (%)')} por ciento distinguen ajustar una "
        "curva y conservar la predicción de residencia mezclada."),
    ('03-learning', 1): (
        f"A scaled Ridge model predicts recovery on {value('Design rows')} simulator states with "
        f"interpolation RMSE {value('Ridge interpolation RMSE (pp)')} pp. The circuit probes show "
        "where physical labels originate; training contains every case, so this introductory result "
        "does not test an absent ore.",
        f"Ridge escalado predice recuperación sobre {value('Design rows')} estados del simulador "
        f"con RMSE interpolado {value('Ridge interpolation RMSE (pp)')} pp. Las resoluciones muestran "
        "procedencia física de etiquetas; entrenamiento contiene cada caso y el resultado inicial "
        "no prueba un mineral ausente."),
    ('03-learning', 2): (
        f"When soft porphyry is withheld, Ridge RMSE is {value('Ridge case RMSE (pp)')} pp and "
        f"random forest {value('Forest case RMSE (pp)')} pp, compared with Ridge interpolation "
        f"{value('Ridge interpolation RMSE (pp)')} pp. Holding out a complete case changes the "
        "prediction question even with the same design size. Hard porphyry remains available, "
        "so the result describes near-neighbour transfer.",
        f"Al reservar pórfido blando, Ridge tiene RMSE {value('Ridge case RMSE (pp)')} pp y bosque "
        f"{value('Forest case RMSE (pp)')} pp, frente a {value('Ridge interpolation RMSE (pp)')} pp "
        "interpolados de Ridge. Retirar un caso completo cambia la pregunta aun con igual tamaño "
        "del diseño. Como sigue disponible pórfido duro, se describe transferencia a un vecino."),
    ('03-learning', 3): (
        f"The fixed-kernel GP's case/group errors are {value('GP case RMSE (pp)')}/"
        f"{value('GP group RMSE (pp)')} pp and its group R² is {value('GP group R2')}. "
        f"{value('Negative group R2 models')} estimators have negative group R² in the computed "
        "comparison. The four-model figures retain these transfer failures and compare each "
        "protocol on common rows with training-only transforms; none establishes prediction on a measured plant.",
        f"El proceso gaussiano fijo tiene errores de caso/grupo {value('GP case RMSE (pp)')}/"
        f"{value('GP group RMSE (pp)')} pp y R² de grupo {value('GP group R2')}. "
        f"{value('Negative group R2 models')} estimadores tienen R² de grupo negativo. Las figuras "
        "conservan fallas de transferencia y comparan protocolos con filas comunes y transformaciones "
        "solo de entrenamiento; ninguno establece predicción sobre una planta medida."),
    ('04-optimization', 1): (
        f"The production search returns target {value('Selected P80 (µm)')} µm after "
        f"{value('Unscreened count')} exact candidate evaluations. A separate engine solve gives "
        f"recovery {value('Selected recovery (%)')} percent and energy {value('Selected energy (kWh/t)')} "
        "kWh/t. The printed slacks and stop reasons qualify that feasible setting rather than proving a global optimum.",
        f"La búsqueda devuelve objetivo {value('Selected P80 (µm)')} µm tras "
        f"{value('Unscreened count')} evaluaciones exactas. Una resolución separada da recuperación "
        f"{value('Selected recovery (%)')} por ciento y energía {value('Selected energy (kWh/t)')} kWh/t. "
        "Holguras y detención califican la configuración factible sin probar óptimo global."),
    ('04-optimization', 2): (
        f"Metal-only and energy-only preferences recover {value('Metal-only recovered (t/h)')} "
        f"and {value('Energy-only recovered (t/h)')} t/h under common constraints. The equal-weight "
        f"setting uses {value('Selected energy (kWh/t)')} kWh/t and reaches "
        f"{value('Selected recovery (%)')} percent recovery. The plotted endpoints and "
        "progressive-barrier history expose physical preferences and stopping behaviour without assigning economic values.",
        f"Preferir solo metal o energía recupera {value('Metal-only recovered (t/h)')} y "
        f"{value('Energy-only recovered (t/h)')} t/h con restricciones comunes. La configuración "
        f"intermedia usa {value('Selected energy (kWh/t)')} kWh/t y alcanza "
        f"{value('Selected recovery (%)')} por ciento. Extremos y barrera muestran preferencias "
        "físicas y detención sin asignar precios ni valor económico a los compromisos calculados."),
    ('04-optimization', 3): (
        f"The screened search spends {value('Screened count')} exact evaluations against "
        f"{value('Unscreened count')} for its identical unscreened reference, a signed cost "
        f"difference of {value('Additional count')}. Positive is additional engine work. "
        f"The independently checked reference recovery is {value('Selected recovery (%)')} percent; "
        "cost and terminal physical agreement are separate findings.",
        f"Con filtro se gastan {value('Screened count')} evaluaciones exactas frente a "
        f"{value('Unscreened count')} sin filtro, diferencia con signo {value('Additional count')}. "
        "Un valor positivo es trabajo adicional. La recuperación de referencia revisada es "
        f"{value('Selected recovery (%)')} por ciento; costo y acuerdo físico terminal son hallazgos separados."),
    ('04-optimization', 4): (
        f"Fresh searches use {value('Screened count')} versus {value('Unscreened count')} evaluations "
        f"with {value('Proposal count')} learned proposals, adding {value('Additional count')} engine calls. "
        f"The separate {value('Archived pair count')}-pair archive adds {value('Archived extra count')} "
        "calls under its recorded settings. Proposal residuals explain prediction behaviour, while complete "
        "paired counts supply the observed negative saving result.",
        f"Las búsquedas nuevas usan {value('Screened count')} frente a {value('Unscreened count')} "
        f"evaluaciones y {value('Proposal count')} propuestas, añadiendo {value('Additional count')} llamadas. "
        f"El archivo separado de {value('Archived pair count')} parejas añade {value('Archived extra count')} "
        "con sus ajustes. Los residuos explican predicción; los conteos completos entregan el resultado "
        "negativo de ahorro observado."),
    ('05-uncertainty', 1): (
        f"Empirical recovery P05/P95 is {value('Recovery P05 (%)')}/{value('Recovery P95 (%)')} "
        f"percent over {value('Solved count')} solved Latin-hypercube draws. Joint feasibility "
        f"is {value('Joint feasibility (1)')} with {value('Refused count')} refusals counted separately. "
        "This is a conditional distribution under authored ore ranges rather than a mine frequency forecast.",
        f"P05/P95 empírico de recuperación es {value('Recovery P05 (%)')}/{value('Recovery P95 (%)')} "
        f"por ciento en {value('Solved count')} sorteos resueltos. La factibilidad conjunta es "
        f"{value('Joint feasibility (1)')} con {value('Refused count')} rechazos separados. Es una "
        "distribución condicionada por rangos de autoría, no un pronóstico de frecuencias de mina."),
    ('05-uncertainty', 2): (
        f"The output interval {value('Recovery P05 (%)')} to {value('Recovery P95 (%)')} percent "
        f"uses {value('Solved count')} solved recoveries, while feasibility "
        f"{value('Joint feasibility (1)')} includes all attempts and {value('Refused count')} refusals. "
        f"The larger Sobol design still has maximum total-effect half-width "
        f"{value('Largest total-effect half-width (1)')}, so a neat point-estimate ordering alone "
        "cannot certify sensitivity stability.",
        f"El intervalo {value('Recovery P05 (%)')} a {value('Recovery P95 (%)')} por ciento usa "
        f"{value('Solved count')} recuperaciones resueltas; factibilidad "
        f"{value('Joint feasibility (1)')} incluye intentos y {value('Refused count')} rechazos. "
        f"El diseño Sobol mayor conserva semiamplitud máxima {value('Largest total-effect half-width (1)')}; "
        "un orden puntual prolijo no certifica estabilidad de sensibilidad."),
    ('05-uncertainty', 3): (
        f"N=8 versus N=16 total-effect order agreement is {value('Same total-effect order (1=yes)')} "
        f"(1=yes), with largest N=16 bootstrap half-width {value('Largest total-effect half-width (1)')}. "
        "The exploratory factor ranking must be read with those intervals and the full first/total-effect "
        "table. Doubling this small design does not remove structural uncertainty or establish plant causality.",
        f"El acuerdo de orden total entre N=8 y N=16 es {value('Same total-effect order (1=yes)')} "
        f"(1=sí), con máxima semiamplitud bootstrap de N=16 {value('Largest total-effect half-width (1)')}. "
        "Lee el orden exploratorio junto a intervalos y tabla completa de efectos. Duplicar este diseño "
        "pequeño no elimina incertidumbre estructural ni establece causalidad de planta."),
    }
    en, es = interpretations[(topic, level)]
    if topic == '03-learning' and level == 3:
        program = program.replace("    'Design rows': len(x),\n", '')
        program = program.replace("    'Ridge interpolation RMSE (pp)': score_by_key[('Ridge', 'Interpolation')]['RMSE (pp)'],\n", '')
    program += "\nanswer_values = {label: round(float(number), 3) for label, number in answer_values.items()}"
    program += "\nprint(json.dumps(answer_values, ensure_ascii=False))"
    return program, pair(en, es, lang)


def summary_explanation(topic, level, lang):
    details = {
        ('01-comminution', 1): ('Collect achieved nominal/fine grind and required power from the solved circuit for the grind-target answer.', 'Resumir molienda nominal y fina alcanzadas y potencia requerida desde el circuito resuelto para responder sobre el objetivo.'),
        ('01-comminution', 2): ('Summarize the fine-product power demand and alternative nominal work requirements on their stated mill-feed basis.', 'Resumir demanda de potencia fina y trabajos nominales alternativos sobre la base de alimentación declarada al molino.'),
        ('01-comminution', 3): ('Bind the physical mill-endpoint law values separately from the exact reference-calibration table above.', 'Vincular valores de leyes en extremos físicos del molino por separado de la tabla de calibración exacta anterior.'),
        ('02-flotation', 1): ('Collect short-bank overall/true recovery alongside nominal kinetic errors for the residence interpretation.', 'Resumir recuperación global y verdadera del banco corto junto a errores nominales para interpretar residencia.'),
        ('02-flotation', 2): ('Combine the matched nominal and increased-dose recovery/error calculations for the quantitative reagent-change answer.', 'Combinar recuperación y errores emparejados nominales y con dosis aumentada para responder cuantitativamente al cambio de reactivo.'),
        ('02-flotation', 3): ('Summarize changed-residence Kelsall errors with refitted versus frozen nominal parameters; the preceding table retains all five forms.', 'Resumir errores de Kelsall con residencia modificada y parámetros reajustados o congelados; la tabla anterior conserva cinco formas.'),
        ('03-learning', 1): ('Collect actual design, training and interpolation-test counts together with the Ridge recovery RMSE.', 'Resumir cantidades reales de diseño, entrenamiento y prueba interpolada junto al RMSE de recuperación de Ridge.'),
        ('03-learning', 2): ('Collect interpolation and whole-case recovery errors for the two fitted estimators, preserving the near-neighbour validation scope.', 'Resumir errores interpolados y de caso completo para ambos estimadores, conservando el alcance de validación entre vecinos.'),
        ('03-learning', 3): ('Collect computed case/group errors and negative group-R2 counts from the four actual reference fits.', 'Resumir errores de caso y grupo y conteos R2 negativos desde los cuatro ajustes de referencia reales.'),
        ('04-optimization', 1): ('Collect reported target, endpoint feasibility, convergence flag and exact candidate cost without inventing unavailable physical values.', 'Resumir objetivo informado, factibilidad, convergencia y costo exacto sin inventar valores físicos ausentes.'),
        ('04-optimization', 2): ('Summarize the equal-weight target and feasibility flags of all three preference endpoints after inspecting their status table.', 'Resumir objetivo intermedio e indicadores de factibilidad de las tres preferencias después de inspeccionar estados.'),
        ('04-optimization', 3): ('Collect paired exact counts and status-qualified normalized decision agreement from the separately calculated comparisons.', 'Resumir conteos pareados y acuerdo normalizado calificado por estado desde comparaciones calculadas por separado.'),
        ('04-optimization', 4): ('Bind fresh paired costs and decision validity alongside observed counts from the separately identified current cohort.', 'Vincular costos y validez de la pareja nueva junto a conteos observados de la cohorte actual identificada aparte.'),
        ('05-uncertainty', 1): ('Collect solved/refused counts, empirical recovery quantiles and joint all-attempt feasibility from the Latin hypercube.', 'Resumir resueltos, rechazos, cuantiles de recuperación y factibilidad sobre intentos del hipercubo latino.'),
        ('05-uncertainty', 2): ('Collect propagation denominators and the larger Sobol design half-width for the finite-budget interpretation.', 'Resumir denominadores de propagación y semiamplitud del diseño Sobol mayor para interpretar presupuesto finito.'),
        ('05-uncertainty', 3): ('Bind computed total-effect rank agreement and bootstrap width after comparing the N8 and N16 designs.', 'Vincular acuerdo de orden total y semiamplitud calculados después de comparar diseños N8 y N16.'),
    }
    return pair(*details[(topic, level)], lang)


def review_fixes(notebook):
    """Apply the independently requested scientific and presentation corrections before formatting."""
    lang = notebook['metadata']['caos']['language']
    topic = notebook['metadata']['caos']['topic']
    level = notebook['metadata']['caos']['level']
    cells = notebook['cells']

    def source(cell):
        return ''.join(cell['source'])

    def find(token):
        return next(i for i, cell in enumerate(cells) if cell['cell_type'] == 'code' and token in source(cell))

    def replace_code(token, program, en, es):
        i = find(token)
        cells[i]['source'] = program.splitlines(keepends=True)
        cells[i - 1]['source'] = pair(en, es, lang).splitlines(keepends=True)
        return i

    def add_before_results(additions):
        i = next(i for i, cell in enumerate(cells) if source(cell).startswith(('## Results', '## Resultados')))
        cells[i:i] = additions

    def result_text(en, es):
        i = next(i for i, cell in enumerate(cells) if source(cell).startswith(('## Results', '## Resultados')))
        cells[i]['source'] = (pair('## Results\n\n**Answer:** ', '## Resultados\n\n**Respuesta:** ', lang)
                              + pair(en, es, lang)).splitlines(keepends=True)

    def bound(label):
        label = LABELS_ES.get(label, label) if lang == 'es' else label
        return f'<!-- result:{label} -->0<!-- /result -->'

    def summary_extra(program):
        cell = next(c for c in cells if 'answer-values' in c.get('metadata', {}).get('tags', []))
        text = source(cell)
        marker = '\nanswer_values = {label: round(float(number), 3) for label, number in answer_values.items()}'
        if marker not in text:
            raise ValueError('Missing numeric summary boundary')
        cell['source'] = text.replace(marker, '\n' + program + marker).splitlines(keepends=True)

    if topic == '01-comminution' and level == 1:
        i = find('psd[stream]')
        program = source(cells[i]).replace('psd[stream]', '100.0 * np.asarray(psd[stream])')
        program = re.sub(r'ax\.set_xlim\([^\n]*\)',
                         "ax.set_xlim(max(1.0, float(size.min())), float(size.max()))", program)
        cells[i]['source'] = program.splitlines(keepends=True)
        cells[i + 1]['source'] = pair(
            'The cumulative arrays returned by the engine are fractions. Multiplication by 100 places every stream on the labelled percent scale, with 80% interpreted on the same basis. The displayed size domain spans the actual grid, including the crusher-feed F80 crossing rather than clipping it below the feed percentile. Separation of the three curves describes size reduction within one mass-balanced circuit; it does not establish measured ore calibration.',
            'Las curvas acumuladas del motor son fracciones. Multiplicar por 100 permite interpretar el 80% sobre la escala porcentual indicada. El dominio abarca la malla real e incluye el cruce F80 de alimentación al triturador, sin recortarlo por debajo de ese percentil. La separación de curvas describe reducción de tamaño en un circuito balanceado; no establece calibración mineral medida.', lang).splitlines(keepends=True)

    if topic == '01-comminution' and level == 2:
        i = find('laws = law_curves')
        cells[i + 1]['source'] = pair(
            'The absolute energy curves hold mill-feed F80 and work index fixed while changing product size. Their vertical separation represents alternative reduction hypotheses in kWh/t, not additive pieces of a power balance. Unlike the classifier partition, these curves do not show stream fractions. Comparison with achieved P80 and required mill power is needed before an equation requirement can be treated as an attainable circuit state.',
            'Las curvas de energía absoluta mantienen F80 de alimentación al molino e índice de trabajo fijos mientras varía el producto. Su separación representa hipótesis alternativas en kWh/t, no componentes aditivos de potencia. A diferencia de la partición, no muestran fracciones de flujo. Comparar con P80 alcanzado y potencia requerida permite evaluar si el requerimiento corresponde a un estado realizable.', lang).splitlines(keepends=True)

    if topic == '01-comminution' and level == 3:
        replace_code('trace_record =', """# Resolve the physical mill endpoints independently of the calibration reduction.
from pipeline.cases.catalog import CASE_BY_ID
from pipeline.engine.circuit import simulate
from pipeline.engine.energy import law_curves, reference_constants
from pipeline.engine.constants import constant
case = CASE_BY_ID['copper_porphyry_soft']
nominal = simulate(case.ore, case.plant, case.nominal)
metrics = nominal.metrics
wi = case.nominal.work_index_kwh_t
f80 = nominal.grinding.feed_f80_um
print('Achieved mill F80 (µm):', round(f80, 3))
print('Achieved product P80 (µm):', round(nominal.grinding.p80_um, 3))""",
            'The physical comparison uses freshly achieved mill-feed F80 throughout. Crusher-feed F80 belongs to an upstream reduction and is not substituted into this mill calculation. The separately declared reference reduction determines the diagnostic constants but does not redefine the operating circuit.',
            'La comparación física usa F80 de alimentación al molino recién resuelto. El F80 del triturador corresponde a una reducción anterior y no se sustituye en este cálculo. La reducción de referencia separada determina constantes diagnósticas, sin redefinir el circuito operativo.')
        replace_code('k_r, k_k =', """# Evaluate operating curves and the exact declared calibration as separate experiments.
p80 = np.geomspace(50.0, f80 / 1.01, 80)
curves = law_curves(wi, f80, p80)
reference_feed = float(constant('bond.reference_feed_um'))
reference_product = float(constant('bond.reference_product_um'))
calibration = law_curves(wi, reference_feed, np.array([reference_product]))
reference_products = np.unique(np.r_[np.geomspace(50.0, reference_feed / 1.01, 80), reference_product])
reference_curves = law_curves(wi, reference_feed, reference_products)
display(pd.DataFrame(calibration).round(6))""",
            'All operating curves use the same achieved mill feed and work index. A second calculation evaluates all three laws exactly at the production reference feed and product sizes, and inserts that exact product into its own plotting grid. Equality there follows from calibration, whereas equality at 150 µm with a different feed is not imposed.',
            'Las curvas operativas comparten alimentación alcanzada e índice de trabajo. Otro cálculo evalúa las tres leyes exactamente en alimentación y producto de referencia e incorpora ese producto exacto a su propia malla. La igualdad allí procede de calibración; no se impone igualdad a 150 µm con otra alimentación.')
        i = replace_code('np.argmin', """# Separate physical mill-feed curves from the exact reference-calibration figure.
fig, axes = plt.subplots(1, 2, figsize=(11, 4.5))
for name in ('bond', 'rittinger', 'kick'):
    axes[0].plot(curves['p80_um'], curves[name], label=name.title())
    axes[1].plot(reference_products, reference_curves[name], label=name.title())
    axes[1].scatter([reference_product], [calibration[name][0]], s=28)
axes[0].set(title=f'Physical mill feed: F80={f80:.1f} µm', ylabel='Specific energy (kWh/t)')
axes[1].set(title=f'Calibration: F80={reference_feed:g} µm; P80={reference_product:g} µm',
            ylabel='Specific energy (kWh/t)')
for axis in axes:
    axis.set_xscale('log')
    axis.set_xlabel('Product P80 (µm)')
    axis.invert_xaxis()
    axis.grid(alpha=0.25)
    axis.legend()
fig.tight_layout()""",
            'The left panel evaluates the physical mill-feed reduction. The right panel is a different, explicitly labelled calibration experiment; each marker uses the exact law value at the declared reference endpoint. No nearest-grid ordinate is used for a marker at another size.',
            'El panel izquierdo evalúa la reducción física del molino. El derecho es un experimento de calibración distinto y rotulado; cada marca usa el valor exacto de su ley en el extremo de referencia. Ninguna marca toma la ordenada de un tamaño vecino.')
        cells[i + 1]['source'] = pair(
            'The left curves can differ at 150 µm because their feed is the achieved mill feed. The right markers coincide only at the declared reference reduction, evaluated exactly rather than interpolated from an unrelated grid point. These are two distinct questions with labelled endpoints. The later nominal-work table and ratio sweep retain the physical mill-feed basis; the calibration panel does not supply a second physical operating state or measured energy validation.',
            'Las curvas izquierdas pueden diferir a 150 µm porque usan alimentación alcanzada del molino. Las marcas derechas coinciden en la reducción de referencia declarada, evaluada exactamente y no desde un punto vecino. Son preguntas distintas con extremos identificados. La tabla nominal y el barrido relativo posteriores mantienen la base física del molino; calibrar no aporta otro estado operativo ni validación energética medida.', lang).splitlines(keepends=True)
        for cell in cells:
            if cell['cell_type'] == 'code' and 'ratio.items()' in source(cell):
                text = source(cell).replace('Calibration and divergence', 'Mill-feed energy-law ratios')
                text = text.replace('Calibración y divergencia', 'Relaciones de leyes para alimentación al molino')
                cell['source'] = text.splitlines(keepends=True)

    if topic == '02-flotation' and level in (2, 3):
        additions = []
        if level == 3:
            i = find('kinetics = kinetic_record')
            cells[i - 1]['source'] = pair(
                'The nominal circuit is solved and all five kinetic forms are fitted afresh to its shared virtual batch observations. This operation does not load a committed score table. Its exact distributed-rate bank result is the simulator reference for the following model comparisons.',
                'Resolver el circuito nominal y ajustar nuevamente las cinco formas a observaciones batch virtuales comunes. No se carga una tabla guardada de puntuaciones. El banco exacto de tasas distribuidas constituye la referencia del simulador para comparar los modelos.', lang).splitlines(keepends=True)
            step(additions, lang,
                 'Compare every named projection after shortening the bank. Two experiments are kept separate: refitting the changed-bank virtual response, and transferring frozen nominal natural parameters into the changed residence geometry. Only the second is a frozen-parameter transfer test. Both use the shortened bank exact true-flotation reference; signed errors retain overprediction versus underprediction.',
                 'Comparar cada proyección después de acortar el banco. Se separan reajuste de la respuesta virtual modificada y transferencia de parámetros nominales congelados a otra residencia. Solo la segunda es transferencia con parámetros fijos. Ambas usan la referencia exacta del banco corto; los errores con signo distinguen sobrepredicción y subpredicción.',
                 """from pipeline.engine.kinetics import MODELS
nominal_by_id = {m['id']: m for m in fits['models']}
short_by_id = {m['id']: m for m in short_fits['models']}
short_exact = short_fits['bank']['exact_true_flotation_pct']
residence_rows = []
for model in MODELS:
    nominal_fit = nominal_by_id[model.id]
    refit = short_by_id[model.id]
    q = [nominal_fit['parameters'][name] / (100.0 if name in ('R_inf', 'phi') else 1.0)
         for name in model.names]
    frozen = 100.0 * model.project(q, short_point.rougher_cells, short_fits['bank']['cell_residence_min'])
    residence_rows.append({'Model': model.id, 'Nominal bank (%)': nominal_fit['bank_projection_pct'],
        'Short refit (%)': refit['bank_projection_pct'], 'Short frozen (%)': frozen,
        'Short exact (%)': short_exact, 'Refit signed error (pp)': refit['lumping_error_pct'],
        'Frozen signed error (pp)': frozen - short_exact,
        'Refit absolute error (pp)': abs(refit['lumping_error_pct']),
        'Frozen absolute error (pp)': abs(frozen - short_exact)})
residence = pd.DataFrame(residence_rows)
display(residence.round(4))"""
            )
            figure(additions, lang,
                   'Plot signed shortened-bank errors for the refitted and frozen representations of all five kinetic forms.',
                   'Graficar errores con signo del banco corto para representaciones reajustadas y congeladas de las cinco formas.',
                   """fig, ax = plt.subplots(figsize=(9, 4.5))
residence.set_index('Model')[['Refit signed error (pp)', 'Frozen signed error (pp)']].plot.bar(ax=ax)
ax.axhline(0, color='black', linewidth=1)
ax.set(xlabel='Kinetic form', ylabel='Projection minus exact recovery (pp)', title='Changed-residence projection errors')
ax.tick_params(axis='x', rotation=20)
fig.tight_layout()""",
                   'The signed bars compare every model with the same shortened-bank reference. Refit bars allow the changed virtual response to identify new parameters; frozen bars retain the nominal parameter vector and change only the production projection geometry. Similar bars are an observed result, not evidence that refitting and transfer are the same procedure. Error magnitude and direction are simulator approximation diagnostics and do not establish performance on an independently sampled flotation campaign.',
                   'Las barras comparan cada modelo con la misma referencia del banco corto. Reajustar permite identificar otros parámetros; congelar conserva el vector nominal y cambia solo la geometría de proyección de producción. Barras similares son un resultado, no equivalencia entre procedimientos. Magnitud y sentido del error diagnostican aproximación del simulador, sin establecer desempeño en una campaña de flotación independiente.')
            summary_extra("""short_kelsall = short_by_id['kelsall']
frozen_kelsall = next(row for row in residence_rows if row['Model'] == 'kelsall')
answer_values.update({'Short Kelsall refit error (pp)': short_kelsall['lumping_error_pct'],
                     'Short Kelsall frozen error (pp)': frozen_kelsall['Frozen signed error (pp)']})"""
            )
            result_text(
                f'For the shortened bank, Kelsall signed projection errors are {bound("Short Kelsall refit error (pp)")} pp after refitting and {bound("Short Kelsall frozen error (pp)")} pp with frozen nominal parameters. The full table and figure compare all five forms against the same changed-bank exact reference. Nominal fit quality alone does not answer this residence question; refitting and frozen-parameter transfer remain separately identified experiments.',
                f'En el banco corto, los errores con signo de Kelsall son {bound("Short Kelsall refit error (pp)")} pp tras reajuste y {bound("Short Kelsall frozen error (pp)")} pp con parámetros nominales congelados. Tabla y figura comparan las cinco formas con la misma referencia modificada. El ajuste nominal no responde por sí solo esta pregunta; reajuste y transferencia permanecen identificados por separado.')
        if level == 2:
            step(additions, lang,
                 'Calculate matched nominal and increased-dose diagnostics for each kinetic form. The dose changes by ten percent with nominal bank geometry restored. Signed projection errors and absolute magnitudes are both retained; a small numerical change does not establish a statistically or physically meaningful reagent improvement.',
                 'Calcular diagnósticos emparejados nominales y con dosis aumentada para cada forma. La dosis cambia diez por ciento con geometría nominal. Se conservan signo y magnitud de errores; una diferencia pequeña no demuestra una mejora estadística o física del reactivo.',
                 """nominal_by_id = {m['id']: m for m in fits['models']}
dose_by_id = {m['id']: m for m in dose_fits['models']}
dose_comparison = pd.DataFrame([
    {'Model': name, 'Nominal batch RMSE (pp)': nominal_by_id[name]['rmse_pct'],
     'Dosed batch RMSE (pp)': dose_by_id[name]['rmse_pct'],
     'Nominal signed bank error (pp)': nominal_by_id[name]['lumping_error_pct'],
     'Dosed signed bank error (pp)': dose_by_id[name]['lumping_error_pct'],
     'Batch RMSE change (pp)': dose_by_id[name]['rmse_pct'] - nominal_by_id[name]['rmse_pct']}
    for name in nominal_by_id])
display(dose_comparison.round(4))"""
            )
            summary_extra("""dose_by_id = {m['id']: m for m in dose_fits['models']}
answer_values.update({'Dosed Kelsall batch RMSE (pp)': dose_by_id['kelsall']['rmse_pct'],
    'Dosed Kelsall bank error (pp)': abs(dose_by_id['kelsall']['lumping_error_pct']),
    'Dosed first-order batch RMSE (pp)': dose_by_id['first_order']['rmse_pct'],
    'Dosed overall recovery (%)': dosed.metrics['rougher_recovery_pct'],
    'Nominal overall recovery (%)': nominal.metrics['rougher_recovery_pct']})"""
            )
            result_text(
                f'With collector increased by 10%, Kelsall batch RMSE changes from {bound("Kelsall batch RMSE (pp)")} to {bound("Dosed Kelsall batch RMSE (pp)")} pp, while its absolute bank error changes from {bound("Kelsall bank error (pp)")} to {bound("Dosed Kelsall bank error (pp)")} pp. Overall rougher recovery changes from {bound("Nominal overall recovery (%)")} to {bound("Dosed overall recovery (%)")} percent. These are computed response/approximation changes, not independently validated reagent benefits.',
                f'Al aumentar colector 10%, el RMSE batch de Kelsall pasa de {bound("Kelsall batch RMSE (pp)")} a {bound("Dosed Kelsall batch RMSE (pp)")} pp y su error absoluto de banco de {bound("Kelsall bank error (pp)")} a {bound("Dosed Kelsall bank error (pp)")} pp. La recuperación rougher global pasa de {bound("Nominal overall recovery (%)")} a {bound("Dosed overall recovery (%)")} por ciento. Son cambios calculados de respuesta y aproximación, no beneficios del reactivo validados independientemente.')
        add_before_results(additions)

    if topic == '03-learning' and level == 1:
        summary_extra("answer_values.update({'Training rows': len(train), 'Interpolation test rows': len(test)})")
        result_text(
            f'The common design contains {bound("Design rows")} simulated states. Ridge fits {bound("Training rows")} training rows and predicts {bound("Interpolation test rows")} reserved rows, with RMSE {bound("Ridge interpolation RMSE (pp)")} pp. Every case remains represented during training; this result establishes interpolation on engine-generated labels, not prediction for an absent ore or a measured plant.',
            f'El diseño común contiene {bound("Design rows")} estados simulados. Ridge se ajusta con {bound("Training rows")} filas y predice {bound("Interpolation test rows")} filas reservadas, con RMSE {bound("Ridge interpolation RMSE (pp)")} pp. Cada caso sigue representado en entrenamiento; se establece interpolación de etiquetas del motor, no predicción de mineral ausente ni planta medida.')
    if topic == '03-learning' and level == 2:
        for cell in cells:
            if cell['cell_type'] == 'code' and 'ax.scatter' in source(cell):
                text = '\n'.join(line for line in source(cell).splitlines() if not line.lstrip().startswith('#'))
                cell['source'] = (pair('# Compare predictions on the complete held-out soft-porphyry case.\n',
                                       '# Comparar predicciones del caso completo de pórfido blando reservado.\n', lang)
                                  + text).splitlines(keepends=True)
    review_optimization(notebook, find, replace_code, add_before_results, result_text, bound)
    reconcile_copy(notebook)


def review_optimization(notebook, find, replace_code, add_before_results, result_text, bound):
    meta = notebook['metadata']['caos']
    if meta['topic'] != '04-optimization':
        return
    lang, level, cells = meta['language'], meta['level'], notebook['cells']
    for cell in cells:
        if cell['cell_type'] != 'code':
            continue
        text = ''.join(cell['source'])
        for name in ('plain', 'screened', 'metal_search', 'energy_search'):
            old = f"{name}['optimum'] or {name}['least_violating']"
            text = text.replace(old, f"{name}.get('optimum') or {name}.get('least_violating') or {name}['base']")
        text = text.replace("plain['trace']", "plain.get('trace', [])")
        text = text.replace("screened['without_screen']['evaluations']",
                            "screened.get('without_screen', {}).get('evaluations')")
        text = text.replace("run['screen']['proposals']", "run.get('screen', {}).get('proposals', [])")
        text = text.replace("columns=screened['proposal_columns']",
                            "columns=screened.get('proposal_columns', ('iteration', 'surrogate_recovery_pct', "
                            "'engine_recovery_pct', 'surrogate_objective', 'engine_objective', 'runner_up_margin', 'improved'))")
        cell['source'] = text.splitlines(keepends=True)
    replace_code('plain_point =', """# Audit the reported unscreened endpoint only when the engine can define that state.
from pipeline.engine.model import InfeasibleState
plain_point = case.nominal.with_values(**plain_end['decisions'])
plain_check = None
if plain['status'] != 'base_refused':
    try:
        plain_check = simulate(case.ore, case.plant, plain_point)
    except InfeasibleState as refusal:
        print('Unscreened audit refusal:', refusal.code)
print('Unscreened audit available:', plain_check is not None)
if plain_check is not None:
    print('Unscreened engine recovery (%):', round(plain_check.metrics['recovery_pct'], 3))
    print('Unscreened engine energy (kWh/t):', round(plain_check.metrics['specific_energy_total_kwh_t'], 3))""",
        'The reported endpoint is audited independently when its state is defined. A refused base or refused audit remains labelled as unavailable rather than receiving a substitute physical value. An infeasible but solvable state can still supply physical outputs; its negative constraint slack does not become feasible merely because a circuit solve succeeds. Audit solves remain outside the candidate counts.',
        'Auditar independientemente el extremo cuando su estado esté definido. Una base o auditoría rechazada permanece identificada como no disponible, sin valor físico sustituto. Un estado infactible pero resoluble puede entregar salidas; resolver el circuito no convierte holguras negativas en factibilidad. Las auditorías quedan fuera del conteo de candidatos.')
    if level >= 3:
        replace_code('screened_point =', """# Preserve unavailable screened audits instead of inventing terminal physical metrics.
from pipeline.engine.model import InfeasibleState
screened_point = case.nominal.with_values(**screened_end['decisions'])
screened_check = None
if screened['status'] != 'base_refused':
    try:
        screened_check = simulate(case.ore, case.plant, screened_point)
    except InfeasibleState as refusal:
        print('Screened audit refusal:', refusal.code)
print('Screened audit available:', screened_check is not None)
if screened_check is not None:
    print('Screened engine recovery (%):', round(screened_check.metrics['recovery_pct'], 3))
print('Screened constraint slacks:', screened_end['slacks'])""",
            'The screened endpoint receives a separate physical audit with explicit refusal handling. This calculation checks the terminal engine state rather than surrogate agreement. A missing physical audit is displayed as unavailable; the subsequent status and decision tables retain the failed run rather than filtering it out of the comparison.',
            'Auditar por separado el extremo con filtro y conservar rechazos explícitos. Se revisa el estado terminal del motor, no acuerdo con el modelo aprendido. Una auditoría ausente se muestra como no disponible; las tablas de estado y decisión conservan la corrida fallida en vez de eliminarla.')
    additions = []
    run_expr = "{'Unscreened': plain}"
    if level == 2:
        run_expr = "{'Equal weight': plain, 'Metal only': metal_search, 'Energy only': energy_search}"
    if level >= 3:
        run_expr = "{'Unscreened': plain, 'Screened': screened}"
    step(additions, lang,
         'Report each run before comparing cost or preference. The table retains status, physical decision vector, constraint slacks, per-start stopping reasons and reported convergence. A least-violating endpoint is labelled infeasible and a refused base has no physical outcome assigned. Solvable infeasible outcomes remain visible, so this table does not select only successful runs.',
         'Informar cada corrida antes de comparar costo o preferencias. La tabla conserva estado, decisiones, holguras, detención por comienzo y convergencia informada. El extremo de menor violación sigue siendo infactible; a una base rechazada no se le asigna resultado físico. Se mantienen estados infactibles resolubles, sin seleccionar solo éxitos.',
         f"""runs = {run_expr}
endpoint_rows = []
for label, run in runs.items():
    end = run.get('optimum') or run.get('least_violating') or run['base']
    physical = run['status'] != 'base_refused' and bool(end['values'])
    endpoint_rows.append({{'Run': label, 'Status': run['status'], 'Feasible': end['feasible'],
        'Converged': run.get('converged'), 'Stops': ', '.join(r['stop'] for r in run['starts']),
        'Decisions': end['decisions'], 'Slacks': end['slacks'], 'Exact calls': run['evaluations'],
        'Recovered metal (t/h)': end['recovered_tph'] if physical else None,
        'Recovery (%)': end['recovery_pct'] if physical else None,
        'Specific energy (kWh/t)': end['values'].get('energy_kwh_t') if physical else None}})
endpoints = pd.DataFrame(endpoint_rows)
with pd.option_context('display.max_colwidth', None, 'display.max_columns', None):
    display(endpoints)"""
    )
    if level >= 3:
        step(additions, lang,
             'Measure actual decision disagreement independently of cost. Each physical difference is divided by its contract-bound width, then compared with the explicitly declared unitless tolerance 1e-8. Agreement is accepted only for two feasible endpoints with available physical audits. The physical output deltas remain separate from both this numerical decision test and the exact-call difference.',
             'Medir desacuerdo de decisiones por separado del costo. Cada diferencia física se divide por la amplitud contractual y compara con tolerancia adimensional declarada 1e-8. Solo se acepta acuerdo entre extremos factibles con auditorías disponibles. Las diferencias físicas quedan separadas de la prueba numérica y del conteo de llamadas.',
             """decision_tolerance = 1e-8
decision_rows = []
for name, (lo, hi) in plain['bounds'].items():
    left, right = plain_end['decisions'][name], screened_end['decisions'][name]
    delta = right - left
    decision_rows.append({'Decision': name, 'Unit': contract['cases'][case.id]['inputs'][name]['unit'],
        'Unscreened': left, 'Screened': right,
        'Physical delta': delta, 'Normalized delta (1)': delta / (hi - lo),
        'Tolerance (1)': decision_tolerance, 'Within tolerance': abs(delta / (hi - lo)) <= decision_tolerance})
decision_comparison = pd.DataFrame(decision_rows)
both_audited = plain_check is not None and screened_check is not None
decision_agreement = bool(plain_end['feasible'] and screened_end['feasible'] and both_audited
                          and decision_comparison['Within tolerance'].all())
display(decision_comparison)
print('Feasible audited decision agreement:', decision_agreement)
physical_deltas = {'Recovery delta (pp)': None, 'Energy delta (kWh/t)': None}
if both_audited:
    physical_deltas['Recovery delta (pp)'] = screened_check.metrics['recovery_pct'] - plain_check.metrics['recovery_pct']
    physical_deltas['Energy delta (kWh/t)'] = (screened_check.metrics['specific_energy_total_kwh_t']
                                            - plain_check.metrics['specific_energy_total_kwh_t'])
display(pd.Series(physical_deltas, name='Screened minus unscreened').to_frame())"""
        )
    # Status tables precede the conclusions. The old preference figure is replaced after they exist.
    if level == 2:
        i = find('ends = [energy_end')
        cells[i]['source'] = """# Plot only physical outcomes; refused runs remain in the status table.
preference_outcomes = pd.DataFrame([
    {'Run': label, 'Status': run['status'],
     'Feasible': (run.get('optimum') or run.get('least_violating') or run['base'])['feasible'],
     'End': run.get('optimum') or run.get('least_violating') or run['base']}
    for label, run in (('Equal weight', plain), ('Metal only', metal_search), ('Energy only', energy_search))])
fig, ax = plt.subplots(figsize=(7, 4))
for row in preference_outcomes.to_dict('records'):
    end = row['End']
    if row['Status'] != 'base_refused' and end['values']:
        ax.scatter(end['values']['energy_kwh_t'], end['recovered_tph'],
                   marker='o' if row['Feasible'] else 'x', label=row['Run'] + ' [' + row['Status'] + ']')
ax.set(xlabel='Specific energy (kWh/t)', ylabel='Recovered metal (t/h)', title='Computed preference endpoints')
ax.legend()
fig.tight_layout()""".splitlines(keepends=True)
        cells[i + 1]['source'] = pair(
            'Each marker is one computed preference endpoint and its legend retains the run status. Crosses identify physically solvable but infeasible results; refused states supply no invented point. The status table below preserves all runs, including unavailable outputs. No connecting line implies an interpolated feasible frontier, and the normalized weights do not assign economic prices to electricity or recovered metal.',
            'Cada marca representa un extremo calculado y su leyenda conserva el estado. Las cruces identifican resultados resolubles pero infactibles; los rechazos no aportan puntos inventados. La tabla posterior conserva todas las corridas y salidas ausentes. No hay una línea que sugiera frontera factible interpolada ni precios económicos para electricidad o metal.', lang).splitlines(keepends=True)
    if level == 4:
        replace_code("if not proposal_table.empty:", """# Interpret only proposals with an actual exact-engine evaluation.
evaluated_proposals = proposal_table.dropna(subset=['engine_recovery_pct'])
fig, ax = plt.subplots(figsize=(7, 4))
if evaluated_proposals.empty:
    ax.text(0.5, 0.5, 'No evaluated proposals: no accuracy estimate', transform=ax.transAxes, ha='center')
else:
    residual = evaluated_proposals['surrogate_recovery_pct'] - evaluated_proposals['engine_recovery_pct']
    ax.scatter(np.arange(len(residual)), residual)
ax.axhline(0, color='black', linestyle='--')
ax.set(xlabel='Evaluated proposal (count)', ylabel='Prediction minus engine (pp)', title='Evaluated proposal errors')
fig.tight_layout()
print('Evaluated proposals:', len(evaluated_proposals))
print('Trace iterations:', len(screened.get('trace', [])))""",
            'Prediction errors use only proposals that have an exact engine value. If none was evaluated, the panel explicitly states that no accuracy estimate exists. Unreached proposals remain missing values rather than zero residuals; candidate-call costs and endpoint validity are still reported independently.',
            'Usar solo propuestas con valor exacto para calcular error. Si ninguna fue evaluada, el panel indica que no existe estimación de precisión. Las propuestas no alcanzadas conservan valores ausentes, sin residuos cero; costo y validez de extremos se informan independientemente.')
        i = find('archive_counts =')
        # Replace the mutable "archive" assumption with versioned current-record evidence.
        del cells[i - 1:i + 1]
        step(additions, lang,
             'Identify the current committed cohort before aggregating it. Engine version and contract digest must be nonempty and consistent across every file. The SHA-256 incorporates sorted filenames and their exact bytes, so the displayed identity changes when data adoption changes the records. The cohort identity is distinct from the engine code VERSION used by the fresh teaching search.',
             'Identificar la cohorte comprometida antes de agregarla. Versión del motor y digest contractual deben existir y coincidir entre archivos. SHA-256 incorpora nombres ordenados y bytes exactos, por lo que la identidad cambia al adoptar datos. Esta identidad se distingue de VERSION del código utilizado por la búsqueda didáctica nueva.',
             """from hashlib import sha256
cohort_paths = sorted((repo / 'data/derived/cases').glob('*.json'))
if not cohort_paths:
    raise RuntimeError('No current cohort case files')
cohort_hash = sha256()
cohort_records = []
for path in cohort_paths:
    payload = path.read_bytes()
    cohort_hash.update(path.name.encode('utf-8') + b'\\0' + payload)
    cohort_records.append(json.loads(payload))
cohort_versions = {item['engine_version'] for item in cohort_records}
cohort_contracts = {item['contract_digest'] for item in cohort_records}
if len(cohort_versions) != 1 or len(cohort_contracts) != 1 or not all(cohort_versions | cohort_contracts):
    raise RuntimeError('Mixed or missing cohort version/contract identity')
cohort_version = next(iter(cohort_versions))
cohort_contract = next(iter(cohort_contracts))
print('Cohort engine version:', cohort_version)
print('Cohort contract digest:', cohort_contract)
print('Cohort SHA-256:', cohort_hash.hexdigest())
print('Cohort source:', 'data/derived/cases/*.json')
print('Cohort files:', [path.name for path in cohort_paths])
print('Fresh search code version:', (repo / 'VERSION').read_text(encoding='utf-8').strip())"""
        )
        step(additions, lang,
             'Calculate paired counts only from screened records that include their unscreened counterpart. Saving, equality and additional-work cases are counted from the observed signed differences. No historical total or expected sign is substituted into this current cohort. These descriptive counts do not imply an independently sampled population of plants.',
             'Calcular conteos solo de registros con filtro y contraparte sin filtro. Ahorro, igualdad y trabajo adicional se cuentan desde diferencias observadas, sin sustituir totales históricos ni signos esperados. Son conteos descriptivos y no una población de plantas muestreada independientemente.',
             """cohort_rows = []
for artifact in cohort_records:
    for variant in artifact['variants']:
        result = variant['methods']['optimization']
        if result.get('screened') and 'without_screen' in result:
            cohort_rows.append((result['evaluations'], result['without_screen']['evaluations']))
if not cohort_rows:
    raise RuntimeError('No paired screened records in identified cohort')
cohort = np.asarray(cohort_rows)
cohort_difference = cohort[:, 0] - cohort[:, 1]
cohort_total_delta = int(cohort_difference.sum())
cost_direction = 'Fewer exact calls' if cohort_total_delta < 0 else 'Additional exact calls' if cohort_total_delta > 0 else 'Equal exact calls'
print('Observed cohort cost direction:', cost_direction)
display(pd.DataFrame({'Screened total': [int(cohort[:, 0].sum())],
    'Unscreened total': [int(cohort[:, 1].sum())], 'Signed excess': [cohort_total_delta],
    'Saving pairs': [int((cohort_difference < 0).sum())],
    'Equal pairs': [int((cohort_difference == 0).sum())],
    'Additional-work pairs': [int((cohort_difference > 0).sum())]}))"""
        )
    add_before_results(additions)
    summary = next(c for c in cells if 'answer-values' in c.get('metadata', {}).get('tags', []))
    program = """# Collect status-qualified search outcomes without inventing missing physical metrics.
answer_values = {'Unscreened count': plain['evaluations'],
    'Reported target P80 (µm)': plain_end['decisions']['target_p80_um'],
    'Selected feasible (1=yes)': int(plain_end['feasible']),
    'Convergence reported (1=yes)': int(plain.get('converged') is True)}"""
    if level == 2:
        program += """
answer_values.update({'Metal endpoint feasible (1=yes)': int(metal_end['feasible']),
                     'Energy endpoint feasible (1=yes)': int(energy_end['feasible'])})"""
    if level >= 3:
        program += """
answer_values.update({'Screened count': screened['evaluations'],
    'Additional count': screened['evaluations'] - plain['evaluations'], 'Proposal count': len(proposals),
    'Screened feasible (1=yes)': int(screened_end['feasible']),
    'Audited decision agreement (1=yes)': int(decision_agreement),
    'Largest normalized decision delta (1)': float(decision_comparison['Normalized delta (1)'].abs().max())})"""
    if level == 4:
        program += """
answer_values.update({'Current cohort pair count': len(cohort), 'Current cohort signed excess': cohort_total_delta,
    'Current cohort saving pairs': int((cohort_difference < 0).sum()),
    'Current cohort additional-work pairs': int((cohort_difference > 0).sum())})"""
    program += "\nanswer_values = {label: round(float(number), 8) for label, number in answer_values.items()}\nprint(json.dumps(answer_values, ensure_ascii=False))"
    summary['source'] = program.splitlines(keepends=True)
    en = (f'The reported grind target is {bound("Reported target P80 (µm)")} µm; endpoint feasibility is '
          f'{bound("Selected feasible (1=yes)")} and reported mesh convergence is {bound("Convergence reported (1=yes)")} '
          f'(1=yes). The unscreened run uses {bound("Unscreened count")} exact candidate calls. '
          'The status table qualifies its decisions, physical outcomes, slacks and stops; unavailable audits are not physical successes. ')
    es = (f'El objetivo de molienda informado es {bound("Reported target P80 (µm)")} µm; factibilidad del extremo '
          f'{bound("Selected feasible (1=yes)")} y convergencia informada {bound("Convergence reported (1=yes)")} '
          f'(1=sí). La corrida sin filtro usa {bound("Unscreened count")} llamadas exactas. '
          'La tabla califica decisiones, salidas, holguras y detención; auditorías ausentes no son éxitos físicos. ')
    if level == 2:
        en += (f'Metal-only and energy-only feasibility flags are {bound("Metal endpoint feasible (1=yes)")} and '
               f'{bound("Energy endpoint feasible (1=yes)")}; the preference plot retains valid physical outcomes and labels infeasibility.')
        es += (f'Los indicadores de factibilidad al preferir metal y energía son {bound("Metal endpoint feasible (1=yes)")} y '
               f'{bound("Energy endpoint feasible (1=yes)")}; la figura conserva resultados físicos y rotula infactibilidad.')
    if level >= 3:
        en += (f'The screened count is {bound("Screened count")}, with signed excess {bound("Additional count")} '
               f'and feasible audited decision agreement {bound("Audited decision agreement (1=yes)")}. '
               f'The largest normalized decision delta is {bound("Largest normalized decision delta (1)")} '
               'against the displayed 1e-8 tolerance. Positive excess means additional work; negative means saving. ')
        es += (f'Con filtro el conteo es {bound("Screened count")}, exceso con signo {bound("Additional count")} '
               f'y acuerdo factible auditado {bound("Audited decision agreement (1=yes)")}. '
               f'La máxima diferencia normalizada es {bound("Largest normalized decision delta (1)")} '
               'frente a tolerancia 1e-8. Exceso positivo significa más trabajo; negativo significa ahorro. ')
    if level == 4:
        en += (f'The separately identified current cohort contains {bound("Current cohort pair count")} pairs with '
               f'signed excess {bound("Current cohort signed excess")}; {bound("Current cohort saving pairs")} save calls '
               f'and {bound("Current cohort additional-work pairs")} add calls. Its printed version, contract digest and SHA-256 '
               'identify the records actually read, without assuming a historical outcome.')
        es += (f'La cohorte actual identificada por separado contiene {bound("Current cohort pair count")} parejas, exceso '
               f'{bound("Current cohort signed excess")}; {bound("Current cohort saving pairs")} ahorran llamadas y '
               f'{bound("Current cohort additional-work pairs")} añaden. Versión, digest contractual y SHA-256 identifican '
               'los registros leídos, sin presuponer un resultado histórico.')
    answers = {
    1: (
        f'The introductory run reports target {bound("Reported target P80 (µm)")} µm, feasibility {bound("Selected feasible (1=yes)")} and mesh convergence reported {bound("Convergence reported (1=yes)")} (1=yes). It spends {bound("Unscreened count")} exact candidate calls. The status/decision/slack table identifies whether this is an admissible endpoint, a least-violating state or a refused base; a reported target alone is not a feasibility certificate.',
        f'La corrida inicial informa objetivo {bound("Reported target P80 (µm)")} µm, factibilidad {bound("Selected feasible (1=yes)")} y convergencia de malla informada {bound("Convergence reported (1=yes)")} (1=sí), con {bound("Unscreened count")} llamadas exactas. La tabla identifica extremo admisible, menor violación o base rechazada; informar un objetivo no certifica factibilidad.'),
    2: (
        f'The equal-weight target is {bound("Reported target P80 (µm)")} µm with feasibility flag {bound("Selected feasible (1=yes)")}. Metal-only and energy-only flags are {bound("Metal endpoint feasible (1=yes)")} and {bound("Energy endpoint feasible (1=yes)")} (1=yes). Their separately labelled physical outcomes and slacks show the preference trade-off, while the per-start stops and reported convergence qualify termination. Unavailable physical outcomes remain absent rather than becoming plotted zero values.',
        f'Con pesos iguales el objetivo es {bound("Reported target P80 (µm)")} µm y factibilidad {bound("Selected feasible (1=yes)")}. Los indicadores de metal y energía son {bound("Metal endpoint feasible (1=yes)")} y {bound("Energy endpoint feasible (1=yes)")} (1=sí). Salidas físicas y holguras rotuladas muestran el compromiso; detención por comienzo y convergencia califican término. Salidas ausentes no se convierten en ceros graficados.'),
    3: (
        f'Exact costs are {bound("Screened count")} with screening and {bound("Unscreened count")} without it; screened-minus-unscreened excess is {bound("Additional count")}. Feasible audited decision agreement is {bound("Audited decision agreement (1=yes)")} (1=yes), with largest normalized delta {bound("Largest normalized decision delta (1)")} against tolerance 1e-8. Cost direction follows the signed excess, while the separate metric-delta table tests physical agreement rather than assuming it from a rounded recovery.',
        f'Los costos exactos son {bound("Screened count")} con filtro y {bound("Unscreened count")} sin filtro; el exceso con menos sin filtro es {bound("Additional count")}. El acuerdo factible auditado es {bound("Audited decision agreement (1=yes)")} (1=sí), con máxima diferencia normalizada {bound("Largest normalized decision delta (1)")} frente a 1e-8. El signo determina costo; otra tabla prueba acuerdo físico sin inferirlo de recuperación redondeada.'),
    4: (
        f'The fresh teaching pair spends {bound("Screened count")} versus {bound("Unscreened count")} exact calls, signed difference {bound("Additional count")}, and audited decision-agreement flag {bound("Audited decision agreement (1=yes)")} (1=yes). The separately identified current cohort contains {bound("Current cohort pair count")} pairs with total signed excess {bound("Current cohort signed excess")}; {bound("Current cohort saving pairs")} save calls and {bound("Current cohort additional-work pairs")} add work. Positive excess is added work and negative excess is saving. The printed cohort version, contract digest and file SHA-256 qualify these observed counts; no direction is predetermined.',
        f'La pareja didáctica usa {bound("Screened count")} frente a {bound("Unscreened count")} llamadas, diferencia con signo {bound("Additional count")}, y acuerdo auditado {bound("Audited decision agreement (1=yes)")} (1=sí). La cohorte actual identificada tiene {bound("Current cohort pair count")} parejas y exceso {bound("Current cohort signed excess")}; {bound("Current cohort saving pairs")} ahorran y {bound("Current cohort additional-work pairs")} añaden trabajo. Exceso positivo añade trabajo y negativo ahorra. Versión, digest y SHA-256 califican lo observado, sin predeterminar sentido.'),
    }
    result_text(*answers[level])
    # The paired tables serve different questions at each curriculum level.
    audit_notes = {
    1: ('The introductory terminal audit checks the reported target through a new circuit solve. Its availability is printed explicitly, including a refusal code if the engine rejects the state. This one extra solve is not part of the search candidate count; endpoint feasibility still comes from the reported constraint slacks.',
        'Auditar el objetivo inicial mediante otra resolución de circuito e informar disponibilidad o código de rechazo. Esa llamada adicional no integra candidatos; la factibilidad sigue dependiendo de holguras informadas.'),
    2: ('The equal-weight preference receives a separate engine audit before comparison with the metal-only and energy-only endpoints. Recovery and energy are printed only for a defined state. This separates a successful circuit calculation from satisfying all optimization constraints and avoids attaching a physical benefit to a refused target.',
        'Auditar la preferencia intermedia antes de compararla con extremos de metal y energía. Solo un estado definido aporta recuperación y energía; resolver circuito y cumplir restricciones siguen siendo preguntas distintas.'),
    3: ('The explicit unscreened reference endpoint is re-evaluated outside the optimizer cache. Its audit either supplies physical metrics for the later matched-delta table or remains unavailable with a refusal message. Those audit values qualify physical agreement and are not counted as candidate evaluations or as evidence that the search is globally optimal.',
        'Reevaluar la referencia sin filtro fuera de caché. La auditoría aporta métricas para diferencias pareadas o queda ausente con rechazo. Sus valores califican acuerdo físico y no se cuentan como candidatos ni prueban óptimo global.'),
    4: ('The evidence baseline has its own independently solved terminal state. A physical refusal is retained rather than replaced by a nominal recovery, so proposal accuracy and cohort totals cannot conceal an invalid baseline. Exact-call accounting continues to use the optimizer record, while this additional audit addresses endpoint integrity.',
        'Resolver independientemente el estado terminal de referencia. Un rechazo se conserva sin sustituir recuperación nominal, de modo que propuestas y totales no oculten una base inválida. El conteo usa el registro del optimizador; la auditoría revisa integridad del extremo.'),
    }
    i = find('plain_point =')
    cells[i - 1]['source'] = pair(*audit_notes[level], lang).splitlines(keepends=True)
    endpoint_notes = {
    1: ('The one-run status table links the introductory grind to feasible/least-violating/refused status, slacks, exact calls and start stops. A convergence field is displayed as reported rather than inferred from the endpoint name. This is the evidence needed before describing the selected setting as feasible.',
        'Relacionar molienda inicial con estado factible, menor violación o rechazo, holguras, llamadas y detenciones. La convergencia se muestra como informada, sin inferirla del nombre del extremo. Esta evidencia precede calificar la configuración como factible.'),
    2: ('All three preference runs remain in a common status table. The metal-only, equal-weight and energy-only endpoints retain their own slacks and stops, so a more attractive mass/energy coordinate cannot conceal infeasibility. Missing physical output from a refused problem remains absent while its run status and decision input are still visible.',
        'Conservar las tres preferencias en tabla común con sus propias holguras y detenciones. Una coordenada atractiva no oculta infactibilidad; el rechazo mantiene estado y decisión de entrada sin inventar salidas físicas.'),
    3: ('The two search configurations are summarized before decision agreement is calculated. Their exact calls, terminal statuses and physical slacks establish whether the subsequent normalized decision test compares feasible audited outcomes. Start-level stops distinguish a budget-limited endpoint from a mesh-converged reference rather than treating both as one success category.',
        'Resumir las dos búsquedas antes de calcular acuerdo. Llamadas, estados y holguras establecen si se comparan extremos factibles auditados; las detenciones distinguen presupuesto y convergencia de malla sin una categoría única de éxito.'),
    4: ('The fresh teaching pair retains endpoint validity alongside its claimed computation cost. The complete table includes failures, physical decisions, slacks and start stops for both methods. It qualifies the small experiment independently of the broad current cohort, whose versioned aggregate counts cannot establish the validity of this particular selected state.',
        'Conservar validez de extremos junto al costo de la pareja nueva. La tabla incluye fallas, decisiones, holguras y detención de ambos métodos. Califica el experimento pequeño independientemente de la cohorte amplia, cuyos conteos no validan este estado seleccionado.'),
    }
    i = find('endpoint_rows =')
    cells[i - 1]['source'] = pair(*endpoint_notes[level], lang).splitlines(keepends=True)
    if level >= 3:
        i = find('screened_point =')
        cells[i - 1]['source'] = pair(
            'The screened candidate is audited with the exact circuit independently of the learned score. Its refusal or physical response is retained for the paired comparison, so a numerical match cannot certify two infeasible or unaudited endpoints.',
            'Auditar el candidato filtrado con el circuito exacto, por separado de la puntuación aprendida. Conservar rechazo o respuesta para la pareja; coincidir numéricamente no certifica dos extremos infactibles o sin auditoría.', lang).splitlines(keepends=True) if level == 3 else pair(
            'A fresh screened terminal audit provides the physical side of the proposal-cost evidence. If the state cannot be evaluated, no recovery value is substituted and the status table keeps that failed audit visible beside the exact call count.',
            'La auditoría del extremo filtrado aporta la parte física de la evidencia de propuestas. Si no se evalúa el estado, no se sustituye recuperación y la tabla conserva la falla junto al conteo exacto.', lang).splitlines(keepends=True)
        i = find('decision_tolerance =')
        text = ''.join(cells[i]['source'])
        before, separator, after = text.partition('both_audited =')
        cells[i]['source'] = before.splitlines(keepends=True)
        second = code('# Qualify numerical decision agreement with physical audits.\nboth_audited =' + after)
        explanation = pair(
            'The physical qualification applies the computed tolerance result only when both endpoints are feasible and both audits exist. The metric deltas then compare recovery and energy on the same engine basis; unavailable audits remain missing values rather than zero differences.',
            'Aplicar el acuerdo numérico solo si ambos extremos son factibles y existen auditorías. Después comparar recuperación y energía sobre el mismo motor; una auditoría ausente conserva diferencias faltantes, no ceros.', lang) if level == 3 else pair(
            'The evidence distinguishes a small decision delta from a valid shared physical outcome. Feasibility and audit availability qualify the agreement flag, and separately computed recovery/energy differences accompany it. This integrity test does not change or reduce the recorded exact search cost.',
            'Distinguir una diferencia pequeña de un resultado físico compartido válido. Factibilidad y auditorías califican el indicador; diferencias de recuperación y energía lo acompañan. La prueba de integridad no reduce costo registrado.', lang)
        cells[i + 1:i + 1] = [md(explanation), second]
        # The first table calculates decisions; the following cell qualifies their physical meaning.
        cells[i - 1]['source'] = pair(
            'Compute screened-minus-unscreened decision differences in physical units and normalized by each contract range. The displayed tolerance 1e-8 is a declared numerical comparison rule, not a proof of global optimality. The next calculation applies physical feasibility and audit qualifications separately.',
            'Calcular diferencias con filtro menos sin filtro en unidades físicas y normalizadas por rango. La tolerancia 1e-8 es una regla numérica declarada, no prueba de óptimo global. El paso siguiente aplica factibilidad y auditorías por separado.', lang).splitlines(keepends=True) if level == 3 else pair(
            'The proposal-cost experiment also records actual changes in selected controls. Contract-range normalization keeps grind differences comparable without hiding their physical unit. This table exposes every decision and the explicit tolerance before a separate status-qualified agreement calculation.',
            'Registrar cambios reales de controles junto al costo de propuestas. Normalizar por rango conserva comparabilidad sin ocultar unidades. La tabla expone decisiones y tolerancia antes de calificar acuerdo mediante estado.', lang).splitlines(keepends=True)
    if level == 2:
        i = find('preference_outcomes =')
        cells[i]['source'] = """# Preserve each run status in the physical preference plot.
preference_runs = (('Equal weight', plain), ('Metal only', metal_search), ('Energy only', energy_search))
fig, ax = plt.subplots(figsize=(7, 4))
for label, run in preference_runs:
    end = run.get('optimum') or run.get('least_violating') or run['base']
    if run['status'] != 'base_refused' and end['values']:
        marker = 'o' if end['feasible'] else 'x'
        ax.scatter(end['values']['energy_kwh_t'], end['recovered_tph'], marker=marker,
                   label=label + ' [' + run['status'] + ']')
ax.set(xlabel='Specific energy (kWh/t)', ylabel='Recovered metal (t/h)', title='Computed preference endpoints')
ax.legend()
fig.tight_layout()""".splitlines(keepends=True)
    if level == 4:
        i = find('cohort_rows =')
        text = ''.join(cells[i]['source'])
        before, separator, after = text.partition('cost_direction =')
        cells[i]['source'] = before.splitlines(keepends=True)
        explanation = pair(
            'Interpret the signed total and pair-level direction counts only after the versioned cohort has been aggregated. Equal, saving and additional-work outcomes are determined by the actual differences. These descriptive totals refer to the printed source identity, without replacing it by the fresh one-case search version.',
            'Interpretar total con signo y conteos de dirección después de agregar la cohorte identificada. Igualdad, ahorro y trabajo adicional se determinan desde diferencias reales. Los totales remiten a la identidad impresa, sin sustituirla por la versión de la pareja nueva.', lang)
        cells[i + 1:i + 1] = [md(explanation), code('# Interpret the observed versioned cohort cost.\ncost_direction =' + after)]


def reconcile_copy(notebook):
    """Reconcile actual experiment scope and apply the persisted formal writing standard."""
    meta = notebook['metadata']['caos']
    lang, topic, level = meta['language'], meta['topic'], meta['level']

    def section(en, es, text_en, text_es):
        label = pair(en, es, lang)
        for cell in notebook['cells']:
            source = ''.join(cell['source'])
            if cell['cell_type'] == 'markdown' and source.startswith('## ' + label):
                cell['source'] = ('## ' + label + '\n\n' + pair(text_en, text_es, lang)).splitlines(keepends=True)

    meta['data'] = ['data-pipeline/pipeline/cases/catalog.py', 'data-pipeline/pipeline/engine/data/constants.json']
    if topic in ('03-learning', '04-optimization'):
        meta['data'].append('data/derived/contract/operating_contract.json')
    if topic == '04-optimization' and level >= 3:
        meta['data'].extend(['models/process_screen.json', 'models/process_surrogate.json'])
    if topic == '04-optimization' and level == 4:
        meta['data'].extend(p.relative_to(ROOT).as_posix() for p in sorted((ROOT / 'data/derived/cases').glob('*.json')))
    if topic == '01-comminution':
        section('Data', 'Datos',
                'Owner: OreFlow authors, MIT project licence. The production case catalog supplies the soft-porphyry ore, crusher, mill, classifier and nominal operating definition. Physical constants and the energy-law reference endpoints come from engine/data/constants.json. Circuit outputs and size distributions are calculated here, rather than loaded from a saved trace. No measured feed distribution, power campaign or new external dataset is introduced. Source: https://github.com/fsantibanezleal/CAOS_OreFlow.',
                'Responsable: autores de OreFlow, licencia MIT. El catálogo aporta mineral, triturador, molino, clasificador y operación nominal del pórfido blando. Las constantes y extremos de referencia provienen de engine/data/constants.json. Salidas y distribuciones de tamaño se calculan aquí, sin cargar una traza guardada. No se introduce distribución medida, campaña energética ni otro conjunto externo. Fuente: https://github.com/fsantibanezleal/CAOS_OreFlow.')
    if topic == '02-flotation':
        section('Data', 'Datos',
                'Owner: OreFlow authors, MIT project licence. The authored copper-molybdenum circuit is supplied by pipeline.cases.catalog. The production engine calculates rougher feed, class rates and residence; batch sample times and numerical fitting settings are read through engine/data/constants.json. Nominal, shortened-bank and changed-dose records are freshly generated where the lesson uses them. Virtual batch values and the exact-rate reference share simulator assumptions and are not laboratory measurements. Source: https://github.com/fsantibanezleal/CAOS_OreFlow.',
                'Responsable: autores de OreFlow, licencia MIT. pipeline.cases.catalog aporta el circuito de cobre y molibdeno. El motor calcula alimentación rougher, tasas y residencia; tiempos batch y ajustes numéricos provienen de engine/data/constants.json. Los registros nominales, de banco corto y dosis modificada se generan cuando la lección los usa. Datos virtuales y referencia exacta comparten supuestos del simulador, sin ser mediciones de laboratorio. Fuente: https://github.com/fsantibanezleal/CAOS_OreFlow.')

    if topic == '03-learning':
        model_text = ('Ridge', 'Ridge and random forest', 'Ridge, random forest, histogram gradient boosting and fixed-kernel Gaussian process')[level - 1]
        model_es = ('Ridge', 'Ridge y bosque aleatorio', 'Ridge, bosque aleatorio, refuerzo por histogramas y proceso gaussiano de núcleo fijo')[level - 1]
        protocols = ('one interpolation split', 'interpolation and complete soft-case holdout', 'interpolation, complete soft-case holdout and a two-case chalcopyrite-group holdout')[level - 1]
        protocols_es = ('una partición de interpolación', 'interpolación y reserva del caso blando completo', 'interpolación, reserva del caso blando y reserva de ambos casos del grupo de calcopirita')[level - 1]
        section('Objectives', 'Objetivos',
                f'The lesson calculates recovery predictions with {model_text} under {protocols}. The four-case design contains 64 engine-generated states, with 16 states per case and seed 20261031. Physical provenance calculations distinguish simulator labels from plant observations. Model ranking concerns this declared target and bounded experiment, not the complete production learning study.',
                f'La lección calcula predicciones de recuperación con {model_es} mediante {protocols_es}. El diseño de cuatro casos contiene 64 estados del motor, dieciséis por caso, con semilla 20261031. Los cálculos físicos distinguen etiquetas del simulador y observaciones de planta. El orden de modelos corresponde a este objetivo y experimento acotado, no al estudio completo de producción.')
        section('Data', 'Datos',
                'Owner: OreFlow authors, MIT project licence. This notebook reads `data/derived/contract/operating_contract.json`; `pipeline.cases.catalog` supplies the four authored case definitions. Production `build_design` generates the 64 labels through the circuit engine. It does not read scores from learning.json or load deployed surrogate models. The operating states and ore factors are synthetic model inputs, not fabricated measurements. Source: https://github.com/fsantibanezleal/CAOS_OreFlow.',
                'Responsable: autores de OreFlow, licencia MIT. Se lee `data/derived/contract/operating_contract.json` y el catálogo aporta cuatro definiciones de casos. `build_design` genera 64 etiquetas mediante el motor de circuito. No se leen puntuaciones de learning.json ni modelos desplegados. Estados y factores minerales son entradas sintéticas del modelo, no mediciones inventadas. Fuente: https://github.com/fsantibanezleal/CAOS_OreFlow.')
        section('Method', 'Método',
                f'{model_text} predict recovery percentage using the production physical feature matrix. The design has four cases: soft/hard porphyry, oxide copper and fine magnetite. Each fitting call receives only its protocol training indices; reserved rows supply the reported RMSE, MAE and R2. Ridge and GP use StandardScaler inside their training pipelines. Hyperparameters are fixed before testing. This lesson measures point prediction only. It does not fit an MLP, estimate GP coverage, calculate permutation importance, train an out-of-envelope detector or reproduce a twelve-case production bake. The three production targets remain visible as label provenance, but only recovery is fitted here.',
                f'{model_es} predicen porcentaje de recuperación desde la matriz física de producción. Hay pórfido blando y duro, cobre oxidado y magnetita fina. Cada ajuste recibe solo índices de entrenamiento; las filas reservadas aportan RMSE, MAE y R2. Ridge y el proceso gaussiano usan StandardScaler dentro de sus pipelines. Los hiperparámetros se fijan antes de probar. Se mide predicción puntual: no se ajusta MLP, estima cobertura, calcula importancia por permutación ni entrena detector fuera de dominio; tampoco se reproduce el precálculo de doce casos. Los tres objetivos aparecen como procedencia de etiquetas, pero aquí solo se ajusta recuperación.')
        if level == 3:
            section('Comparison', 'Comparación',
                    'The four named sklearn estimators use identical training/test indices within each protocol. Random forest uses forty trees, histogram boosting forty iterations and a four-row minimum leaf. The GP uses a fixed RBF kernel and no hyperparameter optimization; its predictions have no calibrated-interval claim. Breiman (2001), Friedman (2001) and Rasmussen and Williams (2006) motivate these reference methods. Interpolation reserves 16 rows, the case fold reserves 16, and the ore-group fold reserves 32. The two transfer questions differ because the case fold retains a related hard-porphyry example while the group fold removes both related cases.',
                    'Los cuatro estimadores sklearn usan índices idénticos dentro de cada protocolo. El bosque usa cuarenta árboles; el refuerzo, cuarenta iteraciones y cuatro filas mínimas por hoja. El proceso gaussiano usa RBF fijo sin optimizar hiperparámetros y sin afirmar intervalos calibrados. Breiman (2001), Friedman (2001) y Rasmussen y Williams (2006) fundamentan las referencias. Se reservan dieciséis filas en interpolación y caso, y treinta y dos en grupo mineral. El pliegue de caso conserva el pórfido duro relacionado; el de grupo retira ambos casos.')
        section('Summary', 'Resumen',
                f'The executed reference experiment compares {model_text} using {protocols} on four authored circuits. Prediction ranges, negative R2 and target units remain visible. Performance here approximates the circuit equations under the selected design; an independently measured campaign and a deployment-specific loss would be needed for a plant-transfer claim.',
                f'El experimento compara {model_es} mediante {protocols_es} sobre cuatro circuitos de autoría. Se conservan rangos, R2 negativos y unidades. Se aproximan ecuaciones bajo el diseño elegido; afirmar transferencia de planta exigiría una campaña medida independiente y una pérdida específica del uso.')
    if topic == '04-optimization':
        section('Objectives', 'Objetivos',
                ('The authored fine-magnetite circuit supplies a one-dimensional grind-target problem. The lesson records endpoint status and exact engine cost for ' +
                 ('equal normalized metal/energy weights.' if level == 1 else 'weights 0, 0.5 and 1 under identical bounds.' if level == 2 else 'screened and unscreened production searches with equal weights.') +
                 ' Feasibility, mesh convergence and physical agreement are distinct observed outcomes; none is assumed in advance.'),
                ('El circuito de magnetita fina aporta un problema unidimensional de molienda. Se registran estado y costo exacto para ' +
                 ('pesos normalizados iguales de metal y energía.' if level == 1 else 'pesos 0, 0.5 y 1 con límites idénticos.' if level == 2 else 'búsquedas de producción con y sin filtro y pesos iguales.') +
                 ' Factibilidad, convergencia y acuerdo físico son resultados distintos y no se presuponen.'))
        data_en = ('Owner: OreFlow authors, MIT project licence. Inputs are the authored `iron_magnetite_fine` case in the production catalog and `data/derived/contract/operating_contract.json`. No measured plant dataset or economic model is used.')
        data_es = ('Responsable: autores de OreFlow, licencia MIT. Las entradas son el caso `iron_magnetite_fine` del catálogo y `data/derived/contract/operating_contract.json`. No se usa un conjunto medido de planta ni modelo económico.')
        if level >= 3:
            data_en += ' Screening reads the committed process_screen.json, process_surrogate.json and companion model files under models/.'
            data_es += ' El filtro lee process_screen.json, process_surrogate.json y archivos compañeros comprometidos en models/.'
        if level == 4:
            data_en += ' The separate current cohort reads data/derived/cases/*.json; its engine version, contract digest and SHA-256 are printed from those actual files.'
            data_es += ' La cohorte actual separada lee data/derived/cases/*.json; versión, digest contractual y SHA-256 se calculan desde esos archivos.'
        section('Data', 'Datos', data_en + ' Source: https://github.com/fsantibanezleal/CAOS_OreFlow.',
                data_es + ' Fuente: https://github.com/fsantibanezleal/CAOS_OreFlow.')
        section('Method', 'Método',
                'The production generalized pattern search uses a progressive barrier on normalized grade, required-power and process-water violations. Its objective is weighted recovered metal divided by nominal metal minus weighted specific energy divided by nominal energy. Equal weights mean 0.5 on each normalized term, not equal prices. The full production multistart and stopping rules are retained. Each run reports exact candidate calls, status, decisions, physical slacks and per-start stops. A least-violating point is not renamed an optimum, and a base refusal supplies no physical result. Independent terminal audits are additional checks outside the candidate-call metric.',
                'La búsqueda de patrones de producción usa barrera progresiva sobre violaciones normalizadas de ley, potencia requerida y agua. El objetivo combina metal recuperado respecto del nominal menos energía específica respecto de la nominal. Pesos iguales significan 0.5 por término, no precios iguales. Se conservan multicomienzo y detención de producción. Cada corrida informa llamadas, estado, decisiones, holguras y detención por comienzo. Un punto de menor violación no se renombra óptimo y una base rechazada no aporta resultado físico. Las auditorías terminales quedan fuera del conteo de candidatos.')
        if level >= 3:
            section('Comparison', 'Comparación',
                    'Both fresh searches use the same magnetite case, nominal start, operating contract, bounds, weights and production stopping settings. The screen prioritizes proposals, while the process engine remains the evaluator. Count differences measure algorithmic work, not elapsed-time speed. The decision table compares physical and normalized differences at declared tolerance 1e-8, and agreement additionally requires feasible endpoints and available audits. Actual decision agreement is measured rather than inferred from a matched recovery rounded to three decimals.',
                    'Las búsquedas nuevas comparten caso, nominal, contrato, límites, pesos y detención. El filtro prioriza propuestas y el motor sigue evaluando. Las diferencias de conteos miden trabajo, no velocidad temporal. La tabla compara diferencias físicas y normalizadas con tolerancia 1e-8; el acuerdo exige además factibilidad y auditorías disponibles. El acuerdo se mide, sin inferirlo de recuperaciones redondeadas iguales.')
        if level == 4:
            section('Evidence', 'Evidencia',
                    'The fresh one-case experiment measures exact calls, screened proposal errors, endpoint validity and decision differences. The broad cohort is a separate aggregation of the current committed case records, not an assumed historical archive. Sorted filenames and exact file bytes define its SHA-256; all files must share a declared engine version and contract digest. A difference from the fresh search code version remains visible and is not silently relabelled. Cohort counts include only records carrying their paired unscreened result.\n\nThe signed excess is screened minus unscreened evaluations. Negative means fewer exact calls, zero equality, and positive additional work. Saving and additional-work pair counts are calculated rather than predetermined. Prediction residuals do not themselves establish an optimization saving. When no proposal has an exact engine value, the figure explicitly reports no accuracy estimate instead of presenting an unexplained empty scatter. These authored scenarios are not independent operating plants; descriptive pair totals do not supply a population confidence interval or plant validation.',
                    'El experimento nuevo mide llamadas, errores de propuestas, validez de extremos y diferencias de decisión. La cohorte amplia agrega registros actuales comprometidos, sin suponer un archivo histórico. Nombres ordenados y bytes exactos definen SHA-256; todos los archivos deben compartir versión y digest contractual. Una diferencia con la versión del código nuevo queda visible. Solo se cuentan registros con contraparte sin filtro.\n\nEl exceso es evaluaciones con filtro menos sin filtro: negativo significa menos llamadas, cero igualdad y positivo trabajo adicional. Los conteos de ahorro y costo adicional se calculan. Los residuos predictivos no establecen ahorro de optimización. Si ninguna propuesta tiene valor exacto, la figura declara que no existe estimación en vez de mostrar dispersión vacía sin explicación. Los escenarios no son plantas independientes; los totales descriptivos no aportan confianza poblacional ni validación de planta.')
        section('Summary', 'Resumen',
                'The fresh constrained-search outcomes are conditional on the magnetite definition, contract and recorded preferences. Status, slacks and stop reasons qualify any reported endpoint. Search cost and decision agreement are measured separately. A current cohort, where present, has its own printed release/contract/file identity and observed signed cost; no fixed historical total or conclusion is inherited. Plant operation would additionally require calibration, economics and uncertainty margins.',
                'Los resultados nuevos dependen de magnetita, contrato y preferencias registradas. Estado, holguras y detención califican cada extremo. Costo y acuerdo se miden por separado. La cohorte, cuando corresponde, tiene identidad de versión, contrato y archivos, además de costo con signo observado; no hereda totales ni conclusiones históricas. Operar una planta exigiría calibración, economía y márgenes de incertidumbre.')
    if topic == '05-uncertainty':
        section('Objectives', 'Objetivos',
                'The notebook propagates 32 seeded Latin-hypercube ore-factor draws through the exact soft-porphyry circuit.' +
                (' Its question concerns solved recovery spread and the all-attempt constraint denominator.' if level == 1 else
                 ' Production Saltelli/Sobol calculations at base N=8 and N=16 then expose finite-design variance effects and bootstrap widths.') +
                ' The experiment calculates new outputs rather than reading a committed uncertainty score table.',
                'Se propagan 32 sorteos minerales de hipercubo latino por el circuito exacto de pórfido blando.' +
                (' La pregunta comprende dispersión de recuperaciones resueltas y denominador de restricciones sobre intentos.' if level == 1 else
                 ' Después se ejecuta Saltelli/Sobol de producción con N=8 y N=16 para examinar efectos finitos y semiamplitudes bootstrap.') +
                ' Se calculan salidas nuevas, sin leer una tabla guardada de puntuaciones.')
        section('Data', 'Datos',
                'Owner: OreFlow authors, MIT project licence. The production case catalog defines the nominal soft-porphyry ore and circuit. engine/data/constants.json defines the independent uniform ore-factor half-widths, seed-related method defaults and sensitivity tolerances. The notebook passes its stated sample counts and seed 20261031 to the production uncertainty methods. No operating-contract file, deployed screen, archived study table or measured uncertainty distribution is loaded here. Source: https://github.com/fsantibanezleal/CAOS_OreFlow.',
                'Responsable: autores de OreFlow, licencia MIT. El catálogo define mineral y circuito nominales del pórfido blando. engine/data/constants.json declara semiamplitudes uniformes independientes y tolerancias de sensibilidad. Se entregan cantidades de muestras explícitas y semilla 20261031 a los métodos de incertidumbre. No se carga contrato operativo, filtro desplegado, tabla archivada ni distribución medida. Fuente: https://github.com/fsantibanezleal/CAOS_OreFlow.')
    distinct_scope_sections(notebook, section)
    for cell in notebook['cells']:
        if cell['cell_type'] == 'markdown':
            text = ''.join(cell['source'])
            if not text.startswith(('## References', '## Referencias')):
                cell['source'] = formal_copy(text, lang).splitlines(keepends=True)
        elif cell['cell_type'] == 'code':
            cell['source'] = '\n'.join(formal_copy(line, lang) if line.lstrip().startswith('#') else line
                                       for line in ''.join(cell['source']).splitlines()).splitlines(keepends=True)
    meta['title'] = formal_copy(meta['title'], lang)


def distinct_scope_sections(notebook, section):
    """Describe the particular level's experiment, rather than sharing production-wide promises."""
    meta = notebook['metadata']['caos']
    topic, level = meta['topic'], meta['level']
    methods = {
    '03-learning': [
        ('The first regression task uses recovery as its sole fitted target. Four authored cases contribute sixteen engine states each; production features describe ore and operating conditions without an explicit case identifier. Ridge learns from 48 interpolation-training rows after StandardScaler fits those rows alone. The remaining sixteen rows are predicted once and supply RMSE, MAE and R2. Three separate nominal circuit solves establish where labels originate. Case identity can still be encoded indirectly by physical features, so this within-design test concerns interpolation among represented cases rather than a new ore population.',
         'La primera regresión ajusta solo recuperación. Cuatro casos aportan dieciséis estados cada uno; las variables describen mineral y operación sin identificador de caso explícito. Ridge aprende con 48 filas después de ajustar StandardScaler solo en ellas. Dieciséis filas reservadas aportan RMSE, MAE y R2. Tres resoluciones nominales establecen procedencia de etiquetas. Las propiedades pueden codificar identidad indirectamente; esta prueba es interpolación entre casos representados, no otra población mineral.'),
        ('Ridge and a forty-tree random forest are fitted separately on two protocols built from the same 64 generated rows. Interpolation has 48 training and sixteen test rows; the complete soft-porphyry holdout also has 48/16 but removes all sampled states of that case. The hard-porphyry sibling remains in training. Ridge standardization is refitted within each training partition, while the forest uses physical features directly and fixed minimum leaf size two. Nominal provenance probes and one finer soft-porphyry solve distinguish case offsets from operating response. Recovery errors are compared within a protocol before interpreting a model-rank change across protocols.',
         'Ridge y un bosque de cuarenta árboles se ajustan por separado en dos protocolos del mismo diseño de 64 filas. Interpolación tiene 48 filas de entrenamiento y dieciséis de prueba; reservar pórfido blando mantiene 48/16 y retira todos sus estados. Su par duro sigue en entrenamiento. Ridge reajusta estandarización en cada partición; el bosque recibe variables físicas y mínimo de dos filas por hoja. Las pruebas nominales y una molienda más fina distinguen diferencias entre casos y respuesta operativa. Los errores se comparan primero dentro de cada protocolo.'),
        ('The comparison fits four named estimators on 22 production features and one target, recovery percentage. Every estimator uses identical rows within interpolation, soft-case holdout and two-case chalcopyrite-group holdout. The first two protocols reserve sixteen rows; group transfer reserves 32 and trains on the other 32. Ridge and the fixed-RBF Gaussian process standardize using their training pipeline. Forest and histogram boosting use declared fixed settings. The GP produces point predictions with kernel optimization disabled. Scores and absent-group prediction plots are computed from actual predictions. Negative R2 and unbounded reference-model predictions remain visible, rather than becoming a claim of physically admissible plant forecasting.',
         'Se ajustan cuatro estimadores sobre 22 variables de producción y recuperación como único objetivo. Comparten filas en interpolación, reserva de caso blando y reserva de ambos casos de calcopirita. Los dos primeros protocolos reservan dieciséis filas; grupo reserva 32 y entrena con otras 32. Ridge y el proceso gaussiano RBF fijo estandarizan dentro del entrenamiento. Bosque y refuerzo usan ajustes declarados. El proceso gaussiano entrega predicción puntual sin optimizar núcleo. Puntuaciones y figura del grupo ausente proceden de predicciones reales. Se conservan R2 negativos y predicciones de referencia no acotadas, sin afirmar pronóstico físicamente admisible de planta.')],
    '04-optimization': [
        ('The introductory search controls only the grind target of authored fine magnetite. Its objective assigns 0.5 to recovered metal divided by nominal metal and 0.5 to the negative of specific energy divided by nominal energy. Grade, required power and water remain constraints. The production progressive-barrier multistart returns a feasible optimum, a least-violating endpoint, or a refused base as distinct statuses. A separate circuit audit is attempted only for a defined state. Exact candidate counts exclude that audit. The endpoint table links the reported grind to its feasibility, slacks and actual stopping reasons rather than assuming success from the existence of a decision vector.',
         'La búsqueda inicial controla solo molienda de magnetita fina. El objetivo asigna 0.5 al metal respecto del nominal y 0.5 a energía específica negativa respecto de la nominal. Ley, potencia requerida y agua siguen como restricciones. La barrera progresiva multicomienzo distingue óptimo factible, extremo de menor violación y base rechazada. Se intenta auditoría separada solo para un estado definido, fuera del conteo de candidatos. La tabla relaciona molienda, factibilidad, holguras y detención real, sin asumir éxito porque exista un vector.'),
        ('Three complete production searches hold the magnetite circuit, contract and starts fixed while changing recovered-metal weight to 0, 0.5 and 1. The complementary energy weight is one minus that value. These are preferences in normalized physical outputs, not electricity or commodity prices. Each run retains its own status, endpoint slacks, convergence field and start-level stops. Physical but infeasible endpoints are plotted with explicit markers; refused outcomes remain in the table without invented coordinates. The equal-weight endpoint also receives an independent engine audit, so the interpretation separates preference, physical feasibility and a mesh-based stopping rule.',
         'Tres búsquedas completas mantienen circuito, contrato y comienzos mientras cambian peso de metal a 0, 0.5 y 1. El peso energético es complementario. Son preferencias físicas normalizadas, no precios. Cada corrida conserva estado, holguras, convergencia y detención por comienzo. Los extremos físicos infactibles se identifican en la figura; los rechazados permanecen en tabla sin coordenadas inventadas. El punto intermedio recibe auditoría independiente, separando preferencia, factibilidad y regla de malla.'),
        ('The screened and unscreened production optimizers solve the same one-dimensional magnetite problem at weight 0.5. Candidate cost is counted by exact circuit evaluations, while the learned search step only prioritizes proposals. Both reported endpoints are independently audited when their states can be solved. A separate table calculates screened-minus-unscreened physical decisions and divides each difference by its contract range. The explicitly stated 1e-8 tolerance tests numerical decision agreement, not optimality. Agreement additionally requires feasible endpoints and available audits; physical metric deltas and cost differences remain separate evidence.',
         'Los optimizadores con y sin filtro resuelven el mismo problema unidimensional con peso 0.5. El costo cuenta evaluaciones exactas y el paso aprendido solo prioriza propuestas. Ambos extremos reciben auditoría cuando son resolubles. Otra tabla calcula diferencias físicas y las normaliza por rango contractual. La tolerancia 1e-8 prueba acuerdo numérico, no optimalidad. Se requieren además factibilidad y auditorías; las diferencias de métricas físicas y costos permanecen como evidencia separada.'),
        ('The evidence experiment joins a fresh matched search pair with an independently identified committed cohort. For the pair, exact calls, proposal residuals, status, constraint slacks and decision agreement are observed together. A proposal is eligible for an error calculation only when it has an exact engine response. The cohort is read from the current case files and identified by their engine version, contract digest and a SHA-256 of sorted names plus bytes. Its total signed excess and counts of saving/equal/additional-work pairs are calculated from those records, without importing fixed old totals or a predetermined direction of benefit.',
         'La evidencia combina una pareja nueva emparejada y una cohorte comprometida identificada aparte. Se observan llamadas, residuos, estado, holguras y acuerdo de decisiones. Solo propuestas con respuesta exacta aportan error. La cohorte se lee de archivos actuales y se identifica mediante versión, digest contractual y SHA-256 de nombres ordenados y bytes. Su exceso y cantidades de parejas con ahorro, igualdad o trabajo adicional se calculan, sin importar totales anteriores ni una dirección de beneficio predeterminada.')],
    '05-uncertainty': [
        ('The production uncertainty propagator draws 32 Latin-hypercube states at seed 20261031 from declared independent uniform ore factors. Work index, head grade, liberation scale and floatability act through the actual circuit equations. Two deterministic liberation perturbations at 0.9 and 1.1 provide local physical context but are not uncertainty bounds. Recovery P05/P95 summarize only solved draws. Joint grade/power/water feasibility uses every attempt, including refused states as failures. The nominal solve is one reference point, not the distribution mean. Factor half-widths and refusals accompany the output so the interval remains conditional on its authored assumptions.',
         'El propagador sortea 32 estados de hipercubo latino con semilla 20261031 y factores uniformes independientes. Dureza, ley, liberación y flotabilidad actúan por las ecuaciones del circuito. Perturbaciones de liberación 0.9 y 1.1 aportan contexto local, no límites de incertidumbre. P05/P95 resumen sorteos resueltos; factibilidad conjunta usa todos los intentos e incluye rechazos como fallas. El nominal es una referencia, no la media. Semiamplitudes y rechazos mantienen explícitos los supuestos de autoría.'),
        ('The practical lesson first calculates the same 32-draw conditional output distribution, retaining attempted and solved denominators. It then calls the production Saltelli/Sobol sensitivity method at base N=8 and N=16 with the same seed and factor ranges. For four factors these designs require 48 and 96 circuit evaluations respectively. Structured hybrid rows cannot be dropped after a refusal; the method reports that invalid design instead. First-order and total effects answer different variance questions, and their bootstrap half-widths quantify finite-estimator stability. Constant output is treated as a declared numerical condition rather than ranked from roundoff.',
         'Primero se calcula distribución de 32 sorteos con denominadores de intentos y resueltos. Después se ejecuta Saltelli/Sobol de producción con N=8 y N=16, iguales semilla y rangos. Cuatro factores requieren 48 y 96 evaluaciones. Las filas híbridas no pueden eliminarse tras un rechazo: se informa diseño inválido. Primer orden y total responden preguntas de varianza distintas y bootstrap cuantifica estabilidad finita. Una salida constante se reconoce numéricamente, sin ordenar redondeo.'),
        ('The published-method comparison doubles the Saltelli base design from eight to sixteen while holding factor ranges, nominal circuit and seed fixed. Production sensitivity calculates S1, ST and bootstrap half-widths from each complete structured design. Rank-order agreement is derived from the computed ST vectors rather than assumed. The preceding 32-draw Latin hypercube illustrates output scale; it is not another Sobol estimator or an independent physical dataset. Refused hybrid rows and numerically constant recovery stop unsupported ranking. Small-N negative estimates and wide intervals remain visible, so a matching point order does not by itself establish a robust importance claim.',
         'La comparación duplica base Saltelli de ocho a dieciséis con rangos, circuito y semilla fijos. El método calcula S1, ST y semiamplitudes en cada diseño estructurado. El acuerdo de orden proviene de los ST calculados. El hipercubo previo de 32 sorteos muestra escala de salida; no es otro estimador Sobol ni conjunto físico independiente. Rechazos y constancia detienen órdenes sin fundamento. Se conservan estimaciones negativas e intervalos amplios: coincidir en orden puntual no establece importancia robusta.')],
    }
    summaries = {
    '03-learning': [
        ('The entry fit uses 48 training rows to predict sixteen reserved rows from a 64-state simulator design. Label provenance and units precede any model ranking. No ore case is absent from training in this interpolation question.',
         'El ajuste inicial usa 48 filas para predecir dieciséis reservadas dentro de 64 estados. Procedencia y unidades preceden cualquier orden de modelos. En esta pregunta de interpolación no falta un caso mineral al entrenar.'),
        ('The practical comparison removes all sampled soft-porphyry states before fitting each estimator, while retaining the hard sibling. Its case-transfer residual pattern therefore qualifies the model ranking; neither shared row count nor a favourable pooled score establishes missing-ore-group transfer.',
         'Se retiran todos los estados del pórfido blando antes de ajustar y se conserva el par duro. El patrón residual califica el orden de modelos; igual cantidad de filas o buena puntuación agregada no establece transferencia al faltar el grupo mineral.'),
        ('Four reference estimators are compared over four authored circuits with common protocol-specific partitions. The absent-group figure and negative-score count expose failures that interpolation alone misses. This point-prediction experiment remains separate from production-wide learning diagnostics and independently observed plant performance.',
         'Se comparan cuatro referencias en cuatro circuitos con particiones comunes por protocolo. La figura de grupo ausente y el conteo negativo exponen fallas que interpolación no revela. El experimento puntual se mantiene separado de diagnósticos completos de producción y desempeño observado de planta.')],
    '04-optimization': [
        ('A reported grind is meaningful with its endpoint status and constraint slacks. The introductory trace explains the production search stop, while the independent audit distinguishes an engine-defined outcome from a refused base. Candidate counts describe search work only.',
         'La molienda informada tiene sentido con estado y holguras. La traza explica detención de producción y la auditoría distingue un estado definido de una base rechazada. El conteo describe solo trabajo de búsqueda.'),
        ('The three preference endpoints retain individual feasibility and stopping information. Differences in recovered mass and energy follow from the specified normalized weights, without an economic utility claim or an interpolated feasible frontier.',
         'Los tres extremos conservan factibilidad y detención individuales. Diferencias de masa y energía proceden de pesos normalizados, sin afirmar utilidad económica ni frontera factible interpolada.'),
        ('Paired cost and numerical decision agreement are separately measured. A lower exact-call count would not certify better physics, and a matched recovery rounded for display would not establish equal decisions. The tables expose the underlying endpoint and normalized deltas.',
         'Costo pareado y acuerdo numérico se miden aparte. Menor conteo no certificaría mejor física; recuperaciones redondeadas coincidentes tampoco prueban decisiones iguales. Las tablas exponen extremos y diferencias normalizadas.'),
        ('The displayed current-cohort identity limits the scope of aggregate cost evidence. Fresh proposal accuracy, paired exact work and valid endpoint agreement remain distinct tests. The observed signed counts determine whether this cohort saves calls; no outcome is inherited from a prior release.',
         'La identidad actual limita el alcance de los agregados. Precisión de propuestas, trabajo exacto y acuerdo válido son pruebas distintas. Los conteos con signo determinan si esta cohorte ahorra llamadas; no se hereda resultado de otra versión.')],
    '05-uncertainty': [
        ('The 32-draw histogram and quantiles describe a declared ore scenario, while joint feasibility retains all attempted states. The nominal marker and local liberation probes explain physical scale without turning the scenario into a measured frequency forecast.',
         'Histograma y cuantiles de 32 sorteos describen un escenario declarado y factibilidad conserva intentos. Nominal y pruebas locales explican escala física sin convertirlo en pronóstico medido de frecuencias.'),
        ('Solved-quantile and all-attempt feasibility denominators answer different questions. The two finite sensitivity budgets add estimator variability and interaction context; their intervals belong beside the point estimates before any factor ranking is interpreted.',
         'Los denominadores de cuantiles y factibilidad responden preguntas diferentes. Los presupuestos finitos agregan variabilidad e interacciones; sus intervalos acompañan estimaciones antes de interpretar un orden.'),
        ('Doubling this small structured design tests stability at fixed assumptions. Computed order agreement, bootstrap widths and any refusal or constant-output condition jointly limit the conclusion. Independent geological dependence and structural-model uncertainty remain outside these variance estimates.',
         'Duplicar este diseño pequeño prueba estabilidad con supuestos fijos. Acuerdo, bootstrap, rechazo o constancia limitan conjuntamente la conclusión. Dependencia geológica y error estructural quedan fuera de estas estimaciones de varianza.')],
    }
    if topic in methods:
        section('Method', 'Método', *methods[topic][level - 1])
        section('Summary', 'Resumen', *summaries[topic][level - 1])
    if topic == '03-learning':
        objectives = [
            ('The entry lesson constructs physical feature/target provenance and fits Ridge recovery on a 48/16 interpolation split of 64 simulated states. The three case probes establish the interpretation of labels before one model and one validation question are examined.',
             'Construir procedencia física de variables y objetivos y ajustar Ridge con partición 48/16 de 64 estados. Tres pruebas de casos establecen significado de etiquetas antes de examinar un modelo y una pregunta.'),
            ('The practical lesson compares Ridge and random forest when interpolation rows or a complete soft-porphyry case are withheld. Shared generated data isolate the changed validation boundary; the related hard-porphyry training case makes the transfer scope explicit.',
             'Comparar Ridge y bosque al reservar filas interpoladas o el caso completo de pórfido blando. Compartir datos aísla la frontera de validación y conservar el par duro explicita el alcance de transferencia.'),
            ('The comparison fits four named sklearn references for recovery on the same four-case design and three validation protocols. Computed scores and prediction ranges show whether interpolation ranking survives case and ore-group exclusion, without expanding the lesson to unrelated production diagnostics.',
             'Ajustar cuatro referencias sklearn de recuperación sobre cuatro casos y tres protocolos. Puntuaciones y rangos calculados muestran si el orden interpolado se conserva al excluir caso o grupo, sin extender la lección a diagnósticos de producción ajenos.')]
        section('Objectives', 'Objetivos', *objectives[level - 1])
    if topic == '04-optimization' and level >= 3:
        objectives = [
            ('The paired-search lesson measures exact evaluation cost and selected-decision agreement on the same magnetite problem at weight 0.5. Endpoint statuses and independent physical deltas qualify whether the two reported solutions actually agree, rather than inferring agreement from rounded recovery.',
             'Medir costo exacto y acuerdo de decisiones en el mismo problema de magnetita con peso 0.5. Estados y diferencias físicas independientes califican coincidencia real, sin inferirla de recuperaciones redondeadas.'),
            ('The evidence lesson examines evaluated proposal errors and complete paired costs, then identifies and aggregates the current committed case cohort. Release, contract and file identity accompany observed cohort counts so neither a historical sign nor one small teaching pair determines the broader conclusion.',
             'Examinar errores de propuestas y costos pareados completos, e identificar y agregar la cohorte comprometida actual. Versión, contrato e identidad de archivos acompañan conteos, sin determinar la conclusión amplia desde un signo histórico ni una pareja pequeña.')]
        section('Objectives', 'Objetivos', *objectives[level - 3])
        comparisons = [
            ('The direct reference is the same production pattern search with the learned proposal step disabled. Both calls retain case, base, weight 0.5, contract and stopping settings. The additional unscreened record inside the screened call supplies a fresh-cache consistency reference. Exact work, decision tolerance and independent metric differences are measured on the actual pair rather than inherited from a stored optimum.',
             'La referencia directa es la misma búsqueda sin propuestas aprendidas. Se conservan caso, base, peso 0.5, contrato y detención. El registro adicional sin filtro aporta referencia con caché nueva. Trabajo exacto, tolerancia y métricas se miden en la pareja real, sin heredar un óptimo guardado.'),
            ('The small fresh magnetite pair isolates one reproducible algorithm comparison; the separately identified committed cohort broadens descriptive coverage. These cohorts have different source identities and are never pooled as independent plant samples. Complete cost differences determine saving direction, while proposal residuals and status-qualified decision deltas address separate mechanism and validity questions.',
             'La pareja pequeña de magnetita aísla una comparación reproducible; la cohorte comprometida identificada amplía cobertura descriptiva. Sus identidades son distintas y no se agregan como plantas independientes. Diferencias completas determinan ahorro; residuos y decisiones calificadas responden preguntas separadas de mecanismo y validez.')]
        section('Comparison', 'Comparación', *comparisons[level - 3])
    if topic == '05-uncertainty' and level > 1:
        objectives = [
            ('The practical uncertainty calculation separates solved-output quantiles from all-attempt feasibility, then examines first/total Sobol effects at two finite budgets. Every summary is computed through the production engine at the declared seed.',
             'Separar cuantiles de salidas resueltas y factibilidad sobre intentos, y examinar efectos Sobol con dos presupuestos. Cada resumen se calcula mediante el motor a la semilla declarada.'),
            ('The research comparison asks whether total-effect ordering remains stable when the Saltelli base design doubles. Both designs share physical assumptions; rank agreement and bootstrap widths are calculated rather than inferred from a saved sensitivity table.',
             'Examinar estabilidad del orden total al duplicar base Saltelli con supuestos físicos compartidos. Acuerdo y bootstrap se calculan, sin inferirse de una tabla de sensibilidad guardada.')]
        section('Objectives', 'Objetivos', *objectives[level - 2])


def formal_copy(text, lang):
    if lang == 'en':
        replacements = {'You ran ': 'The lesson executed ', 'You will ': 'The lesson will ',
                        'You ': 'The lesson ',
                        'you can ': 'it is possible to ', 'your ': 'the ', 'Your ': 'The ',
                        'you ': 'the analysis ', 'We report ': 'The calculation reports ',
                        'We compare ': 'The comparison evaluates ', 'We do not ': 'The interpretation does not '}
        replacements['We call '] = 'The lesson calls '
        for before, after in replacements.items():
            text = text.replace(before, after)
        return text
    forms = {
        'Importa': 'Importar', 'Compara': 'Comparar', 'Lee': 'Leer', 'Inspecciona': 'Inspeccionar',
        'Conserva': 'Conservar', 'Grafica': 'Graficar', 'Calcula': 'Calcular', 'Resuelve': 'Resolver',
        'Evalúa': 'Evaluar', 'Ajusta': 'Ajustar', 'Usa': 'Usar', 'Ejecuta': 'Ejecutar',
        'Revisa': 'Revisar', 'Interpreta': 'Interpretar', 'Construye': 'Construir', 'Distingue': 'Distinguir',
        'Llama': 'Llamar', 'Dibuja': 'Dibujar', 'Carga': 'Cargar', 'Cambia': 'Cambiar', 'Mantén': 'Mantener',
        'Parte': 'Partir', 'Informa': 'Informar', 'Propaga': 'Propagar', 'Sigue': 'Seguir',
        'Solicita': 'Solicitar', 'Reconstruye': 'Reconstruir', 'Vuelve': 'Volver', 'Separa': 'Separar',
        'Genera': 'Generar', 'Selecciona': 'Seleccionar', 'Identifica': 'Identificar', 'Examina': 'Examinar',
        'Reduce': 'Reducir', 'Aumenta': 'Aumentar', 'Retira': 'Retirar', 'Obtén': 'Obtener',
        'Repite': 'Repetir', 'Pide': 'Solicitar', 'Muestra': 'Mostrar', 'Fija': 'Fijar',
        'Define': 'Definir', 'Comprueba': 'Comprobar', 'Toma': 'Tomar', 'Conecta': 'Conectar',
        'Restablece': 'Restablecer', 'Perturba': 'Perturbar', 'Reajusta': 'Reajustar', 'Duplica': 'Duplicar',
        'Registra': 'Registrar', 'Reevalúa': 'Reevaluar', 'Agrega': 'Agregar', 'Recalcula': 'Recalcular',
        'Crea': 'Crear', 'Acorta': 'Acortar', 'Activa': 'Activar', 'Mide': 'Medir', 'Mira': 'Observar',
    }
    pattern = r'(?m)(^|(?<=[.!?;])\s+)([\s#>*-]*)(%s)\b([^.!?\n]*)' % '|'.join(forms)
    def instruction(match):
        rest = match[4]
        for verb, infinitive in forms.items():
            rest = re.sub(r'\b([ye]) ' + verb.lower() + r'\b', lambda m: m[1] + ' ' + infinitive.lower(), rest)
        return match[1] + match[2] + forms[match[3]] + rest
    text = re.sub(pattern, instruction, text)
    negative = {'compares': 'comparar', 'interpretes': 'interpretar', 'sumes': 'sumar', 'uses': 'usar',
                'ajustes': 'ajustar', 'selecciones': 'seleccionar', 'multipliques': 'multiplicar',
                'normalices': 'normalizar', 'infieras': 'inferir', 'confundas': 'confundir',
                'elimines': 'eliminar', 'atribuyas': 'atribuir', 'descartes': 'descartar', 'trates': 'tratar'}
    for before, after in negative.items():
        text = re.sub(r'\b([Nn]o) ' + before + r'\b', r'\1 ' + after, text)
    for before, after in {'así puedes': 'así es posible', 'puedes ': 'es posible ', 'tu propio': 'el propio'}.items():
        text = text.replace(before, after)
    case_names = {'copper porphyry soft': '`copper_porphyry_soft`',
                  'copper porphyry hard': '`copper_porphyry_hard`', 'copper oxide': '`copper_oxide`',
                  'iron magnetite fine': '`iron_magnetite_fine`'}
    for before, after in case_names.items():
        text = text.replace(before, after)
    return text


def released_learning_challenge(notebook):
    """A separate inference experiment; never mix its released models into the fold ranking."""
    lang = notebook['metadata']['caos']['language']
    LABELS_ES.update({
        'Log10 upgrade': 'Log10 de enriquecimiento', 'All 32 states': 'Los 32 estados',
        'Soft porphyry': 'Pórfido blando', 'Hard porphyry': 'Pórfido duro', 'Copper oxide': 'Cobre oxidado',
        'Magnetite': 'Magnetita', 'Baseline': 'Base sin cambios', 'Work index': 'Índice de trabajo',
        'Grind target': 'Objetivo de molienda', 'Water': 'Agua', 'Cohort': 'Cohorte', 'Target': 'Objetivo',
        'Attempted': 'Intentos', 'Scored': 'Puntuados', 'Rejected': 'Rechazados', 'Bias': 'Sesgo',
        'Diagnostics': 'Diagnósticos', 'Case': 'Caso', 'Probe': 'Prueba', 'Row': 'Fila', 'Error': 'Error',
        'Threshold': 'Umbral', 'Accepted': 'Aceptados', 'Subset': 'Subconjunto', 'Nominal level': 'Nivel nominal',
        'Covered': 'Cubiertos', 'Coverage': 'Cobertura', 'Mean width (pp)': 'Amplitud media (pp)',
        'Release identity mismatch: ': 'Identidad de publicación incompatible: ',
        'Feature or target order mismatch: ': 'Orden incompatible de variables u objetivos: ',
        'Frozen threshold mismatch': 'Umbral publicado incompatible',
        'Model byte identity mismatch: ': 'Identidad de bytes del modelo incompatible: ',
        'Contract digest mismatch': 'Digest contractual incompatible', 'Artifact': 'Artefacto',
        'Release version:': 'Versión publicada:', 'Contract digest:': 'Digest contractual:',
        'Producer fingerprint:': 'Huella del productor:', 'Invalid released scaling': 'Escalado publicado inválido',
        'Frozen guard threshold:': 'Umbral fijo del guardia:', 'Feature': 'Variable',
        'Surrogate mean': 'Media de red', 'Surrogate scale': 'Escala de red',
        'Guard mean': 'Media del guardia', 'Guard scale': 'Escala del guardia',
        'Target mean': 'Media de objetivo', 'Target scale': 'Escala de objetivo',
        'Guard layer shapes:': 'Dimensiones de capas del guardia:',
        'Exported network/scaler reference mismatch: ': 'Referencia de red/escalador incompatible: ',
        'Global training-case inventory mismatch': 'Inventario global de casos incompatible',
        'Direct feature mapping mismatch: ': 'Mapeo directo de variable incompatible: ',
        'Index': 'Índice', 'Global min': 'Mínimo global', 'Global max': 'Máximo global',
        'Challenge seed must be separately predeclared': 'La semilla debe declararse por separado',
        'Challenge design shape mismatch': 'Forma incompatible del diseño de diagnóstico',
        'Challenge rows': 'Filas del diagnóstico', 'Challenge seed:': 'Semilla del diagnóstico:',
        'Target order:': 'Orden de objetivos:', 'Released target order mismatch': 'Orden publicado incompatible',
        'Invalid three-target predictions': 'Predicciones inválidas de los tres objetivos',
        'log10 ratio': 'razón log10', 'Prediction min': 'Mínimo predicho', 'Prediction max': 'Máximo predicho',
        'Reference min': 'Mínimo de referencia', 'Reference max': 'Máximo de referencia',
        'Engine target': 'Objetivo del motor', 'Neural prediction': 'Predicción neuronal',
        'Synthetic probe must exceed global bounds': 'La prueba sintética debe superar límites globales',
        'Nonfinite guard error or changed threshold': 'Error no finito o umbral modificado',
        'Baseline accepted/rejected:': 'Bases aceptadas/rechazadas:',
        'Shifted accepted/rejected:': 'Desplazadas aceptadas/rechazadas:',
        'Frozen threshold changed': 'Umbral fijo modificado',
        'Positive threshold required for ratio plot': 'Se exige umbral positivo para graficar razones',
        'Frozen threshold': 'Umbral fijo', 'Reconstruction error / threshold': 'Error de reconstrucción / umbral',
        'Controlled feature challenge': 'Diagnóstico controlado de variables',
        'Invalid GP mean or standard deviation': 'Media o desviación GP inválidas',
        'GP interval centre: production GP mean': 'Centro del intervalo GP: media del GP de producción',
        'Per-case coverage resolution:': 'Resolución de cobertura por caso:',
        'Nominal coverage': 'Cobertura nominal', 'Empirical coverage': 'Cobertura empírica',
        'Unfiltered recovery GP intervals': 'Intervalos GP de recuperación sin filtrar',
        'GP mean and 95% interval': 'Media GP e intervalo al 95%', 'Engine recovery': 'Recuperación del motor',
        'Challenge row': 'Fila del diagnóstico', 'Production GP centre and exact targets': 'Centro GP y objetivos exactos',
        'Cohort|Target|Unit|Attempted|Scored|Rejected|RMSE|MAE|Bias|Diagnostics|Case|Probe|Row|Value|'
        'Error|Threshold|Accepted|Subset|Nominal level|N|Covered|Coverage|Mean width (pp)':
        'Cohorte|Objetivo|Unidad|Intentos|Puntuados|Rechazados|RMSE|MAE|Sesgo|Diagnósticos|Caso|Prueba|Fila|Valor|'
        'Error|Umbral|Aceptados|Subconjunto|Nivel nominal|N|Cubiertos|Cobertura|Amplitud media (pp)',
        'Cohort|Target|Unit|Attempted|Scored|Rejected|RMSE|MAE|Bias|Diagnostics':
        'Cohorte|Objetivo|Unidad|Intentos|Puntuados|Rechazados|RMSE|MAE|Sesgo|Diagnósticos',
        'Case|Probe|Row|Value|Error|Threshold|Accepted|Subset':
        'Caso|Prueba|Fila|Valor|Error|Umbral|Aceptados|Subconjunto',
        'Nominal level|N|Covered|Coverage|Mean width (pp)':
        'Nivel nominal|N|Cubiertos|Cobertura|Amplitud media (pp)',
        'All rows': 'Todas las filas', 'Guard-accepted rows': 'Filas aceptadas por el guardia',
    })
    extra = [md(pair(
        '### Part 2: Challenge the released artifacts\n\nThe first experiment refitted four references on reserved folds. '
        'This second experiment evaluates already trained production networks and a separate recovery GP on 32 '
        'new simulator states. Every authored case family was available during production training; a new Sobol '
        'seed does not turn these models into unseen-case learners. No weights, scalers, threshold or GP parameters '
        'are fitted here. A release mismatch must stop this experiment before inference.',
        '### Parte 2: Examinar los artefactos publicados\n\nEl primer experimento reajustó cuatro referencias con '
        'pliegues reservados. El segundo evalúa redes de producción ya entrenadas y otro GP de recuperación en '
        '32 estados nuevos del simulador. Todas las familias de casos estuvieron disponibles durante entrenamiento '
        'de producción; otra semilla Sobol no convierte estos modelos en predictores de casos ausentes. No se '
        'ajustan pesos, escaladores, umbral ni parámetros GP. Una identidad de versión incompatible debe detener '
        'este experimento antes de inferencia.', lang))]
    step(extra, lang,
         'Keep case names, target units and table labels separate from production identifiers. The two '
         'experiments share feature definitions but retain different cohorts and training histories.',
         'Separar nombres de casos, unidades y rótulos de los identificadores de producción. Los dos '
         'experimentos comparten definiciones de variables y conservan cohortes e historiales diferentes.',
         '''target_labels = ['Recovery (%)', 'Log10 upgrade', 'Specific energy (kWh/t)']
case_labels = {'all': 'All 32 states', 'copper_porphyry_soft': 'Soft porphyry',
               'copper_porphyry_hard': 'Hard porphyry', 'copper_oxide': 'Copper oxide',
               'iron_magnetite_fine': 'Magnetite'}
probe_labels = ['Baseline', 'Work index', 'Grind target', 'Water']
header_keys = ('cohort target unit attempted scored rejected rmse mae bias observable',
               'case probe row feature_value error threshold accepted subset level n hits coverage mean_width')
header_values = ('Cohort|Target|Unit|Attempted|Scored|Rejected|RMSE|MAE|Bias|Diagnostics',
                 'Case|Probe|Row|Value|Error|Threshold|Accepted|Subset',
                 'Nominal level|N|Covered|Coverage|Mean width (pp)')
challenge_headers = dict(zip(' '.join(header_keys).split(), '|'.join(header_values).split('|')))

def challenge_frame(rows):
    frame = pd.DataFrame(rows, dtype=object)
    labels = {'all': 'All rows', 'guard_accepted': 'Guard-accepted rows', 'baseline': 'Baseline'}
    for column in ('cohort', 'subset', 'probe'):
        if column in frame:
            frame[column] = frame[column].replace(labels)
    return frame.rename(columns=challenge_headers)''')
    step(extra, lang,
         'Define the release preflight before reading predictions. Require learning-v2, the running engine version, '
         'the same contract digest, exact feature/target order and the released guard threshold. The export record '
         'declares fixed model filenames and byte counts; supplied SHA values are checked. Fresh hashes identify '
         'every model/scaler byte read, but are not a signed release manifest.',
         'Definir la verificación previa a predicciones. Exigir learning-v2, versión del motor en ejecución, mismo '
         'digest contractual, orden exacto de variables y objetivos, y umbral publicado. El registro declara nombres '
         'de modelo y cantidades de bytes; se comprueban SHA declarados cuando existen. Los hashes calculados '
         'identifican los bytes leídos, sin constituir un manifiesto firmado de publicación.',
         '''import hashlib
from pipeline import __version__ as engine_version
from pipeline.methods.screen import Screen
from pipeline.methods.learning import features
from pipeline.methods.observable import check_observable, PredictionRejected
from scipy.stats import norm

def released_provenance(record, contract, version, model_dir):
    identity = (record.get('schema'), record.get('engine_version'), record.get('contract_digest'))
    if identity != ('oreflow.learning/v2', version, contract['digest']) or record.get('reused'):
        raise ValueError('Release identity mismatch: ' + str(identity))
    scalers = json.loads((model_dir / 'process_surrogate.json').read_text(encoding='utf-8'))
    for key, expected in [('features', list(FEATURES)), ('targets', list(TARGETS))]:
        if record[key] != expected or scalers[key] != expected:
            raise ValueError('Feature or target order mismatch: ' + key)
    if scalers['guard_threshold'] != record['final']['guard_threshold']:
        raise ValueError('Frozen threshold mismatch')
    exports = record['final']['exports']
    names = [('surrogate', 'process_surrogate.onnx'), ('guard', 'process_guard.onnx')]
    declared = [(exports[key], name) for key, name in names]
    declared += [(exports['screen'], 'process_screen.json')]
    declared += [(exports['screen']['cholesky'], 'process_gp_cholesky.bin')]
    hashes = {}
    for entry, name in declared:
        raw = (model_dir / name).read_bytes()
        digest = hashlib.sha256(raw).hexdigest()
        if entry['path'] != name or len(raw) != entry['bytes'] or entry.get('sha256', digest) != digest:
            raise ValueError('Model byte identity mismatch: ' + name)
        hashes[name] = digest
    hashes['process_surrogate.json'] = hashlib.sha256((model_dir / 'process_surrogate.json').read_bytes()).hexdigest()
    return hashes''')
    step(extra, lang,
         'Run the preflight against the adopted release and print its provenance. Recompute the contract digest '
         'from canonical JSON, retain the producer fingerprint and list file SHA-256 values in full. Missing or '
         'old artifacts are a real data boundary, not permission to substitute reference fits. ONNX files are '
         'hashed only; inference uses the exported NumPy/SciPy Screen implementation.',
         'Verificar la publicación adoptada e imprimir procedencia. Recalcular el digest desde JSON canónico, '
         'conservar la huella del productor y mostrar SHA-256 completos. Artefactos ausentes o antiguos representan '
         'una frontera real de datos, sin sustituirlos por ajustes de referencia. Los archivos ONNX solo aportan '
         'bytes para identificación; la inferencia usa Screen con NumPy/SciPy.',
         '''model_dir = repo / 'models'
release_path = repo / 'data/derived/learning.json'
released = json.loads(release_path.read_text(encoding='utf-8'))
artifact_hashes = released_provenance(released, contract, engine_version, model_dir)
contract_body = {key: value for key, value in contract.items() if key != 'digest'}
contract_bytes = json.dumps(contract_body, sort_keys=True, separators=(',', ':')).encode()
if hashlib.sha256(contract_bytes).hexdigest() != contract['digest']:
    raise ValueError('Contract digest mismatch')
for label, path in [('learning.json', release_path), ('VERSION', repo / 'VERSION'),
                    ('operating_contract.json', repo / 'data/derived/contract/operating_contract.json')]:
    artifact_hashes[label] = hashlib.sha256(path.read_bytes()).hexdigest()
print('Release version:', engine_version)
print('Contract digest:', contract['digest'])
print('Producer fingerprint:', released['execution']['fingerprint'])
with pd.option_context('display.max_colwidth', None):
    display(pd.DataFrame(artifact_hashes.items(), columns=['Artifact', 'SHA-256']))
frozen = Screen(model_dir)
scalers = json.loads((model_dir / 'process_surrogate.json').read_text(encoding='utf-8'))
for scale in (frozen.feature_scale, frozen.target_scale, frozen.guard_scale):
    if not np.isfinite(scale).all() or not (scale > 0).all():
        raise ValueError('Invalid released scaling')
frozen_threshold = frozen.guard_threshold
print('Frozen guard threshold:', frozen_threshold)''')
    step(extra, lang,
         'Inspect all exported scaling coordinates. The surrogate uses (x-feature_mean)/feature_scale and '
         'inverse-transforms each output with target_scale and target_mean. The autoencoder uses its separate '
         'guard means/scales and mean squared reconstruction error. The GP uses surrogate-standardized inputs '
         'and returns recovery mean/std in percentage units. These released transforms stay frozen; the small '
         'guard network is not a reproduction of Hinton and Salakhutdinov’s deep-network training.',
         'Inspeccionar las coordenadas exportadas. La red usa (x-feature_mean)/feature_scale y transforma cada '
         'salida mediante target_scale y target_mean. El autoencoder utiliza medias y escalas propias y error '
         'cuadrático medio de reconstrucción. El GP recibe variables estandarizadas como la red y devuelve media '
         'y desviación de recuperación en unidades porcentuales. Los transformadores permanecen fijos; esta red '
         'pequeña no reproduce el entrenamiento profundo de Hinton y Salakhutdinov.',
         '''scale_table = pd.DataFrame({'Feature': FEATURES, 'Surrogate mean': frozen.feature_mean,
                            'Surrogate scale': frozen.feature_scale, 'Guard mean': frozen.guard_mean,
                            'Guard scale': frozen.guard_scale})
display(scale_table)
display(pd.DataFrame({'Target': TARGETS, 'Target mean': frozen.target_mean, 'Target scale': frozen.target_scale}))
for row in scalers['reference']:
    observed = frozen.judge(row['features'])['prediction']
    expected = np.array([row['prediction'][target] for target in TARGETS])
    actual = np.array([observed[target] for target in TARGETS])
    if not released_parity(actual, expected, frozen.target_scale, float(released['settings']['onnx_tolerance'])):
        raise ValueError('Exported network/scaler reference mismatch: ' + row['case_id'])''')
    step(extra, lang,
         'Verify the direct continuous-feature mapping against every authored case’s OperatingPoint. '
         'Global bounds include all twelve production-training cases, not only the four challenge cases. '
         'work_index_kwh_t, target_p80_um and water_m3_t are direct raw fields; transformed ratios are excluded. '
         'This mapping makes the later outside-bound statement explicit instead of inferring it from scaled '
         'coordinates or a few observed feature extrema.',
         'Verificar el mapeo de variables continuas directas frente a OperatingPoint en cada caso. Los límites '
         'globales incluyen los doce casos de entrenamiento, no solo los cuatro examinados. work_index_kwh_t, '
         'target_p80_um y water_m3_t corresponden a campos directos; se excluyen razones transformadas. Así la '
         'afirmación de exterioridad se apoya en límites contractuales y mapeo explícito, sin inferirla de '
         'coordenadas estandarizadas ni extremos observados parciales.',
         '''probe_features = ('work_index_kwh_t', 'target_p80_um', 'water_m3_t')
if set(released['design']['cases']) != set(contract['cases']) or len(contract['cases']) != 12:
    raise ValueError('Global training-case inventory mismatch')
global_bounds = {}
for name in probe_features:
    entries = [item['inputs'][name] for item in contract['cases'].values()]
    global_bounds[name] = (min(item['min'] for item in entries), max(item['max'] for item in entries))
for case_id in contract['cases']:
    member = CASE_BY_ID[case_id]
    mapped = features(member, member.nominal, {'liberation_size': 1.0, 'floatability': 1.0})
    for name in probe_features:
        if mapped[FEATURES.index(name)] != getattr(member.nominal, name):
            raise ValueError('Direct feature mapping mismatch: ' + name)
units = {item['name']: item['unit'] for item in contract['inputs']}
bounds_table = pd.DataFrame.from_dict(global_bounds, orient='index', columns=['Global min', 'Global max'])
bounds_table['Index'] = [FEATURES.index(name) for name in bounds_table.index]
bounds_table['Unit'] = [units[name] for name in bounds_table.index]
display(bounds_table.rename_axis('Feature'))''')
    step(extra, lang,
         'Build a second, separately seeded challenge with eight valid states from each of the same four '
         'declared cases: 32 states at seed 20261101. build_design computes features and all three engine.targets '
         'from fresh circuit solves. The seed is predeclared and distinct from both the reference experiment and '
         'released training design. New draws within known case families measure a frozen-artifact challenge, '
         'not LOCO refitting or independently measured plant transfer.',
         'Construir otro diseño con ocho estados válidos por cada uno de los cuatro casos: 32 estados a semilla '
         '20261101. build_design calcula variables y los tres engine.targets mediante resoluciones nuevas. La '
         'semilla se declara antes de observar errores y difiere de la referencia y del entrenamiento publicado. '
         'Estos sorteos de familias conocidas examinan artefactos fijos; no constituyen reajuste LOCO ni '
         'transferencia medida en planta.',
         '''challenge_seed = 20261101
if challenge_seed in (20261031, released['design']['seed']):
    raise ValueError('Challenge seed must be separately predeclared')
with contextlib.redirect_stdout(io.StringIO()):
    challenge = build_design(contract, cases=selected, per_case=8, seed=challenge_seed)
challenge_x, challenge_y, challenge_case = challenge['x'], challenge['y'], challenge['case']
if challenge_x.shape != (32, len(FEATURES)) or challenge_y.shape != (32, len(TARGETS)):
    raise ValueError('Challenge design shape mismatch')
display(pd.Series(challenge_case).value_counts().rename('Challenge rows'))
print('Challenge seed:', challenge_seed)
print('Target order:', TARGETS)''')
    step(extra, lang,
         'Define three-target inference in declared target order. A prediction dictionary’s insertion order '
         'cannot reorder recovery, log-upgrade and energy. Nonfinite values or incompatible target declarations '
         'stop the experiment. No case label enters the feature vector and no artifact is trained on these rows.',
         'Definir inferencia con los tres objetivos en su orden declarado. El orden de inserción de un diccionario '
         'no puede intercambiar recuperación, log-upgrade y energía. Valores no finitos o declaraciones '
         'incompatibles detienen el experimento. La identidad del caso no integra las variables y ningún '
         'artefacto se entrena con estas filas.',
         '''def released_predictions(screen, raw_x):
    if tuple(screen.targets) != tuple(TARGETS):
        raise ValueError('Released target order mismatch')
    rows = [screen.judge(row)['prediction'] for row in raw_x]
    predicted = np.array([[row[name] for name in TARGETS] for row in rows])
    if predicted.shape != (len(raw_x), len(TARGETS)) or not np.isfinite(predicted).all():
        raise ValueError('Invalid three-target predictions')
    return predicted

challenge_prediction = released_predictions(frozen, challenge_x)
target_units = ('pp', 'log10 ratio', 'kWh/t')
display(pd.DataFrame({'Target': TARGETS, 'Unit': target_units,
                      'Prediction min': challenge_prediction.min(axis=0),
                      'Prediction max': challenge_prediction.max(axis=0),
                      'Reference min': challenge_y.min(axis=0), 'Reference max': challenge_y.max(axis=0)}))''')
    step(extra, lang,
         'Calculate errors for each target on all 32 rows first, then by case. Units differ, so errors are never '
         'averaged across targets or pooled into the four-reference ranking. The production observable check '
         'retains ordinary poor predictions; a wholly out-of-scale cohort keeps its actual prediction/reference '
         'ranges and null errors, with attempted/scored/rejected denominators. Shape and nonfinite failures '
         'still stop execution.',
         'Calcular errores por objetivo primero en las 32 filas y después por caso. Las unidades difieren; no se '
         'promedian objetivos ni se incorpora esta red al orden de las cuatro referencias. La comprobación de '
         'escala conserva predicciones finitas deficientes; una cohorte totalmente fuera de escala mantiene '
         'rangos reales y errores nulos, con denominadores de intentos, puntuados y rechazados. Errores de forma '
         'o valores no finitos detienen la ejecución.',
         '''def challenge_errors(observed, predicted, cohort, reference):
    rows = []
    for j, target in enumerate(TARGETS):
        error = predicted[:, j] - observed[:, j]
        rmse, mae, bias = None, None, None
        try:
            diagnostic = check_observable(observed[:, j], predicted[:, j], reference=reference[:, j])
            rmse, mae, bias = float(np.sqrt(np.mean(error ** 2))), float(np.mean(abs(error))), float(error.mean())
        except PredictionRejected as rejection:
            diagnostic = rejection.diagnostics
        valid = rmse is not None
        row = dict(cohort=cohort, target=target, unit=target_units[j], attempted=len(error))
        row.update(scored=len(error) if valid else 0, rejected=0 if valid else len(error))
        row.update(rmse=rmse, mae=mae, bias=bias, observable=diagnostic)
        rows.append(row)
    return rows

neural_errors = challenge_errors(challenge_y, challenge_prediction, 'all', authored_reference)
for case_id in case_ids:
    mask = challenge_case == case_id
    neural_errors += challenge_errors(challenge_y[mask], challenge_prediction[mask], case_id, authored_reference)
with pd.option_context('display.max_colwidth', None, 'display.max_columns', None):
    display(challenge_frame(neural_errors))''')
    figure(extra, lang,
           'Plot the frozen network’s three targets separately in their physical coordinates. Each diagonal is '
           'the engine reference identity, not a fitted calibration line.',
           'Graficar los tres objetivos de la red fija por separado en sus coordenadas físicas. Cada diagonal '
           'representa identidad con el motor, sin ajustar una línea de calibración.',
           '''with plt.rc_context({'font.size': 15}):
    fig, axes = plt.subplots(3, 1, figsize=(7, 11))
    for j, axis in enumerate(axes):
        for case_id in case_ids:
            mask = challenge_case == case_id
            axis.scatter(challenge_y[mask, j], challenge_prediction[mask, j], label=case_labels[case_id], s=24)
        limits = [float(challenge_y[:, j].min()), float(challenge_y[:, j].max())]
        axis.plot(limits, limits, '--', color='black')
        axis.set(xlabel='Engine target', ylabel='Neural prediction', title=target_labels[j])
    axes[0].legend(fontsize=15)
    fig.tight_layout()''',
           'Each panel has its own units; vertical separation is recovery percentage points, log10 upgrade or '
           'specific-energy error. All valid challenge rows remain visible regardless of guard decision. The '
           'table preserves ranges even when a scoring envelope rejects a cohort. This experiment evaluates '
           'a final model exposed to every case family and therefore cannot compete as another held-out '
           'estimator in the first experiment or establish prediction on an operating plant.',
           'Cada panel tiene unidades propias: separación vertical en puntos porcentuales de recuperación, '
           'log10 de enriquecimiento o energía específica. Todas las filas permanecen visibles con independencia '
           'del guardia. La tabla conserva rangos aunque se rechace una cohorte por escala. El modelo final '
           'conoció todas las familias; no puede añadirse como otro estimador reservado al primer experimento '
           'ni establecer capacidad predictiva en una planta operativa.')
    step(extra, lang,
         'Define the reconstruction diagnostic for unchanged baselines and controlled feature shifts. Each '
         'shift replaces only one direct coordinate, alternately below or above its global contract interval '
         'by a full span. The resulting feature vectors may violate relationships among coordinates: they are '
         'synthetic diagnostics, never plant operating states and never inputs to simulate. An accepted shift '
         'is retained as a missed detection, not removed from the denominator.',
         'Definir el diagnóstico de reconstrucción para bases sin cambios y desplazamientos controlados. Cada '
         'prueba sustituye una coordenada directa, alternando por debajo o encima del intervalo global con un '
         'margen completo. Estos vectores pueden romper relaciones entre variables: son diagnósticos sintéticos, '
         'nunca estados de planta ni entradas a simulate. Una prueba desplazada aceptada permanece como '
         'detección omitida y no se elimina del denominador.',
         '''def challenge_guard_row(screen, raw, case_id, probe, index, value):
    error = float(screen.judge(raw)['guard_error'])
    threshold = screen.guard_threshold
    return {'case': case_id, 'probe': probe, 'row': index, 'feature_value': value,
            'error': error, 'threshold': threshold, 'accepted': error <= threshold}

baseline_diagnostics = [challenge_guard_row(frozen, row, challenge_case[i], 'baseline', i, None)
                        for i, row in enumerate(challenge_x)]
display(challenge_frame(baseline_diagnostics))

def challenge_guard(screen, raw_x, case_of, bounds, baselines=None):
    rows = list(baselines) if baselines is not None else [
        challenge_guard_row(screen, row, case_of[i], 'baseline', i, None) for i, row in enumerate(raw_x)]
    threshold = screen.guard_threshold
    for i, raw in enumerate(raw_x):
        for name, (low, high) in bounds.items():
            probe = raw.copy()
            span = max(1.0, abs(low), abs(high), high - low)
            value = low - span if i % 2 == 0 else high + span
            if not (value < low or value > high):
                raise ValueError('Synthetic probe must exceed global bounds')
            probe[FEATURES.index(name)] = value
            rows.append(challenge_guard_row(screen, probe, case_of[i], name, i, value))
    if not np.isfinite([row['error'] for row in rows]).all() or screen.guard_threshold != threshold:
        raise ValueError('Nonfinite guard error or changed threshold')
    return rows

guard_rows = challenge_guard(frozen, challenge_x, challenge_case, global_bounds, baseline_diagnostics)
guard_table = pd.DataFrame(guard_rows)
display(challenge_frame(guard_rows))''')
    step(extra, lang,
         'Keep accepted and rejected counts for every probe type and case, including an insensitive guard '
         'that accepts all shifts. Baseline rejections describe flags on valid in-envelope simulator states; '
         'accepted synthetic shifts describe misses in this constructed challenge. Neither is an estimate of '
         'the frequency of real plant faults. This is the autoencoder test alone, not the optimizer’s additional '
         'GP-half-width eligibility rule.',
         'Conservar cantidades aceptadas y rechazadas por tipo de prueba y caso, incluso si un guardia '
         'insensible acepta todos los desplazamientos. Rechazos de base describen banderas sobre estados '
         'válidos del simulador; desplazamientos aceptados describen omisiones en este diagnóstico construido. '
         'Ninguno estima frecuencia de fallas de planta. Se examina solo el autoencoder, sin la regla adicional '
         'de semiamplitud GP utilizada por el optimizador.',
         '''guard_counts = guard_table.groupby(['probe', 'case'], sort=False)['accepted'].agg(['size', 'sum'])
guard_counts.columns = ['attempted', 'accepted']
guard_counts['rejected'] = guard_counts['attempted'] - guard_counts['accepted']
display(challenge_frame(guard_counts.reset_index()))
baseline_guard = guard_table[guard_table['probe'] == 'baseline']
shifted_guard = guard_table[guard_table['probe'] != 'baseline']
guard_accepted = baseline_guard['accepted'].to_numpy(dtype=bool)
print('Baseline accepted/rejected:', int(guard_accepted.sum()), int((~guard_accepted).sum()))
print('Shifted accepted/rejected:', int(shifted_guard['accepted'].sum()), int((~shifted_guard['accepted']).sum()))
if frozen.guard_threshold != frozen_threshold:
    raise ValueError('Frozen threshold changed')''')
    figure(extra, lang,
           'Compare reconstruction errors with the same frozen threshold. Scaling the vertical axis by that '
           'threshold puts the decision boundary at one; symlog retains near-zero errors and extreme probes.',
           'Comparar errores con el mismo umbral fijo. Dividir el eje vertical por ese umbral sitúa la frontera '
           'en uno; symlog conserva errores cercanos a cero y pruebas extremas.',
           '''with plt.rc_context({'font.size': 15}):
    fig, ax = plt.subplots(figsize=(7, 6))
    if frozen_threshold <= 0:
        raise ValueError('Positive threshold required for ratio plot')
    for index, name in enumerate(('baseline',) + probe_features):
        rows = guard_table[guard_table['probe'] == name]
        ax.scatter(np.full(len(rows), index), rows['error'] / frozen_threshold, s=24)
    ax.axhline(1, linestyle='--', color='black', label='Frozen threshold')
    ax.set_xticks(range(4), probe_labels, rotation=18)
    ax.set_yscale('symlog', linthresh=1)
    ax.set(ylabel='Reconstruction error / threshold', title='Controlled feature challenge')
    ax.legend(fontsize=15)
    fig.tight_layout()''',
           'Points at or below one are accepted, including shifted vectors that the reconstruction guard fails '
           'to flag. Points above one are rejected, including possible unchanged baselines. The controlled '
           'replacement proves the selected coordinate lies outside all declared training-case bounds, '
           'but does not isolate a physically achievable intervention. The threshold remains the released '
           'value; tuning it after seeing this diagram would change the question and invalidate the frozen test.',
           'Puntos en uno o por debajo se aceptan, incluidos vectores desplazados no detectados. Puntos por '
           'encima se rechazan, incluidas posibles bases sin cambios. La sustitución prueba exterioridad de '
           'una coordenada frente a todos los límites declarados de entrenamiento, sin aislar una intervención '
           'física realizable. El umbral permanece publicado; ajustarlo después de observar la figura cambiaría '
           'la pregunta e invalidaría la prueba fija.')
    step(extra, lang,
         'Define empirical Gaussian interval summaries at nominal levels 0.5, 0.8 and 0.95. For a nonempty '
         'cohort, coverage is the proportion of exact engine recoveries within GP mean ± z times GP std; '
         'mean width uses the same rows. Empty subsets have no hit count, coverage or width estimate. '
         'No interval is centred on a neural prediction.',
         'Definir resúmenes gaussianos a niveles nominales 0.5, 0.8 y 0.95. En una cohorte no vacía, cobertura '
         'es la proporción de recuperaciones exactas dentro de media GP ± z por desviación GP; la amplitud '
         'media usa las mismas filas. Subconjuntos vacíos carecen de cantidad cubierta, cobertura y amplitud '
         'estimadas. Ningún intervalo se centra sobre una predicción neuronal.',
         '''def challenge_coverage_rows(mean, std, truth, mask, cohort, subset):
    rows = []
    n = int(np.count_nonzero(mask))
    for level in (0.5, 0.8, 0.95):
        half = norm.ppf((1 + level) / 2) * std[mask]
        hits = int(np.count_nonzero(abs(truth[mask] - mean[mask]) <= half)) if n else None
        rows.append({'subset': subset, 'cohort': cohort, 'level': level, 'n': n, 'hits': hits,
                     'coverage': hits / n if n else None,
                     'mean_width': float(np.mean(2 * half)) if n else None})
    return rows

def challenge_coverage(screen, raw_x, truth, case_of, accepted):
    standardized = (raw_x - screen.feature_mean) / screen.feature_scale
    gp_values = np.array([screen.gp(row) for row in standardized])
    if not np.isfinite(gp_values).all() or (gp_values[:, 1] < 0).any():
        raise ValueError('Invalid GP mean or standard deviation')
    mean, std = gp_values[:, 0], gp_values[:, 1]
    cohorts = [('all', np.ones(len(raw_x), dtype=bool))]
    cohorts += [(name, case_of == name) for name in dict.fromkeys(case_of.tolist())]
    rows = []
    for subset, selected_rows in [('all', np.ones(len(raw_x), dtype=bool)), ('guard_accepted', accepted)]:
        for cohort, mask in cohorts:
            rows += challenge_coverage_rows(mean, std, truth, mask & selected_rows, cohort, subset)
    return rows, mean, std''')
    step(extra, lang,
         'Evaluate the production GP on every challenge state before considering selection. Display all-cohort '
         'and per-case rows first; only then show the optional guard-accepted subset. Eight rows per case '
         'make coverage advance in steps of 0.125, so agreement with nominal levels is descriptive and coarse. '
         'The GP includes its exported noise term. This is not fold-specific LOCO calibration and does not '
         'estimate coverage for an independently measured plant.',
         'Evaluar el GP de producción en cada estado antes de seleccionar. Mostrar primero cohorte completa '
         'y casos; después el subconjunto opcional aceptado por el guardia. Ocho filas por caso producen '
         'incrementos de cobertura de 0.125, por lo que el acuerdo nominal es descriptivo y grueso. El GP '
         'incluye el término de ruido exportado. No se reproduce calibración LOCO por pliegues ni se estima '
         'cobertura frente a una planta medida independientemente.',
         '''coverage_rows, released_gp_mean, released_gp_std = challenge_coverage(
    frozen, challenge_x, challenge_y[:, 0], challenge_case, guard_accepted)
coverage_all = [row for row in coverage_rows if row['subset'] == 'all']
coverage_accepted = [row for row in coverage_rows if row['subset'] == 'guard_accepted']
display(challenge_frame(coverage_all))
display(challenge_frame(coverage_accepted))
gp95 = next(row for row in coverage_all if row['cohort'] == 'all' and row['level'] == 0.95)
print('GP interval centre: production GP mean')
print('Per-case coverage resolution:', 1 / 8)''')
    figure(extra, lang,
           'Plot only the unfiltered coverage curves, preserving every challenge row. The diagonal represents '
           'nominal coverage, not a fitted calibration correction.',
           'Graficar solo curvas de cobertura sin filtrar, conservando cada fila. La diagonal representa '
           'cobertura nominal, sin ajustar una corrección de calibración.',
           '''with plt.rc_context({'font.size': 15}):
    fig, ax = plt.subplots(figsize=(7, 7))
    for cohort in ('all',) + case_ids:
        records = [row for row in coverage_all if row['cohort'] == cohort]
        ax.plot([row['level'] for row in records], [row['coverage'] for row in records],
                marker='o', label=case_labels[cohort])
    ax.plot([0, 1], [0, 1], '--', color='black')
    ax.set(xlim=(0, 1), ylim=(0, 1.02), xlabel='Nominal coverage', ylabel='Empirical coverage',
           title='Unfiltered recovery GP intervals')
    ax.legend(fontsize=15, loc='upper center', bbox_to_anchor=(0.5, -0.18), ncol=2)
    fig.tight_layout()''',
           'Coverage below the diagonal identifies undercoverage on these simulator draws; above-diagonal '
           'points alone do not establish useful uncertainty, because wide intervals can cover almost '
           'everything. Mean widths and exact denominators in the preceding table qualify the curves. '
           'Per-case steps of one eighth and only four known cases make this a small diagnostic. Filtering '
           'after observing outcomes would hide failures, so accepted-subset numbers remain separate.',
           'Cobertura bajo la diagonal identifica cobertura insuficiente en estos sorteos; estar por encima '
           'no establece incertidumbre útil, porque intervalos muy amplios pueden cubrir casi todo. Amplitudes '
           'medias y denominadores de la tabla califican las curvas. Incrementos de un octavo por caso y solo '
           'cuatro casos conocidos limitan el diagnóstico. Filtrar después de observar resultados ocultaría '
           'fallas; las cifras del subconjunto aceptado permanecen separadas.')
    figure(extra, lang,
           'Show the 95-percent production GP intervals at all 32 row indices. The interval centre is the '
           'GP’s own predictive mean; engine recovery markers reveal individual misses without replacing '
           'them with neural-network predictions.',
           'Mostrar intervalos GP de producción al 95 por ciento en las 32 filas. El centro es la media '
           'predictiva propia del GP; marcas del motor muestran omisiones individuales sin sustituirlas '
           'por predicciones de la red neuronal.',
           '''with plt.rc_context({'font.size': 15}):
    fig, ax = plt.subplots(figsize=(7, 6))
    rows = np.arange(len(challenge_x))
    half95 = norm.ppf(0.975) * released_gp_std
    ax.errorbar(rows, released_gp_mean, yerr=half95, fmt='o', markersize=4, label='GP mean and 95% interval')
    ax.scatter(rows, challenge_y[:, 0], marker='x', color='black', label='Engine recovery')
    ax.set(xlabel='Challenge row', ylabel='Recovery (%)', title='Production GP centre and exact targets')
    ax.legend(fontsize=15)
    fig.tight_layout()''',
           'An engine marker outside its vertical segment is a missed interval, even if the autoencoder '
           'accepted that feature vector. The network and GP have different fitted parameters and targets, '
           'so borrowing a neural centre would create an interval that the GP never predicted. The table '
           'and plot use all 32 labels before filtering. No nominal Gaussian probability here certifies '
           'calibrated plant uncertainty or transfer to an absent ore group.',
           'Una marca del motor fuera del segmento vertical indica omisión, aunque el autoencoder acepte '
           'ese vector. Red y GP tienen parámetros y objetivos ajustados diferentes; utilizar centro '
           'neuronal produciría un intervalo que el GP nunca predijo. Tabla y figura usan las 32 etiquetas '
           'antes de filtrar. Ninguna probabilidad gaussiana nominal certifica incertidumbre calibrada de '
           'planta ni transferencia a un grupo mineral ausente.')
    released_challenge_contract(notebook, extra)


def released_challenge_contract(notebook, extra):
    """Attach the separate cohort, references and computed Results without moving earlier figures."""
    lang = notebook['metadata']['caos']['language']
    meta = notebook['metadata']['caos']
    values = {
        'Challenge rows': 'Filas del diagnóstico',
        'Neural recovery min': 'Mínimo neuronal de recuperación',
        'Neural recovery max': 'Máximo neuronal de recuperación',
        'Neural log-upgrade min': 'Mínimo neuronal de log-enriquecimiento',
        'Neural log-upgrade max': 'Máximo neuronal de log-enriquecimiento',
        'Neural energy min': 'Mínimo neuronal de energía',
        'Neural energy max': 'Máximo neuronal de energía',
        'Scored target cohorts': 'Cohortes de objetivo puntuadas',
        'Rejected target cohorts': 'Cohortes de objetivo rechazadas',
        'Baseline accepted': 'Bases aceptadas', 'Baseline rejected': 'Bases rechazadas',
        'Synthetic probes': 'Pruebas sintéticas', 'Synthetic accepted': 'Sintéticas aceptadas',
        'Synthetic rejected': 'Sintéticas rechazadas', 'Released guard threshold': 'Umbral publicado del guardia',
        'Released GP95 coverage': 'Cobertura GP95 publicada', 'Released GP95 width': 'Amplitud GP95 publicada',
    }
    LABELS_ES.update(values)
    step(extra, lang,
         'Bind the released challenge independently of the four-reference scores. Prediction ranges retain '
         'all targets, guard counts retain misses, and the unfiltered GP estimate retains its denominator. '
         'Null scoring metrics are not replaced by zero. These numeric summaries describe the exact files '
         'identified above and must be recomputed after release adoption.',
         'Vincular el diagnóstico publicado por separado de las cuatro referencias. Los rangos conservan '
         'tres objetivos, las cantidades del guardia conservan omisiones y el GP sin filtrar mantiene su '
         'denominador. Errores nulos no se sustituyen por cero. Estos resúmenes describen los archivos '
         'identificados y deben recalcularse después de adoptar la publicación.',
         '''released_values = {
    'Challenge rows': len(challenge_x),
    'Neural recovery min': challenge_prediction[:, 0].min(),
    'Neural recovery max': challenge_prediction[:, 0].max(),
    'Neural log-upgrade min': challenge_prediction[:, 1].min(),
    'Neural log-upgrade max': challenge_prediction[:, 1].max(),
    'Neural energy min': challenge_prediction[:, 2].min(),
    'Neural energy max': challenge_prediction[:, 2].max(),
    'Scored target cohorts': sum(row['rmse'] is not None for row in neural_errors),
    'Rejected target cohorts': sum(row['rmse'] is None for row in neural_errors),
    'Baseline accepted': guard_accepted.sum(), 'Baseline rejected': (~guard_accepted).sum(),
    'Synthetic probes': len(shifted_guard), 'Synthetic accepted': shifted_guard['accepted'].sum(),
    'Synthetic rejected': (~shifted_guard['accepted']).sum(),
    'Released guard threshold': frozen_threshold,
    'Released GP95 coverage': gp95['coverage'], 'Released GP95 width': gp95['mean_width'],
}
print(json.dumps({label: round(float(value), 6) for label, value in released_values.items()}, allow_nan=False))''')
    extra[-1]['metadata'] = {'tags': ['answer-values']}
    released_step_units(extra, lang)
    imports_index = next(i for i, cell in enumerate(extra) if cell['cell_type'] == 'code'
                         and 'import hashlib' in ''.join(cell['source']))
    imports = '\n'.join(line for line in ''.join(extra[imports_index]['source']).splitlines()
                        if not line.lstrip().startswith('#'))
    setup = next(cell for cell in notebook['cells'] if cell['cell_type'] == 'code')
    setup['source'] = (''.join(setup['source']) + '\n' + imports + '\n').splitlines(keepends=True)
    del extra[imports_index - 1:imports_index + 1]
    for index, cell in enumerate(extra, 1):
        cell['id'] = f'released-{index:03d}'
    released_scoring_contract(extra, lang)
    result_index = next(i for i, cell in enumerate(notebook['cells'])
                        if ''.join(cell['source']).startswith(('## Results', '## Resultados')))
    result = notebook['cells'][result_index]
    def bound(name):
        label = LABELS_ES.get(name, name) if lang == 'es' else name
        return '<!-- result:' + label + ' -->0<!-- /result -->'
    en = ('\n\n**Separate released-artifact challenge:** ' + bound('Challenge rows') +
          ' simulator states give neural prediction ranges ' + bound('Neural recovery min') + ' to ' +
          bound('Neural recovery max') + '% recovery, ' + bound('Neural log-upgrade min') + ' to ' +
          bound('Neural log-upgrade max') + ' log10 upgrade and ' + bound('Neural energy min') + ' to ' +
          bound('Neural energy max') + ' kWh/t. The target/cohort table retains ' + bound('Scored target cohorts') +
          ' scored and ' + bound('Rejected target cohorts') + ' rejected rows, with actual unit-specific errors '
          'and range diagnostics. At frozen threshold ' + bound('Released guard threshold') + ', baseline '
          'accepted/rejected counts are ' + bound('Baseline accepted') + '/' + bound('Baseline rejected') +
          '. Of ' + bound('Synthetic probes') + ' outside-bound vectors, ' + bound('Synthetic accepted') +
          ' are accepted misses and ' + bound('Synthetic rejected') + ' are rejected. The GP-centred 95% '
          'intervals cover fraction ' + bound('Released GP95 coverage') + ' of all challenge recoveries with '
          'mean width ' + bound('Released GP95 width') + ' pp. Per-case N=8 is coarse. This frozen-model '
          'challenge is separate from the held-out ranking and does not reproduce LOCO calibration or plant validity.')
    es = ('\n\n**Diagnóstico separado de artefactos publicados:** ' + bound('Challenge rows') +
          ' estados simulados producen rangos neuronales de ' + bound('Neural recovery min') + ' a ' +
          bound('Neural recovery max') + '% de recuperación, ' + bound('Neural log-upgrade min') + ' a ' +
          bound('Neural log-upgrade max') + ' log10 de enriquecimiento y ' + bound('Neural energy min') + ' a ' +
          bound('Neural energy max') + ' kWh/t. La tabla conserva ' + bound('Scored target cohorts') +
          ' filas de objetivo/cohorte puntuadas y ' + bound('Rejected target cohorts') + ' rechazadas, con '
          'errores por unidad y rangos reales. Al umbral fijo ' + bound('Released guard threshold') +
          ', las bases aceptadas/rechazadas son ' + bound('Baseline accepted') + '/' + bound('Baseline rejected') +
          '. De ' + bound('Synthetic probes') + ' vectores fuera de límites, ' + bound('Synthetic accepted') +
          ' son omisiones aceptadas y ' + bound('Synthetic rejected') + ' se rechazan. Los intervalos al 95% '
          'centrados en GP cubren fracción ' + bound('Released GP95 coverage') + ' de todas las recuperaciones, '
          'con amplitud media ' + bound('Released GP95 width') + ' pp. N=8 por caso es grueso. Este diagnóstico '
          'fijo permanece separado del orden reservado y no reproduce calibración LOCO ni validez en planta.')
    result['source'] = (''.join(result['source']) + pair(en, es, lang)).splitlines(keepends=True)
    notebook['cells'][result_index:result_index] = extra
    data = ['data/derived/learning.json', 'models/process_surrogate.json', 'models/process_screen.json',
            'models/process_gp_cholesky.bin', 'models/process_surrogate.onnx', 'models/process_guard.onnx', 'VERSION']
    meta['data'] += data
    refs = [('https://doi.org/10.1126/science.1127647', 'Hinton and Salakhutdinov (2006), neural reconstruction.'),
            ('https://www.cs.toronto.edu/~rsalakhu/papers/science_som.pdf', 'Author-hosted supporting material.'),
            ('https://gaussianprocess.org/gpml/', 'Rasmussen and Williams (2006), Gaussian Processes for Machine Learning.'),
            ('https://gaussianprocess.org/gpml/chapters/', 'Predictive mean/variance, Chapter 2, Algorithm 2.1.')]
    refs_es = ['Hinton y Salakhutdinov (2006), reconstrucción neuronal.', 'Material complementario de los autores.',
               'Rasmussen y Williams (2006), Gaussian Processes for Machine Learning.',
               'Media y varianza predictivas, capítulo 2, algoritmo 2.1.']
    meta['sources'] = [url for url in meta['sources'] if '1412.6980' not in url]
    for index, cell in enumerate(notebook['cells']):
        source = ''.join(cell['source'])
        if cell['cell_type'] == 'code' and cell['id'] == 'lesson-005':
            cell['source'] = (source + "\nplt.rcParams.update({'font.size': 15})\n").splitlines(keepends=True)
        if cell['cell_type'] == 'code' and cell['id'] in ('lesson-026', 'lesson-029'):
            cell['source'] = source.replace('figsize=(9, 4.5)', 'figsize=(7, 6)').replace(
                'figsize=(7, 4.5)', 'figsize=(7, 6)').splitlines(keepends=True)
        if source.startswith(('## References', '## Referencias')):
            lines = [line for line in source.splitlines() if '1412.6980' not in line]
            for j, (url, note) in enumerate(refs):
                if url not in meta['sources']:
                    meta['sources'].append(url)
                    lines.append('- ' + pair(note, refs_es[j], lang) + ' ' + url)
            cell['source'] = ('\n'.join(lines) + '\n').splitlines(keepends=True)
    released_challenge_scope(notebook)


def released_scoring_contract(cells, lang):
    """Keep parity units and full-design post-inference references explicit and independently testable."""
    additions = [(
        'scale_table =', 'parity',
        'The export tolerance is declared in standardized neural-output units. Compare physical differences '
        'only after dividing by each released target scale, with zero relative tolerance and the unchanged '
        'declared absolute tolerance. Invalid shapes, nonfinite values and nonpositive scales are failures.',
        'La tolerancia de exportación se declara en unidades neuronales estandarizadas. Dividir las diferencias '
        'físicas por la escala publicada de cada objetivo, con tolerancia relativa cero y tolerancia absoluta '
        'declarada sin cambios. Formas inválidas, valores no finitos y escalas no positivas producen fallas.',
        '''def released_parity(actual, expected, scale, tolerance):
    actual, expected, scale = np.asarray(actual), np.asarray(expected), np.asarray(scale)
    if actual.shape != expected.shape or scale.shape != actual.shape:
        raise ValueError('Parity shape mismatch')
    if not all(np.isfinite(value).all() for value in (actual, expected, scale)) or not (scale > 0).all():
        raise ValueError('Parity requires finite values and positive target scales')
    if not np.isfinite(tolerance) or tolerance < 0:
        raise ValueError('Invalid standardized tolerance')
    return bool(np.allclose((actual - expected) / scale, 0, rtol=0, atol=tolerance))'''), (
        'def challenge_errors', 'reference',
        'Use the matching release’s retained ridge observable reference_range for every target: minima and '
        'maxima over the complete authored production design. These are finite sampled-design bounds, not '
        'exhaustive physical limits. The same reference is mandatory for pooled and per-case scoring; each '
        'subset still retains its own observed and predicted ranges. This loose post-inference check never '
        'fits, scales, tunes or clips predictions and does not establish rowwise physical validity.',
        'Usar reference_range conservado por ridge en la publicación compatible: mínimos y máximos del diseño '
        'completo de producción. Son límites de un diseño finito, no límites físicos exhaustivos. La misma '
        'referencia es obligatoria para puntuación agrupada y por caso; cada subconjunto conserva rangos '
        'observados y predichos propios. Esta comprobación amplia posterior a inferencia no ajusta, escala, '
        'selecciona ni recorta predicciones y no establece validez física fila por fila.',
        '''def released_reference(record):
    scores = record['interpolation']['models']['ridge']
    bounds = np.asarray([scores[target]['observable']['reference_range'] for target in TARGETS], dtype=float)
    if bounds.shape != (len(TARGETS), 2) or not np.isfinite(bounds).all() or (bounds[:, 1] < bounds[:, 0]).any():
        raise ValueError('Invalid full-design reference bounds')
    return bounds.T

authored_reference = released_reference(released)
print('Reference: released interpolation/ridge observable.reference_range; full design rows:', released['design']['rows'])
display(pd.DataFrame(authored_reference.T, index=TARGETS, columns=['Full-design min', 'Full-design max']))''')]
    LABELS_ES.update({'Parity shape mismatch': 'Forma incompatible de paridad',
                     'Parity requires finite values and positive target scales':
                     'La paridad exige valores finitos y escalas positivas',
                     'Invalid standardized tolerance': 'Tolerancia estandarizada inválida',
                     'Invalid full-design reference bounds': 'Límites inválidos de referencia completa',
                     'Full-design min': 'Mínimo del diseño completo', 'Full-design max': 'Máximo del diseño completo',
                     'Reference: released interpolation/ridge observable.reference_range; full design rows:':
                     'Referencia: interpolation/ridge observable.reference_range publicado; filas del diseño completo:'})
    for token, name, en, es, program in additions:
        i = next(i for i, cell in enumerate(cells) if cell['cell_type'] == 'code' and token in ''.join(cell['source']))
        if name == 'parity':
            original = ''.join(cells[i]['source'])
            before, loop = original.split("for row in scalers['reference']:", 1)
            program += "\n\nfor row in scalers['reference']:\n" + loop.lstrip('\n')
            manual = """
example_raw = np.asarray(scalers['reference'][0]['features'])
example_scaled = (example_raw - frozen.feature_mean) / frozen.feature_scale
example_targets = frozen.forward('surrogate', example_scaled) * frozen.target_scale + frozen.target_mean
display(pd.Series(example_targets, index=TARGETS, name='Physical-unit prediction'))
"""
            cells[i]['source'] = (before + manual).splitlines(keepends=True)
        note = md(pair(en, es, lang))
        note['id'] = 'released-' + name + '-note'
        block = code('# ' + pair(en, es, lang).split('. ')[0] + '.\n' + program)
        block['id'] = 'released-' + name
        cells[i - 1:i - 1] = [note, block]


def released_step_units(cells, lang):
    """Keep helper definitions and their applications in separate, explained teaching steps."""
    splits = {
        'def released_provenance': (
            'Define the release validator using the imported inference APIs. Incompatible identity, order, '
            'threshold or declared model bytes raise a clear failure before any prediction is used.',
            'Definir la validación con las API importadas. Identidad, orden, umbral o bytes declarados '
            'incompatibles producen una falla clara antes de utilizar predicciones.'),
        'def challenge_guard(screen': (
            'Construct the complete guard challenge from the row diagnostic: unchanged baselines plus '
            'one-coordinate shifts beyond each global bound. Every accepted shift remains in the returned rows.',
            'Construir el diagnóstico completo: bases sin cambios y desplazamientos de una coordenada fuera '
            'de cada límite global. Cada desplazamiento aceptado permanece en las filas devueltas.'),
        'def challenge_coverage(screen': (
            'Obtain mean and standard deviation from Screen.gp on standardized raw inputs. Assemble complete '
            'and per-case cohorts before guard-accepted subsets, retaining empty-subset null estimates.',
            'Obtener media y desviación desde Screen.gp sobre entradas estandarizadas. Formar cohortes '
            'completas y por caso antes de subconjuntos aceptados, conservando estimaciones nulas si están vacíos.'),
    }
    for token, texts in splits.items():
        i = next(i for i, cell in enumerate(cells) if cell['cell_type'] == 'code'
                 and token in ''.join(cell['source']))
        program = ''.join(cells[i]['source'])
        before, marker, after = program.partition(token)
        cells[i]['source'] = before.rstrip().splitlines(keepends=True)
        note = pair(*texts, lang)
        cells[i + 1:i + 1] = [md(note), code('# ' + note.split('. ')[0] + '.\n' + marker + after)]
    i = next(i for i, cell in enumerate(cells) if cell['cell_type'] == 'code'
             and 'def challenge_coverage(screen' in ''.join(cell['source']))
    cells[i - 1]['source'] += ['\n\n'] + cells[i + 1]['source']
    cells[i]['source'] += ['\n\n'] + cells[i + 2]['source']
    del cells[i + 1:i + 3]


def released_challenge_scope(notebook):
    lang = notebook['metadata']['caos']['language']
    title = pair('Compare held-out references and challenge released models',
                 'Comparar referencias reservadas y examinar modelos publicados', lang)
    notebook['metadata']['caos']['title'] = title
    opening = ''.join(notebook['cells'][0]['source'])
    opening = '# ' + title + '\n' + opening.partition('\n')[2]
    question = pair('What changes across held-out reference protocols, and how do released models behave '
                    'on a separate frozen-artifact challenge?',
                    '¿Qué cambia entre protocolos de referencia reservados y cómo responden los modelos '
                    'publicados en un diagnóstico separado de artefactos fijos?', lang)
    opening = re.sub(r'\*\*(Question|Pregunta):\*\*[^\n]*',
                     pair('**Question:** ', '**Pregunta:** ', lang) + question, opening)
    opening = opening.replace('Reading time: 28 minutes', 'Reading time: 50 minutes').replace(
        'Tiempo de lectura: 28 minutos', 'Tiempo de lectura: 50 minutos')
    notebook['cells'][0]['source'] = opening.splitlines(keepends=True)
    paragraphs = {
        'Objectives': ('Part 1 fits four recovery references on the same 64-row design under three held-out '
                       'protocols. Part 2 challenges frozen released MLP/autoencoder/GP artifacts on 32 separately '
                       'seeded engine states, retains synthetic guard misses and measures GP-centred empirical '
                       'coverage. These cohorts have different training exposure and never share an unseen-model ranking.',
                       'La parte 1 ajusta cuatro referencias de recuperación con 64 filas y tres protocolos reservados. '
                       'La parte 2 examina MLP/autoencoder/GP publicados en 32 estados de otra semilla, conserva '
                       'omisiones sintéticas y mide cobertura centrada en GP. Las cohortes tienen exposición de '
                       'entrenamiento diferente y nunca comparten un orden de modelos no vistos.'),
        'Data': ('Owner: OreFlow authors, MIT project licence. The production case catalog, constants and operating '
                 'contract generate both simulator cohorts. Part 2 additionally requires learning-v2 with matching '
                 'engine version/digest, final model exports, scaler JSON and GP Cholesky bytes under models/. '
                 'Full SHA-256 provenance is printed, including VERSION and the learning/contract records. '
                 'No measured plant labels or downloaded training data enter either experiment.',
                 'Responsable: autores de OreFlow, licencia MIT. Catálogo, constantes y contrato generan ambas '
                 'cohortes simuladas. La parte 2 exige learning-v2 con versión/digest compatibles, exportaciones '
                 'finales, escaladores JSON y bytes Cholesky en models/. Se imprimen SHA-256 completos, incluidos '
                 'VERSION y registros de aprendizaje/contrato. No se incorporan etiquetas medidas ni datos descargados.'),
        'Method': ('Part 1 retains the four separate training-only reference fits and 16/16/32-row interpolation, '
                   'case and ore-group test partitions. Its fixed-kernel GP supplies point predictions only. '
                   'Part 2 uses build_design at seed 20261101, eight states per case; Screen.judge inverse-scales '
                   'all three neural targets and uses a separately standardized reconstruction guard. Direct-field '
                   'probes exceed global bounds across all twelve training cases, without simulating invalid vectors. '
                   'Screen.gp receives surrogate-standardized features; its own recovery mean and std define '
                   '50/80/95% Gaussian intervals, including exported noise. All-cohort/per-case coverage and width '
                   'precede optional guard selection; empty subsets have null estimates. No fitting, threshold '
                   'tuning, Torch or ONNX inference runtime is used in part 2.',
                   'La parte 1 conserva cuatro ajustes con transformaciones solo de entrenamiento y reservas '
                   'de 16/16/32 filas para interpolación, caso y grupo mineral. Su GP fijo aporta predicciones '
                   'puntuales. La parte 2 usa build_design a semilla 20261101, ocho estados por caso; Screen.judge '
                   'transforma inversamente tres objetivos neuronales y usa otra estandarización para reconstrucción. '
                   'Pruebas de campos directos exceden límites globales de doce casos sin simular vectores inválidos. '
                   'Screen.gp recibe variables estandarizadas como la red; media y desviación propias definen '
                   'intervalos 50/80/95%, incluido ruido exportado. Cobertura y amplitud completas y por caso '
                   'preceden selección opcional; subconjuntos vacíos tienen estimaciones nulas. La parte 2 no '
                   'ajusta modelos ni umbrales ni usa ejecución Torch u ONNX.'),
        'Summary': ('Held-out reference rankings and frozen released-artifact diagnostics answer different '
                    'questions. Three-target errors, synthetic reconstruction misses and unfiltered GP coverage '
                    'are retained even when unfavourable. The deployed model has seen all case families; its '
                    '32-row challenge does not reproduce LOCO calibration. Per-case N=8 offers coarse descriptive '
                    'coverage, not calibrated plant validity. Reconstruction follows a small production network, '
                    'without claiming reproduction of Hinton and Salakhutdinov’s deep architecture.',
                    'El orden de referencias reservadas y el diagnóstico de artefactos fijos responden preguntas '
                    'diferentes. Se conservan errores de tres objetivos, omisiones sintéticas y cobertura GP sin '
                    'filtrar aunque sean desfavorables. El modelo publicado conoció todas las familias; 32 filas '
                    'no reproducen calibración LOCO. N=8 por caso aporta descripción gruesa, sin validez calibrada '
                    'en planta. La reconstrucción usa una red pequeña, sin afirmar reproducción de la arquitectura '
                    'profunda de Hinton y Salakhutdinov.'),
    }
    headings = {'Objectives': 'Objetivos', 'Data': 'Datos', 'Method': 'Método', 'Summary': 'Resumen'}
    for cell in notebook['cells']:
        source = ''.join(cell['source'])
        for name, text in paragraphs.items():
            heading = '## ' + pair(name, headings[name], lang)
            if source.startswith(heading + '\n'):
                cell['source'] = (heading + '\n\n' + pair(*text, lang)).splitlines(keepends=True)
        if source.startswith(('## Comparison', '## Comparación')):
            cell['source'] = (source.replace('\n\n', pair('\n\n**Part 1: Refit four references.** ',
                                                                         '\n\n**Parte 1: Reajustar cuatro referencias.** ', lang), 1)).splitlines(keepends=True)


def readable_figures(notebook):
    """Size the authored figures for a height-limited phone export, preserving every data series."""
    import textwrap
    lang = notebook['metadata']['caos']['language']
    topic = notebook['metadata']['caos']['topic']
    setup = next(cell for cell in notebook['cells'] if cell['cell_type'] == 'code')
    setup_source = ''.join(setup['source']).replace("plt.rcParams.update({'font.size': 15})", '')
    setup['source'] = (setup_source + "\nlegend_style = dict(loc='lower center', "
                       "bbox_to_anchor=(0.5, 1.02), frameon=False)\n").splitlines(keepends=True)
    LABELS_ES.update({'Batch RMSE': 'RMSE batch', 'Bank absolute error': 'Error absoluto de banco',
                     'Refitted': 'Reajustado', 'Frozen': 'Congelado', 'Case': 'Caso', 'Ore group': 'Grupo mineral',
                     'Recovery\n(%)': 'Recuperación\n(%)', 'Log10\nupgrade': 'Log10 de\nenriquecimiento',
                     'Energy\n(kWh/t)': 'Energía\n(kWh/t)',
                     'Nominal size distributions': 'Distribuciones nominales', 'Batch response': 'Respuesta batch',
                     'Continuous bank': 'Banco continuo', 'Collector +10%: fit and bank': 'Colector +10%: ajuste y banco',
                     'Short-bank projection errors': 'Errores del banco corto',
                     'Reference validation error': 'Error de validación de referencias',
                     'Objective progress': 'Progreso del objetivo', 'Search mesh': 'Malla de búsqueda',
                     'Exact calls (n)': 'Llamadas exactas (n)', 'Iteration (n)': 'Iteración (n)',
                     'Objective (1)': 'Objetivo (1)', 'Mesh (1)': 'Malla (1)',
                     'Prediction error (pp)': 'Error predictivo (pp)'})
    LABELS_ES.update({'Crusher': 'Triturador', 'Fresh': 'Fresca', 'Overflow': 'Rebose',
                     'Bank |error|': '|Error banco|', 'Soft': 'Blando', 'Hard': 'Duro', 'Oxide': 'Óxido',
                     'Equal': 'Igual', 'Energy': 'Energía', 'Physical-unit prediction': 'Predicción en unidades físicas',
                     'GP mean ±95%': 'Media GP ±95%', 'Engine': 'Motor',
                     'GP intervals and engine': 'Intervalos GP y motor',
                     'Unfiltered GP coverage': 'Cobertura GP sin filtrar'})
    titles = {
        'Comminution response at the nominal operating point': 'Nominal size distributions',
        'Conminución en el punto operativo nominal': 'Distribuciones nominales',
        'Virtual batch response': 'Batch response', 'Prueba batch virtual': 'Respuesta batch',
        'Continuous bank profile': 'Continuous bank', 'Perfil del banco continuo': 'Banco continuo',
        'Fit and projection after collector change': 'Collector +10%: fit and bank',
        'Ajuste y proyección después del cambio de dosis': 'Colector +10%: ajuste y banco',
        'Changed-residence projection errors': 'Short-bank projection errors',
        'Errores de proyección con residencia modificada': 'Errores del banco corto',
        'Common-design validation error': 'Reference validation error',
        'Error de validación con diseño común': 'Error de validación de referencias',
        'Incumbent progress': 'Objective progress', 'Progressive mesh': 'Search mesh',
        'Progreso del incumbente': 'Progreso del objetivo', 'Malla progresiva': 'Malla de búsqueda',
        'Exact evaluations (count)': 'Exact calls (n)', 'Iteration (count)': 'Iteration (n)',
        'Evaluaciones exactas (cantidad)': 'Llamadas exactas (n)', 'Iteración (cantidad)': 'Iteración (n)',
        'Normalized objective (1)': 'Objective (1)', 'Objetivo normalizado (1)': 'Objetivo (1)',
        'Mesh width (1)': 'Mesh (1)', 'Ancho de malla (1)': 'Malla (1)',
        'Payable recovery (%)': 'Recovery (%)', 'Recuperación del componente pagable (%)': 'Recuperación (%)',
        'Prediction minus engine (pp)': 'Prediction error (pp)', 'Predicción menos motor (pp)': 'Error predictivo (pp)',
        'Projection minus exact recovery (pp)': 'Bank error (pp)',
        'Proyección menos recuperación exacta (pp)': 'Error de banco (pp)',
        'All 32 states': 'All 32', 'Los 32 estados': 'Los 32',
        'GP mean and 95% interval': 'GP mean ±95%', 'Media GP e intervalo al 95%': 'Media GP ±95%',
        'Engine recovery': 'Engine', 'Recuperación del motor': 'Motor',
        'Production GP centre and exact targets': 'GP intervals and engine',
        'Centro GP y objetivos exactos': 'Intervalos GP y motor',
        'Unfiltered recovery GP intervals': 'Unfiltered GP coverage',
        'Intervalos GP de recuperación sin filtrar': 'Cobertura GP sin filtrar',
    }
    for cell in notebook['cells']:
        if cell['cell_type'] != 'code':
            continue
        source = ''.join(cell['source'])
        if 'plt.subplots' not in source:
            if 'case_labels =' in source:
                for before, after in {'Soft porphyry': 'Soft', 'Hard porphyry': 'Hard', 'Copper oxide': 'Oxide',
                                      'Pórfido blando': 'Blando', 'Pórfido duro': 'Duro', 'Cobre oxidado': 'Óxido',
                                      'All 32 states': 'All 32', 'Los 32 estados': 'Los 32',
                                      'Work index': 'Wi', 'Índice de trabajo': 'Wi',
                                      'Grind target': 'P80', 'Objetivo de molienda': 'P80',
                                      'Base sin cambios': 'Base'}.items():
                    source = source.replace(repr(before), repr(after))
            if 'target_labels =' in source:
                source = re.sub(r'target_labels = [^\n]+',
                                lambda _: "target_labels = ['Recovery\\n(%)', 'Log10\\nupgrade', 'Energy\\n(kWh/t)']",
                                source)
                cell['source'] = source.splitlines(keepends=True)
            continue
        tree = ast.parse(source)
        subplots = next(node for node in ast.walk(tree) if isinstance(node, ast.Call)
                        and ast.unparse(node.func) == 'plt.subplots')
        panels = 1
        if len(subplots.args) >= 2 and all(isinstance(arg, ast.Constant) for arg in subplots.args[:2]):
            panels = subplots.args[0].value * subplots.args[1].value
        font = 22 if panels == 2 else 20 if panels == 3 else 18
        dimensions = (6.4, 4.8) if panels == 2 else (6.4, 3.8)
        if panels == 2:
            subplots.args = [ast.Constant(2), ast.Constant(1)]
        for kw in subplots.keywords:
            if kw.arg == 'figsize':
                kw.value = ast.Tuple([ast.Constant(value) for value in dimensions], ast.Load())
        if panels == 3:
            subplots.args = [ast.Constant(1), ast.Constant(3)]
        legend_columns = 3 if 'psd[stream]' in source or 'coverage_all' in source or 'ratio.items' in source else 2
        has_legend = '.legend(' in source or '.plot.bar(' in source
        title_pad = 80 if (topic == '03-learning' and 'ax.scatter' in source) or 'coverage_all' in source or 'preference_runs' in source else 40
        if not has_legend:
            title_pad = 8
        elif 'ratio.items' in source:
            title_pad = 64
        sensitivity = topic == '05-uncertainty' and 'larger_indices' in source and 'ST_conf' in source
        horizontal = sensitivity or topic in ('02-flotation', '03-learning') and any(
            isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute) and node.func.attr == 'bar'
            for node in ast.walk(tree))
        for node in ast.walk(tree):
            if isinstance(node, ast.Constant) and 'preference_runs' in source and isinstance(node.value, str):
                node.value = {'Equal weight': 'Equal', 'Metal only': 'Metal', 'Energy only': 'Energy',
                              'Peso igual': 'Igual', 'Solo metal': 'Metal', 'Solo energía': 'Energía'}.get(node.value, node.value)
            if isinstance(node, ast.Dict):
                for i, key in enumerate(node.keys):
                    if isinstance(key, ast.Constant) and key.value == 'font.size':
                        node.values[i] = ast.Constant(font)
            if not isinstance(node, ast.Call) or not isinstance(node.func, ast.Attribute):
                continue
            method = node.func.attr
            if sensitivity and method == 'errorbar':
                node.args[0], node.args[1] = node.args[1], node.args[0]
                for kw in node.keywords:
                    if kw.arg == 'yerr':
                        kw.arg = 'xerr'
            if sensitivity and method == 'set_xticks':
                node.func.attr = 'set_yticks'
                if len(node.args) > 1 and isinstance(node.args[1], ast.Name):
                    node.args[1] = ast.parse("[name.replace('_', ' ') for name in names]", mode='eval').body
                for kw in node.keywords:
                    if kw.arg == 'rotation':
                        kw.value = ast.Constant(0)
            if method == 'legend' and panels == 1:
                node.keywords = [kw for kw in node.keywords if kw.arg not in ('loc', 'bbox_to_anchor', 'ncol', 'frameon')]
                node.keywords += [ast.keyword('ncol', ast.Constant(legend_columns)),
                                  ast.keyword(None, ast.Name('legend_style', ast.Load()))]
            if horizontal and method == 'bar':
                node.func.attr = 'barh'
            for kw in node.keywords:
                if kw.arg == 'fontsize' and isinstance(kw.value, ast.Constant):
                    kw.value = ast.Constant(max(18, kw.value.value))
                if kw.arg in ('title', 'xlabel', 'ylabel', 'label') and isinstance(kw.value, ast.Constant):
                    text = titles.get(kw.value.value, kw.value.value)
                    if lang == 'es':
                        text = LABELS_ES.get(text, text)
                    kw.value = ast.Constant(textwrap.fill(text, 38 if kw.arg == 'title' else 16 if kw.arg == 'ylabel' else 23))
                    if panels == 2 and topic == '02-flotation' and kw.arg == 'ylabel':
                        kw.value = ast.Constant(pair('Recovery\n(%)', 'Recuperación\n(%)', lang))
            if method == 'set' and horizontal:
                labels = {kw.arg: kw for kw in node.keywords}
                if 'xlabel' in labels and 'ylabel' in labels:
                    labels['xlabel'].value = labels['ylabel'].value
                    labels['ylabel'].value = ast.Constant('')
            if method == 'tick_params' and horizontal:
                for kw in node.keywords:
                    if kw.arg == 'rotation':
                        kw.value = ast.Constant(0)
            if method == 'set' and panels == 3:
                node.keywords = [kw for kw in node.keywords if kw.arg not in ('xlabel', 'ylabel')]
        tree.body = [node for node in tree.body if not isinstance(node, ast.Import)
                     or not all(alias.name in ('numpy', 'matplotlib.pyplot') for alias in node.names)]
        log_x = any(isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute)
                    and (node.func.attr == 'set_xscale' and node.args and isinstance(node.args[0], ast.Constant)
                         and node.args[0].value == 'log' or any(kw.arg == 'xscale' and isinstance(kw.value, ast.Constant)
                         and kw.value.value == 'log' for kw in node.keywords)) for node in ast.walk(tree))
        program = ast.unparse(tree)
        if panels == 3:
            program = """for indices in ((0,), (1, 2)):
    fig, axes = plt.subplots(1, len(indices), figsize=(6.4, 3.8), squeeze=False)
    for axis, j in zip(axes[0], indices):
        for case_id in case_ids:
            mask = challenge_case == case_id
            axis.scatter(challenge_y[mask, j], challenge_prediction[mask, j], label=case_labels[case_id], s=24)
        limits = [float(challenge_y[:, j].min()), float(challenge_y[:, j].max())]
        axis.plot(limits, limits, '--', color='black')
        axis.set_title(target_labels[j], fontsize=20)
        axis.locator_params(nbins=3)
    fig.supxlabel('Engine target', fontsize=20)
    fig.supylabel('Neural prediction', fontsize=20)
    handles, names = axes[0, 0].get_legend_handles_labels()
    fig.legend(handles, names, loc='upper center', bbox_to_anchor=(0.5, 1.02), ncol=2, fontsize=20)
    fig.subplots_adjust(left=0.18, right=0.98, bottom=0.2, top=0.54, wspace=0.7)"""
            title_pad = 8
        outside = '**legend_style'
        if 'psd[stream]' in source:
            program = program.replace('ax.legend(', "ax.legend(['Crusher', 'Fresh', 'Overflow'], ")
        if horizontal and topic == '02-flotation':
            labels = ['Refitted', 'Frozen'] if 'residence.set_index' in source else ['Batch RMSE', 'Bank |error|']
            program = program.replace('fig.tight_layout()',
                                      f'ax.legend({labels!r}, fontsize=18, ncol=2, {outside})\nfig.tight_layout()')
        if horizontal and topic == '03-learning':
            short = {'Case holdout': 'Case', 'Ore-group holdout': 'Ore group'}
            if lang == 'es':
                short = {LABELS_ES.get(key, key): LABELS_ES.get(value, value) for key, value in short.items()}
            legend = ("handles, legend_names = ax.get_legend_handles_labels()\n"
                      f"legend_short = {short!r}\n"
                      "ax.legend(handles, [legend_short.get(name, name) for name in legend_names], "
                      f"fontsize=18, ncol=2, {outside})\n")
            program = program.replace('fig.tight_layout()', legend + 'fig.tight_layout()')
        if 'coverage_all' in source:
            program = program.replace("loc='upper center', bbox_to_anchor=(0.5, -0.18), ncol=2",
                                      "loc='upper left'")
        if panels == 3:
            program = re.sub(r'axes\[0\]\.legend\([^\n]*\)',
                             "fig.legend(*axes[0].get_legend_handles_labels(), loc='upper center', "
                             "bbox_to_anchor=(0.5, 1.04), ncol=2, fontsize=18)",
                             program)
            program = program.replace('fig.tight_layout()',
                                      "fig.supxlabel('Engine target', fontsize=18)\n"
                                      "    fig.supylabel('Neural prediction', fontsize=18)\n"
                                      "    fig.tight_layout(rect=(0.04, 0.12, 1, 0.74))")
        if panels == 1:
            left = 0.4 if horizontal else 0.22
            top = 0.61 if title_pad >= 64 else 0.72 if has_legend else 0.87
            adjust = f'fig.subplots_adjust(left={left}, right=0.96, bottom=0.23, top={top})'
            program = program.replace('fig.tight_layout()', adjust)
        elif panels == 2:
            program = program.replace('fig.tight_layout()',
                                      'fig.subplots_adjust(left=0.24, right=0.96, bottom=0.15, top=0.91, hspace=1.0)')
        if panels == 1 and log_x:
            program += "\nax.locator_params(axis='x', numticks=4)\nax.tick_params(axis='x', which='minor', labelbottom=False)"
        comments = [line for line in source.splitlines() if line.lstrip().startswith('#')]
        comment = comments[0] if comments else pair('# Plot the computed comparison.', '# Graficar la comparación.', lang)
        style = f"plt.rcParams.update({{'font.size': {font}, 'axes.titlepad': {title_pad}}})"
        cell['source'] = (comment + '\n' + style + '\n' + program + '\n').splitlines(keepends=True)


def final_output_fixes(notebook):
    """F12-F16: repair the quantities, legends and interpretation exposed by adopted outputs."""
    meta = notebook['metadata']['caos']
    topic, level, lang = meta['topic'], meta['level'], meta['language']
    cells = notebook['cells']
    def replace(cell_id, text):
        next(cell for cell in cells if cell['id'] == cell_id)['source'] = text.splitlines(keepends=True)
    def program(cell_id):
        return ''.join(next(cell for cell in cells if cell['id'] == cell_id)['source'])
    LABELS_ES.update({
        'First order|Kelsall|Klimpel|Gamma|Stretched exponential':
        'Primer orden|Kelsall|Klimpel|Gamma|Exponencial estirada',
        'Stretched exp.': 'Exp. estirada', 'Virtual data': 'Datos virtuales',
        'Five batch fits': 'Cinco ajustes batch',
        'Recovery\n(%)': 'Recuperación\n(%)',
        'Fitted projection': 'Proyección ajustada', 'Exact reference': 'Referencia exacta',
        'Bank true-flotation recovery (%)': 'Recuperación verdadera del banco (%)',
        'Continuous-bank projections': 'Proyecciones al banco continuo',
        'Specific energy\n(kWh/t)': 'Energía específica\n(kWh/t)',
        ' coincident preferences': ' preferencias coincidentes',
    })
    if topic == '02-flotation' and level >= 2:
        setup = next(cell for cell in cells if cell['cell_type'] == 'code')
        setup['source'] += ("\nmodel_labels = dict(zip('first_order kelsall klimpel gamma stretched_exponential'.split(),\n"
                            "    'First order|Kelsall|Klimpel|Gamma|Stretched exponential'.split('|')))\n"
                            "curve_labels = {**model_labels, 'stretched_exponential': 'Stretched exp.'}\n").splitlines(keepends=True)
        curve_id = 'lesson-013' if level == 2 else 'lesson-014'
        tree = ast.parse(program(curve_id))
        for node in ast.walk(tree):
            if isinstance(node, ast.Dict):
                for i, key in enumerate(node.keys):
                    if isinstance(key, ast.Constant) and key.value == 'axes.titlepad':
                        node.values[i] = ast.Constant(100)
            if not isinstance(node, ast.Call):
                continue
            for kw in node.keywords:
                if isinstance(node.func, ast.Attribute) and node.func.attr == 'legend' and kw.arg is None:
                    kw.value = ast.parse("{**legend_style, 'bbox_to_anchor': (0.5, 1.1)}", mode='eval').body
                if kw.arg == 'figsize':
                    kw.value = ast.Tuple([ast.Constant(6.4), ast.Constant(4.4)], ast.Load())
                if kw.arg == 'label' and isinstance(kw.value, ast.Subscript):
                    kw.value = ast.Call(ast.Attribute(ast.Name('curve_labels', ast.Load()), 'get', ast.Load()),
                                        [kw.value, kw.value], [])
                elif kw.arg == 'label' and isinstance(kw.value, ast.Constant):
                    kw.value = ast.Constant('Virtual data')
                if kw.arg == 'title':
                    kw.value = ast.Constant('Five batch fits')
                if kw.arg == 'ylabel':
                    kw.value = ast.Constant('Recovery\n(%)')
                if kw.arg == 'ncol':
                    kw.value = ast.Constant(3)
                if isinstance(node.func, ast.Attribute) and node.func.attr == 'subplots_adjust':
                    if kw.arg == 'top':
                        kw.value = ast.Constant(0.5)
                    elif kw.arg == 'bottom':
                        kw.value = ast.Constant(0.18)
        source = ast.unparse(tree)
        source = source.replace("'axes.titlepad': 100", "'axes.titlepad': 100, 'axes.titlesize': 18, 'legend.fontsize': 16")
        replace(curve_id, '# Plot all five fits and their common virtual observations.\n' + source)
    if topic == '02-flotation' and level == 3:
        replace('lesson-017', """# Compare fitted bank projections with the exact reference on the numeric recovery axis.
plt.rcParams.update({'font.size': 18, 'axes.titlepad': 40})
fig, ax = plt.subplots(figsize=(6.4, 3.8))
projection_bars = ax.barh([model_labels.get(m['id'], m['id']) for m in models],
                          [m['bank_projection_pct'] for m in models])
reference_line = ax.axvline(kinetics['bank']['exact_true_flotation_pct'], color='firebrick', linestyle='--')
ax.set(xlabel='Bank true-flotation recovery (%)', ylabel='', title='Continuous-bank projections')
ax.legend([projection_bars, reference_line], ['Fitted projection', 'Exact reference'], ncol=2, **legend_style)
ax.grid(axis='x', alpha=0.25)
fig.subplots_adjust(left=0.4, right=0.96, bottom=0.23, top=0.72)""")
        replace('lesson-036', """# Preserve the two signed-error series and bind their legend to their own bar containers.
plt.rcParams.update({'font.size': 18, 'axes.titlepad': 40})
fig, ax = plt.subplots(figsize=(6.4, 3.8))
residence.set_index('Model')[['Refit signed error (pp)', 'Frozen signed error (pp)']].rename(
    index=model_labels).plot.barh(ax=ax)
ax.axvline(0, color='black', linewidth=1)
ax.set(xlabel='Bank error (pp)', ylabel='', title='Short-bank projection errors')
ax.legend(handles=ax.containers, labels=['Refitted', 'Frozen'], fontsize=18, ncol=2, **legend_style)
fig.subplots_adjust(left=0.4, right=0.96, bottom=0.23, top=0.72)""")
    if topic == '01-comminution' and level == 3:
        title_physical = pair('Mill feed F80', 'F80 al molino', lang)
        title_reference = pair('Reference', 'Referencia', lang)
        replace('lesson-014', r"""# Keep the physical and imposed-calibration experiments in separate complete figures.
plt.rcParams.update({'font.size': 18, 'axes.titlepad': 70, 'axes.titlesize': 18})
axes = []
panel_specs = ((curves['p80_um'], curves), (reference_products, reference_curves))
panel_titles = [f'PHYSICAL={f80:.1f} µm', f'REFERENCE: F80={reference_feed:g}; P80={reference_product:g} µm']
for panel, (products, law_values) in enumerate(panel_specs):
    fig, ax = plt.subplots(figsize=(6.4, 3.8))
    for name in ('bond', 'rittinger', 'kick'):
        ax.plot(products, law_values[name], label=name.title())
        if panel == 1:
            ax.scatter([reference_product], [calibration[name][0]], s=28)
    ax.set(xlabel='Product P80 (µm)', ylabel='Specific energy\n(kWh/t)', title=panel_titles[panel])
    ax.set_xscale('log')
    ax.invert_xaxis()
    ax.grid(alpha=0.25)
    ax.legend(ncol=3, fontsize=16, **legend_style)
    fig.subplots_adjust(left=0.24, right=0.96, bottom=0.23, top=0.72)
    axes.append(ax)""".replace('PHYSICAL', title_physical).replace('REFERENCE', title_reference))
        replace('lesson-013', pair(
            'The first figure evaluates the physical mill-feed reduction. The second is a different, explicitly '
            'labelled calibration experiment; each marker uses the exact law value at the declared reference endpoint. '
            'No nearest-grid ordinate is used for a marker at another size.',
            'La primera figura evalúa la reducción física del molino. La segunda es un experimento de calibración '
            'distinto y rotulado; cada marca usa el valor exacto de su ley en el extremo de referencia. Ninguna '
            'marca toma la ordenada de un tamaño vecino.', lang))
        replace('lesson-015', pair(
            'The first figure’s curves can differ at 150 µm because their feed is the achieved mill feed. '
            'The second figure’s markers coincide only at the declared reference reduction, evaluated exactly '
            'rather than interpolated from an unrelated grid point. These are distinct questions with labelled '
            'endpoints. The later nominal-work table and ratio sweep retain the physical mill-feed basis; '
            'calibration supplies neither another operating state nor measured energy validation.',
            'Las curvas de la primera figura pueden diferir a 150 µm porque usan alimentación alcanzada del '
            'molino. Las marcas de la segunda coinciden solo en la reducción de referencia declarada, evaluada '
            'exactamente y no desde un punto vecino. Son preguntas distintas con extremos identificados. La '
            'tabla nominal y el barrido relativo mantienen la base física del molino; calibrar no aporta otro '
            'estado operativo ni validación energética medida.', lang))
    if topic == '03-learning' and level == 3:
        source = program('released-015')
        tree = ast.parse(source)
        for index, node in enumerate(tree.body):
            if isinstance(node, ast.Assign) and any(isinstance(t, ast.Name) and t.id == 'target_units' for t in node.targets):
                value = ast.parse(ast.unparse(node.value), mode='eval').body
                value.elts[0] = ast.Constant('%')
                tree.body.insert(index + 1, ast.Assign(targets=[ast.Name('physical_units', ast.Store())], value=value))
                break
        for node in ast.walk(tree):
            if isinstance(node, ast.Dict):
                for index, key in enumerate(node.keys):
                    if isinstance(key, ast.Constant) and key.value in ('Unit', 'Unidad'):
                        if isinstance(node.values[index], ast.Name) and node.values[index].id == 'target_units':
                            node.values[index] = ast.Name('physical_units', ast.Load())
        replace('released-015', source.splitlines()[0] + '\n' + ast.unparse(ast.fix_missing_locations(tree)))
        source = program('lesson-026').replace('ncol=2', 'ncol=3')
        source = source.replace("'axes.titlepad': 40", "'axes.titlepad': 90, 'axes.titlesize': 18")
        source = source.replace('fontsize=18', 'fontsize=16')
        if lang == 'es':
            source = source.replace("'Case holdout': 'Case'", "'Case holdout': 'Caso'")
            source = source.replace("'Ore-group holdout': 'Ore group'", "'Ore-group holdout': 'Grupo mineral'")
        replace('lesson-026', source)
    if topic == '04-optimization' and level == 2:
        preference_output_fix(notebook, replace, program)
    if topic == '05-uncertainty' and level == 3:
        uncertainty_output_comparison(notebook)
    if lang == 'es' and topic == '04-optimization':
        setup = next(cell for cell in cells if cell['cell_type'] == 'code')
        setup['source'] += ("\ntrace_headers = dict(zip('Outcome Mesh Barrier Objective Evaluations'.split(),\n"
                            "    'Resultado Malla Barrera Objetivo Evaluaciones'.split()))\n").splitlines(keepends=True)
        trace = next(cell for cell in cells if cell['cell_type'] == 'code' and 'history = pd.DataFrame' in ''.join(cell['source']))
        trace['source'] += "\ndisplay(history.rename(columns=trace_headers))\n".splitlines(keepends=True)


def uncertainty_output_comparison(notebook):
    """UQ-09: distinct output comparisons from the existing complete Saltelli designs."""
    lang = notebook['metadata']['caos']['language']
    LABELS_ES.update({
        'Work index': 'Índice de trabajo', 'Head grade': 'Ley de alimentación',
        'Liberation size': 'Tamaño de liberación', 'Floatability': 'Flotabilidad',
        'Recovery': 'Recuperación', 'Energy': 'Energía', 'Grinding energy': 'Energía de molienda',
        ' ST (1)': ' ST (1)', ' half-width (1)': ' semiamplitud (1)',
        ' rank': ' orden', ' state': ' estado', 'Computed': 'Calculado',
        'Constant output': 'Salida constante',
        'ST recovery - energy (1)': 'ST recuperación - energía (1)',
        'Output-specific total effects': 'Efectos totales según salida',
        'Total Sobol\nindex (1)': 'Índice Sobol\ntotal (1)',
        'Cross-output rank agreement (1=yes)': 'Acuerdo entre salidas (1=sí)',
        'Largest recovery-energy ST difference (1)': 'Máxima diferencia ST entre salidas (1)',
        'Largest energy total-effect half-width (1)': 'Máxima semiamplitud total de energía (1)',
        'Sobol response: unavailable design': 'Respuesta Sobol: diseño no disponible',
        'Sobol response: incomplete target ': 'Respuesta Sobol: objetivo incompleto ',
        'Sobol response: invalid target ': 'Respuesta Sobol: objetivo inválido ',
        'Cross-output Results unavailable: constant target':
        'Resultados entre salidas no disponibles: objetivo constante',
    })
    cells = notebook['cells']
    def local(en, es):
        return pair(en, es, lang)
    def source(cell_id):
        return ''.join(next(c for c in cells if c['id'] == cell_id)['source'])
    def replace(cell_id, text):
        next(c for c in cells if c['id'] == cell_id)['source'] = text.splitlines(keepends=True)
    title = local('Compare output-specific Sobol sensitivity', 'Comparar sensibilidad Sobol según la salida')
    notebook['metadata']['caos']['title'] = title
    replace('lesson-001', '# ' + title + '\n\n' + local(
        '**Question:** How does factor importance differ between recovery and grinding energy '
        'under the same finite Saltelli designs?\n\nLevel: 3. Prerequisites: earlier lessons in this topic. '
        'Reading time: 30 minutes.',
        '**Pregunta:** ¿Cómo cambia la importancia de factores entre recuperación y energía de molienda '
        'con los mismos diseños Saltelli finitos?\n\nNivel: 3. Prerrequisitos: lecciones anteriores del tema. '
        'Tiempo de lectura: 30 minutos.'))
    replace('lesson-002', local(
        '## Objectives\n\nRetain level 2’s seeded N8/N16 experiment as a shared baseline, then calculate '
        'a distinct cross-output comparison. Use already returned recovery and grinding-energy indices '
        'to compare factor ranks and signed total-effect differences at each budget. Keep individual '
        'bootstrap widths and constant-output states visible; no additional engine solve is needed.',
        '## Objetivos\n\nConservar el experimento N8/N16 de nivel 2 como base compartida y calcular una '
        'comparación adicional entre salidas. Usar índices ya devueltos de recuperación y energía de '
        'molienda para comparar órdenes y diferencias firmadas de efectos totales con cada presupuesto. '
        'Conservar semiamplitudes individuales y estados constantes; no se requieren evaluaciones adicionales.'))
    replace('lesson-007', local(
        '## Method\n\nThe original 32-draw propagation and N8/N16 sensitivity calls are the explicitly '
        'shared level-2 baseline: same nominal circuit, seed 20261031 and independent factor ranges. '
        'Each complete response already contains recovery_pct and specific_energy_grinding_kwh_t indices '
        'from its same 48 or 96 engine evaluations. The additional analysis extracts each target separately, '
        'ranks descending ST values with shared ranks for ties, and subtracts energy ST from recovery ST '
        'factor by factor. No input distribution, sample count or solve is added. Individual bootstrap '
        'half-widths remain attached to their own targets. No joint resamples are exposed, so differences '
        'receive no inferred confidence interval or significance test.',
        '## Método\n\nLa propagación de 32 extracciones y las llamadas N8/N16 son la base compartida '
        'explícita de nivel 2: mismo circuito nominal, semilla 20261031 y rangos independientes. Cada '
        'respuesta completa contiene índices recovery_pct y specific_energy_grinding_kwh_t obtenidos de '
        'las mismas 48 o 96 evaluaciones. El análisis adicional extrae cada salida por separado, ordena ST '
        'de mayor a menor con empates compartidos y resta ST de energía a ST de recuperación por factor. '
        'No agrega distribución, muestras ni evaluaciones. Cada semiamplitud pertenece a su salida. '
        'Sin remuestreos conjuntos, no se infiere intervalo de diferencia ni prueba de significación.'))
    additions = []
    def add(number, kind, text):
        if kind == 'code' and lang == 'es':
            explanation = ''.join(additions[-1]['source']).split('. ')[0]
            text = '# ' + explanation + '\n' + '\n'.join(text.splitlines()[1:])
        cell = md(text) if kind == 'markdown' else code(text)
        cell['id'] = f'uq-compare-{number:03d}'
        additions.append(cell)
    add(1, 'markdown', local(
        'Extract two output vectors from one complete sensitivity response. Recovery has physical units '
        'of percent and grinding energy kWh/t; both normalized Sobol indices are dimensionless. Validate '
        'every factor and half-width before ranking. A production constant flag means index and rank are '
        'unavailable, not zero. Missing targets and invalid designs stop with response-contract context.',
        'Extraer dos vectores de una misma respuesta completa. Las unidades físicas son porcentaje para '
        'recuperación y kWh/t para energía de molienda; ambos índices Sobol son adimensionales. Validar '
        'cada factor y semiamplitud antes de ordenar. Una salida constante tiene índice y orden no '
        'disponibles, no cero. Un objetivo ausente o diseño inválido detiene el cálculo con contexto.'))
    add(2, 'code', '''# Extract validated target-specific indices without changing finite estimates.
def uq_target_indices(record, target):
    if record.get('status') != 'computed':
        raise ValueError('Sobol response: unavailable design')
    try:
        names = list(record['inputs'])
        effect = record['indices'][target]
        if effect.get('constant'):
            return {'constant': True, 'ST': None, 'ST_conf': None, 'rank': None}
        values = np.asarray([[effect[key][name] for name in names] for key in ('ST', 'ST_conf')], dtype=float)
    except (KeyError, TypeError, ValueError) as error:
        raise ValueError('Sobol response: incomplete target ' + target) from error
    if not names or not np.isfinite(values).all() or np.any(values[1] < 0):
        raise ValueError('Sobol response: invalid target ' + target)
    ranks = pd.Series(values[0]).rank(ascending=False, method='min').to_numpy(dtype=int)
    return {'constant': False, 'ST': values[0], 'ST_conf': values[1], 'rank': ranks}''')
    add(3, 'markdown', local(
        'Pair each factor’s recovery ST with its own grinding-energy ST from that same design. Calculate '
        'signed recovery-minus-energy differences and compare target-specific point ranks, retaining '
        'negative estimates, values above one and wide individual bootstrap half-widths. These finite-sample '
        'descriptions do not estimate plant effects or uncertainty of a paired difference. A constant '
        'target leaves differences and rank agreement unavailable for the entire pair.',
        'Emparejar ST de recuperación y ST de energía de cada factor dentro del mismo diseño. Calcular '
        'diferencias firmadas recuperación menos energía y comparar órdenes puntuales, conservando '
        'estimaciones negativas, valores mayores que uno y semiamplitudes individuales amplias. Estas '
        'descripciones finitas no estiman efectos de planta ni incertidumbre de una diferencia pareada. '
        'Una salida constante deja diferencias y acuerdo de orden no disponibles.'))
    add(4, 'code', '''# Compare distinct target vectors on their shared factor order and sample design.
def uq_compare_targets(record):
    recovery_effect = uq_target_indices(record, 'recovery_pct')
    energy_effect = uq_target_indices(record, 'specific_energy_grinding_kwh_t')
    available = not (recovery_effect['constant'] or energy_effect['constant'])
    delta = recovery_effect['ST'] - energy_effect['ST'] if available else None
    agreement = bool(np.array_equal(recovery_effect['rank'], energy_effect['rank'])) if available else None
    return {'names': list(record['inputs']), 'N': record['base_samples'], 'recovery': recovery_effect,
            'energy': energy_effect, 'delta': delta, 'rank_agreement': agreement}

cross_outputs = [uq_compare_targets(record) for record in (small_indices, larger_indices)]''')
    add(5, 'markdown', local(
        'Build the new paired table for both existing budgets without calling the engine. Each row keeps '
        'factor, N, two total effects, separate bootstrap half-widths, signed difference and descending '
        'ranks. Absent numbers accompany an explicit constant-output state. Read N8 beside N16 before '
        'treating apparent target-specific importance as stable.',
        'Construir la nueva tabla pareada con ambos presupuestos existentes sin llamar al motor. Cada '
        'fila conserva factor, N, dos efectos totales, semiamplitudes separadas, diferencia firmada y '
        'órdenes descendentes. Los números ausentes acompañan un estado explícito de salida constante. '
        'Leer N8 junto a N16 antes de considerar estable la importancia según salida.'))
    add(6, 'code', '''# Tabulate both already computed designs without additional circuit evaluations.
factor_labels = {'work_index': 'Work index', 'head_grade': 'Head grade',
                 'liberation_size': 'Liberation size', 'floatability': 'Floatability'}
comparison_rows = []
for comparison in cross_outputs:
    for i, name in enumerate(comparison['names']):
        row = {'N': comparison['N'], 'Factor': factor_labels.get(name, name)}
        for key, label in (('recovery', 'Recovery'), ('energy', 'Energy')):
            effect = comparison[key]
            available = not effect['constant']
            row[label + ' ST (1)'] = effect['ST'][i] if available else None
            row[label + ' half-width (1)'] = effect['ST_conf'][i] if available else None
            row[label + ' rank'] = effect['rank'][i] if available else None
            row[label + ' state'] = 'Computed' if available else 'Constant output'
        row['ST recovery - energy (1)'] = comparison['delta'][i] if comparison['delta'] is not None else None
        comparison_rows.append(row)
comparison_table = pd.DataFrame(comparison_rows)
display(comparison_table.round(4))''')
    add(7, 'markdown', local(
        'Plot the new N16 comparison using separate recovery and energy series with their own individual '
        'bootstrap half-widths. Both series occupy the same dimensionless axis; this does not equate '
        'physical output units. The zero reference is an index reference, not a null-hypothesis test. '
        'Let the axes include complete bars rather than trimming negative or above-one endpoints.',
        'Graficar la nueva comparación N16 con series separadas y sus semiamplitudes bootstrap propias. '
        'Ambas usan un eje adimensional, sin equiparar unidades físicas. La referencia cero pertenece '
        'al índice, no a una prueba de hipótesis. Conservar barras completas, incluso con extremos '
        'negativos o mayores que uno.'))
    add(8, 'code', r'''# Plot distinct output indices with their own uncertainty on the existing N16 design.
plt.rcParams.update({'font.size': 18, 'axes.titlesize': 18, 'axes.titlepad': 65})
fig, ax = plt.subplots(figsize=(6.4, 3.8))
comparison = cross_outputs[-1]
for offset, key, label in ((-0.12, 'recovery', 'Recovery'), (0.12, 'energy', 'Grinding energy')):
    effect = comparison[key]
    if effect['constant']:
        ax.plot([], [], 'o', label=label + ': ' + 'Constant output')
    else:
        ax.errorbar(effect['ST'], np.arange(len(comparison['names'])) + offset,
                    xerr=effect['ST_conf'], fmt='o', capsize=3, label=label)
ax.axvline(0, color='grey', linewidth=0.8)
ax.set_yticks(range(len(comparison['names'])), [factor_labels.get(n, n) for n in comparison['names']])
ax.set(xlabel='Total Sobol\nindex (1)', ylabel='', title='Output-specific total effects')
ax.legend(ncol=2, fontsize=16, **legend_style)
ax.grid(axis='x', alpha=0.25)
fig.subplots_adjust(left=0.4, right=0.96, bottom=0.23, top=0.64)''')
    add(9, 'markdown', local(
        'Factor importance is conditional on which output variance is decomposed. Compare signed '
        'differences and point ranks in the table with these individual bars; even matching ranks are '
        'only descriptive at small N. Overlap does not provide a paired-difference interval, and '
        'nonoverlap does not supply a calibrated significance test. Finite design, independent-factor '
        'assumptions and model structure still limit both outputs. No clamp or extra solve was used '
        'to make the two series appear different.',
        'La importancia depende de la varianza de salida descompuesta. Comparar diferencias firmadas '
        'y órdenes de la tabla junto a las barras individuales; incluso órdenes coincidentes son '
        'descriptivos con N pequeño. El solapamiento no aporta un intervalo de diferencia pareada ni '
        'su ausencia una prueba calibrada. Diseño finito, independencia y estructura del modelo limitan '
        'ambas salidas. No se recortaron índices ni agregaron evaluaciones para producir diferencias.'))
    add(10, 'markdown', local(
        'Compute new answer quantities directly from the N16 target pair. Preserve signed factorwise '
        'values in the table while summarizing largest absolute difference, point-order agreement and '
        'largest energy half-width. If a target is constant, refuse numeric answer binding explicitly '
        'instead of manufacturing a zero difference or rank.',
        'Calcular las nuevas respuestas desde la pareja N16. Conservar diferencias firmadas en la tabla '
        'y resumir máxima diferencia absoluta, acuerdo de orden y máxima semiamplitud de energía. Si una '
        'salida es constante, rechazar el vínculo numérico explícitamente en lugar de inventar diferencia cero u orden.'))
    add(11, 'code', '''# Bind the actual cross-output comparison without reusing recovery as energy.
cross_final = cross_outputs[-1]
if cross_final['delta'] is None:
    raise RuntimeError('Cross-output Results unavailable: constant target')
cross_answer = {
    'Cross-output rank agreement (1=yes)': int(cross_final['rank_agreement']),
    'Largest recovery-energy ST difference (1)': float(np.max(np.abs(cross_final['delta']))),
    'Largest energy total-effect half-width (1)': float(np.max(cross_final['energy']['ST_conf'])),
}
display(pd.DataFrame(cross_answer.items(), columns=['Quantity', 'Value']))''')
    result_index = next(i for i, cell in enumerate(cells) if cell['id'] == 'lesson-028')
    cells[result_index:result_index] = additions
    def binding(en, es):
        return '<!-- result:' + local(en, es) + ' -->0<!-- /result -->'
    paragraph = local(
        'For the additional same-design N16 comparison, recovery versus grinding-energy point-order agreement is ',
        'En la comparación adicional N16 del mismo diseño, el acuerdo de orden puntual entre recuperación y energía es ')
    paragraph += binding('Cross-output rank agreement (1=yes)', 'Acuerdo entre salidas (1=sí)')
    paragraph += local(' (1=yes). The largest absolute factorwise ST difference is ',
                       ' (1=sí). La máxima diferencia absoluta ST por factor es ')
    paragraph += binding('Largest recovery-energy ST difference (1)', 'Máxima diferencia ST entre salidas (1)')
    paragraph += local(', and the largest individual energy half-width is ',
                       ', y la máxima semiamplitud individual de energía es ')
    paragraph += binding('Largest energy total-effect half-width (1)', 'Máxima semiamplitud total de energía (1)')
    paragraph += local(
        '. All are dimensionless finite estimators. The table retains signed differences for both budgets '
        'and the figure separate target intervals. No difference confidence interval, significant separation '
        'or plant causality is inferred.',
        '. Son estimadores finitos adimensionales. La tabla conserva diferencias firmadas de ambos '
        'presupuestos y la figura intervalos separados. No se infiere intervalo de diferencia, separación '
        'significativa ni causalidad de planta.')
    replace('lesson-028', source('lesson-028') + '\n\n' + paragraph)
    answer = source('lesson-030')
    answer = answer.replace('answer_values = {label:', 'answer_values.update(cross_answer)\nanswer_values = {label:')
    replace('lesson-030', answer)
    replace('lesson-029', local(
        'Bind retained baseline quantities and the new same-design cross-output comparison to their own Results spans.',
        'Vincular cantidades de la base y la nueva comparación entre salidas del mismo diseño con sus propios resultados.'))
    replace('lesson-031', local(
        '## Summary\n\nThe shared N8/N16 baseline retains its recovery rank-stability check. The additional '
        'paired table and original figure compare recovery and grinding-energy ST vectors, individual '
        'intervals and target-specific ranks from those same solves. Observed differences and rank agreement '
        'are finite-design descriptions, not significance, causal plant effects or evidence against omitted '
        'correlations and structural-model uncertainty.',
        '## Resumen\n\nLa base N8/N16 conserva su comprobación de estabilidad del orden de recuperación. '
        'La tabla pareada adicional y la figura original comparan vectores ST de recuperación y energía, '
        'intervalos individuales y órdenes según salida de las mismas evaluaciones. Diferencias y acuerdo '
        'son descripciones finitas, no significación, efectos causales de planta ni evidencia contra '
        'correlaciones omitidas o incertidumbre estructural.'))


def preference_output_fix(notebook, replace, program):
    """Describe the computed invariant outcome without changing the three searches."""
    lang = notebook['metadata']['caos']['language']
    replace('lesson-022', """# Preserve each preference status and annotate actual coincident physical endpoints.
plt.rcParams.update({'font.size': 18, 'axes.titlepad': 80})
preference_runs = (('Equal', plain), ('Metal', metal_search), ('Energy', energy_search))
endpoints_xy = []
fig, ax = plt.subplots(figsize=(6.4, 3.8))
for label, run in preference_runs:
    end = run.get('optimum') or run.get('least_violating') or run['base']
    if run['status'] != 'base_refused' and end['values']:
        xy = (end['values']['energy_kwh_t'], end['recovered_tph'])
        endpoints_xy.append(xy)
        ax.scatter(*xy, marker='o' if end['feasible'] else 'x', label=label + ' [' + run['status'] + ']')
if len(endpoints_xy) > 1 and len(set(endpoints_xy)) == 1:
    ax.annotate(str(len(endpoints_xy)) + ' coincident preferences', endpoints_xy[0],
                xytext=(0, -30), textcoords='offset points', ha='center', fontsize=16)
ax.set(xlabel='Specific energy (kWh/t)', ylabel='Recovered metal (t/h)', title='Computed preference endpoints')
ax.legend(ncol=2, **legend_style)
fig.subplots_adjust(left=0.22, right=0.96, bottom=0.23, top=0.61)""")
    replace('lesson-021', pair(
        'Plot the three preference runs in energy and recovered-metal coordinates while retaining their '
        'individual statuses. This bounded case selects the same physical endpoint at all three weights. '
        'Coincident markers therefore demonstrate invariance across these requested preferences, not an '
        'observed trade-off. The annotation counts the overplotted outcomes without moving them or inventing '
        'an interpolated frontier. The following table retains every run’s slacks and stopping evidence.',
        'Graficar las tres preferencias en coordenadas de energía y metal recuperado, conservando sus estados. '
        'Este caso acotado selecciona el mismo extremo físico con los tres pesos. Las marcas coincidentes '
        'demuestran invariancia entre estas preferencias, sin intercambio observado. La anotación cuenta '
        'resultados superpuestos sin moverlos ni inventar una frontera interpolada. La tabla posterior '
        'conserva holguras y evidencia de detención de cada corrida.', lang))
    replace('lesson-023', pair(
        'Three status-labelled runs coincide at one plotted coordinate in this experiment. The equal, metal-only '
        'and energy-only preferences therefore supply an invariant physical outcome here, rather than three '
        'distinct Pareto points. The annotation preserves their multiplicity. Infeasible or unavailable states '
        'would still require the recorded status and slacks; coincidence alone is not a feasibility or global '
        'optimality proof, an economic valuation or evidence of preference insensitivity for another circuit.',
        'Las tres corridas con estado coinciden en una coordenada en este experimento. Las preferencias de '
        'pesos iguales, solo metal y solo energía aportan aquí un resultado físico invariante, no tres puntos '
        'Pareto distintos. La anotación conserva su multiplicidad. Estados infactibles o ausentes seguirían '
        'exigiendo estado y holguras registrados; coincidir no prueba factibilidad, optimalidad global, valor '
        'económico ni insensibilidad de otro circuito a preferencias.', lang))
    replace('lesson-030', pair(
        '## Summary\n\nAll three requested preferences select the same physical endpoint in this bounded '
        'experiment. Individual feasibility, slacks and stopping evidence remain visible. This invariance '
        'does not establish a general absence of trade-offs, an economic utility or an interpolated frontier.',
        '## Resumen\n\nLas tres preferencias seleccionan el mismo extremo físico en este experimento '
        'acotado. Se conservan factibilidad, holguras y detención individuales. Esta invariancia no establece '
        'ausencia general de intercambios, utilidad económica ni una frontera interpolada.', lang))
    source = program('lesson-027')
    if lang == 'en':
        source = source.replace('Their separately labelled physical outcomes and slacks show the preference trade-off,',
            'The table reports the same physical endpoint for all three preferences: an invariant outcome in this run,')
    else:
        source = source.replace('Salidas físicas y holguras rotuladas muestran el compromiso;',
            'La tabla informa el mismo extremo físico con las tres preferencias: un resultado invariante en esta corrida;')
    replace('lesson-027', source)


def main():
    from build_didactic_notebooks import PINS
    for relative, base in BASE.items():
        notebook = enrich(json.loads(json.dumps(base)))
        notebook['metadata']['caos']['packages'] = PINS
        path = ROOT / 'notebooks' / relative
        path.write_text(json.dumps(notebook, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    print('build_advanced_notebook_extensions: authored 12 optimization and uncertainty lessons')

BASE = {'en/04-optimization/01-the-record.ipynb': {'cells': [{'cell_type': 'markdown',
                                                       'metadata': {},
                                                       'source': ['# Read an operating-point optimization '
                                                                  'record\n']},
                                                      {'cell_type': 'markdown',
                                                       'metadata': {},
                                                       'source': ['## Objectives\n',
                                                                  '\n',
                                                                  'Separate the operating decisions, '
                                                                  'objective, feasibility constraints and '
                                                                  'measured search effort in the committed '
                                                                  'optimizer result. Explain why an optimum '
                                                                  'is conditional on the authored case and '
                                                                  'its contract.']},
                                                      {'cell_type': 'markdown',
                                                       'metadata': {},
                                                       'source': ['## Setup\n',
                                                                  '\n',
                                                                  '```bash\n',
                                                                  'pip install numpy==2.2.6 scipy==1.17.1 '
                                                                  'pandas==2.2.3 matplotlib==3.11.2 '
                                                                  'nbclient==0.11.0 nbformat==5.11.1 '
                                                                  'ipykernel==7.4.0 SALib==1.6.0\n',
                                                                  '```\n',
                                                                  '\n',
                                                                  'The OreFlow pipeline is imported from '
                                                                  '`data-pipeline/`; this notebook never '
                                                                  'installs packages.']},
                                                      {'cell_type': 'code',
                                                       'execution_count': None,
                                                       'metadata': {},
                                                       'outputs': [],
                                                       'source': ['# Import analysis tools and record their '
                                                                  'exact versions.\n',
                                                                  'import importlib.metadata\n',
                                                                  'import json\n',
                                                                  'from pathlib import Path\n',
                                                                  'import sys\n',
                                                                  'import numpy as np\n',
                                                                  'import pandas as pd\n',
                                                                  'import matplotlib.pyplot as plt\n',
                                                                  '\n',
                                                                  '# Resolve the local pipeline from the '
                                                                  'repository-relative layout.\n',
                                                                  'repo = Path("../../../").resolve()\n',
                                                                  'sys.path.insert(0, str(repo / '
                                                                  '"data-pipeline"))\n',
                                                                  'for package in ("numpy", "scipy", '
                                                                  '"pandas", "matplotlib", "nbclient", '
                                                                  '"nbformat", "ipykernel"):\n',
                                                                  '    print(package, '
                                                                  'importlib.metadata.version(package))\n']},
                                                      {'cell_type': 'markdown',
                                                       'metadata': {},
                                                       'source': ['## Data\n',
                                                                  '\n',
                                                                  'Owner: OreFlow authors; '
                                                                  '`data/derived/benchmark.json` and '
                                                                  '`data/derived/contract/operating_contract.json`, '
                                                                  'MIT project licence. The optimum is '
                                                                  'calculated for an authored scenario, not '
                                                                  'a plant. Repository: '
                                                                  'https://github.com/fsantibanezleal/CAOS_OreFlow.']},
                                                      {'cell_type': 'markdown',
                                                       'metadata': {},
                                                       'source': ['## Method\n',
                                                                  '\n',
                                                                  'OreFlow maximizes recovered primary metal '
                                                                  'relative to the base point while '
                                                                  'enforcing concentrate-grade, '
                                                                  'installed-power and water limits. A '
                                                                  'generalized pattern search works in the '
                                                                  'unit cube of declared decision bounds. A '
                                                                  'candidate rejected by the contract or '
                                                                  'engine is never treated as feasible. The '
                                                                  'committed record exposes the decisions, '
                                                                  'active constraints, evaluations and '
                                                                  'weight path.']},
                                                      {'cell_type': 'markdown',
                                                       'metadata': {},
                                                       'source': ['## Results\n']},
                                                      {'cell_type': 'markdown',
                                                       'metadata': {},
                                                       'source': ['## Summary\n',
                                                                  '\n',
                                                                  'You read the optimizer as a constrained '
                                                                  'engineering calculation: the result '
                                                                  'depends on the objective, bounds, '
                                                                  'constraints and starting case. A feasible '
                                                                  'result is not an operating '
                                                                  'recommendation.']},
                                                      {'cell_type': 'markdown',
                                                       'metadata': {},
                                                       'source': ['## References\n',
                                                                  '\n',
                                                                  '- '
                                                                  'https://doi.org/10.1137/S1052623493250780\n',
                                                                  '- https://doi.org/10.1137/070692662']}],
                                            'metadata': {'kernelspec': {'display_name': 'Python 3',
                                                                        'language': 'python',
                                                                        'name': 'python3'},
                                                         'language_info': {'name': 'python'},
                                                         'caos': {'beyond': [],
                                                                  'data': ['data/derived/benchmark.json',
                                                                           'data/derived/contract/operating_contract.json'],
                                                                  'language': 'en',
                                                                  'level': 1,
                                                                  'packages': ['numpy==2.2.6',
                                                                               'scipy==1.17.1',
                                                                               'pandas==2.2.3',
                                                                               'matplotlib==3.11.2',
                                                                               'nbclient==0.11.0',
                                                                               'nbformat==5.11.1',
                                                                               'ipykernel==7.4.0',
                                                                               'SALib==1.6.0'],
                                                                  'sources': ['https://doi.org/10.1137/S1052623493250780',
                                                                              'https://doi.org/10.1137/070692662'],
                                                                  'title': 'Read an operating-point '
                                                                           'optimization record',
                                                                  'topic': '04-optimization'}},
                                            'nbformat': 4,
                                            'nbformat_minor': 5},
 'en/04-optimization/02-the-method.ipynb': {'cells': [{'cell_type': 'markdown',
                                                       'metadata': {},
                                                       'source': ['# Run and inspect the pattern search\n']},
                                                      {'cell_type': 'markdown',
                                                       'metadata': {},
                                                       'source': ['## Objectives\n',
                                                                  '\n',
                                                                  "Run OreFlow's production optimizer on the "
                                                                  'soft porphyry case, inspect its actual '
                                                                  'evaluation trace and test whether the '
                                                                  'final point satisfies each declared '
                                                                  'physical constraint.']},
                                                      {'cell_type': 'markdown',
                                                       'metadata': {},
                                                       'source': ['## Setup\n',
                                                                  '\n',
                                                                  '```bash\n',
                                                                  'pip install numpy==2.2.6 scipy==1.17.1 '
                                                                  'pandas==2.2.3 matplotlib==3.11.2 '
                                                                  'nbclient==0.11.0 nbformat==5.11.1 '
                                                                  'ipykernel==7.4.0 SALib==1.6.0\n',
                                                                  '```\n',
                                                                  '\n',
                                                                  'The OreFlow pipeline is imported from '
                                                                  '`data-pipeline/`; this notebook never '
                                                                  'installs packages.']},
                                                      {'cell_type': 'code',
                                                       'execution_count': None,
                                                       'metadata': {},
                                                       'outputs': [],
                                                       'source': ['# Import analysis tools and record their '
                                                                  'exact versions.\n',
                                                                  'import importlib.metadata\n',
                                                                  'import json\n',
                                                                  'from pathlib import Path\n',
                                                                  'import sys\n',
                                                                  'import numpy as np\n',
                                                                  'import pandas as pd\n',
                                                                  'import matplotlib.pyplot as plt\n',
                                                                  '\n',
                                                                  '# Resolve the local pipeline from the '
                                                                  'repository-relative layout.\n',
                                                                  'repo = Path("../../../").resolve()\n',
                                                                  'sys.path.insert(0, str(repo / '
                                                                  '"data-pipeline"))\n',
                                                                  'for package in ("numpy", "scipy", '
                                                                  '"pandas", "matplotlib", "nbclient", '
                                                                  '"nbformat", "ipykernel"):\n',
                                                                  '    print(package, '
                                                                  'importlib.metadata.version(package))\n']},
                                                      {'cell_type': 'markdown',
                                                       'metadata': {},
                                                       'source': ['## Data\n',
                                                                  '\n',
                                                                  'Owner: OreFlow authors; the soft-porphyry '
                                                                  'case and Contract 1 are versioned at '
                                                                  '`data/derived/cases/copper_porphyry_soft.json` '
                                                                  'and '
                                                                  '`data/derived/contract/operating_contract.json`, '
                                                                  'MIT project licence. Repository: '
                                                                  'https://github.com/fsantibanezleal/CAOS_OreFlow.']},
                                                      {'cell_type': 'markdown',
                                                       'metadata': {},
                                                       'source': ['## Method\n',
                                                                  '\n',
                                                                  'The generalized pattern search tests mesh '
                                                                  'neighbours in bounded decision '
                                                                  'coordinates and applies a progressive '
                                                                  'barrier to grade, power and water '
                                                                  'violations. This notebook calls '
                                                                  '`optimize` from '
                                                                  '`pipeline/methods/optimization.py`; it '
                                                                  'does not reproduce the optimizer. The run '
                                                                  'disables the optional surrogate screen to '
                                                                  'isolate the engine-evaluated poll.']},
                                                      {'cell_type': 'markdown',
                                                       'metadata': {},
                                                       'source': ['## Results\n']},
                                                      {'cell_type': 'markdown',
                                                       'metadata': {},
                                                       'source': ['## Summary\n',
                                                                  '\n',
                                                                  'You executed the optimizer and checked '
                                                                  'its search trace and constraint slacks. '
                                                                  'Reproducibility of the search path does '
                                                                  'not turn a scenario result into a plant '
                                                                  'optimum.']},
                                                      {'cell_type': 'markdown',
                                                       'metadata': {},
                                                       'source': ['## References\n',
                                                                  '\n',
                                                                  '- '
                                                                  'https://doi.org/10.1137/S1052623493250780\n',
                                                                  '- https://doi.org/10.1137/070692662']}],
                                            'metadata': {'kernelspec': {'display_name': 'Python 3',
                                                                        'language': 'python',
                                                                        'name': 'python3'},
                                                         'language_info': {'name': 'python'},
                                                         'caos': {'beyond': [],
                                                                  'data': ['data/derived/benchmark.json',
                                                                           'data/derived/contract/operating_contract.json'],
                                                                  'language': 'en',
                                                                  'level': 2,
                                                                  'packages': ['numpy==2.2.6',
                                                                               'scipy==1.17.1',
                                                                               'pandas==2.2.3',
                                                                               'matplotlib==3.11.2',
                                                                               'nbclient==0.11.0',
                                                                               'nbformat==5.11.1',
                                                                               'ipykernel==7.4.0',
                                                                               'SALib==1.6.0'],
                                                                  'sources': ['https://doi.org/10.1137/S1052623493250780',
                                                                              'https://doi.org/10.1137/070692662'],
                                                                  'title': 'Run and inspect the pattern '
                                                                           'search',
                                                                  'topic': '04-optimization'}},
                                            'nbformat': 4,
                                            'nbformat_minor': 5},
 'en/04-optimization/03-research-comparison.ipynb': {'cells': [{'cell_type': 'markdown',
                                                                'metadata': {},
                                                                'source': ['# Evaluate surrogate-screened '
                                                                           'search\n']},
                                                               {'cell_type': 'markdown',
                                                                'metadata': {},
                                                                'source': ['## Objectives\n',
                                                                           '\n',
                                                                           'Compare the screened and '
                                                                           'unscreened search evidence in '
                                                                           'the same committed benchmark '
                                                                           'row, then interpret how the '
                                                                           'objective weight changes '
                                                                           'recovery-energy trade-offs.']},
                                                               {'cell_type': 'markdown',
                                                                'metadata': {},
                                                                'source': ['## Setup\n',
                                                                           '\n',
                                                                           '```bash\n',
                                                                           'pip install numpy==2.2.6 '
                                                                           'scipy==1.17.1 pandas==2.2.3 '
                                                                           'matplotlib==3.11.2 '
                                                                           'nbclient==0.11.0 '
                                                                           'nbformat==5.11.1 '
                                                                           'ipykernel==7.4.0 SALib==1.6.0\n',
                                                                           '```\n',
                                                                           '\n',
                                                                           'The OreFlow pipeline is imported '
                                                                           'from `data-pipeline/`; this '
                                                                           'notebook never installs '
                                                                           'packages.']},
                                                               {'cell_type': 'code',
                                                                'execution_count': None,
                                                                'metadata': {},
                                                                'outputs': [],
                                                                'source': ['# Import analysis tools and '
                                                                           'record their exact versions.\n',
                                                                           'import importlib.metadata\n',
                                                                           'import json\n',
                                                                           'from pathlib import Path\n',
                                                                           'import sys\n',
                                                                           'import numpy as np\n',
                                                                           'import pandas as pd\n',
                                                                           'import matplotlib.pyplot as '
                                                                           'plt\n',
                                                                           '\n',
                                                                           '# Resolve the local pipeline '
                                                                           'from the repository-relative '
                                                                           'layout.\n',
                                                                           'repo = '
                                                                           'Path("../../../").resolve()\n',
                                                                           'sys.path.insert(0, str(repo / '
                                                                           '"data-pipeline"))\n',
                                                                           'for package in ("numpy", '
                                                                           '"scipy", "pandas", "matplotlib", '
                                                                           '"nbclient", "nbformat", '
                                                                           '"ipykernel"):\n',
                                                                           '    print(package, '
                                                                           'importlib.metadata.version(package))\n']},
                                                               {'cell_type': 'markdown',
                                                                'metadata': {},
                                                                'source': ['## Data\n',
                                                                           '\n',
                                                                           'Owner: OreFlow authors; '
                                                                           '`data/derived/benchmark.json` '
                                                                           'stores the evaluated optimizer '
                                                                           'variants for twelve authored '
                                                                           'cases, MIT project licence. '
                                                                           'Repository: '
                                                                           'https://github.com/fsantibanezleal/CAOS_OreFlow.']},
                                                               {'cell_type': 'markdown',
                                                                'metadata': {},
                                                                'source': ['## Method\n',
                                                                           '\n',
                                                                           'A surrogate-management framework '
                                                                           'may order proposed evaluations, '
                                                                           'but OreFlow still evaluates '
                                                                           'candidates with its process '
                                                                           'engine. The autoencoder guard '
                                                                           'and Gaussian-process interval '
                                                                           'limit screen proposals; the '
                                                                           'search poll remains '
                                                                           'authoritative. The weight path '
                                                                           'reports the conditional '
                                                                           'trade-off between recovered '
                                                                           'metal and specific energy. This '
                                                                           'notebook compares measured '
                                                                           'evaluation counts and baked path '
                                                                           'records; it claims no new '
                                                                           'optimization algorithm.']},
                                                               {'cell_type': 'markdown',
                                                                'metadata': {},
                                                                'source': ['## Comparison\n',
                                                                           '\n',
                                                                           'Generalized pattern search and '
                                                                           'progressive barriers are '
                                                                           'established derivative-free '
                                                                           'methods (Torczon, 1997; Audet '
                                                                           'and Dennis, 2009). Surrogate '
                                                                           'management can guide expensive '
                                                                           'design evaluations (Booker et '
                                                                           "al., 1999). OreFlow's evidence "
                                                                           'is case-specific: screened and '
                                                                           'unscreened runs reach the same '
                                                                           'recorded optimum on this row, '
                                                                           'while the recorded evaluation '
                                                                           'counts reveal whether screening '
                                                                           'saved work. This is not a proof '
                                                                           'for every case or an economic '
                                                                           'optimum.']},
                                                               {'cell_type': 'markdown',
                                                                'metadata': {},
                                                                'source': ['## Results\n']},
                                                               {'cell_type': 'markdown',
                                                                'metadata': {},
                                                                'source': ['## Summary\n',
                                                                           '\n',
                                                                           'You compared surrogate-assisted '
                                                                           'evaluation ordering with an '
                                                                           'engine-only search and inspected '
                                                                           'a baked objective path. The '
                                                                           'claim is narrow: methods are '
                                                                           "compared on OreFlow's authored "
                                                                           'cases, with no plant-validation '
                                                                           'claim.']},
                                                               {'cell_type': 'markdown',
                                                                'metadata': {},
                                                                'source': ['## References\n',
                                                                           '\n',
                                                                           '- '
                                                                           'https://doi.org/10.1137/S1052623493250780\n',
                                                                           '- '
                                                                           'https://doi.org/10.1137/070692662\n',
                                                                           '- '
                                                                           'https://doi.org/10.1007/BF01197708\n',
                                                                           '- '
                                                                           'https://doi.org/10.1017/CBO9780511790423']}],
                                                     'metadata': {'kernelspec': {'display_name': 'Python 3',
                                                                                 'language': 'python',
                                                                                 'name': 'python3'},
                                                                  'language_info': {'name': 'python'},
                                                                  'caos': {'beyond': [],
                                                                           'data': ['data/derived/benchmark.json',
                                                                                    'data/derived/contract/operating_contract.json'],
                                                                           'language': 'en',
                                                                           'level': 3,
                                                                           'methods': ['M-5'],
                                                                           'packages': ['numpy==2.2.6',
                                                                                        'scipy==1.17.1',
                                                                                        'pandas==2.2.3',
                                                                                        'matplotlib==3.11.2',
                                                                                        'nbclient==0.11.0',
                                                                                        'nbformat==5.11.1',
                                                                                        'ipykernel==7.4.0',
                                                                                        'SALib==1.6.0'],
                                                                           'sources': ['https://doi.org/10.1137/S1052623493250780',
                                                                                       'https://doi.org/10.1137/070692662',
                                                                                       'https://doi.org/10.1007/BF01197708',
                                                                                       'https://doi.org/10.1017/CBO9780511790423'],
                                                                           'title': 'Evaluate '
                                                                                    'surrogate-screened '
                                                                                    'search',
                                                                           'topic': '04-optimization'}},
                                                     'nbformat': 4,
                                                     'nbformat_minor': 5},
 'en/05-uncertainty/01-the-record.ipynb': {'cells': [{'cell_type': 'markdown',
                                                      'metadata': {},
                                                      'source': ['# Distinguish process variation from '
                                                                 'uncertainty\n']},
                                                     {'cell_type': 'markdown',
                                                      'metadata': {},
                                                      'source': ['## Objectives\n',
                                                                 '\n',
                                                                 'Read the committed uncertainty record, '
                                                                 'identify its uncertain ore inputs and '
                                                                 'output quantiles, and explain why an '
                                                                 'interval around one simulated state is not '
                                                                 'a plant confidence interval.']},
                                                     {'cell_type': 'markdown',
                                                      'metadata': {},
                                                      'source': ['## Setup\n',
                                                                 '\n',
                                                                 '```bash\n',
                                                                 'pip install numpy==2.2.6 scipy==1.17.1 '
                                                                 'pandas==2.2.3 matplotlib==3.11.2 '
                                                                 'nbclient==0.11.0 nbformat==5.11.1 '
                                                                 'ipykernel==7.4.0 SALib==1.6.0\n',
                                                                 '```\n',
                                                                 '\n',
                                                                 'The OreFlow pipeline is imported from '
                                                                 '`data-pipeline/`; this notebook never '
                                                                 'installs packages.']},
                                                     {'cell_type': 'code',
                                                      'execution_count': None,
                                                      'metadata': {},
                                                      'outputs': [],
                                                      'source': ['# Import analysis tools and record their '
                                                                 'exact versions.\n',
                                                                 'import importlib.metadata\n',
                                                                 'import json\n',
                                                                 'from pathlib import Path\n',
                                                                 'import sys\n',
                                                                 'import numpy as np\n',
                                                                 'import pandas as pd\n',
                                                                 'import matplotlib.pyplot as plt\n',
                                                                 '\n',
                                                                 '# Resolve the local pipeline from the '
                                                                 'repository-relative layout.\n',
                                                                 'repo = Path("../../../").resolve()\n',
                                                                 'sys.path.insert(0, str(repo / '
                                                                 '"data-pipeline"))\n',
                                                                 'for package in ("numpy", "scipy", '
                                                                 '"pandas", "matplotlib", "nbclient", '
                                                                 '"nbformat", "ipykernel"):\n',
                                                                 '    print(package, '
                                                                 'importlib.metadata.version(package))\n']},
                                                     {'cell_type': 'markdown',
                                                      'metadata': {},
                                                      'source': ['## Data\n',
                                                                 '\n',
                                                                 'Owner: OreFlow authors; '
                                                                 '`data/derived/benchmark.json` and '
                                                                 '`data/derived/studies.json`, MIT project '
                                                                 'licence. The ranges are authored '
                                                                 'uncertainty assumptions applied to '
                                                                 'authored process cases; labels are '
                                                                 'simulated. Repository: '
                                                                 'https://github.com/fsantibanezleal/CAOS_OreFlow.']},
                                                     {'cell_type': 'markdown',
                                                      'metadata': {},
                                                      'source': ['## Method\n',
                                                                 '\n',
                                                                 'OreFlow varies work index, head grade, '
                                                                 'liberation size and floatability within '
                                                                 'declared multiplicative ranges, then '
                                                                 're-solves the same steady-state circuit. A '
                                                                 'seeded Latin hypercube produces '
                                                                 'reproducible samples. Quantiles describe '
                                                                 'this model and these ranges; they are not '
                                                                 'estimates of field measurement error or '
                                                                 'plant-to-plant variability.']},
                                                     {'cell_type': 'markdown',
                                                      'metadata': {},
                                                      'source': ['## Results\n']},
                                                     {'cell_type': 'markdown',
                                                      'metadata': {},
                                                      'source': ['## Summary\n',
                                                                 '\n',
                                                                 'You separated a seeded model uncertainty '
                                                                 'study from measurement uncertainty. State '
                                                                 'the sampling design, input ranges and data '
                                                                 'provenance whenever quoting these '
                                                                 'results.']},
                                                     {'cell_type': 'markdown',
                                                      'metadata': {},
                                                      'source': ['## References\n',
                                                                 '\n',
                                                                 '- '
                                                                 'https://doi.org/10.1080/00401706.1979.10489755']}],
                                           'metadata': {'kernelspec': {'display_name': 'Python 3',
                                                                       'language': 'python',
                                                                       'name': 'python3'},
                                                        'language_info': {'name': 'python'},
                                                        'caos': {'beyond': [],
                                                                 'data': ['data/derived/benchmark.json',
                                                                          'data/derived/studies.json',
                                                                          'data/derived/contract/operating_contract.json'],
                                                                 'language': 'en',
                                                                 'level': 1,
                                                                 'packages': ['numpy==2.2.6',
                                                                              'scipy==1.17.1',
                                                                              'pandas==2.2.3',
                                                                              'matplotlib==3.11.2',
                                                                              'nbclient==0.11.0',
                                                                              'nbformat==5.11.1',
                                                                              'ipykernel==7.4.0',
                                                                              'SALib==1.6.0'],
                                                                 'sources': ['https://doi.org/10.1080/00401706.1979.10489755'],
                                                                 'title': 'Distinguish process variation '
                                                                          'from uncertainty',
                                                                 'topic': '05-uncertainty'}},
                                           'nbformat': 4,
                                           'nbformat_minor': 5},
 'en/05-uncertainty/02-the-method.ipynb': {'cells': [{'cell_type': 'markdown',
                                                      'metadata': {},
                                                      'source': ['# Propagate a seeded uncertainty '
                                                                 'design\n']},
                                                     {'cell_type': 'markdown',
                                                      'metadata': {},
                                                      'source': ['## Objectives\n',
                                                                 '\n',
                                                                 "Run OreFlow's uncertainty function on a "
                                                                 'teaching-sized seeded design, inspect the '
                                                                 'simulated recovery distribution and '
                                                                 'compare the nominal point with its sampled '
                                                                 'range.']},
                                                     {'cell_type': 'markdown',
                                                      'metadata': {},
                                                      'source': ['## Setup\n',
                                                                 '\n',
                                                                 '```bash\n',
                                                                 'pip install numpy==2.2.6 scipy==1.17.1 '
                                                                 'pandas==2.2.3 matplotlib==3.11.2 '
                                                                 'nbclient==0.11.0 nbformat==5.11.1 '
                                                                 'ipykernel==7.4.0 SALib==1.6.0\n',
                                                                 '```\n',
                                                                 '\n',
                                                                 'The OreFlow pipeline is imported from '
                                                                 '`data-pipeline/`; this notebook never '
                                                                 'installs packages.']},
                                                     {'cell_type': 'code',
                                                      'execution_count': None,
                                                      'metadata': {},
                                                      'outputs': [],
                                                      'source': ['# Import analysis tools and record their '
                                                                 'exact versions.\n',
                                                                 'import importlib.metadata\n',
                                                                 'import json\n',
                                                                 'from pathlib import Path\n',
                                                                 'import sys\n',
                                                                 'import numpy as np\n',
                                                                 'import pandas as pd\n',
                                                                 'import matplotlib.pyplot as plt\n',
                                                                 '\n',
                                                                 '# Resolve the local pipeline from the '
                                                                 'repository-relative layout.\n',
                                                                 'repo = Path("../../../").resolve()\n',
                                                                 'sys.path.insert(0, str(repo / '
                                                                 '"data-pipeline"))\n',
                                                                 'for package in ("numpy", "scipy", '
                                                                 '"pandas", "matplotlib", "nbclient", '
                                                                 '"nbformat", "ipykernel"):\n',
                                                                 '    print(package, '
                                                                 'importlib.metadata.version(package))\n']},
                                                     {'cell_type': 'markdown',
                                                      'metadata': {},
                                                      'source': ['## Data\n',
                                                                 '\n',
                                                                 'Owner: OreFlow authors; the scenario, '
                                                                 'contract bounds and uncertainty '
                                                                 'assumptions are in '
                                                                 '`data/derived/cases/copper_porphyry_soft.json`, '
                                                                 '`data/derived/contract/operating_contract.json` '
                                                                 'and `data/derived/benchmark.json`, MIT '
                                                                 'project licence. Repository: '
                                                                 'https://github.com/fsantibanezleal/CAOS_OreFlow.']},
                                                     {'cell_type': 'markdown',
                                                      'metadata': {},
                                                      'source': ['## Method\n',
                                                                 '\n',
                                                                 'The production method maps a deterministic '
                                                                 "Latin-hypercube design through OreFlow's "
                                                                 '`perturbed` and `_evaluate` functions, '
                                                                 'which call the process solver. Rejected '
                                                                 'steady states are counted rather than '
                                                                 'silently turned into measurements. This '
                                                                 'lesson uses 32 runs for an inspectable '
                                                                 'teaching exercise; the committed record '
                                                                 'uses the production sample count.']},
                                                     {'cell_type': 'markdown',
                                                      'metadata': {},
                                                      'source': ['## Results\n']},
                                                     {'cell_type': 'markdown',
                                                      'metadata': {},
                                                      'source': ['## Summary\n',
                                                                 '\n',
                                                                 'You executed a deterministic uncertainty '
                                                                 'propagation through the production engine '
                                                                 'and checked its sensitivity to the chosen '
                                                                 'finite design. A reproducible simulation '
                                                                 'remains conditional on its assumptions.']},
                                                     {'cell_type': 'markdown',
                                                      'metadata': {},
                                                      'source': ['## References\n',
                                                                 '\n',
                                                                 '- '
                                                                 'https://doi.org/10.1080/00401706.1979.10489755']}],
                                           'metadata': {'kernelspec': {'display_name': 'Python 3',
                                                                       'language': 'python',
                                                                       'name': 'python3'},
                                                        'language_info': {'name': 'python'},
                                                        'caos': {'beyond': [],
                                                                 'data': ['data/derived/benchmark.json',
                                                                          'data/derived/studies.json',
                                                                          'data/derived/contract/operating_contract.json'],
                                                                 'language': 'en',
                                                                 'level': 2,
                                                                 'packages': ['numpy==2.2.6',
                                                                              'scipy==1.17.1',
                                                                              'pandas==2.2.3',
                                                                              'matplotlib==3.11.2',
                                                                              'nbclient==0.11.0',
                                                                              'nbformat==5.11.1',
                                                                              'ipykernel==7.4.0',
                                                                              'SALib==1.6.0'],
                                                                 'sources': ['https://doi.org/10.1080/00401706.1979.10489755'],
                                                                 'title': 'Propagate a seeded uncertainty '
                                                                          'design',
                                                                 'topic': '05-uncertainty'}},
                                           'nbformat': 4,
                                           'nbformat_minor': 5},
 'en/05-uncertainty/03-research-comparison.ipynb': {'cells': [{'cell_type': 'markdown',
                                                               'metadata': {},
                                                               'source': ['# Estimate variance-based input '
                                                                          'sensitivity\n']},
                                                              {'cell_type': 'markdown',
                                                               'metadata': {},
                                                               'source': ['## Objectives\n',
                                                                          '\n',
                                                                          'Run the production Saltelli-Sobol '
                                                                          'sensitivity method on a bounded '
                                                                          'teaching design, rank first-order '
                                                                          'and total effects, and explain '
                                                                          'why small-design indices are '
                                                                          'exploratory estimates.']},
                                                              {'cell_type': 'markdown',
                                                               'metadata': {},
                                                               'source': ['## Setup\n',
                                                                          '\n',
                                                                          '```bash\n',
                                                                          'pip install numpy==2.2.6 '
                                                                          'scipy==1.17.1 pandas==2.2.3 '
                                                                          'matplotlib==3.11.2 '
                                                                          'nbclient==0.11.0 nbformat==5.11.1 '
                                                                          'ipykernel==7.4.0 SALib==1.6.0\n',
                                                                          '```\n',
                                                                          '\n',
                                                                          'The OreFlow pipeline is imported '
                                                                          'from `data-pipeline/`; this '
                                                                          'notebook never installs '
                                                                          'packages.']},
                                                              {'cell_type': 'code',
                                                               'execution_count': None,
                                                               'metadata': {},
                                                               'outputs': [],
                                                               'source': ['# Import analysis tools and '
                                                                          'record their exact versions.\n',
                                                                          'import importlib.metadata\n',
                                                                          'import json\n',
                                                                          'from pathlib import Path\n',
                                                                          'import sys\n',
                                                                          'import numpy as np\n',
                                                                          'import pandas as pd\n',
                                                                          'import matplotlib.pyplot as plt\n',
                                                                          '\n',
                                                                          '# Resolve the local pipeline from '
                                                                          'the repository-relative layout.\n',
                                                                          'repo = '
                                                                          'Path("../../../").resolve()\n',
                                                                          'sys.path.insert(0, str(repo / '
                                                                          '"data-pipeline"))\n',
                                                                          'for package in ("numpy", "scipy", '
                                                                          '"pandas", "matplotlib", '
                                                                          '"nbclient", "nbformat", '
                                                                          '"ipykernel"):\n',
                                                                          '    print(package, '
                                                                          'importlib.metadata.version(package))\n']},
                                                              {'cell_type': 'markdown',
                                                               'metadata': {},
                                                               'source': ['## Data\n',
                                                                          '\n',
                                                                          'Owner: OreFlow authors; input '
                                                                          'ranges and output definitions are '
                                                                          'persisted in '
                                                                          '`data/derived/benchmark.json` and '
                                                                          '`data/derived/contract/operating_contract.json`, '
                                                                          'MIT project licence. Repository: '
                                                                          'https://github.com/fsantibanezleal/CAOS_OreFlow.']},
                                                              {'cell_type': 'markdown',
                                                               'metadata': {},
                                                               'source': ['## Method\n',
                                                                          '\n',
                                                                          'For independent uncertain inputs, '
                                                                          'first-order Sobol indices measure '
                                                                          'variance explained by one input '
                                                                          'and total indices include '
                                                                          'interactions. SALib builds the '
                                                                          'scrambled Sobol design and '
                                                                          'estimates indices; OreFlow runs '
                                                                          'every design row through the same '
                                                                          'solver. The teaching design uses '
                                                                          'a small base size to keep '
                                                                          'execution short. It is not a '
                                                                          'substitute for the '
                                                                          'production-sized sensitivity '
                                                                          'record or an empirical plant '
                                                                          'analysis.']},
                                                              {'cell_type': 'markdown',
                                                               'metadata': {},
                                                               'source': ['## Comparison\n',
                                                                          '\n',
                                                                          'Saltelli et al. (2010) give '
                                                                          'variance-based estimators for '
                                                                          'first-order and total-order '
                                                                          'effects; SALib (Herman and Usher, '
                                                                          '2017) supplies the design and '
                                                                          'analysis implementation. OreFlow '
                                                                          'documents that its bootstrap '
                                                                          'resamples low-discrepancy design '
                                                                          'rows as independent and can '
                                                                          'overstate uncertainty bounds. The '
                                                                          'small teaching run is a '
                                                                          'reproducible method '
                                                                          'demonstration, not a novel '
                                                                          'estimator or validated field '
                                                                          'sensitivity.']},
                                                              {'cell_type': 'markdown',
                                                               'metadata': {},
                                                               'source': ['## Results\n']},
                                                              {'cell_type': 'markdown',
                                                               'metadata': {},
                                                               'source': ['## Summary\n',
                                                                          '\n',
                                                                          'You ran a published '
                                                                          'variance-based sensitivity method '
                                                                          "through OreFlow's implementation. "
                                                                          'Treat the small design as a '
                                                                          'teaching experiment, and consult '
                                                                          'the larger committed analysis and '
                                                                          'its documented bootstrap '
                                                                          'limitations before quoting '
                                                                          'results.']},
                                                              {'cell_type': 'markdown',
                                                               'metadata': {},
                                                               'source': ['## References\n',
                                                                          '\n',
                                                                          '- '
                                                                          'https://doi.org/10.1016/j.cpc.2009.09.018\n',
                                                                          '- '
                                                                          'https://doi.org/10.21105/joss.00097']}],
                                                    'metadata': {'kernelspec': {'display_name': 'Python 3',
                                                                                'language': 'python',
                                                                                'name': 'python3'},
                                                                 'language_info': {'name': 'python'},
                                                                 'caos': {'beyond': [],
                                                                          'data': ['data/derived/benchmark.json',
                                                                                   'data/derived/studies.json',
                                                                                   'data/derived/contract/operating_contract.json'],
                                                                          'language': 'en',
                                                                          'level': 3,
                                                                          'methods': ['M-6'],
                                                                          'packages': ['numpy==2.2.6',
                                                                                       'scipy==1.17.1',
                                                                                       'pandas==2.2.3',
                                                                                       'matplotlib==3.11.2',
                                                                                       'nbclient==0.11.0',
                                                                                       'nbformat==5.11.1',
                                                                                       'ipykernel==7.4.0',
                                                                                       'SALib==1.6.0'],
                                                                          'sources': ['https://doi.org/10.1016/j.cpc.2009.09.018',
                                                                                      'https://doi.org/10.21105/joss.00097'],
                                                                          'title': 'Estimate variance-based '
                                                                                   'input sensitivity',
                                                                          'topic': '05-uncertainty'}},
                                                    'nbformat': 4,
                                                    'nbformat_minor': 5},
 'es/04-optimization/01-the-record.ipynb': {'cells': [{'cell_type': 'markdown',
                                                       'metadata': {},
                                                       'source': ['# Interpreta un registro de optimización '
                                                                  'operacional\n']},
                                                      {'cell_type': 'markdown',
                                                       'metadata': {},
                                                       'source': ['## Objetivos\n',
                                                                  '\n',
                                                                  'Distingue las decisiones, el objetivo, '
                                                                  'las restricciones de factibilidad y el '
                                                                  'esfuerzo de búsqueda medido en el '
                                                                  'resultado comprometido. Explica por qué '
                                                                  'el óptimo depende del caso de autoría '
                                                                  'propia y su contrato.']},
                                                      {'cell_type': 'markdown',
                                                       'metadata': {},
                                                       'source': ['## Preparación\n',
                                                                  '\n',
                                                                  '```bash\n',
                                                                  'pip install numpy==2.2.6 scipy==1.17.1 '
                                                                  'pandas==2.2.3 matplotlib==3.11.2 '
                                                                  'nbclient==0.11.0 nbformat==5.11.1 '
                                                                  'ipykernel==7.4.0 SALib==1.6.0\n',
                                                                  '```\n',
                                                                  '\n',
                                                                  'El pipeline OreFlow se importa desde '
                                                                  '`data-pipeline/`; este notebook nunca '
                                                                  'instala paquetes.']},
                                                      {'cell_type': 'code',
                                                       'execution_count': None,
                                                       'metadata': {},
                                                       'outputs': [],
                                                       'source': ['# Importa herramientas de análisis y '
                                                                  'registra sus versiones exactas.\n',
                                                                  'import importlib.metadata\n',
                                                                  'import json\n',
                                                                  'from pathlib import Path\n',
                                                                  'import sys\n',
                                                                  'import numpy as np\n',
                                                                  'import pandas as pd\n',
                                                                  'import matplotlib.pyplot as plt\n',
                                                                  '\n',
                                                                  '# Resuelve el pipeline local desde la '
                                                                  'estructura relativa del repositorio.\n',
                                                                  'repo = Path("../../../").resolve()\n',
                                                                  'sys.path.insert(0, str(repo / '
                                                                  '"data-pipeline"))\n',
                                                                  'for package in ("numpy", "scipy", '
                                                                  '"pandas", "matplotlib", "nbclient", '
                                                                  '"nbformat", "ipykernel"):\n',
                                                                  '    print(package, '
                                                                  'importlib.metadata.version(package))\n']},
                                                      {'cell_type': 'markdown',
                                                       'metadata': {},
                                                       'source': ['## Datos\n',
                                                                  '\n',
                                                                  'Responsable: autores de OreFlow; '
                                                                  '`data/derived/benchmark.json` y '
                                                                  '`data/derived/contract/operating_contract.json`, '
                                                                  'licencia MIT del proyecto. El óptimo se '
                                                                  'calcula para un escenario propio, no para '
                                                                  'una planta. Repositorio: '
                                                                  'https://github.com/fsantibanezleal/CAOS_OreFlow.']},
                                                      {'cell_type': 'markdown',
                                                       'metadata': {},
                                                       'source': ['## Método\n',
                                                                  '\n',
                                                                  'OreFlow maximiza el metal primario '
                                                                  'recuperado respecto del punto base, '
                                                                  'respetando límites de ley del '
                                                                  'concentrado, potencia instalada y agua. '
                                                                  'Una búsqueda generalizada por patrones '
                                                                  'opera en el cubo unitario de los límites '
                                                                  'declarados. Un candidato rechazado por '
                                                                  'contrato o motor nunca se considera '
                                                                  'factible. El registro muestra decisiones, '
                                                                  'restricciones activas, evaluaciones y '
                                                                  'trayectoria de ponderaciones.']},
                                                      {'cell_type': 'markdown',
                                                       'metadata': {},
                                                       'source': ['## Resultados\n']},
                                                      {'cell_type': 'markdown',
                                                       'metadata': {},
                                                       'source': ['## Resumen\n',
                                                                  '\n',
                                                                  'Interpretaste el optimizador como un '
                                                                  'cálculo de ingeniería restringido: '
                                                                  'depende del objetivo, límites, '
                                                                  'restricciones y caso de partida. Un '
                                                                  'resultado factible no es una '
                                                                  'recomendación operacional.']},
                                                      {'cell_type': 'markdown',
                                                       'metadata': {},
                                                       'source': ['## Referencias\n',
                                                                  '\n',
                                                                  '- '
                                                                  'https://doi.org/10.1137/S1052623493250780\n',
                                                                  '- https://doi.org/10.1137/070692662']}],
                                            'metadata': {'kernelspec': {'display_name': 'Python 3',
                                                                        'language': 'python',
                                                                        'name': 'python3'},
                                                         'language_info': {'name': 'python'},
                                                         'caos': {'beyond': [],
                                                                  'data': ['data/derived/benchmark.json',
                                                                           'data/derived/contract/operating_contract.json'],
                                                                  'language': 'es',
                                                                  'level': 1,
                                                                  'packages': ['numpy==2.2.6',
                                                                               'scipy==1.17.1',
                                                                               'pandas==2.2.3',
                                                                               'matplotlib==3.11.2',
                                                                               'nbclient==0.11.0',
                                                                               'nbformat==5.11.1',
                                                                               'ipykernel==7.4.0',
                                                                               'SALib==1.6.0'],
                                                                  'sources': ['https://doi.org/10.1137/S1052623493250780',
                                                                              'https://doi.org/10.1137/070692662'],
                                                                  'title': 'Interpreta un registro de '
                                                                           'optimización operacional',
                                                                  'topic': '04-optimization'}},
                                            'nbformat': 4,
                                            'nbformat_minor': 5},
 'es/04-optimization/02-the-method.ipynb': {'cells': [{'cell_type': 'markdown',
                                                       'metadata': {},
                                                       'source': ['# Ejecuta e inspecciona la búsqueda por '
                                                                  'patrones\n']},
                                                      {'cell_type': 'markdown',
                                                       'metadata': {},
                                                       'source': ['## Objetivos\n',
                                                                  '\n',
                                                                  'Ejecuta el optimizador de producción '
                                                                  'OreFlow para el pórfido blando, '
                                                                  'inspecciona su traza real de evaluaciones '
                                                                  'y comprueba si el punto final satisface '
                                                                  'cada restricción física declarada.']},
                                                      {'cell_type': 'markdown',
                                                       'metadata': {},
                                                       'source': ['## Preparación\n',
                                                                  '\n',
                                                                  '```bash\n',
                                                                  'pip install numpy==2.2.6 scipy==1.17.1 '
                                                                  'pandas==2.2.3 matplotlib==3.11.2 '
                                                                  'nbclient==0.11.0 nbformat==5.11.1 '
                                                                  'ipykernel==7.4.0 SALib==1.6.0\n',
                                                                  '```\n',
                                                                  '\n',
                                                                  'El pipeline OreFlow se importa desde '
                                                                  '`data-pipeline/`; este notebook nunca '
                                                                  'instala paquetes.']},
                                                      {'cell_type': 'code',
                                                       'execution_count': None,
                                                       'metadata': {},
                                                       'outputs': [],
                                                       'source': ['# Importa herramientas de análisis y '
                                                                  'registra sus versiones exactas.\n',
                                                                  'import importlib.metadata\n',
                                                                  'import json\n',
                                                                  'from pathlib import Path\n',
                                                                  'import sys\n',
                                                                  'import numpy as np\n',
                                                                  'import pandas as pd\n',
                                                                  'import matplotlib.pyplot as plt\n',
                                                                  '\n',
                                                                  '# Resuelve el pipeline local desde la '
                                                                  'estructura relativa del repositorio.\n',
                                                                  'repo = Path("../../../").resolve()\n',
                                                                  'sys.path.insert(0, str(repo / '
                                                                  '"data-pipeline"))\n',
                                                                  'for package in ("numpy", "scipy", '
                                                                  '"pandas", "matplotlib", "nbclient", '
                                                                  '"nbformat", "ipykernel"):\n',
                                                                  '    print(package, '
                                                                  'importlib.metadata.version(package))\n']},
                                                      {'cell_type': 'markdown',
                                                       'metadata': {},
                                                       'source': ['## Datos\n',
                                                                  '\n',
                                                                  'Responsable: autores de OreFlow; el caso '
                                                                  'de pórfido blando y el Contrato 1 están '
                                                                  'versionados en '
                                                                  '`data/derived/cases/copper_porphyry_soft.json` '
                                                                  'y '
                                                                  '`data/derived/contract/operating_contract.json`, '
                                                                  'licencia MIT del proyecto. Repositorio: '
                                                                  'https://github.com/fsantibanezleal/CAOS_OreFlow.']},
                                                      {'cell_type': 'markdown',
                                                       'metadata': {},
                                                       'source': ['## Método\n',
                                                                  '\n',
                                                                  'La búsqueda generalizada por patrones '
                                                                  'prueba vecinos de malla en coordenadas de '
                                                                  'decisión acotadas y aplica una barrera '
                                                                  'progresiva a violaciones de ley, potencia '
                                                                  'y agua. Este notebook llama `optimize` '
                                                                  'desde `pipeline/methods/optimization.py`; '
                                                                  'no reproduce el optimizador. La corrida '
                                                                  'desactiva el filtro surrogate opcional '
                                                                  'para aislar la búsqueda evaluada por el '
                                                                  'motor.']},
                                                      {'cell_type': 'markdown',
                                                       'metadata': {},
                                                       'source': ['## Resultados\n']},
                                                      {'cell_type': 'markdown',
                                                       'metadata': {},
                                                       'source': ['## Resumen\n',
                                                                  '\n',
                                                                  'Ejecutaste el optimizador y verificaste '
                                                                  'su traza y holguras. Que la búsqueda sea '
                                                                  'reproducible no convierte el resultado de '
                                                                  'escenario en un óptimo de planta.']},
                                                      {'cell_type': 'markdown',
                                                       'metadata': {},
                                                       'source': ['## Referencias\n',
                                                                  '\n',
                                                                  '- '
                                                                  'https://doi.org/10.1137/S1052623493250780\n',
                                                                  '- https://doi.org/10.1137/070692662']}],
                                            'metadata': {'kernelspec': {'display_name': 'Python 3',
                                                                        'language': 'python',
                                                                        'name': 'python3'},
                                                         'language_info': {'name': 'python'},
                                                         'caos': {'beyond': [],
                                                                  'data': ['data/derived/benchmark.json',
                                                                           'data/derived/contract/operating_contract.json'],
                                                                  'language': 'es',
                                                                  'level': 2,
                                                                  'packages': ['numpy==2.2.6',
                                                                               'scipy==1.17.1',
                                                                               'pandas==2.2.3',
                                                                               'matplotlib==3.11.2',
                                                                               'nbclient==0.11.0',
                                                                               'nbformat==5.11.1',
                                                                               'ipykernel==7.4.0',
                                                                               'SALib==1.6.0'],
                                                                  'sources': ['https://doi.org/10.1137/S1052623493250780',
                                                                              'https://doi.org/10.1137/070692662'],
                                                                  'title': 'Ejecuta e inspecciona la '
                                                                           'búsqueda por patrones',
                                                                  'topic': '04-optimization'}},
                                            'nbformat': 4,
                                            'nbformat_minor': 5},
 'es/04-optimization/03-research-comparison.ipynb': {'cells': [{'cell_type': 'markdown',
                                                                'metadata': {},
                                                                'source': ['# Evalúa una búsqueda asistida '
                                                                           'por surrogate\n']},
                                                               {'cell_type': 'markdown',
                                                                'metadata': {},
                                                                'source': ['## Objetivos\n',
                                                                           '\n',
                                                                           'Compara la búsqueda con y sin '
                                                                           'filtro surrogate en el mismo '
                                                                           'registro del benchmark e '
                                                                           'interpreta cómo el peso del '
                                                                           'objetivo cambia el intercambio '
                                                                           'entre recuperación y energía.']},
                                                               {'cell_type': 'markdown',
                                                                'metadata': {},
                                                                'source': ['## Preparación\n',
                                                                           '\n',
                                                                           '```bash\n',
                                                                           'pip install numpy==2.2.6 '
                                                                           'scipy==1.17.1 pandas==2.2.3 '
                                                                           'matplotlib==3.11.2 '
                                                                           'nbclient==0.11.0 '
                                                                           'nbformat==5.11.1 '
                                                                           'ipykernel==7.4.0 SALib==1.6.0\n',
                                                                           '```\n',
                                                                           '\n',
                                                                           'El pipeline OreFlow se importa '
                                                                           'desde `data-pipeline/`; este '
                                                                           'notebook nunca instala '
                                                                           'paquetes.']},
                                                               {'cell_type': 'code',
                                                                'execution_count': None,
                                                                'metadata': {},
                                                                'outputs': [],
                                                                'source': ['# Importa herramientas de '
                                                                           'análisis y registra sus '
                                                                           'versiones exactas.\n',
                                                                           'import importlib.metadata\n',
                                                                           'import json\n',
                                                                           'from pathlib import Path\n',
                                                                           'import sys\n',
                                                                           'import numpy as np\n',
                                                                           'import pandas as pd\n',
                                                                           'import matplotlib.pyplot as '
                                                                           'plt\n',
                                                                           '\n',
                                                                           '# Resuelve el pipeline local '
                                                                           'desde la estructura relativa del '
                                                                           'repositorio.\n',
                                                                           'repo = '
                                                                           'Path("../../../").resolve()\n',
                                                                           'sys.path.insert(0, str(repo / '
                                                                           '"data-pipeline"))\n',
                                                                           'for package in ("numpy", '
                                                                           '"scipy", "pandas", "matplotlib", '
                                                                           '"nbclient", "nbformat", '
                                                                           '"ipykernel"):\n',
                                                                           '    print(package, '
                                                                           'importlib.metadata.version(package))\n']},
                                                               {'cell_type': 'markdown',
                                                                'metadata': {},
                                                                'source': ['## Datos\n',
                                                                           '\n',
                                                                           'Responsable: autores de OreFlow; '
                                                                           '`data/derived/benchmark.json` '
                                                                           'guarda variantes evaluadas del '
                                                                           'optimizador para doce casos de '
                                                                           'autoría propia, licencia MIT del '
                                                                           'proyecto. Repositorio: '
                                                                           'https://github.com/fsantibanezleal/CAOS_OreFlow.']},
                                                               {'cell_type': 'markdown',
                                                                'metadata': {},
                                                                'source': ['## Método\n',
                                                                           '\n',
                                                                           'Un marco de gestión con '
                                                                           'surrogate puede ordenar '
                                                                           'evaluaciones propuestas, pero '
                                                                           'OreFlow evalúa candidatos con el '
                                                                           'motor de procesos. El guard '
                                                                           'autoencoder y el límite de '
                                                                           'intervalo GP filtran propuestas; '
                                                                           'el sondeo de búsqueda sigue '
                                                                           'siendo autoritativo. La '
                                                                           'trayectoria de pesos informa el '
                                                                           'intercambio condicional entre '
                                                                           'metal recuperado y energía '
                                                                           'específica. Se comparan conteos '
                                                                           'medidos y trayectorias del bake; '
                                                                           'no se afirma un algoritmo '
                                                                           'nuevo.']},
                                                               {'cell_type': 'markdown',
                                                                'metadata': {},
                                                                'source': ['## Comparación\n',
                                                                           '\n',
                                                                           'La búsqueda generalizada por '
                                                                           'patrones y las barreras '
                                                                           'progresivas son métodos '
                                                                           'establecidos (Torczon, 1997; '
                                                                           'Audet y Dennis, 2009). La '
                                                                           'gestión con surrogate puede '
                                                                           'guiar evaluaciones costosas '
                                                                           '(Booker et al., 1999). La '
                                                                           'evidencia OreFlow es específica '
                                                                           'al caso: búsqueda filtrada y sin '
                                                                           'filtrar alcanzan el mismo óptimo '
                                                                           'registrado en esta fila, y los '
                                                                           'conteos muestran si se ahorró '
                                                                           'trabajo. No es una prueba para '
                                                                           'todos los casos ni un óptimo '
                                                                           'económico.']},
                                                               {'cell_type': 'markdown',
                                                                'metadata': {},
                                                                'source': ['## Resultados\n']},
                                                               {'cell_type': 'markdown',
                                                                'metadata': {},
                                                                'source': ['## Resumen\n',
                                                                           '\n',
                                                                           'Comparaste el ordenamiento '
                                                                           'asistido por surrogate con la '
                                                                           'búsqueda evaluada por el motor e '
                                                                           'inspeccionaste una trayectoria '
                                                                           'de objetivo comprometida. El '
                                                                           'alcance es acotado a los '
                                                                           'escenarios de autoría propia, '
                                                                           'sin validación en planta.']},
                                                               {'cell_type': 'markdown',
                                                                'metadata': {},
                                                                'source': ['## Referencias\n',
                                                                           '\n',
                                                                           '- '
                                                                           'https://doi.org/10.1137/S1052623493250780\n',
                                                                           '- '
                                                                           'https://doi.org/10.1137/070692662\n',
                                                                           '- '
                                                                           'https://doi.org/10.1007/BF01197708\n',
                                                                           '- '
                                                                           'https://doi.org/10.1017/CBO9780511790423']}],
                                                     'metadata': {'kernelspec': {'display_name': 'Python 3',
                                                                                 'language': 'python',
                                                                                 'name': 'python3'},
                                                                  'language_info': {'name': 'python'},
                                                                  'caos': {'beyond': [],
                                                                           'data': ['data/derived/benchmark.json',
                                                                                    'data/derived/contract/operating_contract.json'],
                                                                           'language': 'es',
                                                                           'level': 3,
                                                                           'methods': ['M-5'],
                                                                           'packages': ['numpy==2.2.6',
                                                                                        'scipy==1.17.1',
                                                                                        'pandas==2.2.3',
                                                                                        'matplotlib==3.11.2',
                                                                                        'nbclient==0.11.0',
                                                                                        'nbformat==5.11.1',
                                                                                        'ipykernel==7.4.0',
                                                                                        'SALib==1.6.0'],
                                                                           'sources': ['https://doi.org/10.1137/S1052623493250780',
                                                                                       'https://doi.org/10.1137/070692662',
                                                                                       'https://doi.org/10.1007/BF01197708',
                                                                                       'https://doi.org/10.1017/CBO9780511790423'],
                                                                           'title': 'Evalúa una búsqueda '
                                                                                    'asistida por surrogate',
                                                                           'topic': '04-optimization'}},
                                                     'nbformat': 4,
                                                     'nbformat_minor': 5},
 'es/05-uncertainty/01-the-record.ipynb': {'cells': [{'cell_type': 'markdown',
                                                      'metadata': {},
                                                      'source': ['# Distingue variabilidad de proceso e '
                                                                 'incertidumbre\n']},
                                                     {'cell_type': 'markdown',
                                                      'metadata': {},
                                                      'source': ['## Objetivos\n',
                                                                 '\n',
                                                                 'Lee el registro de incertidumbre '
                                                                 'comprometido, identifica sus entradas '
                                                                 'inciertas y cuantiles de salida, y explica '
                                                                 'por qué un intervalo de un estado simulado '
                                                                 'no es un intervalo de confianza de '
                                                                 'planta.']},
                                                     {'cell_type': 'markdown',
                                                      'metadata': {},
                                                      'source': ['## Preparación\n',
                                                                 '\n',
                                                                 '```bash\n',
                                                                 'pip install numpy==2.2.6 scipy==1.17.1 '
                                                                 'pandas==2.2.3 matplotlib==3.11.2 '
                                                                 'nbclient==0.11.0 nbformat==5.11.1 '
                                                                 'ipykernel==7.4.0 SALib==1.6.0\n',
                                                                 '```\n',
                                                                 '\n',
                                                                 'El pipeline OreFlow se importa desde '
                                                                 '`data-pipeline/`; este notebook nunca '
                                                                 'instala paquetes.']},
                                                     {'cell_type': 'code',
                                                      'execution_count': None,
                                                      'metadata': {},
                                                      'outputs': [],
                                                      'source': ['# Importa herramientas de análisis y '
                                                                 'registra sus versiones exactas.\n',
                                                                 'import importlib.metadata\n',
                                                                 'import json\n',
                                                                 'from pathlib import Path\n',
                                                                 'import sys\n',
                                                                 'import numpy as np\n',
                                                                 'import pandas as pd\n',
                                                                 'import matplotlib.pyplot as plt\n',
                                                                 '\n',
                                                                 '# Resuelve el pipeline local desde la '
                                                                 'estructura relativa del repositorio.\n',
                                                                 'repo = Path("../../../").resolve()\n',
                                                                 'sys.path.insert(0, str(repo / '
                                                                 '"data-pipeline"))\n',
                                                                 'for package in ("numpy", "scipy", '
                                                                 '"pandas", "matplotlib", "nbclient", '
                                                                 '"nbformat", "ipykernel"):\n',
                                                                 '    print(package, '
                                                                 'importlib.metadata.version(package))\n']},
                                                     {'cell_type': 'markdown',
                                                      'metadata': {},
                                                      'source': ['## Datos\n',
                                                                 '\n',
                                                                 'Responsable: autores de OreFlow; '
                                                                 '`data/derived/benchmark.json` y '
                                                                 '`data/derived/studies.json`, licencia MIT '
                                                                 'del proyecto. Los rangos son supuestos de '
                                                                 'incertidumbre aplicados a casos de proceso '
                                                                 'propios; las etiquetas son simuladas. '
                                                                 'Repositorio: '
                                                                 'https://github.com/fsantibanezleal/CAOS_OreFlow.']},
                                                     {'cell_type': 'markdown',
                                                      'metadata': {},
                                                      'source': ['## Método\n',
                                                                 '\n',
                                                                 'OreFlow varía índice de trabajo, ley de '
                                                                 'cabeza, tamaño de liberación y '
                                                                 'flotabilidad dentro de rangos '
                                                                 'multiplicativos declarados, y resuelve '
                                                                 'nuevamente el mismo circuito estacionario. '
                                                                 'Un hipercubo latino con semilla genera '
                                                                 'muestras reproducibles. Los cuantiles '
                                                                 'describen este modelo y estos rangos; no '
                                                                 'estiman error de medición de terreno ni '
                                                                 'variabilidad entre plantas.']},
                                                     {'cell_type': 'markdown',
                                                      'metadata': {},
                                                      'source': ['## Resultados\n']},
                                                     {'cell_type': 'markdown',
                                                      'metadata': {},
                                                      'source': ['## Resumen\n',
                                                                 '\n',
                                                                 'Separaste un estudio de incertidumbre '
                                                                 'simulada con semilla de la incertidumbre '
                                                                 'de medición. Al citar resultados, declara '
                                                                 'diseño, rangos de entrada y procedencia de '
                                                                 'datos.']},
                                                     {'cell_type': 'markdown',
                                                      'metadata': {},
                                                      'source': ['## Referencias\n',
                                                                 '\n',
                                                                 '- '
                                                                 'https://doi.org/10.1080/00401706.1979.10489755']}],
                                           'metadata': {'kernelspec': {'display_name': 'Python 3',
                                                                       'language': 'python',
                                                                       'name': 'python3'},
                                                        'language_info': {'name': 'python'},
                                                        'caos': {'beyond': [],
                                                                 'data': ['data/derived/benchmark.json',
                                                                          'data/derived/studies.json',
                                                                          'data/derived/contract/operating_contract.json'],
                                                                 'language': 'es',
                                                                 'level': 1,
                                                                 'packages': ['numpy==2.2.6',
                                                                              'scipy==1.17.1',
                                                                              'pandas==2.2.3',
                                                                              'matplotlib==3.11.2',
                                                                              'nbclient==0.11.0',
                                                                              'nbformat==5.11.1',
                                                                              'ipykernel==7.4.0',
                                                                              'SALib==1.6.0'],
                                                                 'sources': ['https://doi.org/10.1080/00401706.1979.10489755'],
                                                                 'title': 'Distingue variabilidad de proceso '
                                                                          'e incertidumbre',
                                                                 'topic': '05-uncertainty'}},
                                           'nbformat': 4,
                                           'nbformat_minor': 5},
 'es/05-uncertainty/02-the-method.ipynb': {'cells': [{'cell_type': 'markdown',
                                                      'metadata': {},
                                                      'source': ['# Propaga un diseño de incertidumbre con '
                                                                 'semilla\n']},
                                                     {'cell_type': 'markdown',
                                                      'metadata': {},
                                                      'source': ['## Objetivos\n',
                                                                 '\n',
                                                                 'Ejecuta la función de incertidumbre '
                                                                 'OreFlow en un diseño pequeño con semilla, '
                                                                 'inspecciona la distribución simulada de '
                                                                 'recuperación y compara el punto nominal '
                                                                 'con el rango de muestras.']},
                                                     {'cell_type': 'markdown',
                                                      'metadata': {},
                                                      'source': ['## Preparación\n',
                                                                 '\n',
                                                                 '```bash\n',
                                                                 'pip install numpy==2.2.6 scipy==1.17.1 '
                                                                 'pandas==2.2.3 matplotlib==3.11.2 '
                                                                 'nbclient==0.11.0 nbformat==5.11.1 '
                                                                 'ipykernel==7.4.0 SALib==1.6.0\n',
                                                                 '```\n',
                                                                 '\n',
                                                                 'El pipeline OreFlow se importa desde '
                                                                 '`data-pipeline/`; este notebook nunca '
                                                                 'instala paquetes.']},
                                                     {'cell_type': 'code',
                                                      'execution_count': None,
                                                      'metadata': {},
                                                      'outputs': [],
                                                      'source': ['# Importa herramientas de análisis y '
                                                                 'registra sus versiones exactas.\n',
                                                                 'import importlib.metadata\n',
                                                                 'import json\n',
                                                                 'from pathlib import Path\n',
                                                                 'import sys\n',
                                                                 'import numpy as np\n',
                                                                 'import pandas as pd\n',
                                                                 'import matplotlib.pyplot as plt\n',
                                                                 '\n',
                                                                 '# Resuelve el pipeline local desde la '
                                                                 'estructura relativa del repositorio.\n',
                                                                 'repo = Path("../../../").resolve()\n',
                                                                 'sys.path.insert(0, str(repo / '
                                                                 '"data-pipeline"))\n',
                                                                 'for package in ("numpy", "scipy", '
                                                                 '"pandas", "matplotlib", "nbclient", '
                                                                 '"nbformat", "ipykernel"):\n',
                                                                 '    print(package, '
                                                                 'importlib.metadata.version(package))\n']},
                                                     {'cell_type': 'markdown',
                                                      'metadata': {},
                                                      'source': ['## Datos\n',
                                                                 '\n',
                                                                 'Responsable: autores de OreFlow; '
                                                                 'escenario, límites del contrato y '
                                                                 'supuestos de incertidumbre en '
                                                                 '`data/derived/cases/copper_porphyry_soft.json`, '
                                                                 '`data/derived/contract/operating_contract.json` '
                                                                 'y `data/derived/benchmark.json`, licencia '
                                                                 'MIT del proyecto. Repositorio: '
                                                                 'https://github.com/fsantibanezleal/CAOS_OreFlow.']},
                                                     {'cell_type': 'markdown',
                                                      'metadata': {},
                                                      'source': ['## Método\n',
                                                                 '\n',
                                                                 'El método de producción transforma un '
                                                                 'diseño hipercubo latino determinista '
                                                                 'mediante `perturbed` y `_evaluate` de '
                                                                 'OreFlow, que llaman al solver del proceso. '
                                                                 'Los estados estacionarios rechazados se '
                                                                 'cuentan; no se convierten silenciosamente '
                                                                 'en mediciones. Esta lección usa 32 '
                                                                 'corridas para inspección; el registro '
                                                                 'comprometido usa el tamaño de muestra de '
                                                                 'producción.']},
                                                     {'cell_type': 'markdown',
                                                      'metadata': {},
                                                      'source': ['## Resultados\n']},
                                                     {'cell_type': 'markdown',
                                                      'metadata': {},
                                                      'source': ['## Resumen\n',
                                                                 '\n',
                                                                 'Ejecutaste una propagación determinista de '
                                                                 'incertidumbre por el motor de producción y '
                                                                 'comprobaste su dependencia del diseño '
                                                                 'finito elegido. La simulación reproducible '
                                                                 'sigue condicionada por sus supuestos.']},
                                                     {'cell_type': 'markdown',
                                                      'metadata': {},
                                                      'source': ['## Referencias\n',
                                                                 '\n',
                                                                 '- '
                                                                 'https://doi.org/10.1080/00401706.1979.10489755']}],
                                           'metadata': {'kernelspec': {'display_name': 'Python 3',
                                                                       'language': 'python',
                                                                       'name': 'python3'},
                                                        'language_info': {'name': 'python'},
                                                        'caos': {'beyond': [],
                                                                 'data': ['data/derived/benchmark.json',
                                                                          'data/derived/studies.json',
                                                                          'data/derived/contract/operating_contract.json'],
                                                                 'language': 'es',
                                                                 'level': 2,
                                                                 'packages': ['numpy==2.2.6',
                                                                              'scipy==1.17.1',
                                                                              'pandas==2.2.3',
                                                                              'matplotlib==3.11.2',
                                                                              'nbclient==0.11.0',
                                                                              'nbformat==5.11.1',
                                                                              'ipykernel==7.4.0',
                                                                              'SALib==1.6.0'],
                                                                 'sources': ['https://doi.org/10.1080/00401706.1979.10489755'],
                                                                 'title': 'Propaga un diseño de '
                                                                          'incertidumbre con semilla',
                                                                 'topic': '05-uncertainty'}},
                                           'nbformat': 4,
                                           'nbformat_minor': 5},
 'es/05-uncertainty/03-research-comparison.ipynb': {'cells': [{'cell_type': 'markdown',
                                                               'metadata': {},
                                                               'source': ['# Estima sensibilidad de entradas '
                                                                          'basada en varianza\n']},
                                                              {'cell_type': 'markdown',
                                                               'metadata': {},
                                                               'source': ['## Objetivos\n',
                                                                          '\n',
                                                                          'Ejecuta el método de sensibilidad '
                                                                          'Saltelli-Sobol de producción en '
                                                                          'un diseño acotado para enseñanza, '
                                                                          'ordena efectos de primer orden y '
                                                                          'totales, y explica por qué los '
                                                                          'índices de muestra pequeña son '
                                                                          'exploratorios.']},
                                                              {'cell_type': 'markdown',
                                                               'metadata': {},
                                                               'source': ['## Preparación\n',
                                                                          '\n',
                                                                          '```bash\n',
                                                                          'pip install numpy==2.2.6 '
                                                                          'scipy==1.17.1 pandas==2.2.3 '
                                                                          'matplotlib==3.11.2 '
                                                                          'nbclient==0.11.0 nbformat==5.11.1 '
                                                                          'ipykernel==7.4.0 SALib==1.6.0\n',
                                                                          '```\n',
                                                                          '\n',
                                                                          'El pipeline OreFlow se importa '
                                                                          'desde `data-pipeline/`; este '
                                                                          'notebook nunca instala '
                                                                          'paquetes.']},
                                                              {'cell_type': 'code',
                                                               'execution_count': None,
                                                               'metadata': {},
                                                               'outputs': [],
                                                               'source': ['# Importa herramientas de '
                                                                          'análisis y registra sus versiones '
                                                                          'exactas.\n',
                                                                          'import importlib.metadata\n',
                                                                          'import json\n',
                                                                          'from pathlib import Path\n',
                                                                          'import sys\n',
                                                                          'import numpy as np\n',
                                                                          'import pandas as pd\n',
                                                                          'import matplotlib.pyplot as plt\n',
                                                                          '\n',
                                                                          '# Resuelve el pipeline local '
                                                                          'desde la estructura relativa del '
                                                                          'repositorio.\n',
                                                                          'repo = '
                                                                          'Path("../../../").resolve()\n',
                                                                          'sys.path.insert(0, str(repo / '
                                                                          '"data-pipeline"))\n',
                                                                          'for package in ("numpy", "scipy", '
                                                                          '"pandas", "matplotlib", '
                                                                          '"nbclient", "nbformat", '
                                                                          '"ipykernel"):\n',
                                                                          '    print(package, '
                                                                          'importlib.metadata.version(package))\n']},
                                                              {'cell_type': 'markdown',
                                                               'metadata': {},
                                                               'source': ['## Datos\n',
                                                                          '\n',
                                                                          'Responsable: autores de OreFlow; '
                                                                          'rangos de entrada y salidas '
                                                                          'definidos en '
                                                                          '`data/derived/benchmark.json` y '
                                                                          '`data/derived/contract/operating_contract.json`, '
                                                                          'licencia MIT del proyecto. '
                                                                          'Repositorio: '
                                                                          'https://github.com/fsantibanezleal/CAOS_OreFlow.']},
                                                              {'cell_type': 'markdown',
                                                               'metadata': {},
                                                               'source': ['## Método\n',
                                                                          '\n',
                                                                          'Para entradas inciertas '
                                                                          'independientes, los índices Sobol '
                                                                          'de primer orden miden la varianza '
                                                                          'explicada por una entrada y los '
                                                                          'totales incluyen interacciones. '
                                                                          'SALib construye el diseño Sobol '
                                                                          'scrambled y estima índices; '
                                                                          'OreFlow evalúa cada fila con el '
                                                                          'mismo solver. El diseño didáctico '
                                                                          'usa una base pequeña para reducir '
                                                                          'el tiempo de ejecución. No '
                                                                          'sustituye el registro de '
                                                                          'sensibilidad de producción ni un '
                                                                          'análisis empírico de planta.']},
                                                              {'cell_type': 'markdown',
                                                               'metadata': {},
                                                               'source': ['## Comparación\n',
                                                                          '\n',
                                                                          'Saltelli et al. (2010) presentan '
                                                                          'estimadores de efectos de primer '
                                                                          'orden y orden total basados en '
                                                                          'varianza; SALib (Herman y Usher, '
                                                                          '2017) aporta el diseño y la '
                                                                          'implementación de análisis. '
                                                                          'OreFlow documenta que su '
                                                                          'bootstrap remuestrea filas de '
                                                                          'baja discrepancia como si fueran '
                                                                          'independientes, lo que puede '
                                                                          'exagerar sus límites de '
                                                                          'incertidumbre. La corrida pequeña '
                                                                          'es una demostración reproducible '
                                                                          'del método, no un estimador '
                                                                          'novedoso ni una sensibilidad '
                                                                          'validada en terreno.']},
                                                              {'cell_type': 'markdown',
                                                               'metadata': {},
                                                               'source': ['## Resultados\n']},
                                                              {'cell_type': 'markdown',
                                                               'metadata': {},
                                                               'source': ['## Resumen\n',
                                                                          '\n',
                                                                          'Ejecutaste un método publicado de '
                                                                          'sensibilidad basada en varianza '
                                                                          'mediante la implementación '
                                                                          'OreFlow. Trata el diseño pequeño '
                                                                          'como experimento didáctico y '
                                                                          'consulta el análisis mayor '
                                                                          'comprometido y sus limitaciones '
                                                                          'bootstrap antes de citar '
                                                                          'resultados.']},
                                                              {'cell_type': 'markdown',
                                                               'metadata': {},
                                                               'source': ['## Referencias\n',
                                                                          '\n',
                                                                          '- '
                                                                          'https://doi.org/10.1016/j.cpc.2009.09.018\n',
                                                                          '- '
                                                                          'https://doi.org/10.21105/joss.00097']}],
                                                    'metadata': {'kernelspec': {'display_name': 'Python 3',
                                                                                'language': 'python',
                                                                                'name': 'python3'},
                                                                 'language_info': {'name': 'python'},
                                                                 'caos': {'beyond': [],
                                                                          'data': ['data/derived/benchmark.json',
                                                                                   'data/derived/studies.json',
                                                                                   'data/derived/contract/operating_contract.json'],
                                                                          'language': 'es',
                                                                          'level': 3,
                                                                          'methods': ['M-6'],
                                                                          'packages': ['numpy==2.2.6',
                                                                                       'scipy==1.17.1',
                                                                                       'pandas==2.2.3',
                                                                                       'matplotlib==3.11.2',
                                                                                       'nbclient==0.11.0',
                                                                                       'nbformat==5.11.1',
                                                                                       'ipykernel==7.4.0',
                                                                                       'SALib==1.6.0'],
                                                                          'sources': ['https://doi.org/10.1016/j.cpc.2009.09.018',
                                                                                      'https://doi.org/10.21105/joss.00097'],
                                                                          'title': 'Estima sensibilidad de '
                                                                                   'entradas basada en '
                                                                                   'varianza',
                                                                          'topic': '05-uncertainty'}},
                                                    'nbformat': 4,
                                                    'nbformat_minor': 5}}

if __name__ == '__main__':
    main()
