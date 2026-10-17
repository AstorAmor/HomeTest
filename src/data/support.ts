import { isRemoteActive, supabase } from '@/lib/supabase';
import { ShareScope } from '@/data/sharing';

// Lado de Soporte KUOVA: leer datos de un usuario que ha dado permiso (data_shares con
// grantee = 'support'). Todo pasa por funciones de la base de datos que exigen un motivo y
// dejan el acceso en support_access_log antes de devolver nada (..._support_access.sql).
// La cuenta de soporte no tiene ninguna otra forma de leer datos de salud.

export const MIN_REASON_LENGTH = 10;

export interface SupportGrant {
  shareId: string;
  patientId: string;
  patientName: string | null;
  patientEmail: string | null;
  scopes: ShareScope[];
  note: string | null;
  expiresAt: string;
  grantedAt: string;
}

export interface SupportFile {
  bucket: string;
  path: string;
  size: number | null;
  createdAt: string;
}

// Tablas de la categoría (filas tal cual) y, en análisis y nutrición, la lista de archivos.
export interface SupportReadResult {
  tables: Record<string, Record<string, unknown>[]>;
  files: SupportFile[];
}

const fail = (error: { message: string } | null) => {
  if (error) throw new Error(error.message);
};

export async function amISupportAgent(): Promise<boolean> {
  if (!isRemoteActive()) return false;
  const { data, error } = await supabase!.rpc('is_support_agent');
  if (error) return false;
  return data === true;
}

export async function supportListGrants(): Promise<SupportGrant[]> {
  const { data, error } = await supabase!.rpc('support_list_grants');
  fail(error);
  return (data ?? []).map((r: any) => ({
    shareId: r.share_id,
    patientId: r.patient_id,
    patientName: r.patient_name,
    patientEmail: r.patient_email,
    scopes: r.scopes,
    note: r.note,
    expiresAt: r.expires_at,
    grantedAt: r.granted_at,
  }));
}

export async function supportRead(shareId: string, scope: ShareScope, reason: string): Promise<SupportReadResult> {
  const { data, error } = await supabase!.rpc('support_read', { p_share_id: shareId, p_scope: scope, p_reason: reason });
  fail(error);
  const { files, ...tables } = (data ?? {}) as Record<string, any[]>;
  return {
    tables,
    files: (files ?? []).map((f: any) => ({
      bucket: f.bucket,
      path: f.path,
      size: f.size != null ? Number(f.size) : null,
      createdAt: f.created_at,
    })),
  };
}

// Registra la apertura y devuelve una URL firmada de 60 s (Storage solo la firma si el acceso
// quedó registrado en los últimos 5 minutos).
export async function supportOpenFile(shareId: string, file: SupportFile, reason: string): Promise<string> {
  const { error } = await supabase!.rpc('support_open_file', {
    p_share_id: shareId,
    p_bucket: file.bucket,
    p_path: file.path,
    p_reason: reason,
  });
  fail(error);
  const { data, error: urlError } = await supabase!.storage.from(file.bucket).createSignedUrl(file.path, 60);
  fail(urlError);
  return data!.signedUrl;
}
