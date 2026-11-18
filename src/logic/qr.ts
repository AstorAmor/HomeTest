// Un QR como un solo trazo SVG (un cuadrado por módulo oscuro), para pintarlo con react-native-svg en
// la app, en la web y en la imagen que se comparte. toqr: codificador en JS puro (UTF-8, modo byte).
import { toQR } from 'toqr';

// Nivel de corrección H (30 %): todos los QR llevan en medio la K y «KUOVA HEALTH» (fundador,
// 2026-11-05), así que se tapan unos módulos a propósito y aún sobra margen para una pantalla rayada
// o una foto algo borrosa. En toqr: M = 0, L = 1, H = 2, Q = 3.
const EC_H = 2;

export interface QrShape {
  size: number; // módulos por lado (sin el margen blanco)
  path: string; // en unidades de módulo: de (0,0) a (size,size)
  // El hueco del centro para el logo, en módulos (sin ningún módulo oscuro dentro)
  hole: { x: number; y: number; w: number; h: number } | null;
}

// Como mucho un 7,5 % de los módulos (30 % de ancho × 25 % de alto), lejos de las esquinas: un lector
// lo recupera de sobra con el nivel H. Tamaño impar para que quede centrado en la cuadrícula.
const odd = (n: number) => {
  const r = Math.round(n);
  return r % 2 ? r : r + 1;
};
export const HOLE_W = 0.3;
export const HOLE_H = 0.25;

export function qrShape(text: string, opts: { hole?: boolean } = {}): QrShape {
  const cells = toQR(text, EC_H as never);
  const size = Math.round(Math.sqrt(cells.length));
  let hole: QrShape['hole'] = null;
  if (opts.hole) {
    const w = Math.min(odd(size * HOLE_W), size - 18); // nunca sobre las marcas de las esquinas
    const h = Math.min(odd(size * HOLE_H), size - 18);
    hole = { x: (size - w) / 2, y: (size - h) / 2, w, h };
  }
  const dark = (x: number, y: number) =>
    !!cells[y * size + x] && !(hole && x >= hole.x && x < hole.x + hole.w && y >= hole.y && y < hole.y + hole.h);
  let path = '';
  for (let y = 0; y < size; y++) {
    let x = 0;
    while (x < size) {
      if (!dark(x, y)) {
        x++;
        continue;
      }
      // Los módulos oscuros seguidos de una fila van en un solo rectángulo
      let run = 1;
      while (x + run < size && dark(x + run, y)) run++;
      path += `M${x} ${y}h${run}v1h${-run}z`;
      x += run;
    }
  }
  return { size, path, hole };
}

// Los módulos tal cual (para comprobar en los tests que el QR con el hueco se sigue leyendo)
export function qrCells(text: string): { size: number; cells: Uint8Array } {
  const cells = toQR(text, EC_H as never);
  return { size: Math.round(Math.sqrt(cells.length)), cells };
}
