import { num, t } from '@/i18n';

export type RangeStatus = 'en_rango' | 'por_debajo' | 'por_encima' | 'sin_rango';

// Dentro o fuera del rango del laboratorio. Muchos informes solo traen un límite ("< 200" en el
// colesterol, "> 40" en el HDL): con uno basta para decidir; sin ninguno, no hay referencia.
export function getRangeStatus(
  valor: number,
  min: number | null,
  max: number | null
): RangeStatus {
  if (min === null && max === null) return 'sin_rango';
  if (min !== null && valor < min) return 'por_debajo';
  if (max !== null && valor > max) return 'por_encima';
  return 'en_rango';
}

export const RANGE_STATUS_LABEL: Record<RangeStatus, string> = {
  en_rango: 'In range',
  por_debajo: 'Below range',
  por_encima: 'Above range',
  sin_rango: 'No reference',
};

// "70 – 110", "< 200" o "> 40" (sin unidad; un mínimo de 0 se enseña como "< máximo"); null si
// el informe no trae ningún límite
export function rangeText(min: number | null, max: number | null, format: (n: number) => string = (n) => num(n)): string | null {
  if (min !== null && max !== null && min > 0) return `${format(min)} – ${format(max)}`;
  if (max !== null) return `< ${format(max)}`;
  if (min !== null) return `> ${format(min)}`;
  return null;
}

export const rangeStatusLabel = (s: RangeStatus) => t(RANGE_STATUS_LABEL[s]);
