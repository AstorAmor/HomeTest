import React, { useCallback, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Colors, withAlpha } from '@/constants/colors';
import { dateLocale, t } from '@/i18n';
import { useDeepState, useReloadOnFocus } from '@/hooks/useReloadOnFocus';
import { checkInDayKey, checkInRepository, MOOD_SCORE } from '@/data/checkInRepository';
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

// "Tus últimos días" (Today → check-in → Tus últimos 7 días → tocar): todo lo apuntado y medido
// cada día, para responder a "¿qué ha pasado estos días?" de un vistazo. Los días que se salen de
// lo tuyo (ánimo o energía bajos, poco sueño, pulso en reposo alto) llevan una marca y el porqué.

const DAYS = 14;

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
const WORKOUT_LABEL: Record<string, string> = { strength: 'Strength', cardio: 'Cardio', mobility: 'Mobility', sport: 'Sport' };
// Los tres huecos de check-in de cada día
const SLOT_LABEL: Record<string, string> = { just_woke_up: 'Morning', mid_day: 'Midday', winding_down: 'Night' };

export const DaysScreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams<{ date?: string }>();
  const { series } = useDailyWearables(30);
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
      Array.from({ length: DAYS }, (_, i) => {
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
    }, [dayList, setRaw]),
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
  const usualRhr = avg(days.map((d) => d.rhr).filter((v): v is number => v != null));
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

  const onLayoutDay = (key: string, y: number) => {
    positions.current[key] = y;
    if (!scrolled.current && params.date === key) {
      scrolled.current = true;
      setTimeout(() => scroll.current?.scrollTo({ y: Math.max(0, y - 12), animated: true }), 60);
    }
  };

  const Line = ({ icon, color, children }: { icon: keyof typeof Ionicons.glyphMap; color: string; children: React.ReactNode }) => (
    <View style={styles.line}>
      <Ionicons name={icon} size={15} color={color} style={styles.lineIcon} />
      <Text style={styles.lineText}>{children}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView ref={scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title={t('Your last days')} showBack />
        <Text style={styles.intro}>{t('Everything you logged and measured each day. Days that stand out from your usual are marked.')}</Text>
        <Text style={styles.slotsHelp}>{t('The three circles are morning, midday and night. Tap one to add that check-in or change it.')}</Text>

        {days.map((d) => {
          const why = reasons(d);
          const focus = params.date === d.key;
          const taken = d.doses.filter((x) => x.log?.status === 'taken').length;
          const skipped = d.doses.filter((x) => x.log?.status === 'skipped');
          const empty =
            !d.checkIns.length && d.sleep == null && d.steps == null && d.rhr == null && !d.doses.length && !d.bowel && !d.urine && !d.workouts.length && !d.meals.length && !d.bp.length && !d.glucose.length;
          const date = new Date(`${d.key}T12:00:00`);
          return (
            <View
              key={d.key}
              onLayout={(e) => onLayoutDay(d.key, e.nativeEvent.layout.y)}
              style={[styles.card, focus && styles.cardFocus, why.length > 0 && styles.cardFlag]}
            >
              <View style={styles.head}>
                <Text style={styles.date}>
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
                          <Text style={styles.slotEmoji}>{mood.emoji}</Text>
                        ) : (
                          <Ionicons name={o.icon as any} size={13} color={last ? Colors.gold : Colors.textMuted} />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {why.length > 0 && (
                <View style={styles.flag}>
                  <Ionicons name="alert-circle-outline" size={15} color={Colors.attention} />
                  <Text style={styles.flagText}>{why.join(' · ')}</Text>
                </View>
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
                  <TouchableOpacity key={c.id} onPress={() => router.push({ pathname: '/check-in', params: { id: c.id } })} activeOpacity={0.7}>
                    <View style={styles.checkInLine}>
                      <View style={{ flex: 1 }}>
                        <Line icon={(moment?.icon as any) ?? 'happy-outline'} color={Colors.gold}>
                          <Text style={styles.strong}>{time}</Text> · {bits.join(', ')}
                        </Line>
                      </View>
                      <Ionicons name="create-outline" size={15} color={Colors.textMuted} style={styles.lineIcon} />
                    </View>
                    {c.note ? <Text style={styles.note}>“{c.note}”</Text> : null}
                  </TouchableOpacity>
                );
              })}

              {(d.sleep != null || d.steps != null || d.rhr != null) && (
                <Line icon="watch-outline" color={Colors.violet}>
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
                <Line icon="medical-outline" color={skipped.length ? Colors.attention : Colors.accent}>
                  {t('Medication {done}/{total} taken', { done: taken, total: d.doses.length })}
                  {skipped.length ? ` · ${t('skipped: {names}', { names: skipped.map((x) => x.name).join(', ') })}` : ''}
                </Line>
              )}

              {d.bowel && (
                <Line icon="leaf-outline" color={Colors.green}>
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
                <Line icon="water-outline" color={Colors.gold}>
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
                <Line icon="barbell-outline" color={Colors.coral}>
                  {d.workouts.map((w) => `${t(WORKOUT_LABEL[w.type] ?? w.type)} ${w.minutes} min`).join(' · ')}
                </Line>
              )}
              {d.meals.length > 0 && (
                <Line icon="restaurant-outline" color={Colors.amber}>
                  {t(d.meals.length === 1 ? '{n} meal logged' : '{n} meals logged', { n: d.meals.length })}
                </Line>
              )}
              {d.bp.length > 0 && (
                <Line icon="speedometer-outline" color={Colors.coral}>
                  {t('Blood pressure')} {d.bp.map((b) => `${b.systolic}/${b.diastolic}`).join(', ')}
                </Line>
              )}
              {d.glucose.length > 0 && (
                <Line icon="water" color={Colors.accent}>
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
  safeArea: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: 20, paddingBottom: 40, gap: 10 },
  intro: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20, marginBottom: 6 },
  card: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    padding: 14,
    gap: 6,
  },
  cardFlag: { borderColor: withAlpha(Colors.attention, 0.45) },
  cardFocus: { borderColor: Colors.accent, borderWidth: 2 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  date: { flex: 1, color: Colors.textPrimary, fontSize: 15, fontWeight: '700', textTransform: 'capitalize' },
  slotsHelp: { color: Colors.textMuted, fontSize: 12, lineHeight: 17, marginTop: -4, marginBottom: 6 },
  slots: { flexDirection: 'row', gap: 6 },
  slot: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  slotFilled: { backgroundColor: withAlpha(Colors.gold, 0.16), borderWidth: 1, borderColor: withAlpha(Colors.gold, 0.6) },
  slotEmpty: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: withAlpha(Colors.textMuted, 0.6) },
  slotEmoji: { fontSize: 16 },
  checkInLine: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  flag: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  flagText: { flex: 1, color: Colors.attention, fontSize: 13, fontWeight: '600' },
  none: { color: Colors.textMuted, fontSize: 13 },
  line: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  lineIcon: { marginTop: 2 },
  lineText: { flex: 1, color: Colors.textSecondary, fontSize: 13, lineHeight: 19 },
  strong: { color: Colors.textPrimary, fontWeight: '700' },
  note: { color: Colors.textPrimary, fontSize: 13, lineHeight: 19, fontStyle: 'italic', marginLeft: 23 },
});
