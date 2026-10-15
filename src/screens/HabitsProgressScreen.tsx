import React, { useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader } from '@/components/ScreenHeader';
import { TrendChart } from '@/components/TrendChart';
import { Colors } from '@/constants/colors';
import { currentReport, userProfile, wearableTimeseries } from '@/data/reportRepository';
import { getMarkerDisplayNameEn, getMarkerValueTextEn } from '@/data/reportContentEn';
import { showSamples } from '@/data/dataMode';
import { LabUpload, labUploadRepository } from '@/data/labUploads';
import { useDeepState, useReloadOnFocus } from '@/hooks/useReloadOnFocus';
import { ChangeVerdict, classifyChange, compareUpload } from '@/utils/progress';
import { DailyPoint, formatSleep, useDailyWearables } from '@/wearables/dailySeries';
import { dateLocale, num, t } from '@/i18n';

interface HabitStat {
  key: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  baseline: number;
  current: number;
  unit: string;
  higherIsBetter: boolean;
  note?: string;
  decimals?: number;
  format?: (v: number) => string;
}

// Hábitos del perfil de ejemplo (cuentas de prueba)
const SAMPLE_STATS: HabitStat[] = [
  {
    key: 'sleep',
    label: 'Sleep',
    icon: 'moon-outline',
    baseline: userProfile.sleep_avg_hours.baseline,
    current: userProfile.sleep_avg_hours.current,
    unit: 'h',
    higherIsBetter: true,
    decimals: 1,
    note: `Bedtime moved from ${userProfile.typical_bedtime.baseline} to ${userProfile.typical_bedtime.current}`,
  },
  {
    key: 'sleep_regularity',
    label: 'Sleep regularity',
    icon: 'time-outline',
    baseline: userProfile.sleep_regularity_score_pct.baseline,
    current: userProfile.sleep_regularity_score_pct.current,
    unit: '%',
    higherIsBetter: true,
  },
  {
    key: 'resting_hr',
    label: 'Resting heart rate',
    icon: 'heart-outline',
    baseline: userProfile.resting_heart_rate_bpm.baseline,
    current: userProfile.resting_heart_rate_bpm.current,
    unit: 'bpm',
    higherIsBetter: false,
  },
  {
    key: 'hrv',
    label: 'HRV (RMSSD)',
    icon: 'pulse-outline',
    baseline: userProfile.hrv_rmssd_ms.baseline,
    current: userProfile.hrv_rmssd_ms.current,
    unit: 'ms',
    higherIsBetter: true,
  },
  {
    key: 'steps',
    label: 'Daily steps',
    icon: 'walk-outline',
    baseline: userProfile.steps_avg_daily.baseline,
    current: userProfile.steps_avg_daily.current,
    unit: '',
    higherIsBetter: true,
  },
  {
    key: 'exercise_days',
    label: 'Exercise days/week',
    icon: 'barbell-outline',
    baseline: userProfile.exercise_days_per_week.baseline,
    current: userProfile.exercise_days_per_week.current,
    unit: '',
    higherIsBetter: true,
  },
  {
    key: 'vo2max',
    label: 'VO2max (est.)',
    icon: 'speedometer-outline',
    baseline: userProfile.vo2max_estimate.baseline,
    current: userProfile.vo2max_estimate.current,
    unit: '',
    higherIsBetter: true,
  },
];

const formatStat = (s: HabitStat, value: number) =>
  s.format ? s.format(value) : `${s.decimals ? num(value.toFixed(s.decimals)) : Math.round(value).toLocaleString(dateLocale())}${s.unit}`;

// Cuenta real: los hábitos del wearable, últimos 14 días frente a los 14 anteriores
const WINDOW = 14;
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
function realStats(series: Partial<Record<string, DailyPoint[]>>): { stats: HabitStat[]; enough: boolean } {
  const defs: { metric: string; key: string; label: string; icon: HabitStat['icon']; unit: string; higherIsBetter: boolean; format?: (v: number) => string }[] = [
    { metric: 'sleep_duration', key: 'sleep', label: 'Sleep', icon: 'moon-outline', unit: '', higherIsBetter: true, format: (v) => formatSleep(Math.round(v)) },
    { metric: 'resting_heart_rate', key: 'resting_hr', label: 'Resting heart rate', icon: 'heart-outline', unit: ' bpm', higherIsBetter: false },
    { metric: 'hrv', key: 'hrv', label: 'HRV (RMSSD)', icon: 'pulse-outline', unit: ' ms', higherIsBetter: true },
    { metric: 'steps', key: 'steps', label: 'Daily steps', icon: 'walk-outline', unit: '', higherIsBetter: true },
    { metric: 'active_energy', key: 'kcal', label: 'Active calories', icon: 'flame-outline', unit: ' kcal', higherIsBetter: true },
  ];
  const stats: HabitStat[] = [];
  for (const d of defs) {
    const pts = series[d.metric] ?? [];
    const recent = pts.slice(-WINDOW);
    const before = pts.slice(-2 * WINDOW, -WINDOW);
    if (recent.length < 5 || before.length < 5) continue;
    stats.push({ ...d, baseline: mean(before.map((p) => p.value)), current: mean(recent.map((p) => p.value)) });
  }
  return { stats, enough: stats.length > 0 };
}

interface MarkerMove {
  id: string;
  name: string;
  now: string;
  was: string;
  verdict: ChangeVerdict;
}

// Cuentas de prueba: los marcadores del informe de ejemplo frente a su valor anterior
function sampleMoves(): MarkerMove[] {
  const out: MarkerMove[] = [];
  for (const s of currentReport.sections)
    for (const m of s.markers) {
      const prev = m.trend?.previous_value;
      if (typeof prev !== 'number' || typeof m.value !== 'number' || !m.range) continue;
      out.push({
        id: m.marker_id,
        name: getMarkerDisplayNameEn(m.marker_id, m.display_name),
        now: getMarkerValueTextEn(m.value, m.unit),
        was: getMarkerValueTextEn(prev, m.unit),
        verdict: classifyChange(prev, m.value, m.range.low ?? null, m.range.high ?? null),
      });
    }
  return out;
}

// Cuenta real: la última analítica subida frente a lo anterior (solo marcadores reconocidos y con la misma unidad)
function realMoves(uploads: LabUpload[]): MarkerMove[] {
  if (uploads.length < 2) return [];
  const sorted = [...uploads].sort((a, b) => (b.testDate ?? b.createdAt).localeCompare(a.testDate ?? a.createdAt));
  return compareUpload(sorted[0], sorted.slice(1)).changes.map((c) => ({
    id: c.markerId,
    name: c.name,
    now: `${num(c.after)} ${c.unit}`,
    was: `${num(c.before)} ${c.unit}`,
    verdict: c.verdict,
  }));
}

const GROUPS: { title: string; icon: keyof typeof Ionicons.glyphMap; color: string; verdicts: ChangeVerdict[] }[] = [
  { title: 'Back in range', icon: 'checkmark-circle', color: Colors.ok, verdicts: ['back_in_range'] },
  { title: 'Improved', icon: 'trending-up', color: Colors.accent, verdicts: ['improving'] },
  { title: 'Got worse', icon: 'trending-down', color: Colors.attention, verdicts: ['worsening', 'newly_out'] },
];

// Media de cada mes (para la tendencia de 6 meses con datos reales)
function monthly(points: DailyPoint[] = []) {
  const by = new Map<string, number[]>();
  for (const p of points) by.set(p.date.slice(0, 7), [...(by.get(p.date.slice(0, 7)) ?? []), p.value]);
  const months = [...by.keys()].sort();
  return {
    labels: months.map((m) => new Date(`${m}-15T12:00:00`).toLocaleDateString(dateLocale(), { month: 'short' })),
    values: months.map((m) => mean(by.get(m)!)),
  };
}

// "Your evolution report" (My Data → al final): cómo han cambiado tus hábitos (sueño, pulso en
// reposo, HRV, pasos…) y tus marcadores entre la analítica anterior y la actual (de vuelta en su
// rango, mejor y peor, con el aviso de que dos analíticas no son una tendencia), más la tendencia de
// 6 meses del wearable. Se puede compartir como texto. En una cuenta real todo sale de sus datos:
// sin dos analíticas o sin días suficientes del wearable, lo dice en vez de inventarlo.
export const HabitsProgressScreen = () => {
  const samples = showSamples();
  const { series } = useDailyWearables(183);
  const [uploads, setUploads] = useDeepState<LabUpload[]>([]);
  useReloadOnFocus(
    useCallback(async () => {
      if (!samples) setUploads(await labUploadRepository.getAll().catch(() => []));
    }, [samples, setUploads]),
  );

  const real = realStats(series as Partial<Record<string, DailyPoint[]>>);
  const stats = samples ? SAMPLE_STATS : real.stats;
  const moves = (samples ? sampleMoves() : realMoves(uploads)).filter((m) => GROUPS.some((g) => g.verdicts.includes(m.verdict)));
  const sleepTrend = samples
    ? { labels: wearableTimeseries.months.map((m) => new Date(`${m.slice(0, 7)}-15T12:00:00`).toLocaleDateString(dateLocale(), { month: 'short' })), values: wearableTimeseries.series.sleep_avg_hours }
    : (() => {
        const m = monthly(series.sleep_duration);
        return { labels: m.labels, values: m.values.map((v) => v / 60) };
      })();
  const stepsTrend = samples
    ? { labels: wearableTimeseries.months.map((m) => new Date(`${m.slice(0, 7)}-15T12:00:00`).toLocaleDateString(dateLocale(), { month: 'short' })), values: wearableTimeseries.series.steps_avg_daily }
    : monthly(series.steps);

  const share = async () => {
    const lines = [t('My evolution report (Kuova)'), ''];
    if (stats.length) {
      lines.push(samples ? t('Habits, then vs. now:') : t('Habits, last 14 days vs. the 14 before:'));
      for (const s of stats) lines.push(`• ${t(s.label)}: ${formatStat(s, s.baseline)} → ${formatStat(s, s.current)}`);
    }
    for (const g of GROUPS) {
      const list = moves.filter((m) => g.verdicts.includes(m.verdict));
      if (!list.length) continue;
      lines.push('', `${t(g.title)}:`);
      for (const m of list) lines.push(`• ${m.name}: ${m.was} → ${m.now}`);
    }
    if (moves.length) lines.push('', t('Two tests are not a trend: values change from day to day and between labs.'));
    const message = lines.join('\n');
    try {
      await Share.share({ message });
    } catch {
      try {
        await (globalThis as any).navigator?.clipboard?.writeText(message);
        (globalThis as any).alert?.(t('Copied. Paste it wherever you want.'));
      } catch {
        // nada más que hacer
      }
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title={t('Your evolution report')} showBack />
        <Text style={styles.intro}>{t('How your habits and your markers have changed between your last two tests.')}</Text>

        <Text style={styles.sectionTitle}>{t('Your markers')}</Text>
        {moves.length > 0 ? (
          <>
            {GROUPS.map((g) => {
              const list = moves.filter((m) => g.verdicts.includes(m.verdict));
              if (!list.length) return null;
              return (
                <View key={g.title} style={styles.trendCard}>
                  <View style={styles.groupHead}>
                    <Ionicons name={g.icon} size={18} color={g.color} />
                    <Text style={[styles.groupTitle, { color: g.color }]}>{t(g.title)}</Text>
                  </View>
                  {list.map((m) => (
                    <View key={m.id} style={styles.markerRow}>
                      <Text style={styles.markerName} numberOfLines={2}>
                        {m.name}
                      </Text>
                      <Text style={styles.markerValue}>
                        <Text style={styles.markerWas}>{m.was} → </Text>
                        {m.now}
                      </Text>
                    </View>
                  ))}
                </View>
              );
            })}
            <View style={styles.disclaimer}>
              <Ionicons name="information-circle-outline" size={16} color={Colors.textMuted} />
              <Text style={styles.disclaimerText}>
                {t('For guidance only: two tests are not a trend. A value changes from one day to another and between labs, and small changes can be noise. Talk it over with your doctor before drawing conclusions.')}
              </Text>
            </View>
          </>
        ) : (
          <Text style={styles.empty}>
            {samples
              ? t('No markers changed enough between your two tests to show here.')
              : uploads.length < 2
                ? t('To compare your markers you need two blood tests. Upload the ones you already have in Lab.')
                : t('No markers changed enough between your two tests to show here.')}
          </Text>
        )}

        <Text style={styles.sectionTitle}>{samples ? t('Then vs. now') : t('Last 14 days vs. the 14 before')}</Text>
        {stats.length > 0 ? (
          <View style={styles.statsGrid}>
            {stats.map((stat) => {
              const diff = (stat.current - stat.baseline) / (Math.abs(stat.baseline) || 1);
              const improved = Math.abs(diff) >= 0.03 && (stat.higherIsBetter ? diff > 0 : diff < 0);
              return (
                <View key={stat.key} style={styles.statCard}>
                  <View style={styles.statHeader}>
                    <Ionicons name={stat.icon} size={18} color={Colors.accent} />
                    {improved && <Ionicons name="trending-up" size={14} color={Colors.accent} />}
                  </View>
                  <Text style={styles.statValue}>{formatStat(stat, stat.current)}</Text>
                  <Text style={styles.statLabel}>{t(stat.label)}</Text>
                  <Text style={styles.statBaseline}>{t('was {v}', { v: formatStat(stat, stat.baseline) })}</Text>
                  {stat.note && <Text style={styles.statNote}>{stat.note}</Text>}
                </View>
              );
            })}
          </View>
        ) : (
          <Text style={styles.empty}>{t('Not enough wearable days yet to compare. Give it a couple of weeks.')}</Text>
        )}

        <Text style={styles.sectionTitle}>{t('6-month trend')}</Text>
        <View style={styles.trendCard}>
          <Text style={styles.trendLabel}>{t('Sleep (hours/night)')}</Text>
          <TrendChart labels={sleepTrend.labels} series={[{ color: Colors.violet, values: sleepTrend.values }]} height={120} formatValue={(v) => `${num(v.toFixed(1))} h`} />
        </View>
        <View style={styles.trendCard}>
          <Text style={styles.trendLabel}>{t('Daily steps')}</Text>
          <TrendChart labels={stepsTrend.labels} series={[{ color: Colors.sky, values: stepsTrend.values }]} height={120} formatY={(v) => `${num((v / 1000).toFixed(1))}k`} formatValue={(v) => Math.round(v).toLocaleString(dateLocale())} />
        </View>

        <TouchableOpacity style={styles.share} onPress={share} activeOpacity={0.85}>
          <Ionicons name="share-outline" size={18} color={Colors.background} />
          <Text style={styles.shareText}>{t('Share my evolution report')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingBottom: 40,
  },
  intro: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20, marginHorizontal: 20, marginBottom: 16 },
  empty: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20, marginHorizontal: 20, marginBottom: 20 },
  groupHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  groupTitle: { fontSize: 15, fontWeight: '700' },
  markerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  markerName: { flex: 1, color: Colors.textPrimary, fontSize: 14, fontWeight: '600' },
  markerValue: { color: Colors.textPrimary, fontSize: 13, fontWeight: '600', flexShrink: 0 },
  markerWas: { color: Colors.textMuted, fontWeight: '400' },
  disclaimer: { flexDirection: 'row', gap: 8, marginHorizontal: 20, marginBottom: 20, marginTop: -2 },
  disclaimerText: { flex: 1, color: Colors.textMuted, fontSize: 12, lineHeight: 17 },
  share: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.accent,
    borderRadius: 26,
    paddingVertical: 14,
    marginHorizontal: 20,
    marginTop: 12,
  },
  shareText: { color: Colors.background, fontSize: 15, fontWeight: '800' },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    paddingHorizontal: 20,
    marginBottom: 12,
    marginTop: 8,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    gap: 10,
    marginBottom: 24,
  },
  statCard: {
    width: '47%',
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 14,
    padding: 12,
  },
  statHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  statValue: {
    color: Colors.textPrimary,
    fontSize: 22,
    fontWeight: '800',
  },
  statLabel: {
    color: Colors.textPrimary,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  statBaseline: {
    color: Colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  statNote: {
    color: Colors.textMuted,
    fontSize: 10,
    marginTop: 6,
    lineHeight: 14,
  },
  trendCard: {
    marginHorizontal: 20,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
  },
  trendLabel: {
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
});
