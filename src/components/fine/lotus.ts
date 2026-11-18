// La flor de loto única del ciclo y la salud reproductiva (fundador, 2026-11-17: «salud reproductiva es una florecita,
// sin embargo en registra tu regla es como una flor de loto… me gusta más flor de loto en todos los casos, pero con el
// estilo más minimalista de la flor con tallo del principio»). A 24 × 24 y solo trazo: el pétalo central, los dos
// laterales abiertos (sin cruzarse con el central) y una línea de base; con tallo parecía un brote. De aquí la toman Aprende
// (fine/LineEmblem.tsx), cualquier icono de flor o rosa que llegue por su nombre (AppIcon, en HealthIcons.tsx) y la
// pantalla de apuntar la regla. La insignia «Mente tranquila» lleva su propio loto sobre el agua (badges/).
export const LOTUS_PATH =
  'M12 17C9.8 14.4 9.9 9.6 12 6.5 14.1 9.6 14.2 14.4 12 17zM12 17C8.4 16.8 5.8 14.3 5.6 10.5 8.3 11 10 12.2 10.65 14.1M12 17C15.6 16.8 18.2 14.3 18.4 10.5 15.7 11 14 12.2 13.35 14.1M8 19.5h8';

// Los nombres con los que los datos piden la flor del ciclo: los de Ionicons y los de MaterialCommunityIcons
const FLOWER_ICONS = new Set(['rose', 'rose-outline', 'rose-sharp', 'flower', 'flower-outline', 'flower-sharp', 'mci:flower', 'mci:flower-outline', 'lotus']);

export const isFlowerIcon = (name?: string | null): boolean => !!name && FLOWER_ICONS.has(name);
