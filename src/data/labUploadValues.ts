import { labUploadRepository } from './labUploads';
import { LabMarker, LabValue, labValuesFrom } from '@/logic/labUploadValues';
import { t } from '@/i18n';

// Versión con datos de src/logic/labUploadValues.ts: lee las analíticas subidas de la cuenta.
export { labValuesFrom } from '@/logic/labUploadValues';
export type { LabMarker, LabValue } from '@/logic/labUploadValues';

export async function labValues(marker: LabMarker): Promise<LabValue[]> {
  return labValuesFrom(await labUploadRepository.getAll().catch(() => []), marker);
}

export const LAB_VALUE_LABEL = () => t('Lab test');
