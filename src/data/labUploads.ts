import AsyncStorage from '@react-native-async-storage/async-storage';
import { getCurrentUserId, isRemoteActive, supabase } from '@/lib/supabase';
import { ExtractedLabReport } from '@/types/labReport';

// Analíticas subidas por el usuario (Lab → Upload lab report). Con cuenta: tabla
// `lab_uploads`; en modo demo: en el móvil.

export interface LabUpload {
  id: string;
  labName: string | null;
  testDate: string | null; // YYYY-MM-DD
  data: ExtractedLabReport;
  createdAt: string;
}

const KEY = 'labUploads.v1';

// "12/09/2026", "2026-09-12" o null → YYYY-MM-DD
export function normalizeDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const iso = raw.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const eu = raw.match(/(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (eu) {
    const y = eu[3].length === 2 ? `20${eu[3]}` : eu[3];
    return `${y}-${eu[2].padStart(2, '0')}-${eu[1].padStart(2, '0')}`;
  }
  return null;
}

async function localAll(): Promise<LabUpload[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export const labUploadRepository = {
  async getAll(): Promise<LabUpload[]> {
    if (isRemoteActive() && supabase) {
      const { data, error } = await supabase
        .from('lab_uploads')
        .select('id, lab_name, test_date, data, created_at')
        .eq('user_id', getCurrentUserId())
        .order('created_at', { ascending: false });
      if (error) throw new Error(error.message);
      return (data ?? []).map((r) => ({ id: r.id, labName: r.lab_name, testDate: r.test_date, data: r.data, createdAt: r.created_at }));
    }
    return (await localAll()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async get(id: string): Promise<LabUpload | null> {
    return (await this.getAll()).find((u) => u.id === id) ?? null;
  },

  async save(report: ExtractedLabReport): Promise<LabUpload> {
    const labName = report.paciente?.laboratorio ?? null;
    const testDate = normalizeDate(report.paciente?.fecha_validacion ?? report.paciente?.fecha_recepcion);
    if (isRemoteActive() && supabase) {
      const { data, error } = await supabase
        .from('lab_uploads')
        .insert({ user_id: getCurrentUserId(), lab_name: labName, test_date: testDate, data: report })
        .select('id, created_at')
        .single();
      if (error || !data) throw new Error(error?.message ?? 'Could not save');
      return { id: data.id, labName, testDate, data: report, createdAt: data.created_at };
    }
    const upload: LabUpload = { id: `upload-${Date.now()}`, labName, testDate, data: report, createdAt: new Date().toISOString() };
    await AsyncStorage.setItem(KEY, JSON.stringify([upload, ...(await localAll())]));
    return upload;
  },
};
