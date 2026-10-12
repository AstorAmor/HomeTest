// Posición de cada pestaña de la barra de abajo (también el ?tab=N de la URL). Laboratorio va en
// el centro (fundador, 2026-10-12): Hoy, Mis datos, Laboratorio, Agenda, Más. Usar siempre estos
// nombres en lugar de números sueltos.
export const TAB = { today: 0, myData: 1, lab: 2, schedule: 3, more: 4 } as const;

export const tabHref = (n: number) => `/(tabs)?tab=${n}`;
