import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Colors } from '@/constants/colors';
import { LabUpload, labUploadRepository } from '@/data/labUploads';
import { compareUpload, ChangeVerdict, ProgressResult, VERDICT_LABEL } from '@/utils/progress';
import { useReloadOnFocus } from '@/hooks/useReloadOnFocus';

const VERDICT_COLOR = (): Record<ChangeVerdict, string> => ({
  back_in_range: Colors.ok,
  improving: Colors.ok,
  still_in_range: Colors.textSecondary,
  stable_out: Colors.attention,
  worsening: Colors.danger,
  newly_out: Colors.danger,
});

const VERDICT_ICON: Record<ChangeVerdict, string> = {
  back_in_range: 'checkmark-circle',
  improving: 'trending-up',
  still_in_range: 'remove-circle-outline',
  stable_out: 'pause-circle-outline',
  worsening: 'trending-down',
  newly_out: 'alert-circle',
};

const shortDate = (iso: string) =>
  new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

// "See my progress": qué ha cambiado en una analítica subida respecto al último valor
// conocido de cada marcador. Solo los marcadores que se han vuelto a medir.
export const ProgressScreen = () => {
  const router = useRouter();
  const { upload: uploadId } = useLocalSearchParams<{ upload: string }>();
  const [upload, setUpload] = useState<LabUpload | null>(null);
  const [result, setResult] = useState<ProgressResult | null>(null);
  const [showOthers, setShowOthers] = useState(false);

  useReloadOnFocus(
    useCallback(async () => {
      const all = await labUploadRepository.getAll();
      const u = all.find((x) => x.id === uploadId) ?? null;
      setUpload(u);
      if (u) setResult(compareUpload(u, all.filter((x) => x.id !== u.id && x.createdAt < u.createdAt)));
    }, [uploadId]),
  );

  if (!upload || !result) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScreenHeader title="Your progress" showBack />
      </SafeAreaView>
    );
  }

  const colors = VERDICT_COLOR();
  const better = result.changes.filter((c) => c.verdict === 'back_in_range' || c.verdict === 'improving').length;
  const worse = result.changes.filter((c) => c.verdict === 'worsening' || c.verdict === 'newly_out').length;
  const same = result.changes.length - better - worse;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="Your progress" showBack />
        <Text style={styles.intro}>
          {upload.testDate ? shortDate(upload.testDate) : 'Uploaded test'} · {upload.labName ?? 'User upload'}. Compared with the last value
          we had for each marker. Markers that weren't in this test stay as they were.
        </Text>

        <View style={styles.summary}>
          <Stat value={better} label="Better" color={Colors.ok} />
          <Stat value={same} label="No change" color={Colors.textSecondary} />
          <Stat value={worse} label="To watch" color={worse ? Colors.danger : Colors.textSecondary} />
        </View>

        {result.changes.length === 0 && (
          <Text style={styles.empty}>None of these markers had an earlier value to compare with.</Text>
        )}

        {result.changes.map((c) => (
          <View key={c.markerId} style={styles.card}>
            <View style={styles.row}>
              <Ionicons name={VERDICT_ICON[c.verdict] as any} size={18} color={colors[c.verdict]} />
              <Text style={styles.name}>{c.name}</Text>
              <Text style={[styles.verdict, { color: colors[c.verdict] }]}>{VERDICT_LABEL[c.verdict]}</Text>
            </View>
            <View style={styles.values}>
              <Text style={styles.before}>
                {c.before} <Text style={styles.unit}>{c.unit}</Text>
              </Text>
              <Ionicons name="arrow-forward" size={14} color={Colors.textMuted} />
              <Text style={[styles.after, { color: c.afterStatus === 'in' ? Colors.ok : Colors.attention }]}>
                {c.after} <Text style={styles.unit}>{c.unit}</Text>
              </Text>
            </View>
            <Text style={styles.meta}>
              Before: {shortDate(c.beforeDate)} ({c.beforeSource})
              {c.low !== null || c.high !== null ? ` · Range ${c.low ?? '–'}–${c.high ?? '–'}` : ''}
            </Text>
          </View>
        ))}

        {(result.firstTime.length > 0 || result.notCompared.length > 0) && (
          <TouchableOpacity style={styles.othersToggle} onPress={() => setShowOthers((v) => !v)}>
            <Text style={styles.othersText}>
              {result.firstTime.length + result.notCompared.length} other values not compared
            </Text>
            <Ionicons name={showOthers ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.textSecondary} />
          </TouchableOpacity>
        )}
        {showOthers && (
          <View style={styles.others}>
            {result.firstTime.map((f) => (
              <Text key={`f-${f.name}`} style={styles.otherLine}>
                {f.name}: {f.value} {f.unit} · first time measured
              </Text>
            ))}
            {result.notCompared.map((n, i) => (
              <Text key={`n-${n.name}-${i}`} style={styles.otherLine}>
                {n.name} · {n.reason}
              </Text>
            ))}
          </View>
        )}
      </ScrollView>

      <TouchableOpacity style={styles.cta} onPress={() => router.push({ pathname: '/plan-update', params: { upload: upload.id } })}>
        <Ionicons name="sparkles" size={18} color={Colors.background} />
        <Text style={styles.ctaText}>Update my plan</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const Stat = ({ value, label, color }: { value: number; label: string; color: string }) => (
  <View style={styles.stat}>
    <Text style={[styles.statValue, { color }]}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: 24 },
  intro: { color: Colors.textSecondary, fontSize: 13, lineHeight: 19, marginHorizontal: 20, marginBottom: 14 },
  summary: { flexDirection: 'row', gap: 10, marginHorizontal: 20, marginBottom: 16 },
  stat: { flex: 1, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 14, paddingVertical: 12, alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: '900' },
  statLabel: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  empty: { color: Colors.textSecondary, fontSize: 14, marginHorizontal: 20 },
  card: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 14, padding: 14, marginHorizontal: 20, marginBottom: 8, gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700', flex: 1 },
  verdict: { fontSize: 12, fontWeight: '800' },
  values: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  before: { color: Colors.textSecondary, fontSize: 16, fontWeight: '700' },
  after: { fontSize: 18, fontWeight: '900' },
  unit: { fontSize: 11, fontWeight: '400', color: Colors.textMuted },
  meta: { color: Colors.textMuted, fontSize: 11 },
  othersToggle: { flexDirection: 'row', alignItems: 'center', gap: 6, marginHorizontal: 20, marginTop: 10 },
  othersText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600' },
  others: { marginHorizontal: 20, marginTop: 8, gap: 4 },
  otherLine: { color: Colors.textMuted, fontSize: 12 },
  cta: {
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.accent,
    borderRadius: 30,
    paddingVertical: 16,
    marginHorizontal: 20,
    marginBottom: 12,
  },
  ctaText: { color: Colors.background, fontSize: 15, fontWeight: '800' },
});
