// El dibujo único de las pesas (fundador, 2026-11-17: «sé coherente con los iconos. P. ej. en Entrenamientos, el icono
// de las pesas no es el mismo que racha de fuerza y tampoco el mismo que en Entrenador personal. Me gusta el de
// Entrenador personal»). Es el del entrenador personal (fine/RoleEmblem.tsx): una mancuerna con sus discos, a
// 24 × 24 y solo trazo. De aquí lo toman el rol de entrenador, la insignia «Racha de fuerza» (badges/badgeIconPaths.ts),
// el tema de Aprende (fine/LineEmblem.tsx), el objetivo «Ponerte en forma» (fine/GoalEmblem.tsx) y cualquier icono
// de pesas que llegue por su nombre (AppIcon, en HealthIcons.tsx): cambiarlo aquí lo cambia en todos.
// Solo el trazo, sin React Native, para que también lo lean los datos y los tests; el componente, en DumbbellIcon.tsx.
export const DUMBBELL_PATH = 'M2.5 9.8h1.8v4.4H2.5zM4.3 6.9h2.8v10.2H4.3zM16.9 6.9h2.8v10.2h-2.8zM19.7 9.8h1.8v4.4h-1.8zM7.1 12h9.8';

// Los nombres con los que los datos piden unas pesas: los de Ionicons, el de MaterialCommunityIcons y el de AppIcon
const WEIGHTS_ICONS = new Set(['barbell', 'barbell-outline', 'barbell-sharp', 'dumbbell', 'mci:dumbbell']);

export const isWeightsIcon = (name?: string | null): boolean => !!name && WEIGHTS_ICONS.has(name);
