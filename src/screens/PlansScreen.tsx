import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Colors } from '@/constants/colors';
import { getMarkerDisplayNameEn } from '@/data/reportContentEn';
import { markerIn, planHistory, reportsForProgress } from '@/data/planHistory';
import { flagColor } from '@/utils/labReportView';

const monthYear = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

// "See full plan": el plan completo más reciente y los anteriores, con cómo han
// evolucionado los marcadores que trabajaba cada acción.
export const PlansScreen = () => {
  const router = useRouter();
  const plans = planHistory();
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="Your plans" showBack />
        <Text style={styles.intro}>A new plan comes with every blood test. Earlier plans stay here so you can see how far you've come.</Text>

        {plans.map((p) => {
          const open = openId === p.id;
          return (
            <View key={p.id} style={[styles.card, p.latest && styles.cardLatest]}>
              <TouchableOpacity
                style={styles.head}
                activeOpacity={0.85}
                onPress={() => (p.latest ? router.push('/report-plan') : setOpenId(open ? null : p.id))}
              >
                <View style={[styles.icon, p.latest && { backgroundColor: Colors.accent }]}>
                  <Ionicons name={p.latest ? 'sparkles' : 'time-outline'} size={20} color={p.latest ? Colors.background : Colors.accent} />
                </View>
                <View style={{ flex: 1 }}>
                  {p.latest && <Text style={styles.badge}>Current plan</Text>}
                  <Text style={styles.title}>{monthYear(p.date)}</Text>
                  <Text style={styles.sub}>
                    {p.label} · {p.items.length} actions
                  </Text>
                </View>
                <Ionicons name={p.latest ? 'chevron-forward' : open ? 'chevron-up' : 'chevron-down'} size={20} color={Colors.textMuted} />
              </TouchableOpacity>

              {p.latest && (
                <TouchableOpacity style={styles.cta} onPress={() => router.push('/report-plan')}>
                  <Text style={styles.ctaText}>See full plan</Text>
                </TouchableOpacity>
              )}

              {!p.latest && open && (
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
                  <Text style={styles.note}>Values from your first test → your follow-up test.</Text>
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
});
