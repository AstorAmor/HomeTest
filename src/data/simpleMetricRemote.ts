import { definedOnly, RemoteTable } from './metricRepository';
import { SimpleMetricEntry } from '@/types/simpleMetric';

// Colesterol, cortisol y demás métricas de un solo valor comparten la tabla
// metric_readings, diferenciadas por `kind`.
export const simpleMetricRemote = (kind: string): RemoteTable<SimpleMetricEntry> => ({
  table: 'metric_readings',
  dateColumn: 'measured_at',
  match: { kind },
  toRow: (e) =>
    definedOnly({
      id: e.id,
      value: e.valor,
      unit: e.unidad,
      measured_at: e.fecha,
      created_at: e.createdAt,
    }),
  fromRow: (r) => ({
    id: r.id,
    valor: Number(r.value),
    unidad: r.unit,
    fecha: r.measured_at,
    createdAt: r.created_at,
  }),
});
