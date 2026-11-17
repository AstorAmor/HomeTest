import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { InfoButton } from '@/components/InfoButton';
import { Pill } from '@/components/fine/Fine';
import { FineLink } from '@/components/fine/FineMeasure';
import { CometLine } from '@/components/CometLine';
import { ringTones } from '@/components/GlowRing';
import { useDeepState, useReloadOnFocus } from '@/hooks/useReloadOnFocus';
import { dayKey } from '@/data/bathroomRepository';
import { loadDailyGoals } from '@/data/dailyGoals';
import { addWater, GLASS_ML, litres, waterOnDay, waterRepository, waterUsual, WATER_USUAL_SOURCE } from '@/data/waterRepository';
import { onDataChange } from '@/data/dataEvents';
import { DEFAULT_GOALS } from '@/logic/dailyGoals';
import { SimpleMetricEntry } from '@/types/simpleMetric';
import { dateLocale, t } from '@/i18n';
import { FINE, ff, fine } from '@/theme/fine';

const lastSevenDays = () =>
  Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d;
  });

// Agua en Hidratación: lo bebido hoy frente a tu objetivo (Tus objetivos del día), la semana en barras
// (tocar un día lo abre) y dos botones: tu medida con un toque (un vaso, o tu botella si la has puesto)
// u otra cantidad (/log-water), donde también se cambia la medida. Desde el 2026-11-16, sin tarjeta: cabecera
// pequeña con la meta en jade, lo de hoy grande y ligero con la línea de cometa, barras finas y la píldora.
const WATER_TONES = ringTones('#83D6B4');
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
    <View>
      <View style={fine.secHead}>
        <Text style={fine.secTitle} accessibilityRole="header">
          {t('Water')}
        </Text>
        <InfoButton topic="daily_goals" size={16} />
        <TouchableOpacity onPress={() => router.push('/daily-goals')} hitSlop={8} style={styles.goal} accessibilityRole="link">
          <Text style={fine.secMore}>{t('Goal {v}', { v: litres(goal) })} ›</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.big}>
        <Text style={styles.total}>{litres(total)}</Text>
        <Text style={styles.of}>{t('of {v} today', { v: litres(goal) })}</Text>
      </View>
      <CometLine progress={Math.min(1, total / goal)} colors={WATER_TONES} thickness={4} style={styles.comet} />
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
              accessibilityRole="button"
              accessibilityLabel={`${d.toLocaleDateString(dateLocale(), { weekday: 'long' })}: ${litres(v)}`}
            >
              <View style={styles.barTrack}>
                <View style={[styles.bar, { height: `${Math.min(1, v / goal) * 100}%`, opacity: v >= goal ? 1 : 0.6 }]} />
              </View>
              <Text style={styles.dayLabel}>{d.toLocaleDateString(dateLocale(), { weekday: 'narrow' })}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={fine.note}>{t('Water, tea, coffee, milk and other drinks all count. You need more when it is hot or you exercise.')}</Text>
      <View style={styles.buttons}>
        <Pill label={`+ ${usual === GLASS_ML ? t('A glass ({ml} ml)', { ml: GLASS_ML }) : t('{ml} ml', { ml: usual })}`} onPress={addUsual} />
        <FineLink icon="options-outline" label={t('Other amount')} onPress={() => router.push('/log-water')} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  goal: { marginLeft: 'auto' },
  big: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginTop: 2 },
  total: { ...fine.num, fontSize: 36, lineHeight: 44 },
  of: { ...ff('regular'), color: FINE.mute, fontSize: 13 },
  comet: { marginTop: 8, marginHorizontal: -6 },
  week: { flexDirection: 'row', marginTop: 14 },
  dayCol: { flex: 1, alignItems: 'center', gap: 4, minHeight: 44 },
  barTrack: { width: 8, height: 44, borderRadius: 4, backgroundColor: FINE.line, justifyContent: 'flex-end', overflow: 'hidden' },
  bar: { width: 8, borderRadius: 4, backgroundColor: FINE.jade },
  dayLabel: { ...ff('regular'), color: FINE.mute, fontSize: 11 },
  buttons: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: 14, marginTop: 16 },
});
