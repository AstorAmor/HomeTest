import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Chev, SecHead } from '@/components/fine/Fine';
import { FineGlyph } from '@/components/fine/FineMeasure';
import { DonutLegend, FineDonut, LabGauge, labStyles } from '@/components/fine/FineLab';
import {
  currentReport,
  getComputedSummaryCounts,
  getMarkersNeedingReview,
} from '@/data/reportRepository';
import {
  getMarkerDisplayNameEn,
  getMarkerValueTextEn,
} from '@/data/reportContentEn';
import { FLAG_LABEL, categoryLabel } from '@/utils/reportDisplay';
import { findLabReport, formatReportDate } from '@/utils/labReportView';
import { t, tn } from '@/i18n';
import { FINE, ff, fine } from '@/theme/fine';

// Proxy simplificado: "mejora" = cambio significativo que además ya aterrizó en rango.
// No tenemos (todavía) una tabla de qué dirección es clínicamente buena por marcador,
// así que evitamos inventar esa lógica — ver research prompt pendiente.
const countImprovedMarkers = () =>
  currentReport.sections.reduce(
    (count, section) =>
      count +
      section.markers.filter((m) => m.flag === 'en_rango' && m.trend?.significant).length,
    0
  );

const getCategoryBreakdown = () =>
  currentReport.sections
    .map((section) => {
      const total = section.markers.length;
      const inRange = section.markers.filter((m) => m.flag === 'en_rango').length;
      return { categoryId: section.category_id, title: section.title, total, inRange };
    })
    .filter((c) => c.inRange < c.total);

const asNumber = (v: number | string) => (typeof v === 'number' ? v : Number(v));

// Tu informe (el último): desde el 2026-11-16, como el «Tu informe» del prototipo. El total en un rosco fino de
// jade (en rango) y oro (para revisar) con su leyenda, los roscos pequeños de las áreas con algo que revisar y lo
// que conviene mirar en filas con línea fina, cada una con su línea de rango. Sin tarjetas ni iconos de color.
export const ReportSummaryScreen = () => {
  const router = useRouter();
  const counts = getComputedSummaryCounts();
  const markersNeedingReview = getMarkersNeedingReview();
  const improvedCount = countImprovedMarkers();
  const categoryBreakdown = getCategoryBreakdown();
  const { lab } = findLabReport('current');

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title={t('Your Report')} showBack />

        <View style={styles.body}>
          <Text style={styles.headline}>{t('Your improvement shows in the numbers')}</Text>
          <View style={styles.improved}>
            <FineGlyph name="up" size={16} color={FINE.jade} />
            <Text style={styles.improvedText}>
              {tn(improvedCount, '{n} marker improved significantly since your last test', '{n} markers improved significantly since your last test')}
            </Text>
          </View>

          {/* El rosco del informe y su leyenda */}
          <View style={styles.donutRow}>
            <FineDonut
              inRange={counts.enRango}
              review={counts.needsReview}
              label={`${counts.enRango}`}
              sub={t('of {n} in range', { n: counts.total })}
            />
            <DonutLegend inRange={counts.enRango} review={counts.needsReview} />
          </View>
          <Text style={fine.note}>
            {formatReportDate(currentReport.test_date)} · {lab}
          </Text>
        </View>

        {/* Las áreas con algo que revisar, cada una en su rosco pequeño */}
        {categoryBreakdown.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
            {categoryBreakdown.map((c) => (
              <View key={c.categoryId} style={styles.category}>
                <FineDonut size={60} stroke={3} inRange={c.inRange} review={c.total - c.inRange} label={`${c.inRange}/${c.total}`} />
                <Text style={styles.categoryLabel} numberOfLines={2}>
                  {categoryLabel(c.categoryId)}
                </Text>
              </View>
            ))}
          </ScrollView>
        )}

        {/* Informe objetivo: sin edad biológica (está en Análisis), sin plan ni hábitos */}
        <View style={styles.body}>
          <SecHead title={t('Markers that need a look')} />
          {markersNeedingReview.map((marker, i) => {
            const name = getMarkerDisplayNameEn(marker.marker_id, marker.display_name);
            const value = asNumber(marker.value);
            return (
              <TouchableOpacity
                key={marker.marker_id}
                style={[fine.row, i === markersNeedingReview.length - 1 && styles.noLine]}
                onPress={() =>
                  router.push({
                    pathname: '/report-marker-detail',
                    params: { markerId: marker.marker_id },
                  })
                }
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={`${name}, ${getMarkerValueTextEn(marker.value, marker.unit)}, ${t(FLAG_LABEL[marker.flag])}`}
              >
                <View style={styles.flex}>
                  <Text style={fine.rowTitle} numberOfLines={2}>
                    {name}
                  </Text>
                  <Text style={fine.rowSub}>
                    {categoryLabel(marker.categoryId)} · <Text style={{ color: FINE.gold }}>{t(FLAG_LABEL[marker.flag])}</Text>
                  </Text>
                  <LabGauge value={Number.isNaN(value) ? null : value} low={marker.range.low} high={marker.range.high} style={labStyles.rowGauge} />
                </View>
                <Text style={fine.rowValue}>{getMarkerValueTextEn(marker.value, marker.unit)}</Text>
                <Chev />
              </TouchableOpacity>
            );
          })}
          <Text style={fine.note}>{t('The band on each line is the range of the lab; the dot is your result.')}</Text>
          <Text style={fine.note}>{t('A value out of range is not a diagnosis. Your doctor puts it in context.')}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingBottom: 40 },
  body: { paddingHorizontal: 20 },
  flex: { flex: 1, minWidth: 0 },
  noLine: { borderBottomWidth: 0 },
  headline: { ...ff('light'), color: FINE.ivory, fontSize: 24, lineHeight: 30, letterSpacing: -0.2 },
  improved: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  improvedText: { ...ff('regular'), flex: 1, color: FINE.mute, fontSize: 13, lineHeight: 18 },
  donutRow: { flexDirection: 'row', alignItems: 'center', gap: 22, marginTop: 22 },
  categoryRow: { paddingHorizontal: 20, gap: 16, paddingTop: 18 },
  category: { alignItems: 'center', width: 74 },
  categoryLabel: { ...ff('regular'), color: FINE.mute, fontSize: 11, lineHeight: 14, marginTop: 6, textAlign: 'center' },
});
