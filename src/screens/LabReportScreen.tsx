import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { DonutChart } from '@/components/DonutChart';
import { MarkerRangeBar } from '@/components/MarkerRangeBar';
import { Colors } from '@/constants/colors';
import { getMarkerValueTextEn } from '@/data/reportContentEn';
import { FLAG_LABEL, categoryLabel } from '@/utils/reportDisplay';
import { findLabReport, flagColor, formatReportDate, markerNameEn, rangePosition, reportCounts } from '@/utils/labReportView';

// Resultados de un informe por secciones (se usa para informes anteriores;
// el último abre el recorrido completo de report-summary).
export const LabReportScreen = () => {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const entry = findLabReport(id);
  const { title, report, id: reportId } = entry;
  const counts = reportCounts(report);
  const [open, setOpen] = useState<Set<string>>(
    () => new Set(report.sections.filter((s) => s.markers.some((m) => m.flag !== 'en_rango')).map((s) => s.category_id))
  );

  const toggle = (categoryId: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return next;
    });

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="Lab Results" showBack />

        <View style={styles.summary}>
          <DonutChart
            size={96}
            strokeWidth={11}
            segments={[
              { value: counts.inRange, color: Colors.ok },
              { value: counts.needsReview, color: Colors.attention },
            ]}
            centerLabel={`${counts.inRange}`}
            centerSubLabel={`of ${counts.total}`}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.date}>
              {formatReportDate(report.test_date)} · {entry.lab}
            </Text>
            <Text style={styles.counts}>
              <Text style={{ color: Colors.ok }}>{counts.inRange} in range</Text>
              {'  ·  '}
              <Text style={{ color: Colors.attention }}>{counts.needsReview} need a look</Text>
            </Text>
          </View>
        </View>

        {report.sections.map((section) => {
          const isOpen = open.has(section.category_id);
          const flagged = section.markers.filter((m) => m.flag !== 'en_rango').length;
          return (
            <View key={section.category_id} style={styles.section}>
              <TouchableOpacity style={styles.sectionHeader} onPress={() => toggle(section.category_id)}>
                <Text style={styles.sectionTitle}>{categoryLabel(section.category_id)}</Text>
                <Text style={[styles.sectionCount, flagged > 0 && { color: Colors.attention }]}>
                  {flagged > 0 ? `${flagged} to review` : `${section.markers.length} in range`}
                </Text>
                <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.textMuted} />
              </TouchableOpacity>
              {isOpen &&
                section.markers.map((m) => {
                  const pos = rangePosition(m);
                  const content = (
                    <>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.markerName}>{markerNameEn(m)}</Text>
                        <Text style={[styles.markerFlag, { color: flagColor(m) }]}>{FLAG_LABEL[m.flag]}</Text>
                      </View>
                      <View style={styles.markerRight}>
                        <Text style={styles.markerValue}>{getMarkerValueTextEn(m.value, m.unit)}</Text>
                        {pos !== null && <MarkerRangeBar position={pos} color={flagColor(m)} width={84} />}
                      </View>
                    </>
                  );
                  // El detalle por marcador solo existe para el informe actual
                  return reportId === 'current' ? (
                    <TouchableOpacity
                      key={m.marker_id}
                      style={styles.markerRow}
                      onPress={() => router.push({ pathname: '/report-marker-detail', params: { markerId: m.marker_id } })}
                    >
                      {content}
                    </TouchableOpacity>
                  ) : (
                    <View key={m.marker_id} style={styles.markerRow}>
                      {content}
                    </View>
                  );
                })}
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
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 18,
    marginHorizontal: 20,
    marginBottom: 20,
  },
  title: { color: Colors.textPrimary, fontSize: 18, fontWeight: '700' },
  date: { color: Colors.textSecondary, fontSize: 13, marginTop: 2 },
  counts: { fontSize: 13, fontWeight: '600', marginTop: 6, color: Colors.textMuted },
  section: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    marginHorizontal: 20,
    marginBottom: 10,
    paddingHorizontal: 16,
  },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14 },
  sectionTitle: { flex: 1, color: Colors.textPrimary, fontSize: 15, fontWeight: '700' },
  sectionCount: { color: Colors.textMuted, fontSize: 12, fontWeight: '600' },
  markerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  markerName: { color: Colors.textPrimary, fontSize: 14, fontWeight: '600' },
  markerFlag: { fontSize: 12, marginTop: 2 },
  markerRight: { alignItems: 'flex-end', gap: 6 },
  markerValue: { color: Colors.textPrimary, fontSize: 13, fontWeight: '600' },
});
