# Notebooks OreFlow

Lecciones prácticas bilingües basadas en casos comprometidos y métodos implementados en el pipeline OreFlow.


## 01 01-comminution

- [Sigue un mineral de cobre por trituración y molienda](01-comminution/01-the-record.ipynb), level 1: Partiendo de un mineral OreFlow declarado y su punto operativo nominal, sigue el tamaño de alimentación a través del circuito de conminución. Distingue un registro simulado de planta de una medición y reconoce las magnitudes que calcula el motor.

- [Reconstruye el cálculo de energía y reciclaje](01-comminution/02-the-method.ipynb), level 2: Reproduce una corrida nominal con el caso declarado de OreFlow, inspecciona las etapas de clasificación y energía, y evalúa la respuesta de la ley Bond implementada ante un cambio controlado de P80. Cada magnitud calculada procede de métodos del pipeline.

- [Compara Bond, Rittinger y Kick en una reducción](01-comminution/03-research-comparison.ipynb), level 3: Compara tres hipótesis de conminución en el mismo rango de alimentación y producto, identifica el punto de calibración donde coinciden y establece qué permite y qué no permite concluir la comparación.



## 02 02-flotation

- [Interpreta un banco de flotación como respuesta cinética](02-flotation/01-the-record.ipynb), level 1: Ejecuta el rougher Cu-Mo y distingue su curva batch virtual de la respuesta del banco alimentado de forma continua. Comprende por qué recuperación versus tiempo es una respuesta de proceso, no una animación decorativa.

- [Ajusta cinco modelos cinéticos y compara la proyección del banco](02-flotation/02-the-method.ipynb), level 2: Ejecuta los ajustes no lineales acotados de OreFlow, inspecciona límites y residuales, y compara la predicción de banco con la referencia exacta de tasas distribuidas del motor.

- [Compara cinética clásica de flotación con la misma evidencia](02-flotation/03-research-comparison.ipynb), level 3: Compara cinco formas cinéticas citadas sobre la misma evidencia batch y evalúa por separado la proyección de banco frente a la referencia exacta con tasas distribuidas del motor.



## 03 03-learning

- [Construye un ejemplo de aprendizaje para procesamiento de minerales](03-learning/01-the-record.ipynb), level 1: Usa las funciones propias de OreFlow para características y objetivos en un circuito de autoría propia. Identifica qué aprende el surrogate y por qué las filas generadas por el motor no son observaciones de planta.

- [Sigue el diseño y las particiones de validación sin fuga](03-learning/02-the-method.ipynb), level 2: Genera un diseño determinista pequeño con el pipeline OreFlow, inspecciona particiones de interpolación y caso completo no visto, y relaciónalas con la validación comprometida de tamaño completo.

- [Compara surrogates y transfiere a minerales no vistos](03-learning/03-research-comparison.ipynb), level 3: Compara familias de modelos con objetivos y filas de prueba idénticos, inspecciona transferencia de caso completo y cobertura GP, y evalúa los límites de generalización que permite la evidencia.
