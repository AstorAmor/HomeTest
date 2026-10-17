import { mockBiomarkers, Biomarker } from '@/data/mockData';
import { getGlucoseEntries } from '@/data/glucoseRepository';
import { getBloodPressureEntries } from '@/data/bloodPressureRepository';
import { cholesterolRepository } from '@/data/cholesterolRepository';
import { cortisolRepository } from '@/data/cortisolRepository';
import { showSamples } from '@/data/dataMode';
import { labUploadRepository } from '@/data/labUploads';
import { labValuesFrom } from '@/data/labUploadValues';

function sortedAsc<T extends { fecha: string }>(entries: T[]): T[] {
  return [...entries].sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
}

// Sustituye cada biomarcador mock por datos reales del dispositivo cuando
// existen (última medición + histórico para la mini-gráfica). Si un
// marcador todavía no tiene ningún registro guardado, mantiene el mock
// como demo para no dejar la pantalla vacía (en una cuenta real, no: sale vacío, "—").
const unmeasured = (mock: Biomarker): Biomarker => ({ ...mock, valor: '—', status: 'none', statusLabel: 'Tap to log', history: [] });

export const initialBiomarkers = (): Biomarker[] => (showSamples() ? mockBiomarkers : mockBiomarkers.map(unmeasured));

export async function getLiveBiomarkers(): Promise<Biomarker[]> {
  const [glucoseLogs, bloodPressure, cholesterolLogs, cortisolLogs, uploads] = await Promise.all([
    getGlucoseEntries(),
    getBloodPressureEntries(),
    cholesterolRepository.getAll(),
    cortisolRepository.getAll(),
    labUploadRepository.getAll().catch(() => []),
  ]);
  // Lo apuntado a mano más lo que traen las analíticas subidas
  const glucose = [...glucoseLogs, ...labValuesFrom(uploads, 'glucose')];
  const cholesterol = [...cholesterolLogs, ...labValuesFrom(uploads, 'total_cholesterol')];
  const cortisol = [...cortisolLogs, ...labValuesFrom(uploads, 'cortisol_am')];

  return mockBiomarkers.map((mock) => {
    if (mock.id === 'sugar' && glucose.length > 0) {
      const asc = sortedAsc(glucose);
      const latest = asc[asc.length - 1];
      return {
        ...mock,
        valor: String(latest.valor),
        history: asc.slice(-6).map((e) => e.valor),
        statusLabel: 'Latest reading',
      };
    }

    if (mock.id === 'blood_pressure' && bloodPressure.length > 0) {
      const asc = sortedAsc(bloodPressure);
      const latest = asc[asc.length - 1];
      return {
        ...mock,
        valor: `${latest.systolic}/${latest.diastolic}`,
        history: asc.slice(-6).map((e) => e.systolic),
        statusLabel: 'Latest reading',
      };
    }

    if (mock.id === 'cholesterol' && cholesterol.length > 0) {
      const asc = sortedAsc(cholesterol);
      const latest = asc[asc.length - 1];
      return {
        ...mock,
        valor: String(latest.valor),
        history: asc.slice(-6).map((e) => e.valor),
        statusLabel: 'Latest reading',
      };
    }

    if (mock.id === 'cortisol' && cortisol.length > 0) {
      const asc = sortedAsc(cortisol);
      const latest = asc[asc.length - 1];
      return {
        ...mock,
        valor: String(latest.valor),
        history: asc.slice(-6).map((e) => e.valor),
        statusLabel: 'Latest reading',
      };
    }

    return showSamples() ? mock : unmeasured(mock);
  });
}
