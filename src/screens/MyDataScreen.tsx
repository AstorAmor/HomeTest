import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Sparkline } from '@/components/Sparkline';
import { Colors } from '@/constants/colors';
import { mockBiomarkers, mockDiagnosticTests, DiagnosticTest } from '@/data/mockData';

const diagnosticIcon = (status: DiagnosticTest['status']) => {
  switch (status) {
    case 'ok':
      return { name: 'happy-outline' as const, color: Colors.accent };
    case 'waiting':
      return { name: 'time-outline' as const, color: Colors.textSecondary };
    case 'attention':
      return { name: 'alert-circle-outline' as const, color: Colors.danger };
  }
};

export const MyDataScreen = () => {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="My Data" />

        <Text style={styles.sectionTitle}>Blood tests</Text>
        <View style={styles.bloodTestsCard}>
          {mockBiomarkers.map((b, index) => (
            <View
              key={b.id}
              style={[
                styles.bloodTestRow,
                index < mockBiomarkers.length - 1 && styles.bloodTestDivider,
              ]}
            >
              <View>
                <Text style={styles.bloodTestName}>{b.nombre}</Text>
                <Text style={styles.bloodTestUnit}>{b.unidad.split(' ')[0]}</Text>
              </View>
              <Sparkline data={b.history} />
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>Diagnostic tests</Text>
        <View style={styles.diagnosticGrid}>
          {mockDiagnosticTests.map((test) => {
            const icon = diagnosticIcon(test.status);
            return (
              <View key={test.id} style={styles.diagnosticCard}>
                <Text style={styles.diagnosticName}>{test.nombre}</Text>
                {test.statusLabel ? (
                  <View style={styles.diagnosticWaiting}>
                    <Ionicons name={icon.name} size={16} color={icon.color} />
                    <Text style={styles.diagnosticWaitingText}>{test.statusLabel}</Text>
                  </View>
                ) : (
                  <Ionicons name={icon.name} size={28} color={icon.color} />
                )}
              </View>
            );
          })}
        </View>

        <TouchableOpacity
          style={styles.logGlucoseButton}
          onPress={() => router.push('/log-glucose')}
        >
          <Ionicons name="add-circle-outline" size={22} color={Colors.accent} />
          <Text style={styles.logGlucoseText}>Log Glucose</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.filesCard}>
          <Ionicons name="folder-outline" size={22} color={Colors.textPrimary} />
          <Text style={styles.filesText}>Access to your files</Text>
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
  bloodTestsCard: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    marginHorizontal: 20,
    marginBottom: 28,
    paddingHorizontal: 16,
  },
  bloodTestRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
  },
  bloodTestDivider: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  bloodTestName: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  bloodTestUnit: {
    color: Colors.textSecondary,
    fontSize: 13,
  },
  diagnosticGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 20,
  },
  diagnosticCard: {
    width: '47%',
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  diagnosticName: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
    flexShrink: 1,
  },
  diagnosticWaiting: {
    alignItems: 'center',
    gap: 2,
  },
  diagnosticWaitingText: {
    color: Colors.textSecondary,
    fontSize: 10,
    textAlign: 'center',
    width: 60,
  },
  logGlucoseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    marginHorizontal: 20,
    marginBottom: 12,
    paddingVertical: 16,
  },
  logGlucoseText: {
    color: Colors.accent,
    fontSize: 15,
    fontWeight: '700',
  },
  filesCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    marginHorizontal: 20,
    paddingVertical: 18,
    paddingHorizontal: 16,
  },
  filesText: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
});
