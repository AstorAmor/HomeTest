import { useEffect, useSyncExternalStore } from 'react';
import { useAuth } from '@/context/AuthContext';
import { getCurrentUserId } from '@/lib/supabase';
import { onDataChange } from '@/data/dataEvents';
import { userFlags } from '@/data/userFlags';
import { isLengthUnit, type LengthUnit } from '@/logic/lengthUnits';

// En qué unidad ve y escribe el usuario las medidas con cinta: cm o pulgadas (fundador, 2026-11-16: «quiero que
// puedas cambiar las unidades (inch - cm)»). Se guarda en user_flags (clave "length_unit"): con cuenta, en todos
// sus dispositivos; sin cuenta, en el móvil. Sin elegir, cm. Solo cambia cómo se enseña: lo apuntado va siempre
// en cm (src/logic/lengthUnits.ts). El peso y la altura no la usan.

const FLAG_KEY = 'length_unit';
export const LENGTH_UNIT_SOURCE = `flag:${FLAG_KEY}`;

// Compartido por todas las pantallas: al cambiarlo en Medidas, Peso y la evolución se actualizan al momento
let state: { unit: LengthUnit; loadedFor: string | null } = { unit: 'cm', loadedFor: null };
let version = 0; // sube con cada cambio: una lectura que empezó antes no lo pisa
let writing = false; // el aviso de user_flags de un cambio propio no hace volver a leer
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const currentOwner = () => getCurrentUserId() ?? 'demo';

export const lengthUnit = {
  get: () => state.unit,

  async load(): Promise<LengthUnit> {
    const owner = currentOwner();
    const started = version;
    const raw = await userFlags.get(FLAG_KEY).catch(() => undefined);
    const unit = isLengthUnit(raw) ? raw : 'cm';
    if (started !== version || owner !== currentOwner()) return state.unit;
    const changed = unit !== state.unit;
    state = { unit, loadedFor: owner };
    if (changed) emit();
    return unit;
  },

  async set(unit: LengthUnit): Promise<void> {
    if (unit === state.unit && state.loadedFor === currentOwner()) return;
    version++;
    state = { unit, loadedFor: currentOwner() };
    emit();
    writing = true;
    try {
      await userFlags.set(FLAG_KEY, unit);
    } catch {
      // sin conexión: se queda la copia local y la elección de esta sesión
    } finally {
      writing = false;
    }
  },
};

// Si otra parte de la app cambia la clave, volver a leerla (una sola escucha para toda la app)
let watching = false;
const watch = () => {
  if (watching) return;
  watching = true;
  onDataChange((source) => {
    if (source === LENGTH_UNIT_SOURCE && !writing) void lengthUnit.load();
  });
};

const subscribe = (listener: () => void) => {
  watch();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const setLengthUnit = (unit: LengthUnit) => {
  void lengthUnit.set(unit);
};

// [unidad, cambiarla]
export function useLengthUnit(): [LengthUnit, (unit: LengthUnit) => void] {
  const { user } = useAuth();
  const unit = useSyncExternalStore(subscribe, () => state.unit, () => state.unit);
  useEffect(() => {
    // Primera vez, o ha entrado otra cuenta: leer la suya
    if (state.loadedFor !== currentOwner()) void lengthUnit.load();
  }, [user?.id]);
  return [unit, setLengthUnit];
}
