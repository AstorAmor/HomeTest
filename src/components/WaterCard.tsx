import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, withAlpha } from '@/constants/colors';
import { InfoButton } from '@/components/InfoButton';
import { useDeepState, useReloadOnFocus } from '@/hooks/useReloadOnFocus';
import { dayKey } from '@/data/bathroomRepository';
import { loadDailyGoals } from '@/data/dailyGoals';
import { addWater, GLASS_ML, litres, waterOnDay, waterRepository, waterUsual, WATER_USUAL_SOURCE } from '@/data/waterRepository';
import { onDataChange } from '@/data/dataEvents';
import { DEFAULT_GOALS } from '@/logic/dailyGoals';
import { SimpleMetricEntry } from '@/types/simpleMetric';
import { dateLocale, t } from '@/i18n';

const lastSevenDays = () =>
  Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d;
  });

// Agua en Hidratación: lo bebido hoy frente a tu objetivo (Tus objetivos del día), la semana en barras
// (tocar un día lo abre) y dos botones: tu medida con un toque (un vaso, o tu botella si la has puesto)
// u otra cantidad con la rueda (/log-water), donde también se cambia la medida.
export const WaterCard = () => {
  const router = useRouter();
  const [entries, setEntries] = useDeepState<SimpleMetricEntry[]>([]);
  const [goal, setGoal] = useState(DEFAULT_GOALS.waterMl);
  const [usual, setUsual] = useState(GLASS_ML);

  const load = useCallback(async () => {
    const [all, goals, ml] = await Promise.all([
      waterRepository.getAll().catch(() => [] as SimpleMetricEntry[]),
      loadDailyGoals().catch(() => null),
      waterUsual.get().catch(() => GLASS_ML),
    ]);
    setEntries(all);
    if (goals) setGoal(goals.waterMl);
    setUsual(ml);
  }, [setEntries]);
  useReloadOnFocus(load);
  useEffect(() => onDataChange((s) => (s === 'hometest:water_entries' || s === WATER_USUAL_SOURCE) && load()), [load]);

  const addUsual = () => addWater(usual).catch(() => undefined);

  const total = waterOnDay(entries, dayKey(new Date()));

  return (
    <>
      <View style={styles.card}>
        <View style={styles.header}>
          <Ionicons name="water" size={18} color={Colors.water} />
          <Text style={styles.title}>{t('Water')}</Text>
          <InfoButton topic="daily_goals" size={16} />
          <TouchableOpacity onPress={() => router.push('/daily-goals')} hitSlop={8}>
            <Text style={styles.goal}>{t('Goal {v}', { v: litres(goal) })}</Text>
          </TouchableOpacity>
        </View>
        <Text style={styles.total}>
          {litres(total)} <Text style={styles.of}>{t('of {v} today', { v: litres(goal) })}</Text>
        </Text>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${Math.min(1, total / goal) * 100}%` }]} />
        </View>
        <View style={styles.week}>
          {lastSevenDays().map((d) => {
            const key = dayKey(d);
            const v = waterOnDay(entries, key);
            return (
              <TouchableOpacity
                key={key}
                style={styles.dayCol}
                onPress={() => router.push({ pathname: '/log-water', params: { day: key } })}
                activeOpacity={0.8}
                accessibilityLabel={`${d.toLocaleDateString(dateLocale(), { weekday: 'long' })}: ${litres(v)}`}
              >
                <View style={styles.barTrack}>
                  <View style={[styles.bar, { height: `${Math.min(1, v / goal) * 100}%`, opacity: v >= goal ? 1 : 0.65 }]} />
                </View>
                <Text style={styles.dayLabel}>{d.toLocaleDateString(dateLocale(), { weekday: 'narrow' })}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <Text style={styles.note}>{t('Water, tea, coffee, milk and other drinks all count. You need more when it is hot or you exercise.')}</Text>
      </View>
      <View style={styles.buttons}>
        <TouchableOpacity style={[styles.button, styles.buttonMain]} onPress={addUsual} activeOpacity={0.85}>
          <Ionicons name="add" size={18} color={Colors.background} />
          <Text style={[styles.buttonText, { color: Colors.background }]}>
            {usual === GLASS_ML ? t('A glass ({ml} ml)', { ml: GLASS_ML }) : t('{ml} ml', { ml: usual })}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={() => router.push('/log-water')} activeOpacity={0.85}>
          <Ionicons name="options-outline" size={18} color={Colors.water} />
          <Text style={styles.buttonText}>{t('Other amount')}</Text>
        </TouchableOpacity>
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    padding: 14,
    marginHorizontal: 20,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  title: { flex: 1, color: Colors.textPrimary, fontSize: 15, fontWeight: '700' },
  goal: { color: Colors.water, fontSize: 12, fontWeight: '700' },
  total: { color: Colors.textPrimary, fontSize: 26, fontWeight: '800' },
  of: { color: Colors.textSecondary, fontSize: 14, fontWeight: '600' },
  track: { height: 8, borderRadius: 4, backgroundColor: withAlpha(Colors.water, 0.15), marginTop: 8, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4, backgroundColor: Colors.water },
  week: { flexDirection: 'row', marginTop: 16 },
  dayCol: { flex: 1, alignItems: 'center', gap: 4 },
  barTrack: { width: 14, height: 44, borderRadius: 7, backgroundColor: withAlpha(Colors.water, 0.12), justifyContent: 'flex-end', overflow: 'hidden' },
  bar: { width: 14, borderRadius: 7, backgroundColor: Colors.water },
  dayLabel: { color: Colors.textMuted, fontSize: 11, fontWeight: '700' },
  note: { color: Colors.textMuted, fontSize: 12, lineHeight: 17, marginTop: 12 },
  buttons: { flexDirection: 'row', gap: 10, marginHorizontal: 20, marginTop: 12, marginBottom: 22 },
  button: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: withAlpha(Colors.water, 0.6),
  },
  buttonMain: { backgroundColor: Colors.water, borderColor: Colors.water },
  buttonText: { color: Colors.water, fontSize: 14, fontWeight: '800' },
});
