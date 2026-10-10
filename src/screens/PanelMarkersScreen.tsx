import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Colors } from '@/constants/colors';
import { t } from '@/i18n';
import { BIOMARKER_CATEGORY_LABELS, PanelMarker, subscriptionPanelMarkers } from '@/utils/biomarkerLabels';

type Filter = 'all' | 'followUp';

// Qué mide cada analítica de la suscripción: el panel completo del inicio y el seguimiento de
// los 6 meses (Premium repite el seguimiento cada 3 meses). Se abre desde la tienda.
export const PanelMarkersScreen = () => {
  const [filter, setFilter] = useState<Filter>('all');
  const all = useMemo(subscriptionPanelMarkers, []);
  const followUpCount = all.filter((m) => m.followUp).length;

  const sections = useMemo(() => {
    const list = filter === 'all' ? all : all.filter((m) => m.followUp);
    const byCategory = new Map<string, PanelMarker[]>();
    for (const m of list) byCategory.set(m.category, [...(byCategory.get(m.category) ?? []), m]);
    return [...byCategory.entries()]
      .map(([category, data]) => ({
        title: t(BIOMARKER_CATEGORY_LABELS[category] ?? category),
        data: [...data].sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [all, filter]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title={t('What each analysis measures')} showBack backFallback="/store" />
        <Text style={styles.intro}>
          {t('Your subscription starts with a full panel and repeats the key markers in the follow-up at 6 months. Premium repeats the follow-up every 3 months.')}
        </Text>

        <View style={styles.summary}>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryNum}>{all.length}</Text>
            <Text style={styles.summaryLabel}>{t('Full panel')}</Text>
          </View>
          <View style={styles.summaryBox}>
            <Text style={styles.summaryNum}>{followUpCount}</Text>
            <Text style={styles.summaryLabel}>{t('6-month follow-up')}</Text>
          </View>
        </View>

        <View style={styles.filters}>
          {(['all', 'followUp'] as Filter[]).map((f) => (
            <TouchableOpacity key={f} style={[styles.filter, filter === f && styles.filterOn]} onPress={() => setFilter(f)}>
              <Text style={[styles.filterText, filter === f && styles.filterTextOn]}>
                {f === 'all' ? t('All markers') : t('Only in the follow-up')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.colHead}>
          <Text style={[styles.colHeadText, { flex: 1 }]}>{t('Marker')}</Text>
          <Text style={styles.colHeadText}>{t('At start')}</Text>
          <Text style={styles.colHeadText}>{t('At 6 months')}</Text>
        </View>

        {sections.map((s) => (
          <View key={s.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{s.title}</Text>
            {s.data.map((m) => (
              <View key={m.id} style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{m.name}</Text>
                  {m.calculated && <Text style={styles.calc}>{t('Calculated from other values')}</Text>}
                </View>
                <View style={styles.cell}>
                  <Ionicons name="checkmark-circle" size={18} color={Colors.accent} />
                </View>
                <View style={styles.cell}>
                  {m.followUp ? (
                    <Ionicons name="checkmark-circle" size={18} color={Colors.accent} />
                  ) : (
                    <Text style={styles.dash}>–</Text>
                  )}
                </View>
              </View>
            ))}
          </View>
        ))}

        <Text style={styles.footnote}>
          {t('Indicative list: the final panel is confirmed with our partner laboratory. A doctor reviews every result.')}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const CELL = 64;

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: 40 },
  intro: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20, marginHorizontal: 20, marginBottom: 14 },
  summary: { flexDirection: 'row', gap: 10, marginHorizontal: 20, marginBottom: 14 },
  summaryBox: {
    flex: 1,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  summaryNum: { color: Colors.textPrimary, fontSize: 22, fontWeight: '800' },
  summaryLabel: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  filters: { flexDirection: 'row', gap: 8, marginHorizontal: 20, marginBottom: 12 },
  filter: { borderWidth: 1, borderColor: Colors.cardBorder, backgroundColor: Colors.card, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7 },
  filterOn: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  filterText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600' },
  filterTextOn: { color: Colors.background },
  colHead: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 20,
    paddingHorizontal: 14,
    paddingBottom: 6,
  },
  colHeadText: { color: Colors.textMuted, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', width: CELL, textAlign: 'center' },
  section: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    marginHorizontal: 20,
    marginBottom: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  sectionTitle: { color: Colors.textPrimary, fontSize: 13, fontWeight: '800', paddingVertical: 6 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  name: { color: Colors.textPrimary, fontSize: 14 },
  calc: { color: Colors.textMuted, fontSize: 11, marginTop: 1 },
  cell: { width: CELL, alignItems: 'center' },
  dash: { color: Colors.textMuted, fontSize: 16 },
  footnote: { color: Colors.textMuted, fontSize: 11, textAlign: 'center', paddingHorizontal: 30, marginTop: 8, lineHeight: 16 },
});
