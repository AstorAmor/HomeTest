import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { SimpleMetricChart } from '@/components/SimpleMetricChart';
import { Colors } from '@/constants/colors';

export interface GenericMetricEntry {
  id: string;
  valor: number;
  unidad: string;
  fecha: string;
  extra?: string; // ej. "Desayuno" para glucosa
}

type Range = 'D' | 'M' | '3M' | '6M';

const RANGE_DAYS: Record<Range, number> = { D: 1, M: 30, '3M': 90, '6M': 180 };
const RANGES: Range[] = ['D', 'M', '3M', '6M'];

const formatListDate = (iso: string) => {
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth() + 1}`;
};

interface SimpleMetricDetailScreenProps {
  title: string;
  color: string;
  loadEntries: () => Promise<GenericMetricEntry[]>;
  onAddPress: () => void;
  onEditPress: (id: string) => void;
}

export const SimpleMetricDetailScreen = ({
  title,
  color,
  loadEntries,
  onAddPress,
  onEditPress,
}: SimpleMetricDetailScreenProps) => {
  const navigation = useNavigation();
  const [entries, setEntries] = useState<GenericMetricEntry[]>([]);
  const [range, setRange] = useState<Range>('M');

  useEffect(() => {
    loadEntries().then(setEntries);
    const unsubscribe = navigation.addListener('focus', () => {
      loadEntries().then(setEntries);
    });
    return unsubscribe;
  }, [navigation]);

  const cutoff = Date.now() - RANGE_DAYS[range] * 24 * 60 * 60 * 1000;
  const filtered = entries
    .filter((e) => new Date(e.fecha).getTime() >= cutoff)
    .sort((a, b) => new Date(a.fecha).getTime() - new Date(b.fecha).getTime());

  const historyDesc = [...entries].sort(
    (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title={title} showBack />

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

        <View style={styles.chartCard}>
          <SimpleMetricChart entries={filtered} color={color} />
        </View>

        <TouchableOpacity style={styles.addButton} onPress={onAddPress}>
          <Ionicons name="add-circle-outline" size={20} color={color} />
          <Text style={[styles.addButtonText, { color }]}>Add reading</Text>
        </TouchableOpacity>

        <Text style={styles.sectionTitle}>History</Text>
        {historyDesc.length === 0 ? (
          <Text style={styles.emptyText}>No entries yet.</Text>
        ) : (
          <View style={styles.historyList}>
            {historyDesc.map((entry) => (
              <TouchableOpacity
                key={entry.id}
                style={styles.historyRow}
                onPress={() => onEditPress(entry.id)}
              >
                <Text style={styles.historyDate}>{formatListDate(entry.fecha)}</Text>
                <Text style={styles.historyValue}>
                  {entry.valor} {entry.unidad}
                  {entry.extra ? ` · ${entry.extra}` : ''}
                </Text>
                <Ionicons name="pencil-outline" size={16} color={Colors.textMuted} />
              </TouchableOpacity>
            ))}
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
    marginBottom: 16,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginBottom: 28,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  addButtonText: {
    fontSize: 14,
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
