import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useNavigation } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Colors } from '@/constants/colors';
import { CycleEntry, CyclePrediction } from '@/types/cycle';
import { cycleRepository } from '@/data/cycleRepository';
import { getApiBaseUrl } from '@/utils/apiBaseUrl';

const formatListDate = (iso: string) => {
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth() + 1}`;
};

const formatFullDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
};

const CONFIDENCE_LABEL: Record<string, string> = {
  low: 'Low confidence — log more cycles',
  medium: 'Medium confidence',
  high: 'High confidence',
};

export const CycleDetailScreen = () => {
  const router = useRouter();
  const navigation = useNavigation();
  const [entries, setEntries] = useState<CycleEntry[]>([]);
  const [prediction, setPrediction] = useState<CyclePrediction | null>(null);
  const [loadingPrediction, setLoadingPrediction] = useState(false);
  const [predictionError, setPredictionError] = useState('');

  const loadPrediction = async (cycleEntries: CycleEntry[]) => {
    if (cycleEntries.length < 2) {
      setPrediction(null);
      return;
    }
    setLoadingPrediction(true);
    setPredictionError('');
    try {
      const response = await fetch(`${getApiBaseUrl()}/api/predict-cycle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cycle_starts: cycleEntries.map((e) => e.fecha.slice(0, 10)),
        }),
      });
      const data = await response.json();
      if (!response.ok || data.error) {
        setPredictionError(data.error ?? 'Could not compute prediction');
        setPrediction(null);
      } else {
        setPrediction(data as CyclePrediction);
      }
    } catch (err) {
      setPredictionError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoadingPrediction(false);
    }
  };

  const refresh = () => {
    cycleRepository.getAll().then((data) => {
      setEntries(data);
      loadPrediction(data);
    });
  };

  useEffect(() => {
    refresh();
    const unsubscribe = navigation.addListener('focus', refresh);
    return unsubscribe;
  }, [navigation]);

  const historyDesc = [...entries].sort(
    (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title="Menstrual Cycle" showBack />

        {loadingPrediction && (
          <View style={styles.statusRow}>
            <ActivityIndicator color={Colors.pulseAccent} />
            <Text style={styles.statusText}>Computing prediction…</Text>
          </View>
        )}

        {predictionError ? <Text style={styles.errorText}>{predictionError}</Text> : null}

        {prediction && !prediction.error && (
          <View style={styles.predictionCard}>
            {prediction.is_late && (
              <View style={styles.lateBadge}>
                <Ionicons name="alert-circle" size={14} color={Colors.danger} />
                <Text style={styles.lateBadgeText}>
                  {prediction.days_late} day{prediction.days_late !== 1 ? 's' : ''} late
                </Text>
              </View>
            )}
            <Text style={styles.predictionLabel}>Next period predicted</Text>
            <Text style={styles.predictionDate}>
              {formatFullDate(prediction.predicted_next_start)}
            </Text>
            <Text style={styles.predictionWindow}>± {prediction.window_days} days</Text>

            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{prediction.median_cycle_length}</Text>
                <Text style={styles.statLabel}>Median length</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{prediction.avg_cycle_length}</Text>
                <Text style={styles.statLabel}>Average length</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{prediction.cycles_logged}</Text>
                <Text style={styles.statLabel}>Cycles logged</Text>
              </View>
            </View>

            <Text style={styles.confidenceText}>
              {CONFIDENCE_LABEL[prediction.confidence]}
            </Text>
          </View>
        )}

        {entries.length < 2 && !loadingPrediction && (
          <View style={styles.emptyPredictionCard}>
            <Text style={styles.emptyText}>
              Log at least 2 period start dates to get a prediction.
            </Text>
          </View>
        )}

        <TouchableOpacity style={styles.addButton} onPress={() => router.push('/log-cycle')}>
          <Ionicons name="add-circle-outline" size={20} color={Colors.pulseAccent} />
          <Text style={styles.addButtonText}>Log period start</Text>
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
                onPress={() => router.push({ pathname: '/log-cycle', params: { id: entry.id } })}
              >
                <Text style={styles.historyDate}>{formatListDate(entry.fecha)}</Text>
                <Text style={styles.historyValue}>Period start</Text>
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
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  statusText: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  errorText: {
    color: Colors.danger,
    fontSize: 13,
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  predictionCard: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    marginHorizontal: 20,
    padding: 20,
    marginBottom: 16,
    alignItems: 'center',
  },
  lateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.dangerSoft,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 14,
  },
  lateBadgeText: {
    color: Colors.danger,
    fontSize: 12,
    fontWeight: '700',
  },
  predictionLabel: {
    color: Colors.textSecondary,
    fontSize: 13,
    marginBottom: 4,
  },
  predictionDate: {
    color: Colors.textPrimary,
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 2,
  },
  predictionWindow: {
    color: Colors.textMuted,
    fontSize: 13,
    marginBottom: 20,
  },
  statsRow: {
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  statLabel: {
    color: Colors.textMuted,
    fontSize: 11,
    marginTop: 2,
    textAlign: 'center',
  },
  confidenceText: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontStyle: 'italic',
  },
  emptyPredictionCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 16,
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: 13,
    paddingHorizontal: 20,
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
    color: Colors.pulseAccent,
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
