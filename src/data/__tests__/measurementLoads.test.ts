import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Cuánto tardan en llegar los datos de las pantallas de mediciones con una cuenta real (fundador, 2026-11-17:
// «las medidas tardan en cargar»). Un Supabase de mentira cuenta las peticiones y simula la red del móvil: cada
// petición tarda RTT ms y Android (OkHttp) no deja más de 5 a la vez contra el mismo servidor; las demás esperan
// turno. Cada escenario repite las lecturas que hace su pantalla, en el mismo orden.

const net = vi.hoisted(() => {
  const RTT = 150;
  const MAX_PER_HOST = 5;
  const MAX_ROWS = 1000; // el tope de filas por petición de Supabase
  type Row = Record<string, unknown>;
  const db: Record<string, Row[]> = {};
  const log: { table: string; op: string; filters: string }[] = [];
  let active = 0;
  const queue: (() => void)[] = [];
  const slot = () =>
    new Promise<void>((resolve) => {
      const run = () => {
        active++;
        setTimeout(() => {
          active--;
          resolve();
          queue.shift()?.();
        }, RTT);
      };
      if (active < MAX_PER_HOST) run();
      else queue.push(run);
    });

  class Query {
    op = 'select';
    filters: ((r: Row) => boolean)[] = [];
    desc: string[] = [];
    orders: { col: string; asc: boolean }[] = [];
    from = 0;
    to = MAX_ROWS - 1;
    one = false;
    payload: Row | Row[] | null = null;
    constructor(public table: string) {}
    select() {
      return this;
    }
    eq(col: string, v: unknown) {
      this.filters.push((r) => r[col] === v);
      this.desc.push(`${col}=${String(v)}`);
      return this;
    }
    match(o: Record<string, unknown>) {
      for (const [k, v] of Object.entries(o)) this.eq(k, v);
      return this;
    }
    in(col: string, vs: unknown[]) {
      this.filters.push((r) => vs.includes(r[col]));
      this.desc.push(`${col} in ${vs.length}`);
      return this;
    }
    gte(col: string, v: string) {
      this.filters.push((r) => String(r[col]) >= v);
      this.desc.push(`${col}>=${v}`);
      return this;
    }
    order(col: string, o?: { ascending?: boolean }) {
      this.orders.push({ col, asc: o?.ascending !== false });
      return this;
    }
    range(a: number, b: number) {
      this.from = a;
      this.to = Math.min(b, a + MAX_ROWS - 1);
      return this;
    }
    limit(n: number) {
      this.to = this.from + Math.min(n, MAX_ROWS) - 1;
      return this;
    }
    maybeSingle() {
      this.one = true;
      return this;
    }
    single() {
      this.one = true;
      return this;
    }
    insert(rows: Row | Row[]) {
      this.op = 'insert';
      this.payload = rows;
      return this;
    }
    upsert(rows: Row | Row[]) {
      this.op = 'upsert';
      this.payload = rows;
      return this;
    }
    update(row: Row) {
      this.op = 'update';
      this.payload = row;
      return this;
    }
    delete() {
      this.op = 'delete';
      return this;
    }
    async run() {
      log.push({ table: this.table, op: this.op, filters: this.desc.join(',') });
      await slot();
      const rows = (db[this.table] ??= []);
      const hit = (r: Row) => this.filters.every((f) => f(r));
      if (this.op === 'insert' || this.op === 'upsert') {
        for (const r of [this.payload!].flat()) rows.push({ ...r });
        return { data: null, error: null };
      }
      if (this.op === 'update') {
        for (const r of rows) if (hit(r)) Object.assign(r, this.payload);
        return { data: null, error: null };
      }
      if (this.op === 'delete') {
        db[this.table] = rows.filter((r) => !hit(r));
        return { data: null, error: null };
      }
      const out = rows.filter(hit);
      out.sort((a, b) => {
        for (const o of this.orders) {
          const c = String(a[o.col]).localeCompare(String(b[o.col]));
          if (c) return o.asc ? c : -c;
        }
        return 0;
      });
      const page = out.slice(this.from, this.to + 1).map((r) => ({ ...r }));
      return { data: this.one ? (page[0] ?? null) : page, error: null };
    }
    then<A, B>(ok: (v: { data: unknown; error: null }) => A, ko?: (e: unknown) => B) {
      return this.run().then(ok, ko);
    }
  }
  const client = {
    from: (table: string) => new Query(table),
    rpc: async () => ({ data: false, error: null }),
  };
  return { RTT, db, log, client, reset: () => (log.length = 0) };
});

const store = vi.hoisted(() => {
  (globalThis as { __DEV__?: boolean }).__DEV__ = false;
  return new Map<string, string>();
});
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (k: string) => store.get(k) ?? null,
    setItem: async (k: string, v: string) => void store.set(k, v),
    removeItem: async (k: string) => void store.delete(k),
    getAllKeys: async () => [...store.keys()],
    multiGet: async (ks: string[]) => ks.map((k) => [k, store.get(k) ?? null]),
    multiSet: async (pairs: [string, string][]) => pairs.forEach(([k, v]) => store.set(k, v)),
    multiRemove: async (ks: string[]) => ks.forEach((k) => store.delete(k)),
  },
}));
const auth = vi.hoisted(() => ({ uid: 'u1' as string | null }));
vi.mock('@/lib/supabase', () => ({
  supabase: net.client,
  getCurrentUserId: () => auth.uid,
  isRemoteActive: () => !!auth.uid,
  isPublicDemo: false,
}));
vi.mock('@/i18n', () => ({ t: (s: string) => s, num: (v: unknown) => String(v), dateLocale: () => 'es-ES', lang: () => 'es' }));
vi.mock('@/utils/imageUpload', () => ({ compressPhoto: async (u: string) => u }));
vi.mock('react-native', () => ({ Platform: { OS: 'android', select: (o: Record<string, unknown>) => o.android ?? o.default } }));

const { weightRepository, latestBodyComp, latestBodyFat } = await import('../weightRepository');
const { loadBodyBasics } = await import('../bodyBasics');
const { loadMeasureReadings } = await import('../measurementsRepository');
const { getBloodPressureEntries } = await import('../bloodPressureRepository');
const { vo2maxRepository } = await import('../vo2maxRepository');
const { gripStrengthRepository } = await import('../gripStrengthRepository');
const { thermometerRepository } = await import('../temperatureRepository');
const { labUploadRepository } = await import('../labUploads');
const { userFlags } = await import('../userFlags');
const { profileRepository } = await import('../profileRepository');
const { wearableRepository } = await import('@/wearables/wearableRepository');
const { getLiveBiomarkers } = await import('@/utils/liveBiomarkers');
const { nudgeStore } = await import('../nudgeStore');
const { medicationRepository, doseRepository } = await import('../medicationRepository');
const { bowelRepository, urineRepository } = await import('../bathroomRepository');
const { checkInRepository } = await import('../checkInRepository');
const { cycleRepository } = await import('../cycleRepository');
const { workoutRepository } = await import('../planRepository');
const { metaValueRepository } = await import('../metasRepository');
const { MEASURE_SITES } = await import('@/logic/bodyMeasures');
const { BODY_COMP } = await import('@/logic/weight');

// Una cuenta como la del fundador tras unos meses: pesadas, tensión, medidas y el reloj
function seed() {
  for (const k of Object.keys(net.db)) delete net.db[k];
  const day = (n: number) => new Date(Date.UTC(2026, 10, 17) - n * 86400000).toISOString();
  const metric: Record<string, unknown>[] = [];
  const add = (kind: string, n: number, value: number, unit = 'kg') =>
    metric.push({ user_id: 'u1', id: `${kind}-${n}`, kind, value, unit, measured_at: day(n), created_at: day(n) });
  for (let w = 0; w < 20; w++) {
    add('weight', w * 7, 80 - w * 0.2);
    for (const b of BODY_COMP) add(b.kind, w * 7, 20);
  }
  for (let m = 0; m < 6; m++) for (const s of MEASURE_SITES) add(s.kind, m * 14, 40, s.unit);
  for (let i = 0; i < 4; i++) {
    add('vo2max', i * 30, 40, 'mL/kg/min');
    add('grip_strength', i * 30, 42);
  }
  net.db.metric_readings = metric;
  net.db.blood_pressure_readings = Array.from({ length: 30 }, (_, i) => ({
    user_id: 'u1',
    id: `bp-${i}`,
    systolic: 120,
    diastolic: 80,
    pulse: 60,
    source: 'manual',
    measured_at: day(i),
    created_at: day(i),
  }));
  net.db.profiles = [{ id: 'u1', sex: 'male', date_of_birth: '1990-05-01', height_cm: 180, weight_kg: 80, goals: [], badges: [], conditions: [] }];
  const metrics = ['steps', 'resting_heart_rate', 'hrv', 'sleep_duration', 'active_energy', 'distance', 'sleep_deep', 'sleep_light', 'sleep_rem', 'sleep_start', 'sleep_end'];
  net.db.wearable_daily = [];
  for (let d = 0; d < 120; d++)
    for (const metric of metrics)
      net.db.wearable_daily.push({
        user_id: 'u1',
        date: day(d).slice(0, 10),
        metric,
        value: 1,
        source_name: 'Watch',
        provider: 'health_connect',
        raw_type_id: metric,
        raw_type_name: metric,
      });
}

// Lanza la carga de una pantalla y mide, en el tiempo simulado, cuándo llega cada parte
async function measure(parts: Record<string, () => Promise<unknown>>) {
  net.reset();
  const t0 = Date.now();
  const done: Record<string, number> = {};
  const all = Promise.all(Object.entries(parts).map(([k, f]) => f().then(() => (done[k] = Date.now() - t0))));
  await vi.runAllTimersAsync();
  await all;
  const byTable: Record<string, number> = {};
  for (const r of net.log) byTable[r.table] = (byTable[r.table] ?? 0) + 1;
  return { requests: net.log.length, done, byTable };
}

const weightDetail = () =>
  measure({
    // weight-detail: la lista y la altura del perfil
    list: () => Promise.all([weightRepository.getAll(), loadBodyBasics()]),
    // WeightInfo: composición, grasa, pesadas, perfil y medidas
    info: () =>
      Promise.all([latestBodyComp(), latestBodyFat().catch(() => null), weightRepository.getAll(), loadBodyBasics(), loadMeasureReadings().catch(() => ({}))]),
  });

const measurementsAll = () =>
  measure({
    wearables: () => wearableRepository.getRecords(),
    weight: () => weightRepository.getAll(),
    bp: () => getBloodPressureEntries(),
    vo2: () => vo2maxRepository.getAll(),
    grip: () => gripStrengthRepository.getAll(),
  });

// Hoy pide mucho más que las mediciones a la vez (avisos, medicación, metas…): todo compite por las 5 conexiones
const today = () =>
  measure({
    wearables: () => wearableRepository.getRecords(),
    wearablesMetas: () => wearableRepository.getRecords(),
    biomarkers: () => getLiveBiomarkers(),
    summary: () =>
      Promise.all([
        userFlags.get('report_seen:x'),
        net.client.from('appointments').select().eq('patient_id', 'u1'),
        labUploadRepository.getAll().catch(() => []),
        userFlags.get('today_first_analysis_closed'),
      ]),
    nudges: () => nudgeStore.refresh(),
    meds: () => Promise.all([medicationRepository.getAll(), doseRepository.getAll()]),
    goals: () => Promise.all([userFlags.get('daily_goals'), userFlags.get('goals_shown')]),
    weight: () => weightRepository.getAll(),
    thermo: () => thermometerRepository.getAll(),
    bathroom: () => Promise.all([bowelRepository.getAll(), urineRepository.getAll()]),
    profile: () => Promise.all([profileRepository.get(), checkInRepository.getAll(), cycleRepository.getAll()]),
    metas: async () => {
      await Promise.all([profileRepository.get(), labUploadRepository.getAll().catch(() => [])]);
      await Promise.all([userFlags.get('metas'), metaValueRepository.getAll(), workoutRepository.getAll(), checkInRepository.getAll()]);
    },
  });

const { readCache, CACHE_PREFIX } = await import('../readCache');
const { basalTemperatureRepository } = await import('../temperatureRepository');
const { bloodPressureRepository, updateBloodPressureEntry, deleteBloodPressureEntry } = await import('../bloodPressureRepository');

beforeEach(async () => {
  vi.useFakeTimers();
  auth.uid = 'u1';
  await readCache.clear();
  store.clear();
  seed();
  net.reset();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('mediciones: peticiones y tiempo (red simulada, 150 ms por petición, 5 a la vez)', () => {
  // Antes (473c6a3): 23 peticiones (21 a metric_readings, 4 de ellas una detrás de otra) y la parte de
  // composición, IMC y medidas a los 1050 ms
  it('ficha del peso: 2 peticiones y todo en una vuelta', async () => {
    const r = await weightDetail();
    expect(r.byTable).toEqual({ metric_readings: 1, profiles: 1 });
    expect(r.done.info).toBe(net.RTT);
  });

  // Antes: 10 peticiones (también azúcar, colesterol, cortisol, analíticas y marcas, que no salen) y lista a los 450 ms
  it('«Ver todas» las mediciones: 3 peticiones, solo lo que sale', async () => {
    const r = await measurementsAll();
    expect(r.requests).toBe(3);
    expect(Math.max(...Object.values(r.done))).toBe(net.RTT);
  });

  // Antes: 45 peticiones al abrir Hoy y las mediciones a los 900 ms (esperando turno detrás de lo demás)
  it('Hoy: lo repetido sale una vez y las mediciones llegan antes', async () => {
    const r = await today();
    expect(r.requests).toBeLessThanOrEqual(18);
    for (const table of ['wearable_daily', 'profiles', 'lab_uploads', 'blood_pressure_readings', 'glucose_readings', 'check_ins']) expect(r.byTable[table]).toBe(1);
    expect(r.byTable.user_flags).toBeLessThanOrEqual(2);
    expect(Math.max(r.done.weight, r.done.thermo, r.done.biomarkers, r.done.wearables)).toBeLessThanOrEqual(3 * net.RTT);
  });
});

// Lanza una lectura y deja correr la red simulada
async function settle<T>(p: Promise<T>): Promise<T> {
  await vi.runAllTimersAsync();
  return p;
}

describe('metric_readings agrupado', () => {
  it('cada kind recibe solo lo suyo, lo más reciente primero', async () => {
    const [weight, vo2, measures] = await settle(Promise.all([weightRepository.getAll(), vo2maxRepository.getAll(), loadMeasureReadings()]));
    expect(net.log).toHaveLength(1);
    expect(weight).toHaveLength(20);
    expect(weight.every((e) => e.unidad === 'kg' && e.id.startsWith('weight-'))).toBe(true);
    expect(weight[0].fecha > weight[1].fecha).toBe(true);
    expect(vo2.map((e) => e.valor)).toEqual([40, 40, 40, 40]);
    expect(measures.tape_waist).toHaveLength(6);
  });

  it('por páginas: no se pierden filas por el tope de 1000 de Supabase', async () => {
    for (let i = 0; i < 2500; i++)
      net.db.metric_readings.push({
        user_id: 'u1',
        id: `t${i}`,
        kind: 'basal_temperature',
        value: 36.5,
        unit: '°C',
        measured_at: `2025-01-01T00:00:${String(i).padStart(4, '0')}`,
        created_at: 'x',
      });
    const [weight, basal] = await settle(Promise.all([weightRepository.getAll(), basalTemperatureRepository.getAll()]));
    expect(basal).toHaveLength(2500);
    expect(weight).toHaveLength(20);
    expect(net.log).toHaveLength(3); // tres páginas
  });

  it('nunca lee filas de otra persona (un profesional con permiso las vería por RLS)', async () => {
    net.db.metric_readings.push({ user_id: 'u2', id: 'x', kind: 'weight', value: 50, unit: 'kg', measured_at: '2026-11-17T08:00:00Z', created_at: 'x' });
    expect((await settle(weightRepository.getAll())).some((e) => e.id === 'x')).toBe(false);
  });
});

describe('caché por usuario e invalidación tras guardar', () => {
  it('tras apuntar un peso, la ficha lo enseña al momento y la siguiente lectura vuelve a la red', async () => {
    await settle(weightRepository.getAll());
    expect(weightRepository.peek()).toHaveLength(20);
    await settle(weightRepository.save({ id: 'new', valor: 77, unidad: 'kg', fecha: '2026-11-18T08:00:00.000Z', createdAt: '2026-11-18T08:00:00.000Z' }));
    // Sin esperar a la red
    expect(weightRepository.peek()![0]).toMatchObject({ id: 'new', valor: 77 });
    net.reset();
    const fresh = await settle(weightRepository.getAll());
    expect(net.log).toHaveLength(1);
    expect(fresh.some((e) => e.id === 'new')).toBe(true);
  });

  it('editar y borrar también corrigen lo último leído', async () => {
    await settle(getBloodPressureEntries());
    await settle(updateBloodPressureEntry('bp-0', { systolic: 135 }));
    expect(bloodPressureRepository.peek()!.find((e) => e.id === 'bp-0')!.systolic).toBe(135);
    await settle(deleteBloodPressureEntry('bp-1'));
    expect(bloodPressureRepository.peek()!.some((e) => e.id === 'bp-1')).toBe(false);
  });

  it('cada pantalla recibe su copia: tocar la lista no cambia lo guardado', async () => {
    const mine = await settle(weightRepository.getAll());
    mine.splice(0, mine.length);
    expect(weightRepository.peek()).toHaveLength(20);
  });

  it('las mediciones de una cuenta no se ven con otra', async () => {
    await settle(weightRepository.getAll());
    auth.uid = 'u2';
    expect(weightRepository.peek()).toBeUndefined();
    expect(await settle(weightRepository.getAll())).toEqual([]);
    auth.uid = 'u1';
    expect(weightRepository.peek()).toHaveLength(20);
  });

  it('se guarda en el móvil por usuario y se borra al cerrar sesión', async () => {
    await settle(Promise.all([weightRepository.getAll(), getBloodPressureEntries(), wearableRepository.getRecords(), profileRepository.get()]));
    await readCache.flushNow();
    const keys = [...store.keys()].filter((k) => k.startsWith(CACHE_PREFIX));
    expect(keys).toEqual(
      expect.arrayContaining([
        `${CACHE_PREFIX}u1:hometest:weight_entries`,
        `${CACHE_PREFIX}u1:hometest:blood_pressure_entries`,
        `${CACHE_PREFIX}u1:wearable_daily`,
        `${CACHE_PREFIX}u1:profile`,
      ]),
    );
    await readCache.clear();
    expect([...store.keys()].filter((k) => k.startsWith(CACHE_PREFIX))).toEqual([]);
    expect(weightRepository.peek()).toBeUndefined();
  });

  it('el reloj: lo leído se comparte y borrar lo vacía al momento', async () => {
    net.reset();
    await settle(Promise.all([wearableRepository.getRecords(), wearableRepository.getRecords()]));
    expect(net.log).toHaveLength(1);
    expect(wearableRepository.peekRecords()).toHaveLength(1000); // tope de Supabase por petición, como antes
    await settle(wearableRepository.clearRecords());
    expect(wearableRepository.peekRecords()).toEqual([]);
  });

  it('el perfil guardado se ve ya (la altura del IMC)', async () => {
    const p = await settle(profileRepository.get());
    await settle(profileRepository.save({ ...p, heightCm: 175 }));
    expect(profileRepository.peek()!.heightCm).toBe(175);
  });

  it('marcas: varias lecturas a la vez son una petición y guardar una la trae en la siguiente', async () => {
    net.reset();
    await settle(Promise.all([userFlags.get('a'), userFlags.get('b'), userFlags.get('c')]));
    expect(net.log.filter((r) => r.table === 'user_flags')).toHaveLength(1);
    await settle(userFlags.set('a', 'x'));
    expect(await settle(userFlags.get('a'))).toBe('x');
  });

  it('sin cuenta (demo) todo sigue en el móvil y no hay caché', async () => {
    auth.uid = null;
    store.set('hometest:weight_entries', JSON.stringify([{ id: 'd', valor: 70, unidad: 'kg', fecha: '2026-11-01', createdAt: 'x' }]));
    net.reset();
    expect(await settle(weightRepository.getAll())).toHaveLength(1);
    expect(weightRepository.peek()).toBeUndefined();
    expect(net.log).toHaveLength(0);
  });
});

