import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import { useReloadOnFocus } from './useReloadOnFocus';
import { useDailyWearables } from '@/wearables/dailySeries';
import { showSamples } from '@/data/dataMode';
import { getCurrentUserId } from '@/lib/supabase';
import type { DailySeries } from '@/wearables/seriesLogic';
import { workoutRepository, type WorkoutEntry } from '@/data/planRepository';
import { checkInRepository } from '@/data/checkInRepository';
import type { CheckInEntry } from '@/types/checkIn';
import {
  loadLabReadings,
  loadManualValues,
  loadMetasState,
  loadProfile,
  saveMetasState,
  setMetaValue,
  whoOf,
} from '@/data/metasRepository';
import {
  addDays,
  autoValues,
  closedWeek,
  dayKeyOf,
  firstMarkOf,
  knownBefore,
  labGoals,
  valuesFor,
  weekOf,
  weeklyCongrats,
  weekReview,
  type DayMap,
  type LabGoal,
  type Meta,
  type MetasState,
  type Who,
} from '@/logic/metas';

interface Loaded {
  state: MetasState;
  saved: boolean; // ya eligió algo alguna vez
  manual: DayMap;
  workouts: WorkoutEntry[];
  checkIns: CheckInEntry[];
  who: Who;
  lab: LabGoal[];
  hasLab: boolean; // tiene algún valor de analítica (aunque no apunte a ningún objetivo)
}

// Lo cargado se comparte entre Hoy y las pantallas de metas (y se queda en memoria): al abrir un área se
// ve al momento, sin esperar a la carga, que se rehace detrás (fundador, 2026-11-05: «se queda un rato en
// blanco»). Va con el usuario: si cambia la cuenta, no se enseña lo del anterior.
let shared: { user: string | null; data: Loaded } | null = null;
let sharedSeries: { user: string | null; series: DailySeries } | null = null;
const listeners = new Set<(d: Loaded | null) => void>();
const userNow = () => getCurrentUserId() ?? null;
const cached = () => (shared && shared.user === userNow() ? shared.data : null);
function setShared(fn: (d: Loaded | null) => Loaded | null) {
  const next = fn(cached());
  shared = next ? { user: userNow(), data: next } : null;
  listeners.forEach((l) => l(next));
}

// Todo lo de las metas para Hoy y sus pantallas: lo elegido, la semana de cada meta (lo que llega solo y
// lo apuntado a mano), los objetivos que recomienda la analítica y la enhorabuena de la
// semana. Se recarga al volver a la pantalla; los cambios se ven al momento y se guardan detrás.
export function useMetas() {
  const { series: fresh } = useDailyWearables(21);
  const [data, setData] = useState<Loaded | null>(cached);
  useEffect(() => {
    listeners.add(setData);
    return () => {
      listeners.delete(setData);
    };
  }, []);
  // Mientras el reloj aún no ha cargado, lo último que se vio
  const freshEmpty = Object.keys(fresh).length === 0;
  useEffect(() => {
    if (!freshEmpty) sharedSeries = { user: userNow(), series: fresh };
  }, [fresh, freshEmpty]);
  const series = freshEmpty && sharedSeries?.user === userNow() ? sharedSeries.series : fresh;

  const load = useCallback(async () => {
    const today = dayKeyOf(new Date());
    const [profile, labReadings] = await Promise.all([loadProfile(), loadLabReadings()]);
    const [{ state, saved }, manual, workouts, checkIns] = await Promise.all([
      loadMetasState(today, profile, labReadings),
      loadManualValues(),
      workoutRepository.getAll().catch(() => [] as WorkoutEntry[]),
      checkInRepository.getAll().catch(() => [] as CheckInEntry[]),
    ]);
    setShared(() => ({ state, saved, manual, workouts, checkIns, who: whoOf(profile), lab: labGoals(labReadings), hasLab: labReadings.length > 0 }));
  }, []);
  useReloadOnFocus(load);

  const auto = useMemo(
    () =>
      autoValues({
        steps: series.steps,
        sleepMinutes: series.sleep_duration,
        sleepStart: series.sleep_start,
        workouts: data?.workouts ?? [],
        checkIns: data?.checkIns ?? [],
      }),
    [series, data?.workouts, data?.checkIns],
  );

  const today = dayKeyOf(new Date());
  const demoToday = showSamples() ? today : undefined;
  // Si la app se queda abierta de un día para otro, al volver a ella hoy pasa a ser el día nuevo (y el aro con él)
  const [, setDayShown] = useState(today);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') setDayShown(dayKeyOf(new Date()));
    });
    return () => sub.remove();
  }, []);
  // Tu primer día apuntado: si es antes de tu compromiso, tu primera semana cuenta desde él
  const firstMark = useMemo(() => (data ? firstMarkOf(data.state, data.manual) : null), [data]);

  // Una semana de tus metas (de lunes a domingo, o de domingo a sábado): la en curso (0) o la anterior
  // (−1), con lo de cada día y qué metas ya tenían datos antes
  const weekView = useCallback(
    (offset = 0) => {
      if (!data) return null;
      const week = weekOf(addDays(today, offset * 7), data.state, today, firstMark);
      const vals = valuesFor(data.state, week.days, data.manual, auto, demoToday);
      const known = knownBefore(data.state, week.days[Math.min(week.from, 6)], data.manual, auto, demoToday);
      return { week, days: week.days, vals, known };
    },
    [data, today, auto, demoToday, firstMark],
  );
  const cur = useMemo(() => weekView(0), [weekView]);
  const congrats = useMemo(
    () => (data ? weeklyCongrats(data.state, today, (ds) => valuesFor(data.state, ds, data.manual, auto, demoToday), firstMark) : null),
    [data, today, auto, demoToday, firstMark],
  );

  // Lo que te propusiste y lo que hiciste la semana que se acaba de cerrar (al tocar la enhorabuena)
  const review = useMemo(() => {
    if (!data || !congrats) return null;
    const w = closedWeek(data.state, today, firstMark);
    return w ? weekReview(data.state, valuesFor(data.state, w.days, data.manual, auto, demoToday), w) : null;
  }, [data, congrats, today, auto, demoToday, firstMark]);

  // Guarda lo elegido (se ve al momento)
  const update = useCallback((next: MetasState) => {
    setShared((d) => (d ? { ...d, state: next, saved: true } : d));
    saveMetasState(next).catch((e) => console.warn('Saving metas failed', e));
  }, []);

  // Apunta lo de un día (null = borrarlo)
  const setValue = useCallback((m: Meta, day: string, value: number | null) => {
    setShared((d) => {
      if (!d) return d;
      const forMeta = { ...(d.manual[m.id] ?? {}) };
      if (value == null) delete forMeta[day];
      else forMeta[day] = value;
      return { ...d, manual: { ...d.manual, [m.id]: forMeta } };
    });
    setMetaValue(m, day, value).catch((e) => console.warn('Saving meta value failed', e));
  }, []);

  return {
    ready: !!data,
    data,
    week: cur?.week ?? null,
    vals: cur?.vals ?? {},
    known: cur?.known ?? {},
    days: cur?.days ?? [],
    weekView,
    auto,
    today,
    congrats,
    review,
    update,
    setValue,
    reload: load,
  };
}

export type MetasApi = ReturnType<typeof useMetas>;
