import { labUploadRepository } from './labUploads';
import { LabMarker, LabValue, labValuesFrom } from '@/logic/labUploadValues';
import { t } from '@/i18n';
import type { GenericMetricEntry } from '@/screens/SimpleMetricDetailScreen';

// Versión con datos de src/logic/labUploadValues.ts: lee las analíticas subidas de la cuenta.
export { labValuesFrom } from '@/logic/labUploadValues';
export type { LabMarker, LabValue } from '@/logic/labUploadValues';

export async function labValues(marker: LabMarker): Promise<LabValue[]> {
  return labValuesFrom(await labUploadRepository.getAll().catch(() => []), marker);
}

export const LAB_VALUE_LABEL = () => t('Lab test');

// Lo que trae cada analítica subida, como filas de la ficha de su medición (no se edita allí: abre la analítica)
const labRows = (lab: LabValue[]): GenericMetricEntry[] =>
  lab.map((l) => ({ id: l.id, valor: l.valor, unidad: l.unidad, fecha: l.fecha, extra: LAB_VALUE_LABEL(), uploadId: l.uploadId }));

// Lo apuntado a mano de un marcador (azúcar, colesterol total, cortisol) más lo de las analíticas subidas. Las dos
// lecturas a la vez: antes iban una detrás de otra (fundador, 2026-11-17: «las medidas tardan en cargar»)
export async function withLabValues(own: Promise<GenericMetricEntry[]>, marker: LabMarker): Promise<GenericMetricEntry[]> {
  const [rows, lab] = await Promise.all([own, labValues(marker)]);
  return rows.concat(labRows(lab));
}

// Lo mismo con lo último leído, sin esperar a la red (undefined si falta algo por leer): para pintar al momento
export function peekWithLabValues(own: GenericMetricEntry[] | undefined, marker: LabMarker): GenericMetricEntry[] | undefined {
  const uploads = labUploadRepository.peek();
  return own && uploads ? own.concat(labRows(labValuesFrom(uploads, marker))) : undefined;
}
