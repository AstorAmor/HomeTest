import { useEffect, useState } from 'react';

// Orden de los avisos al entrar por primera vez (2026-11-10): «Before we start» (PermissionsIntro, los
// permisos del móvil) va primero, y los avisos de bienvenida (perfil genético, la regla) esperan a que se
// cierre, y además un rato (AFTER_MS), para no salir encima ni nada más cerrarlo. Antes salían los dos a la
// vez y uno tapaba al otro (Astor, al crear una cuenta de paciente).
//
// 'unknown' → aún no se sabe si hace falta (la sesión se está cargando); 'open' → se está enseñando (o
// pidiendo el permiso de avisos); 'done' → cerrado o no hace falta (web, profesional, ya visto).

export type GateState = 'unknown' | 'open' | 'done';
export const AFTER_MS = 2000;

let state: GateState = 'unknown';
let doneAt = 0; // 0 = no se acaba de cerrar: los avisos pueden salir ya
const listeners = new Set<() => void>();

export function setPermissionsGate(next: GateState, opts: { justClosed?: boolean } = {}) {
  if (state === next) return;
  state = next;
  if (next === 'done') doneAt = opts.justClosed ? Date.now() : 0;
  listeners.forEach((l) => l());
}

// Cuánto falta para que los demás avisos puedan salir (null = esperar a que cambie el estado)
export function remainingWait(s: GateState, closedAt: number, now: number, afterMs = AFTER_MS): number | null {
  if (s !== 'done') return null;
  if (!closedAt) return 0;
  return Math.max(0, closedAt + afterMs - now);
}

// true mientras los avisos de bienvenida deben esperar
export function usePermissionsGatePending(): boolean {
  const [pending, setPending] = useState(() => remainingWait(state, doneAt, Date.now()) !== 0);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const update = () => {
      if (timer) clearTimeout(timer);
      const wait = remainingWait(state, doneAt, Date.now());
      if (wait === null) setPending(true);
      else if (wait === 0) setPending(false);
      else timer = setTimeout(() => setPending(false), wait);
    };
    listeners.add(update);
    update();
    return () => {
      listeners.delete(update);
      if (timer) clearTimeout(timer);
    };
  }, []);
  return pending;
}
