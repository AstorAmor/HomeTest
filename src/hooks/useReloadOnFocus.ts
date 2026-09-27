import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigation } from 'expo-router';

// Tiempo máximo de espera si no llega 'transitionEnd' (p. ej. en web).
const FALLBACK_MS = 450;

// Recarga datos al montar y cada vez que la pantalla vuelve a tener el foco,
// pero DESPUÉS de que termine la animación de "atrás". Recargar durante la
// animación (sobre todo pantallas con muchas gráficas SVG) es lo que la hacía
// ir a tirones. `load` debe ser estable (useCallback).
export function useReloadOnFocus(load: () => unknown) {
  const navigation = useNavigation();

  useEffect(() => {
    load();
    let pending: ReturnType<typeof setTimeout> | null = null;

    const run = () => {
      if (!pending) return;
      clearTimeout(pending);
      pending = null;
      load();
    };

    const unsubscribeFocus = navigation.addListener('focus', () => {
      if (pending) clearTimeout(pending);
      pending = setTimeout(run, FALLBACK_MS);
    });
    // En native-stack, la pantalla que reaparece recibe transitionEnd al acabar la animación
    const unsubscribeEnd = navigation.addListener('transitionEnd' as any, (e: any) => {
      if (!e?.data?.closing) run();
    });

    return () => {
      unsubscribeFocus();
      unsubscribeEnd();
      if (pending) clearTimeout(pending);
    };
  }, [navigation, load]);
}

// useState que ignora actualizaciones con el mismo contenido: al volver a una
// pantalla sin cambios en los datos, no se vuelve a dibujar nada.
export function useDeepState<T>(initial: T): [T, (next: T) => void] {
  const [state, setState] = useState(initial);
  const lastJson = useRef<string | null>(null);

  const setIfChanged = useCallback((next: T) => {
    const json = JSON.stringify(next);
    if (json === lastJson.current) return;
    lastJson.current = json;
    setState(next);
  }, []);

  return [state, setIfChanged];
}
