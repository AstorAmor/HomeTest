import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SubscriptionCard } from '@/components/SubscriptionCard';
import { ScreenHeader } from '@/components/ScreenHeader';
import { DonutChart } from '@/components/DonutChart';
import { MarkerRangeBar } from '@/components/MarkerRangeBar';
import { Colors } from '@/constants/colors';
import { mockUpcomingAnalyses } from '@/data/mockData';
import { getMarkerValueTextEn } from '@/data/reportContentEn';
import {
  LAB_REPORTS,
  flagColor,
  flaggedMarkers,
  formatReportDate,
  markerNameEn,
  rangePosition,
  reportCounts,
} from '@/utils/labReportView';

const formatShortDate = (dateString: string) => {
  const date = new Date(dateString);
  return `${date.getDate()}/${date.getMonth() + 1}`;
};

export const LabScreen = () => {
  const router = useRouter();

  const openReport = (id: 'current' | 'baseline') => {
    // El informe más reciente abre el recorrido completo (resumen + plan);
    // los anteriores, la vista de resultados por secciones.
    if (id === 'current') router.push('/report-summary');
    else router.push({ pathname: '/lab-report', params: { id } });
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="Lab" />

        <Text style={styles.sectionTitle}>Upcoming Analysis</Text>
        <View style={styles.sectionBlock}>
          {mockUpcomingAnalyses.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.upcomingCard}
              onPress={() => router.push({ pathname: '/upcoming-analysis', params: { id: item.id } })}
              activeOpacity={0.85}
            >
              <View style={styles.upcomingLeft}>
                <Text style={styles.upcomingName}>{item.nombre}</Text>
                <Text style={styles.upcomingDesc}>{item.descripcion}</Text>
              </View>
              <View style={styles.upcomingRight}>
                <View style={styles.dateBadge}>
                  <Text style={styles.dateBadgeText}>{formatShortDate(item.fecha)}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Lab Results</Text>
        <View style={styles.sectionBlock}>
          {LAB_REPORTS.map(({ id, title, report }) => {
            const counts = reportCounts(report);
            const flagged = flaggedMarkers(report);
            return (
              <TouchableOpacity key={id} style={styles.resultCard} onPress={() => openReport(id)} activeOpacity={0.85}>
                <View style={styles.resultTop}>
                  <DonutChart
                    size={58}
                    strokeWidth={7}
                    segments={[
                      { value: counts.inRange, color: Colors.ok },
                      { value: counts.needsReview, color: Colors.attention },
                    ]}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.resultName}>{title}</Text>
                    <Text style={styles.resultDate}>{formatReportDate(report.test_date)}</Text>
                    <Text style={styles.resultCounts}>
                      <Text style={{ color: Colors.ok }}>{counts.inRange} in range</Text>
                      {'  ·  '}
                      <Text style={{ color: Colors.attention }}>{counts.needsReview} need a look</Text>
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
                </View>

                {flagged.length > 0 && (
                  <View style={styles.paramsList}>
                    {flagged.map((m) => {
                      const pos = rangePosition(m);
                      return (
                        <View key={m.marker_id} style={styles.paramRow}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.paramText} numberOfLines={1}>
                              {markerNameEn(m)}
                            </Text>
                            <Text style={[styles.paramValue, { color: flagColor(m) }]}>
                              {getMarkerValueTextEn(m.value, m.unit)}
                            </Text>
                          </View>
                          {pos !== null && <MarkerRangeBar position={pos} color={flagColor(m)} />}
                        </View>
                      );
                    })}
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.sectionTitle}>My subscription</Text>
        <View style={{ marginHorizontal: 20, marginBottom: 20 }}>
          <SubscriptionCard />
        </View>

        <TouchableOpacity style={styles.requestButton} onPress={() => router.push('/store')}>
          <Ionicons name="flask-outline" size={20} color={Colors.background} />
          <Text style={styles.requestButtonText}>Request a new test</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.uploadButton} onPress={() => router.push('/book-lab')}>
          <Ionicons name="calendar-outline" size={20} color={Colors.accent} />
          <Text style={styles.uploadButtonText}>Book an appointment</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.uploadButton} onPress={() => router.push('/upload-test')}>
          <Ionicons name="cloud-upload-outline" size={20} color={Colors.accent} />
          <Text style={styles.uploadButtonText}>Upload lab report (test)</Text>
        </TouchableOpacity>
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
    paddingBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
    paddingHorizontal: 20,
    marginBottom: 14,
  },
  sectionBlock: {
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 28,
  },
  upcomingCard: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  upcomingLeft: {
    flex: 1,
    marginRight: 12,
  },
  upcomingName: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  upcomingDesc: {
    color: Colors.textSecondary,
    fontSize: 13,
  },
  upcomingRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dateBadge: {
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  dateBadgeText: {
    color: Colors.textPrimary,
    fontSize: 13,
    fontWeight: '600',
  },
  resultCard: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    padding: 16,
  },
  resultTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  resultName: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  resultDate: {
    color: Colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  resultCounts: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
    color: Colors.textMuted,
  },
  paramsList: {
    gap: 10,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  paramRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  paramText: {
    color: Colors.textPrimary,
    fontSize: 13,
  },
  paramValue: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 1,
  },
  requestButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.accent,
    borderRadius: 30,
    paddingVertical: 16,
    marginHorizontal: 20,
  },
  requestButtonText: {
    color: Colors.background,
    fontSize: 16,
    fontWeight: '700',
  },
  uploadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 30,
    paddingVertical: 16,
    marginHorizontal: 20,
    marginTop: 12,
  },
  uploadButtonText: {
    color: Colors.accent,
    fontSize: 15,
    fontWeight: '700',
  },
});
