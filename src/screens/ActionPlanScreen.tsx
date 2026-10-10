import { dateLocale } from '@/i18n';
import React, { useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { ActionPlanList } from '@/components/ActionPlanList';
import { SharePlanButton } from '@/components/SharePlanButton';
import { Colors } from '@/constants/colors';
import { currentReport } from '@/data/reportRepository';
import { PlanVersion, planVersionRepository } from '@/data/planVersions';
import { STATUS_LABEL } from '@/utils/planUpdate';
import { statusColor } from '@/screens/PlanUpdateScreen';
import { useDeepState, useReloadOnFocus } from '@/hooks/useReloadOnFocus';
import { useSections } from '@/data/appPrefs';

const longDate = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'long', year: 'numeric' });

// "Full view" desde Today → Your plan: el action plan del último informe, con el
// porqué de cada acción y la proyección de su marcador.
export const ActionPlanScreen = () => {
  const show = useSections();
  const router = useRouter();
  const [latest, setLatest] = useDeepState<PlanVersion | null>(null);
  useReloadOnFocus(
    useCallback(async () => {
      setLatest(await planVersionRepository.latest().catch(() => null));
    }, [setLatest]),
  );
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="Your action plan" showBack />
        <Text style={styles.intro}>
          Built from your blood test of {longDate(currentReport.test_date)} and your wearable data. Each action shows
          why it matters for you and where the marker could be at your next test.
        </Text>
        <View style={styles.share}>
          <SharePlanButton />
        </View>

        {latest && (
          <View style={styles.updated}>
            <Text style={styles.updatedTitle}>Your plan today</Text>
            <Text style={styles.updatedSub}>Updated {longDate(latest.createdAt.slice(0, 10))} with your latest results</Text>
            {latest.items.map((it, i) => (
              <View key={`${it.title}-${i}`} style={styles.updatedRow}>
                <View style={[styles.dot, { backgroundColor: statusColor(it.status) }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.updatedItem}>{it.title}</Text>
                  {it.note && <Text style={styles.updatedNote}>{it.note}</Text>}
                </View>
                <Text style={[styles.updatedStatus, { color: statusColor(it.status) }]}>{STATUS_LABEL[it.status]}</Text>
              </View>
            ))}
          </View>
        )}

        {latest && <Text style={styles.section}>From your {longDate(currentReport.test_date)} report</Text>}
        <ActionPlanList />

        <View style={styles.links}>
          {show('wearables') && (
            <TouchableOpacity style={styles.link} onPress={() => router.push('/habits')}>
              <Ionicons name="stats-chart-outline" size={18} color={Colors.accent} />
              <Text style={styles.linkText}>Your habits and 6-month trends</Text>
              <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.link} onPress={() => router.push('/plans')}>
            <Ionicons name="time-outline" size={18} color={Colors.accent} />
            <Text style={styles.linkText}>Earlier plans</Text>
            <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.link} onPress={() => router.push('/talk-to-specialist')}>
            <Ionicons name="chatbubbles-outline" size={18} color={Colors.accent} />
            <Text style={styles.linkText}>Talk to a specialist about your plan</Text>
            <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: 32 },
  intro: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20, marginHorizontal: 20, marginBottom: 12 },
  share: { marginHorizontal: 20, marginBottom: 16 },
  links: { marginHorizontal: 20, marginTop: 8, gap: 8 },
  updated: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.accent,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 18,
    gap: 10,
  },
  updatedTitle: { color: Colors.textPrimary, fontSize: 17, fontWeight: '800' },
  updatedSub: { color: Colors.textSecondary, fontSize: 12, marginTop: -6 },
  updatedRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  updatedItem: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },
  updatedNote: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  updatedStatus: { fontSize: 11, fontWeight: '800' },
  section: { color: Colors.textPrimary, fontSize: 16, fontWeight: '800', marginHorizontal: 20, marginBottom: 10 },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 14,
    padding: 14,
  },
  linkText: { color: Colors.textPrimary, fontSize: 14, fontWeight: '600', flex: 1 },
});
