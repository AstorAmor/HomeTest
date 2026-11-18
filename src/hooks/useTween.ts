// Un número que va hacia `target` en `ms` (ease-out), para los trazos de SVG que se dibujan desde
// JavaScript (arcos de los anillos). `from`: de dónde sale la primera vez (p. ej. 0 para que el anillo
// se llene al cargar). Con «reducir movimiento» salta directamente al valor.
import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'react-native-reanimated';

export function useTween(target: number, ms: number, from?: number): number {
  const reduce = useReducedMotion();
  const start0 = reduce ? target : (from ?? target);
  const [v, setV] = useState(start0);
  const cur = useRef(start0);
  useEffect(() => {
    const start = cur.current;
    if (start === target) return;
    if (reduce) {
      cur.current = target;
      setV(target);
      return;
    }
    const t0 = Date.now();
    let raf = 0;
    const step = () => {
      const k = Math.min(1, (Date.now() - t0) / ms);
      const eased = 1 - Math.pow(1 - k, 3);
      const now = start + (target - start) * eased;
      cur.current = now;
      setV(now);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms, reduce]);
  return v;
}
