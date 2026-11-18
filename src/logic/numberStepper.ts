// Las cuentas del «− cifra +» con teclado (src/components/fine/FineNumber.tsx), que usan la glucosa, el peso, la
// tensión y las mediciones de un solo valor (fundador, 2026-11-16: «me quedo con +- y que se pueda introducir con
// teclado»). Sin React Native, para probarlo con vitest. Los pasos se cuentan en unidades enteras del último
// decimal (décimas, centésimas) para no arrastrar errores de coma flotante (0,1 + 0,2).

export type NumberBounds = { min: number; max: number; decimals?: number };

const scaleOf = (decimals = 0) => 10 ** decimals;

// Redondeada a los decimales que se enseñan
export function roundTo(v: number, decimals = 0): number {
  const s = scaleOf(decimals);
  return Math.round(v * s) / s;
}

// Dentro de los límites y con sus decimales
export function clampNumber(v: number, { min, max, decimals = 0 }: NumberBounds): number {
  return roundTo(Math.min(max, Math.max(min, v)), decimals);
}

// Un toque en − o + (dir −1 o 1). Con `fastStep` (al dejarlo pulsado un rato) salta a los múltiplos de ese paso
// (91 → 95 → 100 → 105…): se llega antes a la cifra y se acaba de ajustar con toques sueltos
export function stepNumber(value: number, dir: 1 | -1, step: number, bounds: NumberBounds, fastStep?: number): number {
  const s = scaleOf(bounds.decimals);
  const v = Math.round(value * s);
  const small = Math.max(1, Math.round(step * s));
  const big = fastStep ? Math.round(fastStep * s) : 0;
  const next = big > small ? (dir > 0 ? (Math.floor(v / big) + 1) * big : (Math.ceil(v / big) - 1) * big) : v + dir * small;
  return clampNumber(next / s, bounds);
}

// Cuántas cifras puede tener la parte entera (409 → 3): no se deja escribir más
export const wholeDigits = (max: number) => String(Math.floor(Math.abs(max))).length;

// Lo que se va escribiendo: solo cifras y, si hay decimales, una coma o un punto (el que salga en el teclado)
// con hasta `decimals` cifras detrás
export function cleanNumberText(text: string, decimals = 0, maxWhole = 4): string {
  const raw = text.replace(/[^\d.,]/g, '');
  if (!decimals) return raw.replace(/[.,]/g, '').slice(0, maxWhole);
  const i = raw.search(/[.,]/);
  if (i < 0) return raw.slice(0, maxWhole);
  const frac = raw.slice(i + 1).replace(/[.,]/g, '').slice(0, decimals);
  return `${raw.slice(0, i).slice(0, maxWhole)}${raw[i]}${frac}`;
}

// La cifra escrita, con coma o con punto; null si aún no hay ninguna
export function parseNumberText(text: string): number | null {
  const n = parseFloat(text.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

// Lo escrito: `value`, lo que vale dentro de los límites (null si no hay cifra), e `inRange`, si cabe tal cual
export function readDraft(text: string, bounds: NumberBounds): { value: number | null; inRange: boolean } {
  const n = parseNumberText(text);
  if (n == null) return { value: null, inRange: false };
  const r = roundTo(n, bounds.decimals);
  return { value: clampNumber(r, bounds), inRange: r >= bounds.min && r <= bounds.max };
}

// ¿Se sale ya sin remedio? Al escribir 140 se pasa por «1» y «14», que aún no valen pero pueden acabar valiendo:
// eso no se avisa. Sí lo que pasa del máximo, o lo que se queda corto y ya no admite más cifras enteras (lleva la
// coma o tiene tantas cifras como el máximo)
export function cannotFit(text: string, bounds: NumberBounds): boolean {
  const n = parseNumberText(text);
  if (n == null) return false;
  const r = roundTo(n, bounds.decimals);
  if (r > bounds.max) return true;
  if (r >= bounds.min) return false;
  const hasSep = /[.,]/.test(text);
  const whole = text.split(/[.,]/)[0].replace(/\D/g, '');
  return hasSep || whole.length >= wholeDigits(bounds.max);
}
