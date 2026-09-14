import React from 'react';
import { View, Text, StyleSheet, ScrollView, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Colors } from '@/constants/colors';
import {
  mockPatient,
  mockBiomarkers,
  mockNextTestDate,
  mockResultsEtaDays,
  mockRecommendations,
  Biomarker,
} from '@/data/mockData';

const firstName = mockPatient.nombre.split(' ')[0];

const statusColor = (status: Biomarker['status']) => {
  switch (status) {
    case 'excellent':
    case 'good':
      return Colors.accent;
    case 'attention':
      return Colors.warning;
    case 'high':
      return Colors.danger;
    default:
      return Colors.textSecondary;
  }
};

const recommendationImages: Record<string, any> = {
  daily_walk: require('../../assets/images/daily-walk.jpg'),
  sleep_well: require('../../assets/images/sleep-well.jpg'),
};

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' });
};

export const TodayScreen = () => {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="Today" />

        <View style={styles.greeting}>
          <Text style={styles.greetingTitle}>Hi {firstName}!</Text>
          <View style={styles.bullet}>
            <Text style={styles.bulletDot}>–</Text>
            <Text style={styles.bulletText}>
              Your next blood test will be delivered {formatDate(mockNextTestDate)}.{' '}
              <Text style={styles.link}>Click here to confirm or edit</Text>
            </Text>
          </View>
          <View style={styles.bullet}>
            <Text style={styles.bulletDot}>–</Text>
            <Text style={styles.bulletText}>
              Your last results will be available in ~{mockResultsEtaDays} days
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Biomarkers</Text>
        <View style={styles.grid}>
          {mockBiomarkers.map((b) => (
            <View key={b.id} style={styles.biomarkerCard}>
              <Text style={styles.biomarkerName}>{b.nombre}</Text>
              <View style={styles.biomarkerValueRow}>
                <Text style={styles.biomarkerValue}>{b.valor}</Text>
                <Text style={styles.biomarkerUnit}> {b.unidad}</Text>
              </View>
              <Text style={[styles.biomarkerStatus, { color: statusColor(b.status) }]}>
                {b.statusLabel}
              </Text>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Health Recommendations</Text>
        <View style={styles.recommendations}>
          {mockRecommendations.map((rec) => (
            <Image
              key={rec.id}
              source={recommendationImages[rec.imageKey]}
              style={styles.recCard}
              resizeMode="cover"
              accessibilityLabel={rec.title}
            />
          ))}
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
    paddingBottom: 32,
  },
  greeting: {
    paddingHorizontal: 20,
    marginBottom: 28,
  },
  greetingTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 10,
  },
  bullet: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  bulletDot: {
    color: Colors.textSecondary,
    marginRight: 8,
  },
  bulletText: {
    flex: 1,
    color: Colors.textSecondary,
    fontSize: 15,
    lineHeight: 21,
  },
  link: {
    color: Colors.accent,
    textDecorationLine: 'underline',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
    paddingHorizontal: 20,
    marginBottom: 14,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 28,
  },
  biomarkerCard: {
    width: '47%',
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    padding: 16,
  },
  biomarkerName: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 10,
  },
  biomarkerValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 6,
  },
  biomarkerValue: {
    color: Colors.textPrimary,
    fontSize: 26,
    fontWeight: '700',
  },
  biomarkerUnit: {
    color: Colors.textSecondary,
    fontSize: 13,
  },
  biomarkerStatus: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'right',
  },
  recommendations: {
    paddingHorizontal: 20,
    gap: 12,
  },
  recCard: {
    width: '100%',
    height: 150,
    borderRadius: 16,
    marginBottom: 12,
    backgroundColor: Colors.card,
  },
});
