import { useCallback, useEffect, useState } from 'react';
import { useReloadOnFocus } from './useReloadOnFocus';
import { onDataChange } from '@/data/dataEvents';
import { dayKey } from '@/data/bathroomRepository';
import { addWater, GLASS_ML, waterOnDay, waterRepository, waterUsual, WATER_USUAL_SOURCE } from '@/data/waterRepository';

const SOURCE = 'hometest:water_entries';

// Lo bebido hoy y la medida del «+», al día aunque se apunte desde otra tarjeta (el círculo y la
// tarjeta de Hidratación de Hoy se enteran por dataEvents)
export function useWaterToday() {
  const [total, setTotal] = useState<number | null>(null);
  const [usual, setUsual] = useState(GLASS_ML);

  const load = useCallback(() => {
    waterRepository
      .getAll()
      .then((all) => setTotal(waterOnDay(all, dayKey(new Date()))))
      .catch(() => setTotal(0));
    waterUsual.get().then(setUsual).catch(() => undefined);
  }, []);
  useReloadOnFocus(load);
  useEffect(() => onDataChange((s) => (s === SOURCE || s === WATER_USUAL_SOURCE) && load()), [load]);

  const add = useCallback(async () => {
    setTotal((x) => (x ?? 0) + usual); // al momento; al guardarse se vuelve a leer
    await addWater(usual).catch(() => load());
  }, [usual, load]);

  return { total: total ?? 0, usual, add };
}
