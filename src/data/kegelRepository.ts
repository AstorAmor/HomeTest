import { createMetricRepository } from './metricRepository';
import { simpleMetricRemote } from './simpleMetricRemote';
import { SimpleMetricEntry } from '@/types/simpleMetric';

// Sesiones de Kegel terminadas, para su histórico en la pantalla del ciclo (src/logic/kegel.ts). En las
// cuentas van a metric_readings con kind 'kegel' (valor = minutos); no hace falta migración. No salen en
// la vista del profesional (src/data/sharing.ts).
export const kegelRepository = createMetricRepository<SimpleMetricEntry>('hometest:kegel_sessions', simpleMetricRemote('kegel'));

export function logKegelSession(minutes: number, now = new Date()): Promise<void> {
  const iso = now.toISOString();
  return kegelRepository.save({ id: `kegel-${now.getTime()}`, valor: minutes, unidad: 'min', fecha: iso, createdAt: iso });
}
