import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Chev } from '@/components/fine/Fine';
import { DonutLegend, FineDonut, LabGauge, labStyles, StatusWord } from '@/components/fine/FineLab';
import { getMarkerValueTextEn } from '@/data/reportContentEn';
import { FLAG_LABEL, categoryLabel } from '@/utils/reportDisplay';
import { findLabReport, formatReportDate, markerNameEn, reportCounts } from '@/utils/labReportView';
import { t } from '@/i18n';
import { markerHref } from '@/utils/markerLinks';
import { FINE, ff, fine } from '@/theme/fine';

// Resultados de un informe por secciones (se usa para informes anteriores;
// el último abre el recorrido completo de report-summary).
// Desde el 2026-11-16, en fino como «Tu informe» del prototipo: el rosco de jade y oro con su leyenda, cada
// sección con su raya y su título pequeño (se abre y se cierra) y cada valor en una fila con su línea de rango.
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
        <ScreenHeader title={t('Lab Results')} showBack />

        <View style={styles.body}>
          <Text style={styles.title}>{title}</Text>
          <Text style={fine.rowSub}>
            {formatReportDate(report.test_date)} · {entry.lab}
          </Text>
          {/* Dentro del rosco, el total de marcadores (fundador, 2026-11-18: «quiero que pongas el total de marcadores») */}
          <View style={styles.donutRow}>
            <FineDonut size={112} inRange={counts.inRange} review={counts.needsReview} label={`${counts.total}`} />
            <DonutLegend inRange={counts.inRange} review={counts.needsReview} />
          </View>

          {report.sections.map((section) => {
            const isOpen = open.has(section.category_id);
            const flagged = section.markers.filter((m) => m.flag !== 'en_rango').length;
            return (
              <View key={section.category_id}>
                <TouchableOpacity
                  style={[fine.secHead, styles.sectionHead]}
                  onPress={() => toggle(section.category_id)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: isOpen }}
                >
                  <Text style={[fine.secTitle, styles.flex]} accessibilityRole="header">
                    {categoryLabel(section.category_id)}
                  </Text>
                  <Text style={[styles.sectionCount, flagged > 0 && { color: FINE.gold }]}>
                    {flagged > 0 ? t('{n} to review', { n: flagged }) : t('{n} in range', { n: section.markers.length })}
                  </Text>
                  <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={15} color={FINE.mute} />
                </TouchableOpacity>
                {isOpen &&
                  section.markers.map((m, i) => {
                    const v = typeof m.value === 'number' ? m.value : Number(m.value);
                    const out = m.flag !== 'en_rango';
                    // Al tocarlo, ese marcador en Mis datos con todos sus valores (fundador, 2026-11-06)
                    return (
                      <TouchableOpacity
                        key={m.marker_id}
                        style={[fine.row, i === section.markers.length - 1 && styles.noLine]}
                        onPress={() => router.push(markerHref(m.marker_id, `report:${reportId}`))}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityLabel={`${markerNameEn(m)}, ${getMarkerValueTextEn(m.value, m.unit)}, ${t(FLAG_LABEL[m.flag])}`}
                      >
                        <View style={styles.flex}>
                          <Text style={fine.rowTitle} numberOfLines={2}>
                            {markerNameEn(m)}
                          </Text>
                          <LabGauge value={Number.isNaN(v) ? null : v} low={m.range.low} high={m.range.high} style={labStyles.rowGauge} />
                        </View>
                        <View style={styles.right}>
                          <Text style={fine.rowValue}>{getMarkerValueTextEn(m.value, m.unit)}</Text>
                          <StatusWord label={t(FLAG_LABEL[m.flag])} tone={out ? 'out' : 'in'} />
                        </View>
                        <Chev />
                      </TouchableOpacity>
                    );
                  })}
              </View>
            );
          })}
          <Text style={fine.note}>{t('The band on each line is the range of the lab; the dot is your result.')}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingBottom: 32 },
  body: { paddingHorizontal: 20 },
  flex: { flex: 1, minWidth: 0 },
  noLine: { borderBottomWidth: 0 },
  title: { ...ff('light'), color: FINE.ivory, fontSize: 24, lineHeight: 30, letterSpacing: -0.2 },
  donutRow: { flexDirection: 'row', alignItems: 'center', gap: 22, marginTop: 18, marginBottom: 4 },
  // Las secciones van seguidas (se abren y se cierran): menos aire que una cabecera suelta
  sectionHead: { marginTop: 14, marginBottom: 0 },
  sectionCount: { ...ff('regular'), color: FINE.mute, fontSize: 12.5 },
  right: { alignItems: 'flex-end', gap: 2 },
});
