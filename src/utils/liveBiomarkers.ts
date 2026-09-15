import { mockBiomarkers, Biomarker } from '@/data/mockData';
import { getGlucoseEntries } from '@/data/glucoseRepository';
import { getBloodPressureEntries } from '@/data/bloodPressureRepository';
import { cholesterolRepository } from '@/data/cholesterolRepository';
import { cortisolRepository } from '@/data/cortisolRepository';

function sortedAsc<T extends { fecha: string }>(entries: T[]): T[] {
  return [...entries].sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
}

// Sustituye cada biomarcador mock por datos reales del dispositivo cuando
// existen (última medición + histórico para la mini-gráfica). Si un
// marcador todavía no tiene ningún registro guardado, mantiene el mock
// como demo para no dejar la pantalla vacía.
export async function getLiveBiomarkers(): Promise<Biomarker[]> {
  const [glucose, bloodPressure, cholesterol, cortisol] = await Promise.all([
    getGlucoseEntries(),
    getBloodPressureEntries(),
    cholesterolRepository.getAll(),
    cortisolRepository.getAll(),
  ]);

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

    return mock;
  });
}
