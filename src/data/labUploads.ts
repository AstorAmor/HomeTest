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

// --- Originales (la foto o el PDF que se subió) ---------------------------------------------
// En el bucket privado lab-files (políticas del esquema inicial: cada usuario solo lee y escribe en
// su carpeta): <usuario>/uploads/<id de la subida>/<n>.jpg|pdf. Sin tabla: se listan por carpeta.
// Las subidas anteriores al 2026-10-21 no los guardaron. En la demo (sin cuenta) no se guardan.
const FILES_BUCKET = 'lab-files';
const filesPrefix = (uploadId: string) => `${getCurrentUserId()}/uploads/${uploadId}`;

export interface OriginalPage {
  uri: string;
  mimeType: string;
}

export interface OriginalFile {
  name: string;
  url: string; // firmada, 1 h
  kind: 'image' | 'pdf';
}

export async function saveOriginals(uploadId: string, pages: OriginalPage[]): Promise<void> {
  if (!isRemoteActive() || !supabase || !pages.length) return;
  for (const [i, p] of pages.entries()) {
    const pdf = p.mimeType === 'application/pdf';
    const bytes = await (await fetch(p.uri)).arrayBuffer();
    const { error } = await supabase.storage
      .from(FILES_BUCKET)
      .upload(`${filesPrefix(uploadId)}/${i + 1}.${pdf ? 'pdf' : 'jpg'}`, bytes, { contentType: pdf ? 'application/pdf' : 'image/jpeg', upsert: true });
    if (error) throw new Error(error.message);
  }
}

export async function originalFiles(uploadId: string): Promise<OriginalFile[]> {
  if (!isRemoteActive() || !supabase) return [];
  const { data, error } = await supabase.storage.from(FILES_BUCKET).list(filesPrefix(uploadId));
  if (error || !data?.length) return [];
  const names = data.map((f) => f.name).sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
  const out: OriginalFile[] = [];
  for (const name of names) {
    const { data: signed } = await supabase.storage.from(FILES_BUCKET).createSignedUrl(`${filesPrefix(uploadId)}/${name}`, 3600);
    if (signed?.signedUrl) out.push({ name, url: signed.signedUrl, kind: name.endsWith('.pdf') ? 'pdf' : 'image' });
  }
  return out;
}

export async function hasOriginals(uploadId: string): Promise<boolean> {
  if (!isRemoteActive() || !supabase) return false;
  const { data } = await supabase.storage.from(FILES_BUCKET).list(filesPrefix(uploadId), { limit: 1 });
  return !!data?.length;
}
