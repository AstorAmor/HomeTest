import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { DonutChart } from '@/components/DonutChart';
import { Colors } from '@/constants/colors';
import {
  currentReport,
  getComputedSummaryCounts,
  getMarkersNeedingReview,
} from '@/data/reportRepository';
import {
  getMarkerDisplayNameEn,
  getMarkerValueTextEn,
} from '@/data/reportContentEn';
import { TIER_COLOR, FLAG_LABEL, FLAG_ICON, categoryLabel } from '@/utils/reportDisplay';
import { t } from '@/i18n';

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

export const ReportSummaryScreen = () => {
  const router = useRouter();
  const { summary } = currentReport;
  const counts = getComputedSummaryCounts();
  const markersNeedingReview = getMarkersNeedingReview();
  const improvedCount = countImprovedMarkers();
  const categoryBreakdown = getCategoryBreakdown();

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title={t('Your Report')} showBack />

        <View style={styles.headlineBlock}>
          <Text style={styles.headline}>{t('Your improvement shows in the numbers')}</Text>
          <View style={styles.improvementPill}>
            <Ionicons name="trending-up" size={14} color={Colors.accent} />
            <Text style={styles.improvementPillText}>
              {improvedCount} markers improved significantly since your last test
            </Text>
          </View>
        </View>

        <View style={styles.donutRow}>
          <DonutChart
            segments={[
              { value: counts.enRango, color: Colors.ok },
              { value: counts.needsReview, color: Colors.attention },
            ]}
            centerLabel={`${counts.enRango}`}
            centerSubLabel={`of ${counts.total} in range`}
          />
          <View style={styles.legend}>
            <View style={styles.legendRow}>
              <View style={[styles.legendDot, { backgroundColor: Colors.ok }]} />
              <Text style={styles.legendText}>{counts.enRango} in range</Text>
            </View>
            <View style={styles.legendRow}>
              <View style={[styles.legendDot, { backgroundColor: Colors.attention }]} />
              <Text style={styles.legendText}>{counts.needsReview} need a look</Text>
            </View>
          </View>
        </View>

        {categoryBreakdown.length > 0 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryRow}
          >
            {categoryBreakdown.map((c) => (
              <View key={c.categoryId} style={styles.categoryCard}>
                <DonutChart
                  size={64}
                  strokeWidth={7}
                  segments={[
                    { value: c.inRange, color: Colors.ok },
                    { value: c.total - c.inRange, color: Colors.attention },
                  ]}
                  centerLabel={`${c.inRange}/${c.total}`}
                />
                <Text style={styles.categoryLabel}>{categoryLabel(c.categoryId)}</Text>
              </View>
            ))}
          </ScrollView>
        )}

        {/* Informe objetivo: sin edad biológica (está en My Data), sin plan ni hábitos */}
        <Text style={styles.sectionTitle}>{t('Markers that need a look')}</Text>
        <View style={styles.markersList}>
          {markersNeedingReview.map((marker) => {
            const color = TIER_COLOR[marker.tier];
            return (
              <TouchableOpacity
                key={marker.marker_id}
                style={styles.markerRow}
                onPress={() =>
                  router.push({
                    pathname: '/report-marker-detail',
                    params: { markerId: marker.marker_id },
                  })
                }
                activeOpacity={0.75}
              >
                <Ionicons name={FLAG_ICON[marker.flag]} size={22} color={color} />
                <View style={styles.markerTextWrap}>
                  <View style={styles.markerNameRow}>
                    <Text style={styles.markerName}>
                      {getMarkerDisplayNameEn(marker.marker_id, marker.display_name)}
                    </Text>
                    <View style={styles.categoryPill}>
                      <Text style={styles.categoryPillText}>
                        {categoryLabel(marker.categoryId)}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.markerValue}>
                    {getMarkerValueTextEn(marker.value, marker.unit)}
                  </Text>
                </View>
                <View style={[styles.markerBadge, { backgroundColor: `${color}22` }]}>
                  <Text style={[styles.markerBadgeText, { color }]}>
                    {FLAG_LABEL[marker.flag]}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
              </TouchableOpacity>
            );
          })}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingBottom: 40,
  },
  headlineBlock: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  headline: {
    color: Colors.textPrimary,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 10,
  },
  improvementPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: Colors.accentSoft,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  improvementPillText: {
    color: Colors.accent,
    fontSize: 12,
    fontWeight: '600',
  },
  donutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    gap: 24,
    marginBottom: 24,
  },
  legend: {
    gap: 10,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    color: Colors.textSecondary,
    fontSize: 13,
  },
  categoryRow: {
    paddingHorizontal: 20,
    gap: 14,
    marginBottom: 24,
  },
  categoryCard: {
    alignItems: 'center',
    width: 80,
  },
  categoryLabel: {
    color: Colors.textSecondary,
    fontSize: 11,
    marginTop: 6,
    textAlign: 'center',
  },
  phenoCard: {
    marginHorizontal: 20,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    padding: 16,
    marginBottom: 28,
  },
  phenoHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  phenoTitle: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  phenoRange: {
    color: Colors.textPrimary,
    fontSize: 26,
    fontWeight: '800',
  },
  phenoChrono: {
    color: Colors.textSecondary,
    fontSize: 12,
    marginBottom: 10,
  },
  phenoExplanation: {
    color: Colors.textSecondary,
    fontSize: 13,
    lineHeight: 19,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  markersList: {
    paddingHorizontal: 20,
    gap: 10,
    marginBottom: 28,
  },
  markerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 14,
    padding: 14,
  },
  markerTextWrap: {
    flex: 1,
  },
  markerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 2,
  },
  markerName: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  categoryPill: {
    backgroundColor: Colors.divider,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  categoryPillText: {
    color: Colors.textMuted,
    fontSize: 10,
    fontWeight: '600',
  },
  markerValue: {
    color: Colors.textSecondary,
    fontSize: 12,
  },
  markerBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  markerBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  planButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.accent,
    borderRadius: 30,
    paddingVertical: 16,
    marginHorizontal: 20,
  },
  planButtonText: {
    color: Colors.background,
    fontSize: 16,
    fontWeight: '700',
  },
  habitsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 14,
    padding: 14,
    marginHorizontal: 20,
    marginTop: 12,
  },
  habitsLinkText: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
});
