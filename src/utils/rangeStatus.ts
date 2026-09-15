export type RangeStatus = 'en_rango' | 'por_debajo' | 'por_encima' | 'sin_rango';

export function getRangeStatus(
  valor: number,
  min: number | null,
  max: number | null
): RangeStatus {
  if (min === null || max === null) return 'sin_rango';
  if (valor < min) return 'por_debajo';
  if (valor > max) return 'por_encima';
  return 'en_rango';
}

export const RANGE_STATUS_LABEL: Record<RangeStatus, string> = {
  en_rango: 'In range',
  por_debajo: 'Below range',
  por_encima: 'Above range',
  sin_rango: 'No reference',
};
