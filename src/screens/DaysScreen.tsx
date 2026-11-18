import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { dateLocale, t } from '@/i18n';
import { useDeepState, useReloadOnFocus } from '@/hooks/useReloadOnFocus';
import { checkInDayKey, checkInRepository, MOOD_SCORE, sampleCheckInSeries } from '@/data/checkInRepository';
import { CheckInEntry, MOMENT_OPTIONS, MOOD_OPTIONS } from '@/types/checkIn';
import { bowelRepository, dayKey, entryForDay, urineRepository } from '@/data/bathroomRepository';
import { BowelEntry, BRISTOL_TYPES, STOOL_COLORS, UrineEntry, URINE_COLORS } from '@/types/bathroom';
import { doseRepository, medicationRepository } from '@/data/medicationRepository';
import { dosesForDay } from '@/logic/medication';
import { ScheduledDose } from '@/types/medication';
import { mealRepository, MealEntry, workoutRepository, WorkoutEntry } from '@/data/planRepository';
import { getBloodPressureEntries } from '@/data/bloodPressureRepository';
import { getGlucoseEntries } from '@/data/glucoseRepository';
import { DailyPoint, formatSleep, useDailyWearables } from '@/wearables/dailySeries';
import { RangeId, rangeDays } from '@/components/MetricDetailParts';
import { FineRangeTabs } from '@/components/fine/FineMeasure';
import { Chev, SecHead } from '@/components/fine/Fine';
import { DumbbellIcon, isWeightsIcon } from '@/components/fine/DumbbellIcon';
import { DaysChart } from '@/components/DaysChart';
import { workoutLabel } from '@/logic/workoutSports';
import { cycleByDay, DAYS_CHART_FLAG, normalizeSeries, DEFAULT_SERIES, type DayValues, type SeriesId } from '@/logic/dayChart';
import { userFlags } from '@/data/userFlags';
import { profileRepository } from '@/data/profileRepository';
import { cycleRepository } from '@/data/cycleRepository';
import { cycleGoalStore } from '@/data/cycleGoal';
import { showSamples } from '@/data/dataMode';
import { CycleEntry } from '@/types/cycle';
import { FINE, ff, fine } from '@/theme/fine';
import { MoodFace } from '@/components/checkin/MoodFaces';

// "Tus últimos días" (Today → check-in → Tus últimos 7 días → tocar): todo lo apuntado y medido
// cada día, para responder a "¿qué ha pasado estos días?" de un vistazo. Los días que se salen de
// lo tuyo (ánimo o energía bajos, poco sueño, pulso en reposo alto) llevan una marca y el porqué.
// Arriba, la gráfica de ánimo y energía, con lo que quieras añadir para compararlo (fundador, 2026-11-06).
// Desde el 2026-11-16, en el lenguaje fino del prototipo: cada día es una sección con su fecha pequeña en
// mayúsculas y sus cosas en filas con una línea fina debajo, iconos a línea apagados (sin un color por tipo)
// y la marca de los días que se salen en oro, sin tarjetas.

const DAYS = 14;
// La gráfica llega a un mes (1M); las tarjetas de cada día, a 14
const CHART_DAYS = 30;
const CHART_RANGES: RangeId[] = ['7D', '14D', '1M'];

interface DayData {
  key: string;
  checkIns: CheckInEntry[];
  sleep: number | null;
  steps: number | null;
  rhr: number | null;
  hrv: number | null;
  doses: ScheduledDose[];
  bowel: BowelEntry | null;
  urine: UrineEntry | null;
  workouts: WorkoutEntry[];
  meals: MealEntry[];
  bp: { systolic: number; diastolic: number }[];
  glucose: number[];
}

const valueOn = (pts: DailyPoint[] | undefined, key: string) => pts?.find((p) => p.date === key)?.value ?? null;
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
// Los tres huecos de check-in de cada día
const SLOT_LABEL: Record<string, string> = { just_woke_up: 'Morning', mid_day: 'Midday', winding_down: 'Night' };

export const DaysScreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams<{ date?: string }>();
  const { series } = useDailyWearables(CHART_DAYS);
  const [range, setRange] = useState<RangeId>('14D');
  const [chartSel, setChartSel] = useDeepState<SeriesId[]>([...DEFAULT_SERIES]);
  // Mujeres: sus reglas y la duración que dijo, para la franja del ciclo (null: no se pinta)
  const [cycleSrc, setCycleSrc] = useDeepState<{ entries: CycleEntry[]; length: number | null } | null>(null);
  const scroll = useRef<ScrollView>(null);
  const positions = useRef<Record<string, number>>({});
  const scrolled = useRef(false);
  const [raw, setRaw] = useDeepState<{
    checkIns: CheckInEntry[];
    bowel: BowelEntry[];
    urine: UrineEntry[];
    doses: Record<string, ScheduledDose[]>;
    workouts: WorkoutEntry[];
    meals: MealEntry[];
    bp: { fecha: string; systolic: number; diastolic: number }[];
    glucose: { fecha: string; valor: number }[];
  }>({ checkIns: [], bowel: [], urine: [], doses: {}, workouts: [], meals: [], bp: [], glucose: [] });

  const dayList = useMemo(
    () =>
      Array.from({ length: CHART_DAYS }, (_, i) => {
        const d = new Date();
        d.setHours(12, 0, 0, 0);
        d.setDate(d.getDate() - i);
        return d;
      }),
    [],
  );

  useReloadOnFocus(
    useCallback(async () => {
      const safe = <T,>(p: Promise<T[]>) => p.catch(() => [] as T[]);
      const [checkIns, bowel, urine, meds, logs, workouts, meals, bp, glucose] = await Promise.all([
        safe(checkInRepository.getAll()),
        safe(bowelRepository.getAll()),
        safe(urineRepository.getAll()),
        safe(medicationRepository.getAll()),
        safe(doseRepository.getAll()),
        safe(workoutRepository.getAll()),
        safe(mealRepository.getAll()),
        safe(getBloodPressureEntries()),
        safe(getGlucoseEntries()),
      ]);
      const doses: Record<string, ScheduledDose[]> = {};
      for (const d of dayList) doses[dayKey(d)] = dosesForDay(meds, d, logs);
      setRaw({ checkIns, bowel, urine, doses, workouts, meals, bp, glucose });
      userFlags
        .get(DAYS_CHART_FLAG)
        .then((v) => setChartSel(normalizeSeries(v)))
        .catch(() => undefined);
      const p = await profileRepository.get().catch(() => null);
      if (p?.sex === 'female') {
        const [entries, goal] = await Promise.all([safe(cycleRepository.getAll()), cycleGoalStore.get().catch(() => null)]);
        setCycleSrc({ entries, length: goal?.cycleLength ?? null });
      } else setCycleSrc(null);
    }, [dayList, setRaw, setChartSel, setCycleSrc]),
  );

  const days: DayData[] = dayList.map((d) => {
    const key = dayKey(d);
    const on = <T extends { fecha: string }>(xs: T[]) => xs.filter((x) => dayKey(new Date(x.fecha)) === key);
    return {
      key,
      // De madrugada, "mi día termina" cuenta para el día anterior (logic/checkInDay)
      checkIns: raw.checkIns.filter((c) => checkInDayKey(c) === key).sort((a, b) => a.fecha.localeCompare(b.fecha)),
      sleep: valueOn(series.sleep_duration, key),
      steps: valueOn(series.steps, key),
      rhr: valueOn(series.resting_heart_rate, key),
      hrv: valueOn(series.hrv, key),
      doses: raw.doses[key] ?? [],
      bowel: entryForDay(raw.bowel, key),
      urine: entryForDay(raw.urine, key),
      workouts: on(raw.workouts),
      meals: on(raw.meals),
      bp: on(raw.bp),
      glucose: on(raw.glucose).map((g) => g.valor),
    };
  });

  // Lo tuyo de estos días, para marcar lo que se sale (no umbrales clínicos: comparación contigo)
  const usualRhr = avg(days.slice(0, DAYS).map((d) => d.rhr).filter((v): v is number => v != null));
  const reasons = (d: DayData): string[] => {
    const out: string[] = [];
    const moods = d.checkIns.filter((c) => c.mood).map((c) => MOOD_SCORE[c.mood!]);
    const energy = d.checkIns.filter((c) => c.energy).map((c) => c.energy!);
    if (moods.length && avg(moods)! <= 2.2) out.push(t('Low mood'));
    if (energy.length && avg(energy)! <= 2) out.push(t('Low energy'));
    if (d.sleep != null && d.sleep < 360) out.push(t('Under 6 hours of sleep'));
    if (d.rhr != null && usualRhr != null && d.rhr >= usualRhr + 5) out.push(t('Resting heart rate above your usual'));
    if (d.doses.some((x) => x.log?.status === 'skipped')) out.push(t('Skipped a dose'));
    if (d.urine?.burning) out.push(t('Burning when peeing'));
    return out;
  };

  // La gráfica: del día más antiguo del periodo a hoy
  const chartDays = days.slice(0, rangeDays(range)).reverse();
  const keys = chartDays.map((d) => d.key);
  const mean = (xs: (number | undefined)[]) => avg(xs.filter((x): x is number => typeof x === 'number'));
  // Sin ningún check-in, en la demo, ánimo y energía de ejemplo (como la gráfica de Hoy)
  const sampleMood = !raw.checkIns.length && showSamples() ? sampleCheckInSeries(keys.length) : null;
  const anyWorkout = raw.workouts.length > 0;
  const values: DayValues = {
    mood: sampleMood ? sampleMood.map((p) => p.mood) : chartDays.map((d) => mean(d.checkIns.map((c) => (c.mood ? MOOD_SCORE[c.mood] : undefined)))),
    energy: sampleMood ? sampleMood.map((p) => p.energy) : chartDays.map((d) => mean(d.checkIns.map((c) => c.energy))),
    stress: chartDays.map((d) => mean(d.checkIns.map((c) => c.stress))),
    sleep: chartDays.map((d) => d.sleep),
    steps: chartDays.map((d) => d.steps),
    hrv: chartDays.map((d) => d.hrv),
    rhr: chartDays.map((d) => d.rhr),
    // Orina: las veces que apuntó (o las visitas una a una); deposiciones: 0 si apuntó que no fue
    urine: chartDays.map((d) => d.urine?.count ?? (d.urine?.visits?.length || null)),
    bowel: chartDays.map((d) => (d.bowel ? d.bowel.count : null)),
    // Entreno: con alguno apuntado, los días sin entreno cuentan 0
    workout: chartDays.map((d) => (d.workouts.length ? d.workouts.reduce((a, w) => a + (w.minutes || 0), 0) : anyWorkout ? 0 : null)),
  };
  const cycle = cycleSrc ? cycleByDay(keys, cycleSrc.entries, cycleSrc.length, showSamples()) : null;
  const onChartSel = (next: SeriesId[]) => {
    setChartSel(next);
    userFlags.set(DAYS_CHART_FLAG, { series: next }).catch(() => undefined);
  };

  const onLayoutDay = (key: string, y: number) => {
    positions.current[key] = y;
    if (!scrolled.current && params.date === key) {
      scrolled.current = true;
      setTimeout(() => scroll.current?.scrollTo({ y: Math.max(0, y - 12), animated: true }), 60);
    }
  };

  // Una fila del día: icono a línea (apagado salvo lo que pide atención, en oro) y el texto
  const Line = ({
    icon,
    color = FINE.mute,
    textColor,
    children,
    onPress,
  }: {
    icon: keyof typeof Ionicons.glyphMap;
    color?: string;
    textColor?: string;
    children: React.ReactNode;
    onPress?: () => void;
  }) => {
    const body = (
      <>
        {/* Las pesas (los entrenos), con el dibujo único de la app: el del entrenador personal (fine/dumbbell.ts) */}
        {isWeightsIcon(icon) ? <DumbbellIcon size={16} color={color} style={styles.lineIcon} /> : <Ionicons name={icon} size={16} color={color} style={styles.lineIcon} />}
        <Text style={[styles.lineText, textColor ? { color: textColor } : null]}>{children}</Text>
        {onPress && (
          <View style={styles.lineIcon}>
            <Chev />
          </View>
        )}
      </>
    );
    return onPress ? (
      <TouchableOpacity style={styles.line} onPress={onPress} activeOpacity={0.7} accessibilityRole="button">
        {body}
      </TouchableOpacity>
    ) : (
      <View style={styles.line}>{body}</View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView ref={scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerWrap}>
          <ScreenHeader title={t('Your last days')} showBack />
        </View>
        <Text style={styles.intro}>{t('Everything you logged and measured each day. Days that stand out from your usual are marked.')}</Text>

        {/* La gráfica, sin tarjeta: cabecera pequeña, los periodos en pestañas con borde y debajo la curva */}
        <SecHead title={t('How you have been')} style={styles.firstSec} />
        <FineRangeTabs value={range} onChange={setRange} only={CHART_RANGES} style={styles.rangeTabs} />
        {/* key: al cambiar de periodo, sin día tocado */}
        <DaysChart key={range} keys={keys} values={values} selected={chartSel} onChange={onChartSel} cycle={cycle} sample={!!sampleMood} />
        {cycleSrc && !cycle?.some(Boolean) && (
          <TouchableOpacity onPress={() => router.push('/log-cycle')} activeOpacity={0.7} accessibilityRole="link">
            <Text style={styles.chartLink}>{t('Log your period and you will see the phases of your cycle under the chart')} ›</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.slotsHelp}>{t('The three circles are morning, midday and night. Tap one to add that check-in or change it.')}</Text>

        {days.slice(0, DAYS).map((d) => {
          const why = reasons(d);
          const focus = params.date === d.key;
          const taken = d.doses.filter((x) => x.log?.status === 'taken').length;
          const skipped = d.doses.filter((x) => x.log?.status === 'skipped');
          const empty =
            !d.checkIns.length && d.sleep == null && d.steps == null && d.rhr == null && !d.doses.length && !d.bowel && !d.urine && !d.workouts.length && !d.meals.length && !d.bp.length && !d.glucose.length;
          const date = new Date(`${d.key}T12:00:00`);
          return (
            <View key={d.key} onLayout={(e) => onLayoutDay(d.key, e.nativeEvent.layout.y)} style={styles.day}>
              {/* La fecha como cabecera de sección (en jade el día al que se ha llegado tocando) y sus tres huecos */}
              <View style={styles.head}>
                <Text style={[styles.date, focus && styles.dateFocus]} accessibilityRole="header">
                  {d.key === dayKey(new Date())
                    ? t('Today')
                    : date.toLocaleDateString(dateLocale(), { weekday: 'long', day: 'numeric', month: 'short' })}
                </Text>
                {/* Mañana, mediodía y noche: el ánimo del check-in o el hueco vacío para apuntarlo */}
                <View style={styles.slots}>
                  {MOMENT_OPTIONS.map((o) => {
                    const last = d.checkIns.filter((c) => c.moment === o.id).pop();
                    const mood = last && MOOD_OPTIONS.find((m) => m.id === last.mood);
                    return (
                      <TouchableOpacity
                        key={o.id}
                        style={[styles.slot, last ? styles.slotFilled : styles.slotEmpty]}
                        onPress={() =>
                          router.push(
                            last
                              ? { pathname: '/check-in', params: { id: last.id } }
                              : { pathname: '/check-in', params: { date: d.key, moment: o.id } },
                          )
                        }
                        hitSlop={4}
                        accessibilityRole="button"
                        accessibilityLabel={`${t(SLOT_LABEL[o.id])}: ${last ? t('change check-in') : t('add check-in')}`}
                      >
                        {mood ? (
                          // La cara a línea del check-in (sin emojis desde el 2026-11-16)
                          <MoodFace mood={mood.id} size={18} color={FINE.gold} />
                        ) : (
                          <Ionicons name={o.icon as any} size={13} color={last ? FINE.gold : FINE.mute} />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Lo que se sale de lo tuyo: en oro, sin alarma */}
              {why.length > 0 && (
                <Line icon="flag-outline" color={FINE.gold} textColor={FINE.gold}>
                  {why.join(' · ')}
                </Line>
              )}

              {empty && <Text style={styles.none}>{t('Nothing logged this day.')}</Text>}

              {d.checkIns.map((c) => {
                const m = MOOD_OPTIONS.find((o) => o.id === c.mood);
                const moment = MOMENT_OPTIONS.find((o) => o.id === c.moment);
                const bits = [
                  m ? t(m.label) : null,
                  c.energy ? t('energy {n}/5', { n: c.energy }) : null,
                  c.sleep ? t('slept {n}/5', { n: c.sleep }) : null,
                  c.stress ? t('stress {n}/5', { n: c.stress }) : null,
                  c.dayRating ? t('day {n}/5', { n: c.dayRating }) : null,
                ].filter(Boolean);
                const time = new Date(c.fecha).toLocaleTimeString(dateLocale(), { hour: '2-digit', minute: '2-digit' });
                return (
                  <TouchableOpacity
                    key={c.id}
                    style={styles.line}
                    onPress={() => router.push({ pathname: '/check-in', params: { id: c.id } })}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityHint={t('change check-in')}
                  >
                    <Ionicons name={(moment?.icon as any) ?? 'happy-outline'} size={16} color={FINE.gold} style={styles.lineIcon} />
                    <View style={styles.flex}>
                      <Text style={styles.lineText}>
                        <Text style={styles.strong}>{time}</Text> · {bits.join(', ')}
                      </Text>
                      {c.note ? <Text style={styles.note}>“{c.note}”</Text> : null}
                    </View>
                    <Ionicons name="create-outline" size={15} color={FINE.mute} style={styles.lineIcon} />
                  </TouchableOpacity>
                );
              })}

              {(d.sleep != null || d.steps != null || d.rhr != null) && (
                <Line icon="watch-outline">
                  {[
                    d.sleep != null ? t('Sleep {v}', { v: formatSleep(d.sleep) }) : null,
                    d.steps != null ? t('{n} steps', { n: Math.round(d.steps).toLocaleString(dateLocale()) }) : null,
                    d.rhr != null ? t('resting HR {n}', { n: Math.round(d.rhr) }) : null,
                    d.hrv != null ? t('HRV {n} ms', { n: Math.round(d.hrv) }) : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Line>
              )}

              {d.doses.length > 0 && (
                <Line
                  icon="medical-outline"
                  color={skipped.length ? FINE.gold : FINE.mute}
                  onPress={() => router.push({ pathname: '/medication-history', params: { date: d.key } })}
                >
                  {t('Medication {done}/{total} taken', { done: taken, total: d.doses.length })}
                  {skipped.length ? ` · ${t('skipped: {names}', { names: skipped.map((x) => x.name).join(', ') })}` : ''}
                </Line>
              )}

              {d.bowel && (
                <Line icon="leaf-outline">
                  {d.bowel.count === 0
                    ? t('Digestion: did not go')
                    : [
                        t('Digestion: {n}×', { n: d.bowel.count }),
                        d.bowel.consistency ? t(BRISTOL_TYPES.find((b) => b.id === d.bowel!.consistency)!.label).toLowerCase() : null,
                        d.bowel.color ? t(STOOL_COLORS.find((c) => c.id === d.bowel!.color)!.label).toLowerCase() : null,
                      ]
                        .filter(Boolean)
                        .join(', ')}
                </Line>
              )}
              {d.urine && (
                <Line icon="water-outline">
                  {[
                    d.urine.count != null ? t('Urine: {n}×', { n: d.urine.count }) : t('Urine'),
                    d.urine.color ? t(URINE_COLORS.find((c) => c.id === d.urine!.color)!.label).toLowerCase() : null,
                    d.urine.nightCount ? t('{n} at night', { n: d.urine.nightCount }) : null,
                  ]
                    .filter(Boolean)
                    .join(', ')}
                </Line>
              )}

              {d.workouts.length > 0 && (
                <Line icon="barbell-outline">
                  {d.workouts.map((w) => `${workoutLabel(w)} ${w.minutes} min`).join(' · ')}
                </Line>
              )}
              {d.meals.length > 0 && (
                <Line icon="restaurant-outline">
                  {t(d.meals.length === 1 ? '{n} meal logged' : '{n} meals logged', { n: d.meals.length })}
                </Line>
              )}
              {d.bp.length > 0 && (
                <Line icon="speedometer-outline">
                  {t('Blood pressure')} {d.bp.map((b) => `${b.systolic}/${b.diastolic}`).join(', ')}
                </Line>
              )}
              {d.glucose.length > 0 && (
                <Line icon="eyedrop-outline">
                  {t('Glucose')} {d.glucose.map((g) => `${g}`).join(', ')} mg/dL
                </Line>
              )}
            </View>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  // La cabecera ya lleva su margen: que no se sume al de la lista
  headerWrap: { marginHorizontal: -20 },
  flex: { flex: 1 },
  intro: { ...fine.lead, marginTop: 0, fontSize: 13.5, lineHeight: 19 },
  firstSec: { marginTop: 18 },
  rangeTabs: { marginTop: 0, marginBottom: 12 },
  chartLink: { ...fine.link, fontSize: 12.5, marginTop: 10, paddingVertical: 4 },
  slotsHelp: { ...fine.note, marginTop: 16 },
  day: { marginTop: 22 },
  // La fecha, como las cabeceras de sección (pequeña, en mayúsculas y apagada) y la línea fina debajo
  head: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: FINE.line },
  date: { ...fine.secTitle, flex: 1 },
  dateFocus: { color: FINE.jade },
  slots: { flexDirection: 'row', gap: 8 },
  slot: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  slotFilled: { borderColor: FINE.goldLine },
  slotEmpty: { borderColor: 'rgba(240,239,230,0.22)' },
  none: { ...ff('regular'), color: FINE.mute, fontSize: 13.5, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: FINE.line },
  // Cada cosa del día, una fila con línea fina
  line: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 11, minHeight: 44, borderBottomWidth: 1, borderBottomColor: FINE.line },
  lineIcon: { marginTop: 2 },
  lineText: { ...ff('regular'), flex: 1, color: FINE.ivory, fontSize: 14, lineHeight: 20 },
  strong: { ...ff('medium'), color: FINE.ivory },
  note: { ...ff('regular'), color: '#CFD6CF', fontSize: 13.5, lineHeight: 19, marginTop: 3 },
});
