import type { GenericMetricEntry } from '@/screens/SimpleMetricDetailScreen';
import type { BloodPressureEntry } from '@/types/bloodPressure';
import { mockBiomarkers } from './mockData';

// Registros de ejemplo para las fichas de detalle cuando aún no hay ninguno propio (las mismas
// cifras que enseña Mis datos como "ejemplo"), para que la pantalla no se vea vacía. Una medición
// por semana, las últimas 6 semanas, a las 08:30. Nunca se guardan.

const weekly = (n: number) =>
  Array.from({ length: n }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (n - 1 - i) * 7);
    d.setHours(8, 30, 0, 0);
    return d.toISOString();
  });

export function sampleSimpleEntries(mockId: 'sugar' | 'cholesterol' | 'cortisol', unit: string): GenericMetricEntry[] {
  const history = mockBiomarkers.find((b) => b.id === mockId)?.history ?? [];
  const dates = weekly(history.length);
  return history.map((valor, i) => ({ id: `sample-${mockId}-${i}`, valor, unidad: unit, fecha: dates[i] }));
}

export function sampleBloodPressure(): BloodPressureEntry[] {
  const sys = [118, 122, 119, 125, 121, 120];
  const dia = [78, 81, 77, 83, 80, 80];
  const pulse = [64, 66, 63, 68, 65, 64];
  const dates = weekly(sys.length);
  return sys.map((s, i) => ({
    id: `sample-bp-${i}`,
    systolic: s,
    diastolic: dia[i],
    pulse: pulse[i],
    fecha: dates[i],
    source: 'manual' as const,
    createdAt: dates[i],
  }));
}
