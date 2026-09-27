import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Colors } from '@/constants/colors';
import { mockShipments, mockTestHistory, Shipment, ShipmentStep } from '@/data/servicesMock';

const stepColor = (s: ShipmentStep['status']) =>
  s === 'done' ? Colors.accent : s === 'current' ? Colors.amber : Colors.cardBorder;

const ShipmentCard = ({ shipment }: { shipment: Shipment }) => {
  const active = shipment.steps.some((s) => s.status !== 'pending');
  return (
    <View style={[styles.card, !active && styles.cardMuted]}>
      <View style={styles.cardHeader}>
        <View style={styles.truck}>
          <MaterialCommunityIcons
            name={shipment.direction === 'to_you' ? 'truck-delivery-outline' : 'truck-fast-outline'}
            size={22}
            color={active ? Colors.accent : Colors.textMuted}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.testName}>{shipment.testName}</Text>
          <Text style={styles.carrier}>
            {shipment.carrier} · {shipment.trackingNumber}
          </Text>
        </View>
      </View>
      <View style={styles.etaRow}>
        <Ionicons name="time-outline" size={14} color={Colors.textSecondary} />
        <Text style={styles.eta}>
          {active ? 'Estimated delivery' : 'After you take the sample'}: {shipment.eta}
        </Text>
      </View>

      <View style={styles.timeline}>
        {shipment.steps.map((step, i) => (
          <View key={step.label} style={styles.stepRow}>
            <View style={styles.stepRail}>
              <View style={[styles.stepDot, { backgroundColor: stepColor(step.status) }]}>
                {step.status === 'done' && <Ionicons name="checkmark" size={10} color={Colors.background} />}
              </View>
              {i < shipment.steps.length - 1 && (
                <View
                  style={[
                    styles.stepLine,
                    { backgroundColor: step.status === 'done' ? Colors.accent : Colors.cardBorder },
                  ]}
                />
              )}
            </View>
            <View style={styles.stepBody}>
              <Text style={[styles.stepLabel, step.status === 'pending' && { color: Colors.textMuted }]}>
                {step.label}
              </Text>
              {step.detail ? <Text style={styles.stepDetail}>{step.detail}</Text> : null}
            </View>
            {step.date ? <Text style={styles.stepDate}>{step.date}</Text> : null}
          </View>
        ))}
      </View>
    </View>
  );
};

export const TrackTestsScreen = () => (
  <SafeAreaView style={styles.safeArea} edges={['top']}>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <ScreenHeader title="Track your tests" showBack />

      <Text style={styles.sectionTitle}>In progress</Text>
      {mockShipments.map((s) => (
        <ShipmentCard key={s.id} shipment={s} />
      ))}

      <Text style={styles.sectionTitle}>History</Text>
      <View style={styles.historyCard}>
        {mockTestHistory.map((h, i) => (
          <View key={h.id} style={[styles.historyRow, i > 0 && styles.historyDivider]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.historyName}>{h.testName}</Text>
              <Text style={styles.historyDate}>{h.date}</Text>
            </View>
            <Text style={styles.historyStatus}>{h.status}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  </SafeAreaView>
);

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: 32 },
  sectionTitle: { color: Colors.textPrimary, fontSize: 18, fontWeight: '700', paddingHorizontal: 20, marginBottom: 12, marginTop: 4 },
  card: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 14,
  },
  cardMuted: { opacity: 0.75 },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  truck: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.accentSoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  testName: { color: Colors.textPrimary, fontSize: 16, fontWeight: '700' },
  carrier: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  etaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, marginBottom: 14 },
  eta: { color: Colors.textSecondary, fontSize: 13 },
  timeline: {},
  stepRow: { flexDirection: 'row', gap: 12 },
  stepRail: { alignItems: 'center', width: 18 },
  stepDot: { width: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center' },
  stepLine: { width: 2, flex: 1, minHeight: 18, marginVertical: 2 },
  stepBody: { flex: 1, paddingBottom: 14 },
  stepLabel: { color: Colors.textPrimary, fontSize: 14, fontWeight: '600' },
  stepDetail: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  stepDate: { color: Colors.textMuted, fontSize: 12 },
  historyCard: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    paddingHorizontal: 16,
    marginHorizontal: 20,
  },
  historyRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
  historyDivider: { borderTopWidth: 1, borderTopColor: Colors.divider },
  historyName: { color: Colors.textPrimary, fontSize: 15, fontWeight: '600' },
  historyDate: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  historyStatus: { color: Colors.accent, fontSize: 12, fontWeight: '700' },
});
