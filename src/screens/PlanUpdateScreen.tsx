import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Colors } from '@/constants/colors';
import { labUploadRepository } from '@/data/labUploads';
import { planVersionRepository, PlanItemStatus } from '@/data/planVersions';
import { compareUpload } from '@/utils/progress';
import { basePlanItems, PlanProposal, proposeUpdatedPlan, STATUS_LABEL } from '@/utils/planUpdate';
import { useReloadOnFocus } from '@/hooks/useReloadOnFocus';

export const statusColor = (s: PlanItemStatus) =>
  ({
    reached: Colors.ok,
    on_track: Colors.ok,
    needs_attention: Colors.attention,
    not_retested: Colors.textMuted,
    new: Colors.accent,
  })[s];

const ORDER: PlanItemStatus[] = ['new', 'needs_attention', 'on_track', 'reached', 'not_retested'];

// "Update plan": propuesta de plan nuevo a partir de una analítica subida. Se aplica
// como versión nueva (el plan anterior queda en el historial).
export const PlanUpdateScreen = () => {
  const router = useRouter();
  const { upload: uploadId } = useLocalSearchParams<{ upload: string }>();
  const [proposal, setProposal] = useState<PlanProposal | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useReloadOnFocus(
    useCallback(async () => {
      const [all, latest] = await Promise.all([labUploadRepository.getAll(), planVersionRepository.latest()]);
      const u = all.find((x) => x.id === uploadId);
      if (!u) return;
      const progress = compareUpload(u, all.filter((x) => x.id !== u.id && x.createdAt < u.createdAt));
      setProposal(proposeUpdatedPlan(basePlanItems(latest), progress));
    }, [uploadId]),
  );

  const apply = async () => {
    if (!proposal) return;
    setSaving(true);
    setError('');
    try {
      await planVersionRepository.save({
        source: 'upload',
        basedOn: uploadId ?? null,
        items: proposal.items,
        note: 'Updated from your uploaded test',
      });
      router.replace('/plans');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save');
      setSaving(false);
    }
  };

  const items = proposal ? [...proposal.items].sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status)) : [];

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="Update your plan" showBack />
        <Text style={styles.intro}>
          Here's how your plan changes with these results. Actions whose markers weren't in this test stay as they are.
        </Text>

        {proposal && (
          <View style={styles.chips}>
            {ORDER.filter((s) => proposal.counts[s] > 0).map((s) => (
              <View key={s} style={[styles.chip, { borderColor: statusColor(s) }]}>
                <Text style={[styles.chipText, { color: statusColor(s) }]}>
                  {proposal.counts[s]} {STATUS_LABEL[s].toLowerCase()}
                </Text>
              </View>
            ))}
          </View>
        )}

        {items.map((it, i) => (
          <View key={`${it.title}-${i}`} style={styles.card}>
            <View style={styles.head}>
              <Text style={styles.title}>{it.title}</Text>
              <Text style={[styles.badge, { color: statusColor(it.status), borderColor: statusColor(it.status) }]}>
                {STATUS_LABEL[it.status]}
              </Text>
            </View>
            <Text style={styles.why}>{it.why}</Text>
            {it.note && <Text style={styles.note}>{it.note}</Text>}
          </View>
        ))}

        <Text style={styles.disclaimer}>
          Suggested automatically from your results. It isn't a diagnosis: if something is getting worse, talk to one of
          our specialists.
        </Text>
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </ScrollView>

      <TouchableOpacity style={styles.cta} onPress={apply} disabled={!proposal || saving}>
        {saving ? (
          <ActivityIndicator color={Colors.background} />
        ) : (
          <>
            <Ionicons name="checkmark" size={18} color={Colors.background} />
            <Text style={styles.ctaText}>Apply to my plan</Text>
          </>
        )}
      </TouchableOpacity>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: 24 },
  intro: { color: Colors.textSecondary, fontSize: 13, lineHeight: 19, marginHorizontal: 20, marginBottom: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginHorizontal: 20, marginBottom: 14 },
  chip: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  chipText: { fontSize: 12, fontWeight: '700' },
  card: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 14, padding: 14, marginHorizontal: 20, marginBottom: 8, gap: 6 },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  title: { color: Colors.textPrimary, fontSize: 15, fontWeight: '800', flex: 1 },
  badge: { fontSize: 11, fontWeight: '800', borderWidth: 1, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, overflow: 'hidden' },
  why: { color: Colors.textSecondary, fontSize: 13, lineHeight: 18 },
  note: { color: Colors.textPrimary, fontSize: 12, fontWeight: '600' },
  disclaimer: { color: Colors.textMuted, fontSize: 11, lineHeight: 16, marginHorizontal: 20, marginTop: 8 },
  error: { color: Colors.danger, fontSize: 13, marginHorizontal: 20, marginTop: 8 },
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
