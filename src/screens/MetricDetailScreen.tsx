import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { TrendChart } from '@/components/TrendChart';
import { Colors } from '@/constants/colors';
import { DailyPoint, formatSleep, shortDate, useDailyWearables } from '@/wearables/dailySeries';
import { WearableMetric } from '@/wearables/types';

// Información orientativa por métrica (texto de bienestar, no diagnóstico).
// Pendiente de revisión médica antes de usuarios reales.
interface MetricInfo {
  title: string;
  unit: string;
  icon: string;
  color: string;
  higherIsBetter: boolean | null;
  format: (v: number) => string;
  what: string;
  typical: string;
  affects: string;
  band?: { low: number; high: number };
}

const INFO: Partial<Record<WearableMetric, MetricInfo>> = {
  resting_heart_rate: {
    title: 'Resting heart rate',
    unit: 'bpm',
    icon: 'heart',
    color: Colors.coral,
    higherIsBetter: false,
    format: (v) => `${Math.round(v)} bpm`,
    what: 'How many times your heart beats per minute when you are fully at rest, usually measured during sleep.',
    typical: 'Most adults sit between 50 and 80 bpm. Fitter people tend to be lower. What matters most is your own trend.',
    affects: 'A few beats above your usual can mean poor sleep, alcohol, stress, dehydration or an incoming cold.',
    band: { low: 50, high: 80 },
  },
  hrv: {
    title: 'Heart rate variability',
    unit: 'ms',
    icon: 'pulse',
    color: Colors.accent,
    higherIsBetter: true,
    format: (v) => `${Math.round(v)} ms`,
    what: 'The small variation in time between heartbeats (RMSSD). It reflects how rested and recovered your nervous system is.',
    typical: 'Very individual: from 20 to over 100 ms. Compare yourself with your own average, not with others.',
    affects: 'Drops with stress, short sleep, alcohol, illness and hard training; rises with rest, regular sleep and fitness.',
  },
  sleep_duration: {
    title: 'Sleep',
    unit: 'h',
    icon: 'moon',
    color: Colors.violet,
    higherIsBetter: true,
    format: (v) => formatSleep(v),
    what: 'Total time asleep each night, as estimated by your wearable.',
    typical: 'Adults need 7 to 9 hours. Regular bed and wake times matter as much as the total.',
    affects: 'Screens late at night, caffeine after lunch, alcohol and irregular schedules shorten and fragment sleep.',
    band: { low: 420, high: 540 },
  },
  steps: {
    title: 'Steps',
    unit: 'steps',
    icon: 'footsteps',
    color: Colors.sky,
    higherIsBetter: true,
    format: (v) => Math.round(v).toLocaleString('en-GB'),
    what: 'Total steps per day counted by your phone or wearable.',
    typical: 'Health benefits grow up to around 8,000-10,000 steps a day. Any increase from your baseline helps.',
    affects: 'Short walks after meals, taking calls on foot and stairs add up quickly.',
    band: { low: 8000, high: 12000 },
  },
  active_energy: {
    title: 'Active calories',
    unit: 'kcal',
    icon: 'flame',
    color: Colors.amber,
    higherIsBetter: true,
    format: (v) => `${Math.round(v)} kcal`,
    what: 'Energy burned through movement and exercise, on top of what your body uses at rest.',
    typical: 'Depends on body size and activity: 300-600 kcal is a common range for active adults.',
    affects: 'Training intensity, daily steps and body weight. Wearable estimates can be off by 20% or more.',
  },
  body_temperature: {
    title: 'Body temperature',
    unit: '°C',
    icon: 'thermometer',
    color: Colors.pinkSoft,
    higherIsBetter: null,
    format: (v) => `${v.toFixed(1)} °C`,
    what: 'Skin or body temperature measured by your wearable, usually overnight.',
    typical: 'Around 36.1-37.2 °C. Wearables track changes from your baseline better than absolute values.',
    affects: 'Rises with illness, alcohol, a hot room and, in women, after ovulation (luteal phase).',
    band: { low: 36.1, high: 37.2 },
  },
};

const RANGES = [
  { id: '7D', days: 7 },
  { id: '14D', days: 14 },
  { id: '1M', days: 30 },
  { id: '6M', days: 182 },
] as const;

// En 6M se agrupa por semanas (media de 7 días, contando desde el último día):
// 180 puntos diarios no se leen en una gráfica de móvil.
const weekly = (pts: DailyPoint[]): DailyPoint[] => {
  const out: DailyPoint[] = [];
  for (let end = pts.length; end > 0; end -= 7) {
    const chunk = pts.slice(Math.max(0, end - 7), end);
    out.unshift({ date: chunk[0].date, value: chunk.reduce((a, p) => a + p.value, 0) / chunk.length });
  }
  return out;
};

export const MetricDetailScreen = () => {
  const router = useRouter();
  const { kind } = useLocalSearchParams<{ kind: WearableMetric }>();
  const info = INFO[kind as WearableMetric] ?? INFO.steps!;
  const { series, isSample } = useDailyWearables(182);
  const [range, setRange] = useState<(typeof RANGES)[number]['id']>('14D');
  const days = RANGES.find((r) => r.id === range)!.days;
  const byWeek = days > 31;

  const all = series[kind as WearableMetric] ?? [];
  const daily = all.slice(-days);
  const points = byWeek ? weekly(daily) : daily;
  const values = points.map((p) => p.value);
  const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  const latestValue = values[values.length - 1];
  const recent = all.slice(-7).map((p) => p.value);
  const previous = all.slice(-14, -7).map((p) => p.value);
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
  const change = previous.length ? (mean(recent) - mean(previous)) / mean(previous) : NaN;
  const trendGood = info.higherIsBetter === null ? null : info.higherIsBetter ? change > 0 : change < 0;

  const chartScale = kind === 'sleep_duration' ? (v: number) => `${(v / 60).toFixed(1)}h` : kind === 'steps' ? (v: number) => `${(v / 1000).toFixed(1)}k` : undefined;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title={info.title} showBack />

        <View style={styles.hero}>
          <View style={[styles.icon, { backgroundColor: `${info.color}22` }]}>
            <Ionicons name={info.icon as any} size={22} color={info.color} />
          </View>
          <Text style={styles.value}>{latestValue !== undefined ? info.format(latestValue) : '—'}</Text>
          <Text style={styles.valueSub}>Latest{isSample ? ' · sample data' : ''}</Text>
        </View>

        <View style={styles.tabs}>
          {RANGES.map((r) => (
            <TouchableOpacity key={r.id} style={[styles.tab, range === r.id && styles.tabOn]} onPress={() => setRange(r.id)}>
              <Text style={[styles.tabText, range === r.id && styles.tabTextOn]}>{r.id}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.card}>
          <TrendChart
            height={150}
            labels={points.map((p) => shortDate(p.date))}
            series={[{ color: info.color, values }]}
            band={info.band}
            formatY={chartScale}
            formatValue={info.format}
          />
          <Text style={styles.tapHint}>
            {byWeek ? 'Weekly averages · tap the chart to see each week' : 'Tap the chart to see each day'}
          </Text>
        </View>

        <View style={styles.stats}>
          {[
            { label: 'Average', value: values.length ? info.format(avg) : '—' },
            { label: 'Lowest', value: values.length ? info.format(Math.min(...values)) : '—' },
            { label: 'Highest', value: values.length ? info.format(Math.max(...values)) : '—' },
          ].map((s) => (
            <View key={s.label} style={styles.stat}>
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {!Number.isNaN(change) && (
          <View style={styles.trend}>
            <Ionicons
              name={change >= 0 ? 'trending-up' : 'trending-down'}
              size={18}
              color={trendGood === null ? Colors.textSecondary : trendGood ? Colors.accent : Colors.warning}
            />
            <Text style={styles.trendText}>
              Last 7 days {change >= 0 ? 'up' : 'down'} {Math.abs(change * 100).toFixed(0)}% vs the previous 7
            </Text>
          </View>
        )}

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>What it is</Text>
          <Text style={styles.infoText}>{info.what}</Text>
          <Text style={styles.infoTitle}>Typical range</Text>
          <Text style={styles.infoText}>{info.typical}</Text>
          <Text style={styles.infoTitle}>What affects it</Text>
          <Text style={styles.infoText}>{info.affects}</Text>
          <Text style={styles.disclaimer}>General information, not a diagnosis.</Text>
        </View>

        <Text style={styles.sectionTitle}>{byWeek ? 'Weekly averages' : 'Daily values'}</Text>
        <View style={styles.list}>
          {[...points].reverse().map((p, i) => (
            <View key={p.date} style={[styles.listRow, i > 0 && styles.listDivider]}>
              <Text style={styles.listDate}>
                {byWeek ? 'Week of ' : ''}
                {new Date(`${p.date}T12:00:00`).toLocaleDateString(
                  'en-GB',
                  byWeek ? { day: 'numeric', month: 'short' } : { weekday: 'short', day: 'numeric', month: 'short' },
                )}
              </Text>
              <Text style={styles.listValue}>{info.format(p.value)}</Text>
            </View>
          ))}
        </View>

        <TouchableOpacity style={styles.manage} onPress={() => router.push('/wearables')}>
          <Ionicons name="watch-outline" size={18} color={Colors.accent} />
          <Text style={styles.manageText}>Manage connected devices</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: 32 },
  hero: { alignItems: 'center', marginBottom: 14 },
  icon: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
  value: { color: Colors.textPrimary, fontSize: 34, fontWeight: '800' },
  valueSub: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
  tabs: { flexDirection: 'row', alignSelf: 'center', backgroundColor: Colors.card, borderRadius: 18, padding: 3, marginBottom: 12 },
  tab: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 15 },
  tabOn: { backgroundColor: Colors.accent },
  tabText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '700' },
  tabTextOn: { color: Colors.background },
  card: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    padding: 16,
    paddingTop: 24,
    marginHorizontal: 20,
  },
  tapHint: { color: Colors.textMuted, fontSize: 11, textAlign: 'center', marginTop: 8 },
  stats: { flexDirection: 'row', gap: 10, marginHorizontal: 20, marginTop: 12 },
  stat: { flex: 1, backgroundColor: Colors.card, borderRadius: 12, padding: 12, alignItems: 'center' },
  statValue: { color: Colors.textPrimary, fontSize: 15, fontWeight: '800' },
  statLabel: { color: Colors.textMuted, fontSize: 11, marginTop: 2 },
  trend: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 20, marginTop: 12 },
  trendText: { color: Colors.textSecondary, fontSize: 13 },
  infoCard: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 20,
    marginTop: 16,
  },
  infoTitle: { color: Colors.textPrimary, fontSize: 14, fontWeight: '800', marginTop: 6, marginBottom: 4 },
  infoText: { color: Colors.textSecondary, fontSize: 13, lineHeight: 19 },
  disclaimer: { color: Colors.textMuted, fontSize: 11, marginTop: 10 },
  sectionTitle: { color: Colors.textPrimary, fontSize: 17, fontWeight: '700', paddingHorizontal: 20, marginTop: 20, marginBottom: 10 },
  list: { backgroundColor: Colors.card, borderRadius: 16, marginHorizontal: 20, paddingHorizontal: 14 },
  listRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 11 },
  listDivider: { borderTopWidth: 1, borderTopColor: Colors.divider },
  listDate: { color: Colors.textSecondary, fontSize: 13 },
  listValue: { color: Colors.textPrimary, fontSize: 13, fontWeight: '700' },
  manage: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 18 },
  manageText: { color: Colors.accent, fontSize: 14, fontWeight: '700' },
});
