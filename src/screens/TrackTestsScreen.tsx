import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Colors } from '@/constants/colors';
import { mockShipments, Shipment, ShipmentStep } from '@/data/servicesMock';
import { t } from '@/i18n';

const stepColor = (s: ShipmentStep['status']) =>
  s === 'done' ? Colors.accent : s === 'current' ? Colors.amber : Colors.cardBorder;

const ShipmentCard = ({ shipment, demo }: { shipment: Shipment; demo?: boolean }) => {
  const active = shipment.steps.some((s) => s.status !== 'pending');
  return (
    <View style={[styles.card, (!active || demo) && styles.cardMuted, demo && styles.cardDemo]}>
      <View style={styles.cardHeader}>
        <View style={styles.truck}>
          <MaterialCommunityIcons
            name={shipment.direction === 'to_you' ? 'truck-delivery-outline' : 'truck-fast-outline'}
            size={22}
            color={active ? Colors.accent : Colors.textMuted}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.testName}>{t(shipment.testName)}</Text>
          <Text style={styles.carrier}>
            {shipment.carrier} · {shipment.trackingNumber}
          </Text>
        </View>
      </View>
      <View style={styles.etaRow}>
        <Ionicons name="time-outline" size={14} color={Colors.textSecondary} />
        <Text style={styles.eta}>
          {active ? t('Estimated delivery') : t('After you take the sample')}: {t(shipment.eta)}
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
                {t(step.label)}
              </Text>
              {step.detail ? <Text style={styles.stepDetail}>{t(step.detail)}</Text> : null}
            </View>
            {step.date ? <Text style={styles.stepDate}>{step.date}</Text> : null}
          </View>
        ))}
      </View>
    </View>
  );
};

// "Track your tests": envíos en curso. Aún no hay pedidos reales conectados, así que en curso sale
// vacío y debajo se enseñan dos envíos de EJEMPLO, marcados como tal. Sin historial: los
// resultados ya están en Tests (My Data) y en Lab.
const realShipments: Shipment[] = [];

export const TrackTestsScreen = () => (
  <SafeAreaView style={styles.safeArea} edges={['top']}>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <ScreenHeader title={t('Track your tests')} showBack />

      <Text style={styles.sectionTitle}>{t('In progress')}</Text>
      {realShipments.length ? (
        realShipments.map((s) => <ShipmentCard key={s.id} shipment={s} />)
      ) : (
        <View style={styles.empty}>
          <MaterialCommunityIcons name="package-variant" size={22} color={Colors.textMuted} />
          <Text style={styles.emptyText}>{t('You have no tests on the way.')}</Text>
        </View>
      )}

      <View style={styles.demoHeader}>
        <Text style={styles.sectionTitleInline}>{t('What it will look like')}</Text>
        <View style={styles.demoTag}>
          <Text style={styles.demoTagText}>{t('EXAMPLE')}</Text>
        </View>
      </View>
      <Text style={styles.demoNote}>{t('These shipments are examples to show how tracking works. They are not real orders.')}</Text>
      {mockShipments.map((s) => (
        <ShipmentCard key={s.id} shipment={s} demo />
      ))}
    </ScrollView>
  </SafeAreaView>
);

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: 32 },
  sectionTitle: { color: Colors.textPrimary, fontSize: 18, fontWeight: '700', paddingHorizontal: 20, marginBottom: 12, marginTop: 4 },
  sectionTitleInline: { color: Colors.textPrimary, fontSize: 18, fontWeight: '700' },
  empty: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 20,
    marginBottom: 24,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderStyle: 'dashed',
  },
  emptyText: { color: Colors.textSecondary, fontSize: 14, flex: 1 },
  demoHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, marginBottom: 6 },
  demoTag: { backgroundColor: Colors.divider, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  demoTagText: { color: Colors.textSecondary, fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
  demoNote: { color: Colors.textMuted, fontSize: 12, lineHeight: 17, marginHorizontal: 20, marginBottom: 12 },
  cardDemo: { borderStyle: 'dashed' },
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
});
