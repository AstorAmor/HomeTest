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

// Mientras deslizas de lado una fila dentro de una pestaña (el carrusel de especialistas, las insignias…), las
// pestañas no se mueven: si no, a veces el gesto se lo quedaba la pestaña y cambiabas de pantalla (fundador,
// 2026-11-16: «el carrusel… a veces me cambia de pantalla»). Lo escucha MainTabsScreen (scrollEnabled del pager).
const swipeListeners = new Set<(on: boolean) => void>();
let safety: ReturnType<typeof setTimeout> | null = null;
export const holdTabSwipe = (hold: boolean) => {
  // Por si no llega el «soltar» (un toque que se cancela sin mover), se suelta solo a los 4 s
  if (safety) clearTimeout(safety);
  safety = hold ? setTimeout(() => swipeListeners.forEach((fn) => fn(true)), 4000) : null;
  swipeListeners.forEach((fn) => fn(!hold));
};
export const onTabSwipe = (fn: (on: boolean) => void) => {
  swipeListeners.add(fn);
  return () => {
    swipeListeners.delete(fn);
  };
};
// Para la fila que se desliza de lado: se sujeta al tocarla y se suelta al levantar el dedo o al pararse
export const holdTabsProps = {
  onTouchStart: () => holdTabSwipe(true),
  onTouchEnd: () => holdTabSwipe(false),
  onScrollEndDrag: () => holdTabSwipe(false),
  onMomentumScrollEnd: () => holdTabSwipe(false),
};
