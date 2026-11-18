// Los emblemas de las insignias, dibujados a mano (fundador, 2026-11-16: los iconos de antes «son muy de niño… otro
// icono más formal»; para «En marcha cada día», una mochila). Como un grabado de medalla: trazo fino y uniforme,
// formas geométricas, sin nada redondito ni gracioso. Trazos a 24 × 24, sin relleno, todos del mismo grueso
// (BADGE_EMBLEM_STROKE) y de un tamaño visual parecido. La clave es el `icon` de cada logro (src/data/achievements.ts).
// Es la única fuente: los pinta BadgeGlyph (badges/BadgeEmblem.tsx) en la fila de Plan, en la insignia en grande y
// en la imagen que se comparte, así no pueden salir distintos: cambiar un dibujo aquí lo cambia en los tres. Las
// suelas y el laurel se calcularon con un pequeño script (curvas por puntos y hojas a lo largo del arco); el resto,
// a mano.

import { DUMBBELL_PATH } from '@/components/fine/dumbbell';

export const BADGE_EMBLEM_STROKE = 1.5; // en unidades de los 24 × 24: crece con el emblema

export const BADGE_EMBLEM_PATHS: Record<string, string> = {
  // Coleccionista de pasos: dos huellas de zapato (suela y tacón), algo giradas hacia fuera
  footsteps: 'M7.61 3.28C8.17 3.19 8.91 3.26 9.39 3.6C9.86 3.95 10.26 4.65 10.47 5.36C10.69 6.06 10.68 7.08 10.67 7.86C10.66 8.63 10.72 9.57 10.4 10.02C10.09 10.48 9.33 10.5 8.77 10.59C8.21 10.68 7.47 10.89 7.05 10.56C6.62 10.22 6.46 9.3 6.22 8.56C5.99 7.82 5.67 6.86 5.64 6.12C5.6 5.38 5.7 4.61 6.03 4.14C6.36 3.66 7.05 3.37 7.61 3.28ZM7.33 12.03L10.59 11.51L10.87 13.29A1.65 1.65 0 0 1 7.61 13.81ZM16.39 8.08C16.95 8.17 17.62 8.46 17.97 8.94C18.32 9.41 18.48 10.2 18.46 10.94C18.45 11.68 18.13 12.64 17.88 13.38C17.62 14.11 17.4 15.02 16.95 15.36C16.51 15.69 15.79 15.48 15.23 15.39C14.67 15.3 13.9 15.28 13.6 14.82C13.3 14.37 13.43 13.45 13.43 12.67C13.44 11.9 13.43 10.88 13.62 10.17C13.82 9.46 14.15 8.75 14.61 8.4C15.07 8.06 15.83 7.99 16.39 8.08ZM13.41 16.31L16.67 16.83L16.39 18.61A1.65 1.65 0 0 1 13.13 18.09Z',
  // En marcha cada día: una mochila
  walk: 'M6 9.5A3.5 3.5 0 0 1 9.5 6h5A3.5 3.5 0 0 1 18 9.5V19a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 19zM9.8 6V4.7a1.2 1.2 0 0 1 1.2-1.2h2a1.2 1.2 0 0 1 1.2 1.2V6M8.5 13.5h7v5h-7zM8.5 15.6h7',
  // Campeón del plan: una corona de laurel
  trophy: 'M13.54 19.44A7.4 7.4 0 0 1 9.47 5.25M10.46 19.44A7.4 7.4 0 0 0 14.53 5.25M7.05 17.7Q5.45 15.7 3.85 17.7Q5.45 19.7 7.05 17.7M4.85 14.12Q4.6 11.57 2.17 12.37Q2.42 14.92 4.85 14.12M4.96 9.91Q6.14 7.64 3.66 6.99Q2.48 9.27 4.96 9.91M7.34 6.45Q9.57 5.18 7.84 3.29Q5.62 4.56 7.34 6.45M16.95 17.7Q18.55 19.7 20.15 17.7Q18.55 15.7 16.95 17.7M19.15 14.12Q21.58 14.92 21.83 12.37Q19.4 11.57 19.15 14.12M19.04 9.91Q21.52 9.27 20.34 6.99Q17.86 7.64 19.04 9.91M16.66 6.45Q18.38 4.56 16.16 3.29Q14.43 5.18 16.66 6.45',
  // Racha de fuerza: una mancuerna con sus discos. La misma que la del entrenador personal y que la de todo lo de
  // fuerza (fundador, 2026-11-17: «el icono de las pesas no es el mismo que racha de fuerza»): fine/dumbbell.ts
  barbell: DUMBBELL_PATH,
  // Consciente de ti: un ojo con el iris
  happy: 'M3.5 12C5.8 8.3 8.7 6.5 12 6.5s6.2 1.8 8.5 5.5c-2.3 3.7-5.2 5.5-8.5 5.5S5.8 15.7 3.5 12zM12 8.9a3.1 3.1 0 1 0 0 6.2 3.1 3.1 0 1 0 0-6.2zM12 10.9a1.1 1.1 0 1 0 0 2.2 1.1 1.1 0 1 0 0-2.2z',
  // Registro de comidas: un plato con tenedor y cuchillo
  restaurant: 'M12 7a5 5 0 1 0 0 10 5 5 0 1 0 0-10zM12 8.8a3.2 3.2 0 1 0 0 6.4 3.2 3.2 0 1 0 0-6.4zM3.2 4.5v3.4a1.2 1.2 0 0 0 2.4 0V4.5M4.4 4.5v15M20.6 19.5v-15c-1.4.9-2.2 2.7-2.2 4.8v3.9h2.2',
  // Mente tranquila: una flor de loto sobre el agua
  leaf: 'M12 5.2C13.9 7.3 14.3 11.3 12 14.6 9.7 11.3 10.1 7.3 12 5.2zM11.4 14.6C8.4 14.4 6.2 12.4 5.6 8.9c2 .3 3.7 1.2 4.9 2.5M12.6 14.6c3-.2 5.2-2.2 5.8-5.7-2 .3-3.7 1.2-4.9 2.5M10.6 14.8c-3.4.7-6 -.3-7.2-2.3 1.3-.5 2.6-.5 3.8-.1M13.4 14.8c3.4.7 6-.3 7.2-2.3-1.3-.5-2.6-.5-3.8-.1M6.5 18h11M9 20.3h6',
};

// Si llegara un logro sin dibujo propio, el laurel
export const badgeEmblemPath = (icon: string) => BADGE_EMBLEM_PATHS[icon] ?? BADGE_EMBLEM_PATHS.trophy;
