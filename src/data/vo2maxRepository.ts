import { createMetricRepository } from './metricRepository';
import { simpleMetricRemote } from './simpleMetricRemote';
import { SimpleMetricEntry } from '@/types/simpleMetric';

// VO2max que la persona apunta a mano (de una prueba de esfuerzo con un especialista). En las
// cuentas va a la tabla genérica metric_readings con kind 'vo2max' (no hace falta migración).
export const vo2maxRepository = createMetricRepository<SimpleMetricEntry>('hometest:vo2max_entries', simpleMetricRemote('vo2max'));
