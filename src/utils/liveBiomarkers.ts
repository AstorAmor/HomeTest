import { mockBiomarkers, Biomarker } from '@/data/mockData';
import { getGlucoseEntries, glucoseRepository } from '@/data/glucoseRepository';
import { bloodPressureRepository, getBloodPressureEntries } from '@/data/bloodPressureRepository';
import { cholesterolRepository } from '@/data/cholesterolRepository';
import { cortisolRepository } from '@/data/cortisolRepository';
import { showSamples } from '@/data/dataMode';
import { LabUpload, labUploadRepository } from '@/data/labUploads';
import { labValuesFrom } from '@/data/labUploadValues';
import { readCache } from '@/data/readCache';
import { GlucoseEntry } from '@/types/glucose';
import { BloodPressureEntry } from '@/types/bloodPressure';
import { SimpleMetricEntry } from '@/types/simpleMetric';

function sortedAsc<T extends { fecha: string }>(entries: T[]): T[] {
  return [...entries].sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());
}

// Sustituye cada biomarcador mock por datos reales del dispositivo cuando
// existen (última medición + histórico para la mini-gráfica). Si un
// marcador todavía no tiene ningún registro guardado, mantiene el mock
// como demo para no dejar la pantalla vacía (en una cuenta real, no: sale vacío, "—").
const unmeasured = (mock: Biomarker): Biomarker => ({ ...mock, valor: '—', status: 'none', statusLabel: 'Tap to log', history: [] });

// Un dato propio: sin juicio (el color del ejemplo no vale para tus datos), con su fecha y de dónde sale
const own = (latest: { id: string; fecha: string }) => ({
  status: 'none' as const,
  statusLabel: 'Latest reading',
  fecha: latest.fecha,
  fromLab: latest.id.startsWith('lab:'),
});

interface BiomarkerSources {
  glucoseLogs: GlucoseEntry[];
  bloodPressure: BloodPressureEntry[];
  cholesterolLogs: SimpleMetricEntry[];
  cortisolLogs: SimpleMetricEntry[];
  uploads: LabUpload[];
}

// Lo último leído de la cuenta, sin esperar a la red (undefined si falta algo o en la demo)
function peekSources(): BiomarkerSources | undefined {
  const glucoseLogs = glucoseRepository.peek();
  const bloodPressure = bloodPressureRepository.peek();
  const cholesterolLogs = cholesterolRepository.peek();
  const cortisolLogs = cortisolRepository.peek();
  const uploads = labUploadRepository.peek();
  if (!glucoseLogs || !bloodPressure || !cholesterolLogs || !cortisolLogs || !uploads) return undefined;
  return { glucoseLogs, bloodPressure, cholesterolLogs, cortisolLogs, uploads };
}

// Con lo último leído (fundador, 2026-11-17: «las medidas tardan en cargar»), Hoy pinta el azúcar y la tensión al
// momento y los refresca detrás. Se calcula una vez por cambio de la caché (Hoy lo pide en cada render).
let initialMemo: { version: number; samples: boolean; list: Biomarker[] } | null = null;
export const initialBiomarkers = (): Biomarker[] => {
  const samples = showSamples();
  const version = readCache.version();
  if (initialMemo && initialMemo.version === version && initialMemo.samples === samples) return initialMemo.list;
  const src = peekSources();
  const list = src ? biomarkersFrom(src) : samples ? mockBiomarkers : mockBiomarkers.map(unmeasured);
  initialMemo = { version, samples, list };
  return list;
};

export async function getLiveBiomarkers(): Promise<Biomarker[]> {
  const [glucoseLogs, bloodPressure, cholesterolLogs, cortisolLogs, uploads] = await Promise.all([
    getGlucoseEntries(),
    getBloodPressureEntries(),
    cholesterolRepository.getAll(),
    cortisolRepository.getAll(),
    labUploadRepository.getAll().catch(() => []),
  ]);
  return biomarkersFrom({ glucoseLogs, bloodPressure, cholesterolLogs, cortisolLogs, uploads });
}

function biomarkersFrom({ glucoseLogs, bloodPressure, cholesterolLogs, cortisolLogs, uploads }: BiomarkerSources): Biomarker[] {
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
        ...own(latest),
      };
    }

    if (mock.id === 'blood_pressure' && bloodPressure.length > 0) {
      const asc = sortedAsc(bloodPressure);
      const latest = asc[asc.length - 1];
      return {
        ...mock,
        valor: `${latest.systolic}/${latest.diastolic}`,
        history: asc.slice(-6).map((e) => e.systolic),
        ...own(latest),
      };
    }

    if (mock.id === 'cholesterol' && cholesterol.length > 0) {
      const asc = sortedAsc(cholesterol);
      const latest = asc[asc.length - 1];
      return {
        ...mock,
        valor: String(latest.valor),
        history: asc.slice(-6).map((e) => e.valor),
        ...own(latest),
      };
    }

    if (mock.id === 'cortisol' && cortisol.length > 0) {
      const asc = sortedAsc(cortisol);
      const latest = asc[asc.length - 1];
      return {
        ...mock,
        valor: String(latest.valor),
        history: asc.slice(-6).map((e) => e.valor),
        ...own(latest),
      };
    }

    return showSamples() ? mock : unmeasured(mock);
  });
}
