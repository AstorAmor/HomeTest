import { createMetricRepository } from './metricRepository';
import { simpleMetricRemote } from './simpleMetricRemote';
import { SimpleMetricEntry } from '@/types/simpleMetric';
import { dayKey, noonOf } from './bathroomRepository';
import { userFlags } from './userFlags';
import { dateLocale } from '@/i18n';

// Lo que bebe (agua o cualquier otra bebida), cada vez con su cantidad en ml. Va a metric_readings con
// kind "water", como el peso o la temperatura: no necesita tabla propia. El total del día es la suma.
export const waterRepository = createMetricRepository<SimpleMetricEntry>('hometest:water_entries', simpleMetricRemote('water'));

// El «+» apunta un vaso, o la medida habitual que haya puesto (su botella, su cantimplora…), guardada en
// user_flags para todos sus dispositivos
export const GLASS_ML = 250;
const USUAL_KEY = 'water_usual_ml';

export const waterUsual = {
  async get(): Promise<number> {
    const v = await userFlags.get(USUAL_KEY).catch(() => undefined);
    return typeof v === 'number' && v >= 50 && v <= 2000 ? v : GLASS_ML;
  },
  set: (ml: number) => userFlags.set(USUAL_KEY, ml),
};
export const WATER_USUAL_SOURCE = `flag:${USUAL_KEY}`;

export const waterOnDay = (entries: SimpleMetricEntry[], day: string) =>
  entries.filter((e) => dayKey(new Date(e.fecha)) === day).reduce((sum, e) => sum + e.valor, 0);

// Un apunte ahora o, para otro día, a mediodía de ese día
export async function addWater(ml: number, day?: string): Promise<void> {
  const now = new Date();
  const fecha = !day || day === dayKey(now) ? now.toISOString() : noonOf(day);
  await waterRepository.save({ id: `water-${Date.now()}`, valor: ml, unidad: 'ml', fecha, createdAt: now.toISOString() });
}

// 1600 → «1,6 L»; 1250 → «1,25 L»
export const litres = (ml: number) => `${(ml / 1000).toLocaleString(dateLocale(), { maximumFractionDigits: 2 })} L`;
