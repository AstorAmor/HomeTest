import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { RangeBar } from '@/components/RangeBar';
import { Colors } from '@/constants/colors';
import { mockUpcomingAnalyses, mockLabResultPanels } from '@/data/mockData';

const formatShortDate = (dateString: string) => {
  const date = new Date(dateString);
  return `${date.getDate()}/${date.getMonth() + 1}`;
};

const formatFullDate = (dateString: string) => {
  const date = new Date(dateString);
  return `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;
};

export const LabScreen = () => {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="Lab" />

        <Text style={styles.sectionTitle}>Upcoming Analysis</Text>
        <View style={styles.sectionBlock}>
          {mockUpcomingAnalyses.map((item) => (
            <View key={item.id} style={styles.upcomingCard}>
              <View style={styles.upcomingLeft}>
                <Text style={styles.upcomingName}>{item.nombre}</Text>
                <Text style={styles.upcomingDesc}>{item.descripcion}</Text>
              </View>
              <View style={styles.upcomingRight}>
                <View style={styles.dateBadge}>
                  <Text style={styles.dateBadgeText}>{formatShortDate(item.fecha)}</Text>
                </View>
                <Ionicons name="calendar-outline" size={22} color={Colors.textSecondary} />
              </View>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Lab Results</Text>
        <View style={styles.sectionBlock}>
          {mockLabResultPanels.map((panel) => (
            <View key={panel.id} style={styles.resultCard}>
              <View style={styles.resultHeader}>
                <Text style={styles.resultName}>{panel.nombre}</Text>
                <Text style={styles.resultDate}>{formatFullDate(panel.fecha)}</Text>
              </View>
              <Text
                style={[
                  styles.resultStatus,
                  { color: panel.status === 'good' ? Colors.accent : Colors.danger },
                ]}
              >
                {panel.statusLabel}
              </Text>

              <View style={styles.paramsList}>
                {panel.parametros.map((param) => (
                  <View key={param.nombre} style={styles.paramRow}>
                    <Text style={styles.paramText}>
                      {param.nombre}: {param.valor}
                    </Text>
                    <RangeBar posicion={param.posicion} estado={param.estado} />
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>

        <TouchableOpacity style={styles.requestButton}>
          <Ionicons name="flask-outline" size={20} color={Colors.background} />
          <Text style={styles.requestButtonText}>Request a new test</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.uploadButton}
          onPress={() => router.push('/upload-test')}
        >
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
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  resultName: {
    color: Colors.textPrimary,
    fontSize: 17,
    fontWeight: '700',
  },
  resultDate: {
    color: Colors.textSecondary,
    fontSize: 13,
  },
  resultStatus: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 14,
  },
  paramsList: {
    gap: 10,
  },
  paramRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  paramText: {
    color: Colors.textPrimary,
    fontSize: 14,
    flex: 1,
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
