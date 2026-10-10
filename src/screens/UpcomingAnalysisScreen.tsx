import { dateLocale } from '@/i18n';
import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Colors } from '@/constants/colors';
import { mockUpcomingAnalyses } from '@/data/mockData';

const formatLongDate = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString(dateLocale(), { weekday: 'long', day: 'numeric', month: 'long' });

// Huecos alternativos (dummy): los próximos días laborables a partir de la fecha actual del test.
function nextSlots(fromIso: string, count = 5) {
  const slots: string[] = [];
  const d = new Date(`${fromIso}T12:00:00`);
  while (slots.length < count) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) slots.push(d.toISOString().slice(0, 10));
  }
  return slots;
}

export const UpcomingAnalysisScreen = () => {
  const { id } = useLocalSearchParams<{ id: string }>();
  const analysis = mockUpcomingAnalyses.find((a) => a.id === id) ?? mockUpcomingAnalyses[0];
  const [date, setDate] = useState(analysis.fecha);
  const [status, setStatus] = useState<'scheduled' | 'confirmed' | 'cancelled'>('scheduled');
  const [sheet, setSheet] = useState<null | 'menu' | 'reschedule' | 'cancel'>(null);
  const slots = useMemo(() => nextSlots(analysis.fecha), [analysis.fecha]);
  const markerCount = analysis.markerGroups.reduce((n, g) => n + g.markers.length, 0);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title={analysis.nombre} showBack />

        <View style={styles.heroCard}>
          <View style={styles.heroIcon}>
            <Ionicons name={status === 'cancelled' ? 'close-circle-outline' : 'calendar'} size={26} color={Colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.heroDate}>{status === 'cancelled' ? 'Cancelled' : formatLongDate(date)}</Text>
            {status !== 'cancelled' && <Text style={styles.heroSlot}>Delivery {analysis.timeSlot}</Text>}
            <Text style={styles.heroSample}>{analysis.sampleType}</Text>
          </View>
          {status === 'confirmed' && (
            <View style={styles.confirmedPill}>
              <Ionicons name="checkmark" size={12} color={Colors.background} />
              <Text style={styles.confirmedText}>Confirmed</Text>
            </View>
          )}
        </View>

        <Text style={styles.sectionTitle}>What we'll measure</Text>
        <Text style={styles.sectionSubtitle}>{markerCount} markers</Text>
        <View style={styles.card}>
          {analysis.markerGroups.map((g, i) => (
            <View key={g.category} style={[styles.group, i > 0 && styles.groupDivider]}>
              <Text style={styles.groupTitle}>{g.category}</Text>
              <View style={styles.chips}>
                {g.markers.map((m) => (
                  <View key={m} style={styles.chip}>
                    <Text style={styles.chipText}>{m}</Text>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>

        <Text style={styles.sectionTitle}>How to prepare</Text>
        <View style={styles.card}>
          {analysis.preparation.map((p) => (
            <View key={p} style={styles.prepRow}>
              <Ionicons name="checkmark-circle-outline" size={18} color={Colors.accent} />
              <Text style={styles.prepText}>{p}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {status !== 'cancelled' && (
        <View style={styles.actions}>
          {status === 'scheduled' && (
            <TouchableOpacity style={styles.primary} onPress={() => setStatus('confirmed')}>
              <Text style={styles.primaryText}>Confirm date</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.secondary} onPress={() => setSheet('menu')}>
            <Text style={styles.secondaryText}>Reschedule or cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      <Modal visible={sheet !== null} transparent animationType="slide" onRequestClose={() => setSheet(null)}>
        <Pressable style={styles.backdrop} onPress={() => setSheet(null)} />
        <View style={styles.sheet}>
          <View style={styles.sheetHandle} />
          {sheet === 'menu' && (
            <>
              <Text style={styles.sheetTitle}>Change this test</Text>
              <TouchableOpacity style={styles.sheetOption} onPress={() => setSheet('reschedule')}>
                <Ionicons name="calendar-outline" size={22} color={Colors.accent} />
                <Text style={styles.sheetOptionText}>Reschedule</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.sheetOption} onPress={() => setSheet('cancel')}>
                <Ionicons name="close-circle-outline" size={22} color={Colors.danger} />
                <Text style={[styles.sheetOptionText, { color: Colors.danger }]}>Cancel test</Text>
              </TouchableOpacity>
            </>
          )}
          {sheet === 'reschedule' && (
            <>
              <Text style={styles.sheetTitle}>Pick a new date</Text>
              {slots.map((s) => (
                <TouchableOpacity
                  key={s}
                  style={styles.sheetOption}
                  onPress={() => {
                    setDate(s);
                    setStatus('confirmed');
                    setSheet(null);
                  }}
                >
                  <Ionicons name="time-outline" size={20} color={Colors.textSecondary} />
                  <Text style={styles.sheetOptionText}>
                    {formatLongDate(s)} · {analysis.timeSlot}
                  </Text>
                </TouchableOpacity>
              ))}
            </>
          )}
          {sheet === 'cancel' && (
            <>
              <Text style={styles.sheetTitle}>Cancel this test?</Text>
              <Text style={styles.sheetText}>
                It stays included in your subscription, so you can book it again whenever you want.
              </Text>
              <TouchableOpacity
                style={[styles.primary, { backgroundColor: Colors.danger }]}
                onPress={() => {
                  setStatus('cancelled');
                  setSheet(null);
                }}
              >
                <Text style={styles.primaryText}>Yes, cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.secondary} onPress={() => setSheet(null)}>
                <Text style={styles.secondaryText}>Keep it</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: 24 },
  heroCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.accent,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 24,
  },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.accentSoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroDate: { color: Colors.textPrimary, fontSize: 16, fontWeight: '700' },
  heroSlot: { color: Colors.textSecondary, fontSize: 13, marginTop: 2 },
  heroSample: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
  confirmedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.accent,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  confirmedText: { color: Colors.background, fontSize: 11, fontWeight: '800' },
  sectionTitle: { color: Colors.textPrimary, fontSize: 18, fontWeight: '700', paddingHorizontal: 20 },
  sectionSubtitle: { color: Colors.textSecondary, fontSize: 13, paddingHorizontal: 20, marginTop: 2, marginBottom: 12 },
  card: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 24,
    marginTop: 4,
  },
  group: { paddingVertical: 10 },
  groupDivider: { borderTopWidth: 1, borderTopColor: Colors.divider },
  groupTitle: { color: Colors.textSecondary, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { backgroundColor: Colors.accentSoft, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5 },
  chipText: { color: Colors.textPrimary, fontSize: 13 },
  prepRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  prepText: { color: Colors.textPrimary, fontSize: 14, flex: 1 },
  actions: { paddingHorizontal: 20, paddingBottom: 8, gap: 10 },
  primary: { backgroundColor: Colors.accent, borderRadius: 30, paddingVertical: 15, alignItems: 'center' },
  primaryText: { color: Colors.background, fontSize: 16, fontWeight: '700' },
  secondary: {
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 30,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 4,
  },
  secondaryText: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    backgroundColor: Colors.backgroundElevated,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 36,
    gap: 8,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.cardBorder,
    marginBottom: 8,
  },
  sheetTitle: { color: Colors.textPrimary, fontSize: 18, fontWeight: '700', marginBottom: 6 },
  sheetText: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20, marginBottom: 12 },
  sheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 16,
  },
  sheetOptionText: { color: Colors.textPrimary, fontSize: 15, fontWeight: '600' },
});
