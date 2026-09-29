import { getCurrentUserId, isRemoteActive, supabase } from '@/lib/supabase';
import { compressPhoto } from '@/utils/imageUpload';

// Categorías que un paciente puede compartir. Deben coincidir con el CHECK de
// data_shares.scopes en supabase/migrations/..._professional_sharing.sql.
export type ShareScope =
  | 'profile'
  | 'lab_reports'
  | 'glucose'
  | 'blood_pressure'
  | 'metrics'
  | 'cycle'
  | 'wellbeing'
  | 'activity'
  | 'nutrition'
  | 'wearables';

export const SHARE_SCOPES: { id: ShareScope; label: string; description: string; icon: string }[] = [
  { id: 'lab_reports', label: 'Lab results', description: 'Your blood test reports', icon: 'flask-outline' },
  { id: 'glucose', label: 'Glucose', description: 'Glucose readings you log', icon: 'water-outline' },
  { id: 'blood_pressure', label: 'Blood pressure', description: 'Blood pressure and pulse readings', icon: 'speedometer-outline' },
  { id: 'metrics', label: 'Other biomarkers', description: 'Cholesterol, cortisol and similar', icon: 'analytics-outline' },
  { id: 'cycle', label: 'Menstrual cycle', description: 'Period start dates and predictions', icon: 'rose-outline' },
  { id: 'wellbeing', label: 'Mood & check-ins', description: 'Sleep, energy, mood and diary notes', icon: 'happy-outline' },
  { id: 'activity', label: 'Activity & workouts', description: 'Workouts you log', icon: 'barbell-outline' },
  { id: 'nutrition', label: 'Nutrition', description: 'Meals and meal photos', icon: 'nutrition-outline' },
  { id: 'wearables', label: 'Wearables', description: 'Steps, sleep, heart rate, HRV, temperature', icon: 'watch-outline' },
  { id: 'profile', label: 'Profile & goals', description: 'Age, sex, height, weight, habits and goals', icon: 'person-outline' },
];

export const scopeLabel = (id: string) => SHARE_SCOPES.find((s) => s.id === id)?.label ?? id;

export type ProfessionalRole = 'doctor' | 'midwife' | 'dietitian' | 'trainer' | 'physio' | 'geneticist';

export const PROFESSIONAL_ROLES: { id: ProfessionalRole; label: string }[] = [
  { id: 'doctor', label: 'Doctor' },
  { id: 'midwife', label: 'Midwife' },
  { id: 'dietitian', label: 'Dietitian' },
  { id: 'trainer', label: 'Personal trainer' },
  { id: 'physio', label: 'Physiotherapist' },
  { id: 'geneticist', label: 'Geneticist' },
];

export const roleLabel = (id: string) => PROFESSIONAL_ROLES.find((r) => r.id === id)?.label ?? id;

export type Modality = 'online' | 'in_person' | 'home_visit';
export type RateStatus = 'none' | 'pending' | 'approved' | 'rejected';

export const MODALITIES: { id: Modality; label: string }[] = [
  { id: 'online', label: 'Online' },
  { id: 'in_person', label: 'In person' },
  { id: 'home_visit', label: 'Home visits' },
];

export const LANGUAGES = ['Spanish', 'English', 'Catalan', 'Basque', 'Galician', 'French', 'German', 'Italian', 'Portuguese'];

export interface ProfessionalAccount {
  id: string;
  displayName: string;
  role: ProfessionalRole;
  specialty: string | null;
  licenseNumber: string | null;
  licenseCollege: string | null;
  bio: string | null;
  city: string | null;
  languages: string[];
  modalities: Modality[];
  yearsExperience: number | null;
  photoUrl: string | null;
  hourlyRateEur: number | null; // aprobada por HomeTest (lo que ven los pacientes)
  // Solo visibles para el propio profesional y los admins:
  hourlyRateRequestedEur?: number | null;
  rateStatus?: RateStatus;
  reviewNote?: string | null;
  verified: boolean;
}

// Campos que el profesional puede editar (la BD rechaza el resto).
export interface ProfessionalProfileInput {
  displayName: string;
  role: ProfessionalRole;
  specialty?: string | null;
  licenseNumber?: string | null;
  licenseCollege?: string | null;
  bio?: string | null;
  city?: string | null;
  languages?: string[];
  modalities?: Modality[];
  yearsExperience?: number | null;
  hourlyRateRequestedEur?: number | null;
}

// Columnas públicas del directorio (coinciden con el GRANT SELECT de la migración).
const PUBLIC_COLUMNS =
  'id, display_name, role, specialty, license_number, license_college, bio, city, languages, modalities, years_experience, photo_path, hourly_rate_eur, verified_at, updated_at';

export interface DataShare {
  id: string;
  professionalId: string;
  professionalName: string;
  professionalRole: string;
  scopes: ShareScope[];
  expiresAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

export interface SharedPatient {
  shareId: string;
  patientId: string;
  patientName: string | null;
  scopes: ShareScope[];
  expiresAt: string | null;
  sharedAt: string;
}

const fail = (error: { message: string } | null) => {
  if (error) throw new Error(error.message);
};

// URL pública de la foto; ?v= evita que se quede en caché la anterior tras cambiarla.
const photoUrlFor = (path: string | null, version?: string | null) => {
  if (!path || !supabase) return null;
  const url = supabase.storage.from('professional-photos').getPublicUrl(path).data.publicUrl;
  return version ? `${url}?v=${encodeURIComponent(version)}` : url;
};

const toProfessional = (r: any): ProfessionalAccount => ({
  id: r.id,
  displayName: r.display_name,
  role: r.role,
  specialty: r.specialty,
  licenseNumber: r.license_number,
  licenseCollege: r.license_college ?? null,
  bio: r.bio ?? null,
  city: r.city ?? null,
  languages: r.languages ?? [],
  modalities: r.modalities ?? [],
  yearsExperience: r.years_experience ?? null,
  photoUrl: photoUrlFor(r.photo_path ?? null, r.updated_at),
  hourlyRateEur: r.hourly_rate_eur != null ? Number(r.hourly_rate_eur) : null,
  hourlyRateRequestedEur:
    r.hourly_rate_requested_eur !== undefined
      ? r.hourly_rate_requested_eur != null
        ? Number(r.hourly_rate_requested_eur)
        : null
      : undefined,
  rateStatus: r.rate_status,
  reviewNote: r.review_note,
  verified: !!r.verified_at,
});

const toRow = (p: ProfessionalProfileInput) => ({
  display_name: p.displayName,
  role: p.role,
  specialty: p.specialty || null,
  license_number: p.licenseNumber || null,
  license_college: p.licenseCollege || null,
  bio: p.bio || null,
  city: p.city || null,
  languages: p.languages ?? [],
  modalities: p.modalities ?? [],
  years_experience: p.yearsExperience ?? null,
  hourly_rate_requested_eur: p.hourlyRateRequestedEur ?? null,
});

// ---------------------------------------------------------------------------
// Cuenta profesional
// ---------------------------------------------------------------------------

// Ficha profesional completa del usuario actual, o null si es paciente.
export async function getMyProfessionalAccount(): Promise<ProfessionalAccount | null> {
  if (!isRemoteActive()) return null;
  const { data, error } = await supabase!.rpc('my_professional_profile');
  fail(error);
  const row = (data ?? [])[0];
  return row ? toProfessional(row) : null;
}

// Alta como profesional (queda pendiente de verificación por HomeTest).
export async function registerAsProfessional(input: ProfessionalProfileInput): Promise<void> {
  const { error } = await supabase!.from('professionals').insert({ id: getCurrentUserId()!, ...toRow(input) });
  fail(error);
}

export async function updateMyProfessionalProfile(input: ProfessionalProfileInput): Promise<void> {
  const { error } = await supabase!.from('professionals').update(toRow(input)).eq('id', getCurrentUserId()!);
  fail(error);
}

// Foto de perfil: se comprime a 512 px (~30-60 KB) y se sube al bucket público.
export async function uploadMyProfessionalPhoto(localUri: string): Promise<void> {
  const userId = getCurrentUserId()!;
  const compressed = await compressPhoto(localUri, 512);
  const bytes = await (await fetch(compressed)).arrayBuffer();
  const path = `${userId}/avatar.jpg`;
  const { error } = await supabase!.storage
    .from('professional-photos')
    .upload(path, bytes, { contentType: 'image/jpeg', upsert: true });
  fail(error);
  const { error: updateError } = await supabase!.from('professionals').update({ photo_path: path }).eq('id', userId);
  fail(updateError);
}

// Directorio: profesionales verificados con los que se puede compartir.
export async function listVerifiedProfessionals(): Promise<ProfessionalAccount[]> {
  const { data, error } = await supabase!
    .from('professionals')
    .select(PUBLIC_COLUMNS)
    .not('verified_at', 'is', null)
    .neq('id', getCurrentUserId()!)
    .order('display_name');
  fail(error);
  return (data ?? []).map(toProfessional);
}

// ---------------------------------------------------------------------------
// Admin de HomeTest: verificación de profesionales y supervisión de tarifas
// ---------------------------------------------------------------------------

export async function amIAdmin(): Promise<boolean> {
  if (!isRemoteActive()) return false;
  const { data, error } = await supabase!.rpc('is_admin');
  if (error) return false;
  return data === true;
}

export async function adminListProfessionals(): Promise<ProfessionalAccount[]> {
  const { data, error } = await supabase!.rpc('admin_list_professionals');
  fail(error);
  return (data ?? []).map(toProfessional);
}

export async function adminReviewProfessional(
  professionalId: string,
  decision: { verified?: boolean; rate?: 'approve' | 'reject'; note?: string }
): Promise<void> {
  const { error } = await supabase!.rpc('admin_review_professional', {
    p_professional_id: professionalId,
    p_verified: decision.verified ?? null,
    p_rate_decision: decision.rate ?? null,
    p_note: decision.note ?? null,
  });
  fail(error);
}

// ---------------------------------------------------------------------------
// Lado paciente: crear, listar y revocar permisos
// ---------------------------------------------------------------------------

export async function listMyShares(): Promise<DataShare[]> {
  const { data, error } = await supabase!
    .from('data_shares')
    .select('*, professionals(display_name, role)')
    .eq('patient_id', getCurrentUserId()!)
    .order('created_at', { ascending: false });
  fail(error);
  return (data ?? []).map((r: any) => ({
    id: r.id,
    professionalId: r.professional_id,
    professionalName: r.professionals?.display_name ?? 'Professional',
    professionalRole: r.professionals?.role ?? '',
    scopes: r.scopes,
    expiresAt: r.expires_at,
    revokedAt: r.revoked_at,
    createdAt: r.created_at,
  }));
}

export const isShareActive = (s: Pick<DataShare, 'revokedAt' | 'expiresAt'>) =>
  !s.revokedAt && (!s.expiresAt || new Date(s.expiresAt).getTime() > Date.now());

export async function createShare(professionalId: string, scopes: ShareScope[], expiresAt: string | null) {
  const { error } = await supabase!.from('data_shares').insert({
    professional_id: professionalId,
    scopes,
    expires_at: expiresAt,
  });
  fail(error);
}

export async function revokeShare(shareId: string) {
  const { error } = await supabase!
    .from('data_shares')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', shareId)
    .eq('patient_id', getCurrentUserId()!);
  fail(error);
}

// ---------------------------------------------------------------------------
// Lado profesional: pacientes que le comparten y sus datos (solo lectura)
// ---------------------------------------------------------------------------

export async function listSharedPatients(): Promise<SharedPatient[]> {
  const { data, error } = await supabase!.rpc('my_shared_patients');
  fail(error);
  return (data ?? []).map((r: any) => ({
    shareId: r.share_id,
    patientId: r.patient_id,
    patientName: r.patient_name,
    scopes: r.scopes,
    expiresAt: r.expires_at,
    sharedAt: r.shared_at,
  }));
}

// Tabla y columna de fecha por categoría. RLS solo devuelve filas si el permiso sigue activo.
const SCOPE_TABLES: Partial<Record<ShareScope, { table: string; dateColumn: string }[]>> = {
  lab_reports: [{ table: 'lab_reports', dateColumn: 'test_date' }],
  glucose: [{ table: 'glucose_readings', dateColumn: 'measured_at' }],
  blood_pressure: [{ table: 'blood_pressure_readings', dateColumn: 'measured_at' }],
  metrics: [{ table: 'metric_readings', dateColumn: 'measured_at' }],
  cycle: [{ table: 'cycle_starts', dateColumn: 'started_at' }],
  wellbeing: [
    { table: 'check_ins', dateColumn: 'checked_in_at' },
    { table: 'ai_logs', dateColumn: 'logged_at' },
  ],
  activity: [{ table: 'workouts', dateColumn: 'performed_at' }],
  nutrition: [{ table: 'meals', dateColumn: 'eaten_at' }],
  wearables: [{ table: 'wearable_daily', dateColumn: 'date' }],
};

export type PatientData = Record<string, any[]> & { profile?: any };

// Datos de un paciente para las categorías compartidas (máx. 60 filas recientes por tabla).
export async function fetchSharedPatientData(patientId: string, scopes: ShareScope[]): Promise<PatientData> {
  const out: PatientData = {};
  const jobs: Promise<void>[] = [];

  if (scopes.includes('profile')) {
    jobs.push(
      (async () => {
        const { data, error } = await supabase!.from('profiles').select('*').eq('id', patientId).maybeSingle();
        fail(error);
        out.profile = data;
      })()
    );
  }

  for (const scope of scopes) {
    for (const { table, dateColumn } of SCOPE_TABLES[scope] ?? []) {
      jobs.push(
        (async () => {
          const { data, error } = await supabase!
            .from(table)
            .select('*')
            .eq('user_id', patientId)
            .order(dateColumn, { ascending: false })
            .limit(60);
          fail(error);
          out[table] = data ?? [];
        })()
      );
    }
  }

  await Promise.all(jobs);
  return out;
}
