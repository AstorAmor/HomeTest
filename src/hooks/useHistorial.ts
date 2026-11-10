import { useCallback, useEffect, useRef, useState } from 'react';
import { useReloadOnFocus } from './useReloadOnFocus';
import { cachedHistorial, loadHistorial, saveHistorial } from '@/data/historialRepository';
import type { Historial } from '@/logic/historial';

// El historial para una pantalla: lo que haya en memoria al instante, y se vuelve a leer al volver.
// Todas las pantallas abiertas comparten lo mismo: `update` cambia a la vez la de editar y la de debajo
// (antes, al guardar una alergia y volver, la lista seguía con lo viejo hasta que acababa la animación
// y llegaba la nube, y cambiaba de golpe). Una lectura que empezó antes de un cambio no lo pisa, y lo
// que llega igual a lo que ya se ve no repinta nada.
const listeners = new Set<(h: Historial) => void>();
let version = 0;
const broadcast = (h: Historial) => listeners.forEach((l) => l(h));

export function useHistorial() {
  const [h, setH] = useState<Historial | null>(cachedHistorial);
  const shown = useRef(h ? JSON.stringify(h) : '');
  useEffect(() => {
    const apply = (next: Historial) => {
      const json = JSON.stringify(next);
      if (json === shown.current) return;
      shown.current = json;
      setH(next);
    };
    listeners.add(apply);
    return () => {
      listeners.delete(apply);
    };
  }, []);
  const load = useCallback(() => {
    const started = version;
    loadHistorial()
      .then((next) => {
        if (started === version) broadcast(next);
      })
      .catch(() => undefined);
  }, []);
  useReloadOnFocus(load);
  const update = useCallback((next: Historial) => {
    version++;
    broadcast(next);
    saveHistorial(next).catch((e) => console.warn('Historial not saved', e));
  }, []);
  return { h, update, reload: load };
}
