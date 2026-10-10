import { dateLocale, t } from '@/i18n';
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Colors } from '@/constants/colors';
import { getMarkerDisplayNameEn } from '@/data/reportContentEn';
import { markerIn, planHistory, reportsForProgress } from '@/data/planHistory';
import { flagColor } from '@/utils/labReportView';
import { PlanVersion, planVersionRepository } from '@/data/planVersions';
import { STATUS_LABEL } from '@/utils/planUpdate';
import { statusColor } from '@/screens/PlanUpdateScreen';
import { useDeepState, useReloadOnFocus } from '@/hooks/useReloadOnFocus';

const dayMonthYear = (iso: string) =>
  new Date(`${iso.slice(0, 10)}T12:00:00`).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'long', year: 'numeric' });

const SOURCE_LABEL: Record<PlanVersion['source'], string> = {
  upload: 'Updated from your uploaded test',
  report: 'From your Kuova report',
  professional: 'Updated by your specialist',
};

// Versión del plan actualizada (subida de analítica o profesional): acciones con su estado.
const VersionCard = ({ v, current, open, onToggle }: { v: PlanVersion; current: boolean; open: boolean; onToggle: () => void }) => (
  <View style={[styles.card, current && styles.cardLatest]}>
    <TouchableOpacity style={styles.head} activeOpacity={0.85} onPress={onToggle}>
      <View style={[styles.icon, current && { backgroundColor: Colors.accent }]}>
        <Ionicons name={current ? 'sparkles' : 'git-branch-outline'} size={20} color={current ? Colors.background : Colors.accent} />
      </View>
      <View style={{ flex: 1 }}>
        {current && <Text style={styles.badge}>{t('Current plan')}</Text>}
        <Text style={styles.title}>{dayMonthYear(v.createdAt)}</Text>
        <Text style={styles.sub}>
          {SOURCE_LABEL[v.source]} · {v.items.length} actions
        </Text>
      </View>
      <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={20} color={Colors.textMuted} />
    </TouchableOpacity>
    {open && (
      <View style={styles.items}>
        {v.items.map((it, i) => (
          <View key={`${it.title}-${i}`} style={styles.item}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
              <Text style={[styles.itemTitle, { flex: 1 }]}>{it.title}</Text>
              <Text style={[styles.status, { color: statusColor(it.status) }]}>{STATUS_LABEL[it.status]}</Text>
            </View>
            <Text style={styles.itemWhy}>{it.why}</Text>
            {it.note && <Text style={styles.itemNote}>{it.note}</Text>}
          </View>
        ))}
      </View>
    )}
  </View>
);

const monthYear = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString(dateLocale(), { month: 'long', year: 'numeric' });

// "See full plan": el plan completo más reciente y los anteriores, con cómo han
// evolucionado los marcadores que trabajaba cada acción.
export const PlansScreen = () => {
  const router = useRouter();
  const plans = planHistory();
  const [openId, setOpenId] = useState<string | null>(null);
  const [versions, setVersions] = useDeepState<PlanVersion[]>([]);
  useReloadOnFocus(
    useCallback(async () => {
      const v = await planVersionRepository.getAll().catch(() => []);
      setVersions(v);
      if (v.length) setOpenId((cur) => cur ?? v[0].id);
    }, [setVersions]),
  );
  const hasVersions = versions.length > 0;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title={t('Your plans')} showBack />
        <Text style={styles.intro}>{t("A new plan comes with every blood test. Earlier plans stay here so you can see how far you've come.")}</Text>

        {versions.map((v, i) => (
          <VersionCard key={v.id} v={v} current={i === 0} open={openId === v.id} onToggle={() => setOpenId(openId === v.id ? null : v.id)} />
        ))}

        {plans.map((raw) => {
          // Si hay versiones actualizadas, el plan del informe deja de ser el vigente.
          const p = { ...raw, latest: raw.latest && !hasVersions, fromReport: raw.latest };
          const open = openId === p.id;
          return (
            <View key={p.id} style={[styles.card, p.latest && styles.cardLatest]}>
              <TouchableOpacity
                style={styles.head}
                activeOpacity={0.85}
                onPress={() => (p.fromReport ? router.push('/report-plan') : setOpenId(open ? null : p.id))}
              >
                <View style={[styles.icon, p.latest && { backgroundColor: Colors.accent }]}>
                  <Ionicons name={p.latest ? 'sparkles' : 'time-outline'} size={20} color={p.latest ? Colors.background : Colors.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  {p.latest && <Text style={styles.badge}>{t('Current plan')}</Text>}
                  <Text style={styles.title}>{monthYear(p.date)}</Text>
                  <Text style={styles.sub}>
                    {p.label} · {p.items.length} actions
                  </Text>
                </View>
                <Ionicons name={p.fromReport ? 'chevron-forward' : open ? 'chevron-up' : 'chevron-down'} size={20} color={Colors.textMuted} />
              </TouchableOpacity>

              {p.fromReport && (
                <TouchableOpacity style={styles.cta} onPress={() => router.push('/report-plan')}>
                  <Text style={styles.ctaText}>{t('See full plan')}</Text>
                </TouchableOpacity>
              )}

              {!p.fromReport && open && (
                <View style={styles.items}>
                  {p.items.map((it) => (
                    <View key={it.title} style={styles.item}>
                      <Text style={styles.itemTitle}>{it.title}</Text>
                      <Text style={styles.itemWhy}>{it.why}</Text>
                      {it.markers.map((id) => {
                        const before = markerIn(reportsForProgress.before, id);
                        const after = markerIn(reportsForProgress.after, id);
                        if (!before) return null;
                        return (
                          <View key={id} style={styles.markerRow}>
                            <Text style={styles.markerName}>{getMarkerDisplayNameEn(id, before.display_name)}</Text>
                            <Text style={[styles.markerVal, { color: flagColor(before) }]}>{before.value ?? before.value_text}</Text>
                            <Ionicons name="arrow-forward" size={12} color={Colors.textMuted} />
                            <Text style={[styles.markerVal, after && { color: flagColor(after) }]}>
                              {after ? after.value ?? after.value_text : '—'}
                            </Text>
                            <Text style={styles.unit}>{before.unit === 'índice' ? 'index' : before.unit}</Text>
                          </View>
                        );
                      })}
                    </View>
                  ))}
                  <Text style={styles.note}>{t('Values from your first test → your follow-up test.')}</Text>
                </View>
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
  content: { paddingBottom: 32 },
  intro: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20, marginHorizontal: 20, marginBottom: 16 },
  card: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 12,
  },
  cardLatest: { borderColor: Colors.accent },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 42, height: 42, borderRadius: 21, backgroundColor: Colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  badge: { color: Colors.accent, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  title: { color: Colors.textPrimary, fontSize: 17, fontWeight: '800' },
  sub: { color: Colors.textSecondary, fontSize: 13, marginTop: 2 },
  cta: { backgroundColor: Colors.accent, borderRadius: 22, paddingVertical: 11, alignItems: 'center', marginTop: 14 },
  ctaText: { color: Colors.background, fontSize: 14, fontWeight: '800' },
  items: { marginTop: 14, gap: 12 },
  item: { borderTopWidth: 1, borderTopColor: Colors.divider, paddingTop: 12, gap: 4 },
  itemTitle: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },
  itemWhy: { color: Colors.textSecondary, fontSize: 13, lineHeight: 18 },
  markerRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  markerName: { color: Colors.textSecondary, fontSize: 12, flex: 1 },
  markerVal: { color: Colors.textPrimary, fontSize: 13, fontWeight: '700' },
  unit: { color: Colors.textMuted, fontSize: 11, minWidth: 44 },
  note: { color: Colors.textMuted, fontSize: 11, marginTop: 4 },
  status: { fontSize: 11, fontWeight: '800' },
  itemNote: { color: Colors.textPrimary, fontSize: 12, fontWeight: '600' },
});
