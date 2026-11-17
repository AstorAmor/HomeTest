// La figura de «Medidas» (BodyHologram): dónde va cada sitio sobre el dibujo del cuerpo y cuánto se acerca la
// figura al elegirlo. El dibujo está en src/components/BodyFigureArt.tsx: desde el 2026-11-16, las cuatro figuras
// del fundador (hombre y mujer, de frente y de espaldas; 360 × 784, el cuerpo centrado y los pies abajo, las cuatro
// con el mismo encuadre). Lo de abajo va en sus coordenadas (el SVG de las marcas usa ese mismo `w` × `h` de viewBox).
// Los sitios son los de la antropometría (ISAK; pliegues de Jackson-Pollock): brazo, muslo, pantorrilla y todos
// los pliegues se toman en el lado derecho de la persona, que de frente queda a la izquierda de la pantalla y de
// espaldas, a la derecha. Los pliegues que se toman por detrás (tríceps y subescapular) van en la figura de
// espaldas: al elegirlos, la figura se da la vuelta (fundador, 2026-11-16: «para la pinza de tríceps y espalda, dale
// la vuelta»).
// Para cambiar las figuras: sustituir las imágenes de BodyFigureArt, poner aquí su `w` y `h` y volver a colocar
// las marcas de cada sitio, comprobándolas pintadas encima de la imagen.
import type { FoldMark, TapeMark, Zone } from './bodyMeasures';

export type FigureSex = 'male' | 'female';
export type FigureSide = 'front' | 'back';

export interface BodyFigure {
  sex: FigureSex;
  w: number;
  h: number;
  // Por kind; cada marca, en las coordenadas de la figura de su lado (sideOf)
  marks: Record<string, TapeMark | FoldMark>;
}

// Los pliegues que se toman por detrás: se marcan en la figura de espaldas
export const BACK_KINDS = ['skinfold_triceps', 'skinfold_subscapular'];
export const sideOf = (kind: string | null | undefined): FigureSide => (kind && BACK_KINDS.includes(kind) ? 'back' : 'front');

// Cuánto se acerca la figura a cada sitio (además, BodyHologram no pasa de zoomCap para que la imagen no se vea
// borrosa)
export const ZOOM: Record<string, number> = {
  tape_neck: 2,
  tape_chest: 1.6,
  tape_waist: 1.7,
  tape_hip: 1.5,
  tape_arm: 2,
  tape_thigh: 1.8,
  tape_calf: 1.9,
  skinfold_chest: 1.9,
  skinfold_triceps: 1.9,
  skinfold_biceps: 1.9,
  skinfold_subscapular: 1.9,
  skinfold_suprailiac: 1.9,
  skinfold_abdominal: 1.9,
  skinfold_thigh: 1.9,
};

// Cinta: centro y media anchura de la vuelta, ceñida al cuerpo: cuello; pecho (en la mujer, el busto); cintura,
// lo más estrecho entre las costillas y la cadera; cadera, lo más ancho de los glúteos; brazo, a media altura entre
// el hombro y el codo; muslo, a medio muslo; pantorrilla, en lo más ancho.
// Pinza: el punto y la dirección del pliegue en grados (0 horizontal, 90 vertical): pectoral, en diagonal entre
// la axila y el pezón; bíceps, vertical a media altura del brazo; suprailíaco, en diagonal sobre la cresta ilíaca;
// abdominal, vertical a un lado del ombligo; muslo, vertical en la parte de delante a medio muslo. De espaldas:
// tríceps, vertical a media altura del brazo, y subescapular, bajo la punta de la escápula en diagonal hacia fuera.
const MALE_MARKS: Record<string, TapeMark | FoldMark> = {
  tape_neck: { x: 181, y: 109, half: 27 },
  tape_chest: { x: 181, y: 197, half: 72 },
  tape_waist: { x: 182, y: 268, half: 57 },
  tape_hip: { x: 182, y: 378, half: 78 },
  tape_arm: { x: 89, y: 212, half: 21 },
  tape_thigh: { x: 138, y: 465, half: 31 },
  tape_calf: { x: 127, y: 572, half: 28 },
  skinfold_chest: { x: 132, y: 200, angle: 50 },
  skinfold_biceps: { x: 91, y: 212, angle: 90 },
  skinfold_suprailiac: { x: 134, y: 318, angle: 40 },
  skinfold_abdominal: { x: 167, y: 292, angle: 90 },
  skinfold_thigh: { x: 138, y: 465, angle: 90 },
  // De espaldas
  skinfold_triceps: { x: 277, y: 212, angle: 90 },
  skinfold_subscapular: { x: 216, y: 236, angle: 45 },
};

const FEMALE_MARKS: Record<string, TapeMark | FoldMark> = {
  tape_neck: { x: 181, y: 122, half: 20 },
  tape_chest: { x: 181, y: 222, half: 57 },
  tape_waist: { x: 182, y: 272, half: 42 },
  tape_hip: { x: 182, y: 378, half: 75 },
  tape_arm: { x: 110, y: 212, half: 15 },
  tape_thigh: { x: 148, y: 462, half: 28 },
  tape_calf: { x: 146, y: 578, half: 25 },
  skinfold_chest: { x: 134, y: 214, angle: 50 },
  skinfold_biceps: { x: 111, y: 212, angle: 90 },
  skinfold_suprailiac: { x: 140, y: 316, angle: 40 },
  skinfold_abdominal: { x: 168, y: 300, angle: 90 },
  skinfold_thigh: { x: 148, y: 462, angle: 90 },
  // De espaldas
  skinfold_triceps: { x: 251, y: 214, angle: 90 },
  skinfold_subscapular: { x: 211, y: 236, angle: 45 },
};

export const FIGURES: Record<FigureSex, BodyFigure> = {
  male: { sex: 'male', w: 360, h: 784, marks: MALE_MARKS },
  female: { sex: 'female', w: 360, h: 784, marks: FEMALE_MARKS },
};

// La figura del sexo del perfil; si el perfil no dice masculino ni femenino, la de hombre
export const figureSexOf = (sex?: string | null): FigureSex => (sex === 'female' ? 'female' : 'male');

export const isTapeMark = (m: TapeMark | FoldMark): m is TapeMark => 'half' in m;

// A dónde se acerca la figura para un sitio (su marca en el centro), o null si no hay sitio
export function zoneOf(fig: BodyFigure, kind: string | null | undefined): Zone | null {
  const m = kind ? fig.marks[kind] : undefined;
  if (!m || !kind) return null;
  return { x: m.x, y: m.y, zoom: ZOOM[kind] ?? 1.8 };
}

// El zoom máximo para que la imagen no se vea borrosa: que un píxel de la imagen no ocupe más de unos 2 píxeles de
// la pantalla. `fit` es la escala de la figura entera en la caja (puntos por unidad de la figura) y `pixelRatio`,
// los píxeles por punto de la pantalla. Siempre deja acercarse algo
export const SHARP_MAX = 2;
export const zoomCap = (fit: number, pixelRatio: number): number =>
  fit > 0 && pixelRatio > 0 ? Math.max(1.3, SHARP_MAX / (fit * pixelRatio)) : 2;
