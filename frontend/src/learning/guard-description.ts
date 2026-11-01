/** The reconstruction detector supplies a threshold signal, not a support oracle. */
import type { Lang } from '../lib/format';

export const GUARD_LABELS = {
  alert: { en: 'Detector alert: reconstruction threshold exceeded', es: 'Alerta del detector: umbral de reconstrucción superado' },
  error: { en: 'Reconstruction error (autoencoder)', es: 'Error de reconstrucción (autocodificador)' },
  axis: { en: 'Reconstruction error', es: 'Error de reconstrucción' },
};

export function describeGuard(flagged: boolean, lang: Lang): string {
  const signal = lang === 'en'
    ? flagged ? 'Detector alert: reconstruction error exceeds the threshold.' : 'No detector alert: reconstruction error is at or below the threshold.'
    : flagged ? 'Alerta del detector: el error de reconstrucción supera el umbral.' : 'Sin alerta del detector: el error de reconstrucción está en el umbral o por debajo.';
  const limit = lang === 'en'
    ? 'This signal does not establish training support or predictive accuracy; false alarms and missed shifts are possible.'
    : 'Esta señal no demuestra pertenencia al dominio de entrenamiento ni precisión predictiva; puede haber falsas alarmas y cambios no detectados.';
  return `${signal} ${limit}`;
}
