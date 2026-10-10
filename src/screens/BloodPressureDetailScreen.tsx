import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { BloodPressureChart } from '@/components/BloodPressureChart';
import { Colors } from '@/constants/colors';
import { useDeepState, useReloadOnFocus } from '@/hooks/useReloadOnFocus';
import { BloodPressureEntry } from '@/types/bloodPressure';
import { getBloodPressureEntries } from '@/data/bloodPressureRepository';
import { sampleBloodPressure } from '@/data/sampleReadings';
import { t } from '@/i18n';

type Range = 'D' | 'M' | '3M' | '6M';

const RANGE_DAYS: Record<Range, number> = {
  D: 1,
  M: 30,
  '3M': 90,
  '6M': 180,
};

const RANGES: Range[] = ['D', 'M', '3M', '6M'];

const formatListDate = (iso: string) => {
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth() + 1}`;
};

export const BloodPressureDetailScreen = () => {
  const router = useRouter();
  const [entries, setEntries] = useDeepState<BloodPressureEntry[]>([]);
  const [range, setRange] = useState<Range>('M');

  const load = useCallback(() => getBloodPressureEntries().then(setEntries), [setEntries]);
  useReloadOnFocus(load);

  // Sin registros propios: los de ejemplo (los mismos que enseña Mis datos), sin poder editarlos
  const isSample = entries.length === 0;
  const shown = isSample ? sampleBloodPressure() : entries;
  const cutoff = Date.now() - RANGE_DAYS[range] * 24 * 60 * 60 * 1000;
  const filtered = shown
    .filter((e) => new Date(e.fecha).getTime() >= cutoff)
    .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());

  const historyDesc = [...shown].sort(
    (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title={t('Blood Pressure')} showBack />

        <View style={styles.rangeTabs}>
          {RANGES.map((r) => (
            <TouchableOpacity
              key={r}
              style={[styles.rangeTab, range === r && styles.rangeTabActive]}
              onPress={() => setRange(r)}
            >
              <Text style={[styles.rangeTabText, range === r && styles.rangeTabTextActive]}>
                {r}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {isSample && (
          <View style={styles.sampleNote}>
            <Ionicons name="flask-outline" size={16} color={Colors.textSecondary} />
            <Text style={styles.sampleNoteText}>{t('Sample data: log your first reading to see your own.')}</Text>
          </View>
        )}
        <View style={styles.chartCard}>
          <BloodPressureChart entries={filtered} />
        </View>

        <TouchableOpacity style={styles.addButton} onPress={() => router.push('/log-blood-pressure')}>
          <Ionicons name="add-circle-outline" size={20} color={Colors.accent} />
          <Text style={styles.addButtonText}>{t('Log blood pressure')}</Text>
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>{t('History')}</Text>
        {historyDesc.length === 0 ? (
          <Text style={styles.emptyText}>
            {t('No entries yet. Add one with "Log blood pressure" above.')}
          </Text>
        ) : (
          <View style={styles.historyList}>
            {historyDesc.map((entry) => (
              <TouchableOpacity
                key={entry.id}
                style={styles.historyRow}
                disabled={isSample}
                onPress={() =>
                  router.push({ pathname: '/log-blood-pressure', params: { id: entry.id } })
                }
              >
                <Text style={styles.historyDate}>{formatListDate(entry.fecha)}</Text>
                <Text style={styles.historyValue}>
                  {entry.systolic} / {entry.diastolic} mmHg
                  {entry.pulse !== null ? `, ${entry.pulse} ${t('BPM')}` : ''}
                </Text>
                {!isSample && <Ionicons name="pencil-outline" size={16} color={Colors.textMuted} />}
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  sampleNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginBottom: 14,
    padding: 12,
    borderRadius: 12,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  sampleNoteText: { flex: 1, color: Colors.textSecondary, fontSize: 13, lineHeight: 18 },
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingBottom: 40,
  },
  rangeTabs: {
    flexDirection: 'row',
    marginHorizontal: 20,
    backgroundColor: Colors.card,
    borderRadius: 10,
    padding: 4,
    marginBottom: 20,
  },
  rangeTab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  rangeTabActive: {
    backgroundColor: Colors.cardBorder,
  },
  rangeTabText: {
    color: Colors.textMuted,
    fontSize: 13,
    fontWeight: '600',
  },
  rangeTabTextActive: {
    color: Colors.textPrimary,
  },
  chartCard: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    marginHorizontal: 20,
    padding: 16,
    marginBottom: 12,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    marginHorizontal: 20,
    marginBottom: 28,
    paddingVertical: 16,
  },
  addButtonText: {
    color: Colors.accent,
    fontSize: 15,
    fontWeight: '700',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: 13,
    paddingHorizontal: 20,
  },
  historyList: {
    marginHorizontal: 20,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 14,
    paddingHorizontal: 16,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
    gap: 12,
  },
  historyDate: {
    color: Colors.textSecondary,
    fontSize: 13,
    width: 44,
  },
  historyValue: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
});
