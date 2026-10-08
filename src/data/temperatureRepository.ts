import { createMetricRepository } from './metricRepository';
import { simpleMetricRemote } from './simpleMetricRemote';
import { SimpleMetricEntry } from '@/types/simpleMetric';
import { DailyWearableRecord } from '@/wearables/types';
import { TempReading } from '@/logic/fertility';
import { dayKey } from './bathroomRepository';

// Temperatura basal tomada con termómetro al despertar (antes de levantarse). Va a
// metric_readings con kind "basal_temperature"; la del wearable sigue en wearable_daily.
export const basalTemperatureRepository = createMetricRepository<SimpleMetricEntry>(
  'hometest:basal_temperature',
  simpleMetricRemote('basal_temperature')
);

// Lecturas manuales y del wearable juntas, para la regla de la subida tras la ovulación
export function temperatureReadings(manual: SimpleMetricEntry[], wearable: DailyWearableRecord[]): TempReading[] {
  return [
    ...manual.map((m) => ({ date: dayKey(new Date(m.fecha)), celsius: m.valor, source: 'manual' as const })),
    ...wearable
      .filter((w) => w.metric === 'body_temperature')
      .map((w) => ({ date: w.date, celsius: w.value, source: 'wearable' as const })),
  ];
}
