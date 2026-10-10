import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SimpleMetricChart } from '@/components/SimpleMetricChart';
import { Colors } from '@/constants/colors';
import { currentReport, markersBackInRange, userProfile, wearableTimeseries } from '@/data/reportRepository';
import { getMarkerDisplayNameEn, getMarkerValueTextEn } from '@/data/reportContentEn';
import { t } from '@/i18n';

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
}

const HABIT_STATS: HabitStat[] = [
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

const formatStat = (value: number, decimals = 0) =>
  decimals > 0 ? value.toFixed(decimals) : Math.round(value).toString();

const toSeriesEntries = (values: number[]) =>
  values.map((valor, i) => ({ valor, fecha: wearableTimeseries.months[i] }));

// "Your evolution report" (My Data → al final): cómo han cambiado tus hábitos (sueño, pulso en
// reposo, HRV, pasos…) y qué marcadores han vuelto a su rango entre la analítica anterior y la
// actual, más la tendencia de 6 meses del wearable. Se puede compartir como texto. El informe del
// laboratorio se queda objetivo: esto vive aparte, en My Data.
const backInRange = markersBackInRange(currentReport);

function shareText() {
  const lines = [
    t('My evolution report (Kuova)'),
    '',
    t('Habits, then vs. now:'),
    ...HABIT_STATS.map((s) => `• ${t(s.label)}: ${formatStat(s.baseline, s.decimals)}${s.unit} → ${formatStat(s.current, s.decimals)}${s.unit}`),
  ];
  if (backInRange.length) {
    lines.push('', t('Markers back in range:'));
    for (const m of backInRange) lines.push(`• ${getMarkerDisplayNameEn(m.marker_id, m.display_name)}: ${getMarkerValueTextEn(m.value, m.unit)}`);
  }
  return lines.join('\n');
}

async function share() {
  const message = shareText();
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
}

export const HabitsProgressScreen = () => (
  <SafeAreaView style={styles.safeArea} edges={['top']}>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <ScreenHeader title={t('Your evolution report')} showBack />
      <Text style={styles.intro}>{t('How your habits and your markers have changed between your last two tests.')}</Text>

      {backInRange.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>{t('Back in range')}</Text>
          <View style={styles.trendCard}>
            {backInRange.map((m) => (
              <View key={m.marker_id} style={styles.markerRow}>
                <Ionicons name="checkmark-circle" size={18} color={Colors.ok} />
                <Text style={styles.markerName}>{getMarkerDisplayNameEn(m.marker_id, m.display_name)}</Text>
                <Text style={styles.markerValue}>{getMarkerValueTextEn(m.value, m.unit)}</Text>
              </View>
            ))}
          </View>
        </>
      )}

      <Text style={styles.sectionTitle}>{t('Then vs. now')}</Text>
      <View style={styles.statsGrid}>
        {HABIT_STATS.map((stat) => {
          const improved = stat.higherIsBetter ? stat.current > stat.baseline : stat.current < stat.baseline;
          return (
            <View key={stat.key} style={styles.statCard}>
              <View style={styles.statHeader}>
                <Ionicons name={stat.icon} size={18} color={Colors.accent} />
                {improved && <Ionicons name="trending-up" size={14} color={Colors.accent} />}
              </View>
              <Text style={styles.statValue}>
                {formatStat(stat.current, stat.decimals)}
                <Text style={styles.statUnit}>{stat.unit}</Text>
              </Text>
              <Text style={styles.statLabel}>{t(stat.label)}</Text>
              <Text style={styles.statBaseline}>
                {t('was {v}', { v: `${formatStat(stat.baseline, stat.decimals)}${stat.unit}` })}
              </Text>
              {stat.note && <Text style={styles.statNote}>{stat.note}</Text>}
            </View>
          );
        })}
      </View>

      <Text style={styles.sectionTitle}>{t('6-month trend')}</Text>
      <View style={styles.trendCard}>
        <Text style={styles.trendLabel}>{t('Sleep (hours/night)')}</Text>
        <SimpleMetricChart entries={toSeriesEntries(wearableTimeseries.series.sleep_avg_hours)} color={Colors.accent} />
      </View>
      <View style={styles.trendCard}>
        <Text style={styles.trendLabel}>{t('Daily steps')}</Text>
        <SimpleMetricChart entries={toSeriesEntries(wearableTimeseries.series.steps_avg_daily)} color={Colors.pulseAccent} />
      </View>

      <TouchableOpacity style={styles.share} onPress={share} activeOpacity={0.85}>
        <Ionicons name="share-outline" size={18} color={Colors.background} />
        <Text style={styles.shareText}>{t('Share my evolution report')}</Text>
      </TouchableOpacity>
    </ScrollView>
  </SafeAreaView>
);

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingBottom: 40,
  },
  intro: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20, marginHorizontal: 20, marginBottom: 16 },
  markerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  markerName: { flex: 1, color: Colors.textPrimary, fontSize: 14, fontWeight: '600' },
  markerValue: { color: Colors.textSecondary, fontSize: 13 },
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
  statUnit: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
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
