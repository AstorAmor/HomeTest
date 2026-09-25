import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Colors } from '@/constants/colors';
import { currentReport, findMarkerInCurrentReport } from '@/data/reportRepository';
import { getMarkerExplanation } from '@/data/markerExplanations';
import { EscalationTier } from '@/types/report';

const TIER_COLOR: Record<EscalationTier, string> = {
  verde: Colors.accent,
  ambar: Colors.warning,
  rojo: Colors.danger,
  critico: Colors.danger,
};

export const ReportMarkerDetailScreen = () => {
  const { markerId } = useLocalSearchParams<{ markerId: string }>();
  const marker = markerId ? findMarkerInCurrentReport(markerId) : undefined;
  const retest = currentReport.retest.find((r) => r.marker_id === markerId);

  if (!marker) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScreenHeader title="Marker" showBack />
        <Text style={styles.notFound}>Marker not found.</Text>
      </SafeAreaView>
    );
  }

  const color = TIER_COLOR[marker.tier];

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title={marker.display_name} showBack />

        <View style={styles.valueCard}>
          <Text style={styles.value}>{marker.value_text}</Text>
          {marker.range.low !== null && marker.range.high !== null && (
            <Text style={styles.range}>
              Reference range: {marker.range.low}–{marker.range.high} {marker.unit ?? ''}
            </Text>
          )}
          <View style={[styles.badge, { backgroundColor: `${color}22` }]}>
            <Ionicons name="information-circle-outline" size={14} color={color} />
            <Text style={[styles.badgeText, { color }]}>
              {marker.flag.replace(/_/g, ' ')}
            </Text>
          </View>
        </View>

        {marker.trend && (
          <View style={styles.trendRow}>
            <Ionicons
              name={marker.trend.direction === 'sube' ? 'trending-up' : marker.trend.direction === 'baja' ? 'trending-down' : 'remove'}
              size={16}
              color={Colors.textSecondary}
            />
            <Text style={styles.trendText}>
              Previous test: {marker.trend.previous_value} ({marker.trend.previous_date})
            </Text>
          </View>
        )}

        <Text style={styles.sectionTitle}>What this means</Text>
        <Text style={styles.explanation}>{getMarkerExplanation(marker.marker_id)}</Text>

        {retest && (
          <View style={styles.retestChip}>
            <Ionicons name="calendar-outline" size={14} color={Colors.textSecondary} />
            <Text style={styles.retestText}>
              Suggested retest in {retest.months} months — {retest.reason}
            </Text>
          </View>
        )}
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
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  notFound: {
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 40,
  },
  valueCard: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    marginBottom: 16,
  },
  value: {
    color: Colors.textPrimary,
    fontSize: 32,
    fontWeight: '800',
    marginBottom: 6,
  },
  range: {
    color: Colors.textSecondary,
    fontSize: 13,
    marginBottom: 12,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 24,
  },
  trendText: {
    color: Colors.textSecondary,
    fontSize: 13,
  },
  sectionTitle: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
  },
  explanation: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 20,
  },
  retestChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 10,
    padding: 12,
  },
  retestText: {
    color: Colors.textSecondary,
    fontSize: 12,
    flex: 1,
  },
});
