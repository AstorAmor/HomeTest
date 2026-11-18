import { getCurrentUserId, supabase } from '@/lib/supabase';

// Lecturas de metric_readings agrupadas (fundador, 2026-11-17: «las medidas tardan en cargar»). Peso, composición
// corporal, medidas, VO2max, fuerza de agarre, colesterol, cortisol, temperatura… viven en la misma tabla, cada uno
// con su `kind`, y cada repositorio la pedía por separado: la ficha del peso hacía 21 peticiones (4 de ellas una
// detrás de otra). Ahora lo que se pide en el mismo momento sale en UNA petición con `kind in (…)`, y a cada uno le
// llega lo suyo. Por páginas de 1000 filas (el tope de Supabase por petición), para no perder ninguna.

export const METRIC_COLUMNS = 'id, kind, value, unit, measured_at, created_at';
const PAGE = 1000;

type Row = Record<string, unknown> & { kind: string };
interface Waiter {
  resolve: (rows: Row[]) => void;
  reject: (e: unknown) => void;
}

let pending = new Map<string, Waiter[]>();
let scheduled = false;

async function fetchKinds(uid: string, kinds: string[]): Promise<Row[]> {
  const out: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    // Siempre filtrado por el propio usuario: con permisos de profesional, RLS también deja leer filas de otros
    const base = supabase!.from('metric_readings').select(METRIC_COLUMNS).eq('user_id', uid);
    const { data, error } = await (kinds.length === 1 ? base.eq('kind', kinds[0]) : base.in('kind', kinds))
      .order('measured_at', { ascending: false })
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as Row[];
    out.push(...rows);
    if (rows.length < PAGE) return out;
  }
}

async function flush() {
  scheduled = false;
  const batch = pending;
  pending = new Map();
  const kinds = [...batch.keys()];
  const uid = getCurrentUserId();
  try {
    if (!uid) throw new Error('Not signed in');
    const rows = await fetchKinds(uid, kinds);
    const byKind = new Map<string, Row[]>(kinds.map((k) => [k, []]));
    for (const r of rows) byKind.get(r.kind)?.push(r);
    for (const [kind, waiters] of batch) for (const w of waiters) w.resolve(byKind.get(kind) ?? []);
  } catch (e) {
    for (const waiters of batch.values()) for (const w of waiters) w.reject(e);
  }
}

// Las filas de un `kind` de metric_readings (las más recientes primero). Lo que se pida en el mismo momento
// (el mismo efecto, el mismo Promise.all) sale junto en una sola petición.
export function loadMetricKind(kind: string): Promise<Row[]> {
  return new Promise<Row[]>((resolve, reject) => {
    const list = pending.get(kind);
    if (list) list.push({ resolve, reject });
    else pending.set(kind, [{ resolve, reject }]);
    if (!scheduled) {
      scheduled = true;
      // Al acabar lo que se está ejecutando: así se juntan las llamadas de los efectos de una misma pantalla
      Promise.resolve().then(flush);
    }
  });
}
