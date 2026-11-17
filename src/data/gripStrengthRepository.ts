import { createMetricRepository } from './metricRepository';
import { simpleMetricRemote } from './simpleMetricRemote';
import { SimpleMetricEntry } from '@/types/simpleMetric';

// Fuerza de agarre que la persona apunta a mano (el mejor intento con un dinamómetro de mano, en kg). Como el
// VO2max: en las cuentas va a la tabla genérica metric_readings con kind 'grip_strength' (columna de texto libre,
// no hace falta migración).
export const gripStrengthRepository = createMetricRepository<SimpleMetricEntry>('hometest:grip_strength_entries', simpleMetricRemote('grip_strength'));
