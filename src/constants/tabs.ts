// Posición de cada pestaña de la barra de abajo (también el ?tab=N de la URL). Desde el 2026-11-16 son
// cuatro (borradores/app-estructura/ESPECIFICACION.md): Hoy, Plan, (el botón K, que no es pestaña: abre
// «Apuntar»), Análisis y Tú. Mis datos y Agenda dejaron de ser pestañas. Usar siempre estos nombres en
// lugar de números sueltos.
export const TAB = { today: 0, plan: 1, analysis: 2, you: 3 } as const;

export const tabHref = (n: number) => `/(tabs)?tab=${n}`;

// Cambiar de pestaña desde dentro de una pestaña (p. ej. «Ver» en Hoy lleva a Análisis): lo escucha
// MainTabsScreen. Desde una pantalla de encima se usa tabHref (router.navigate).
const tabListeners = new Set<(n: number) => void>();
export const goToTab = (n: number) => tabListeners.forEach((fn) => fn(n));
export const onGoToTab = (fn: (n: number) => void) => {
  tabListeners.add(fn);
  return () => {
    tabListeners.delete(fn);
  };
};
