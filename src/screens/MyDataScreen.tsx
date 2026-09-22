import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useNavigation } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Sparkline } from '@/components/Sparkline';
import { Colors } from '@/constants/colors';
import { mockBiomarkers, mockDiagnosticTests, DiagnosticTest, Biomarker } from '@/data/mockData';
import { loadSeedData } from '@/data/seedData';
import { getLiveBiomarkers } from '@/utils/liveBiomarkers';

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

const DETAIL_ROUTES: Record<string, string> = {
  sugar: '/glucose-detail',
  blood_pressure: '/blood-pressure-detail',
  cholesterol: '/cholesterol-detail',
  cortisol: '/cortisol-detail',
};

export const MyDataScreen = () => {
  const router = useRouter();
  const navigation = useNavigation();
  const [seedStatus, setSeedStatus] = useState('');
  const [biomarkers, setBiomarkers] = useState<Biomarker[]>(mockBiomarkers);

  useEffect(() => {
    getLiveBiomarkers().then(setBiomarkers);
    const unsubscribe = navigation.addListener('focus', () => {
      getLiveBiomarkers().then(setBiomarkers);
    });
    return unsubscribe;
  }, [navigation]);

  const handleLoadSeed = async () => {
    setSeedStatus('Loading…');
    const result = await loadSeedData();
    setSeedStatus(
      `Loaded: ${result.bloodPressure} blood pressure, ${result.glucose} glucose, ${result.cholesterol} cholesterol, ${result.cortisol} cortisol, ${result.cycle} cycle`
    );
    getLiveBiomarkers().then(setBiomarkers);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="My Data" />

        <Text style={styles.sectionTitle}>Blood tests</Text>
        <View style={styles.bloodTestsCard}>
          {biomarkers.map((b, index) => (
            <TouchableOpacity
              key={b.id}
              style={[
                styles.bloodTestRow,
                index < biomarkers.length - 1 && styles.bloodTestDivider,
              ]}
              onPress={() => {
                const route = DETAIL_ROUTES[b.id];
                if (route) router.push(route as any);
              }}
            >
              <View>
                <Text style={styles.bloodTestName}>{b.nombre}</Text>
                <Text style={styles.bloodTestUnit}>{b.unidad.split(' ')[0]}</Text>
              </View>
              <Sparkline data={b.history} />
            </TouchableOpacity>
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

        <TouchableOpacity
          style={styles.logGlucoseButton}
          onPress={() => router.push('/log-blood-pressure')}
        >
          <Ionicons name="add-circle-outline" size={22} color={Colors.accent} />
          <Text style={styles.logGlucoseText}>Log Blood Pressure</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.logGlucoseButton}
          onPress={() => router.push('/log-cholesterol')}
        >
          <Ionicons name="add-circle-outline" size={22} color={Colors.accent} />
          <Text style={styles.logGlucoseText}>Log Cholesterol</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.logGlucoseButton}
          onPress={() => router.push('/log-cortisol')}
        >
          <Ionicons name="add-circle-outline" size={22} color={Colors.accent} />
          <Text style={styles.logGlucoseText}>Log Cortisol</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.logGlucoseButton}
          onPress={() => router.push('/cycle-detail')}
        >
          <Ionicons name="water-outline" size={22} color={Colors.pulseAccent} />
          <Text style={[styles.logGlucoseText, { color: Colors.pulseAccent }]}>
            Menstrual Cycle
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.filesCard}>
          <Ionicons name="folder-outline" size={22} color={Colors.textPrimary} />
          <Text style={styles.filesText}>Access to your files</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.seedButton} onPress={handleLoadSeed}>
          <Ionicons name="flask-outline" size={18} color={Colors.textMuted} />
          <Text style={styles.seedButtonText}>Load dummy data (dev)</Text>
        </TouchableOpacity>
        {seedStatus ? <Text style={styles.seedStatus}>{seedStatus}</Text> : null}
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
  seedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginTop: 20,
    paddingVertical: 10,
  },
  seedButtonText: {
    color: Colors.textMuted,
    fontSize: 13,
  },
  seedStatus: {
    color: Colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
});
