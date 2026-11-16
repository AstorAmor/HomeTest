import { dateLocale, t } from '@/i18n';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { CycleGoalPanel } from '@/components/CycleGoalPanel';
import { CycleStrip } from '@/components/CycleStrip';
import { toDayKey } from '@/components/MonthCalendar';
import { InfoButton } from '@/components/InfoButton';
import { Colors, withAlpha } from '@/constants/colors';
import { useReloadOnFocus } from '@/hooks/useReloadOnFocus';
import { CycleEntry, CyclePrediction } from '@/types/cycle';
import { cycleRepository } from '@/data/cycleRepository';
import { cycleGoalStore } from '@/data/cycleGoal';
import { CycleGoalAnswers } from '@/types/cycleGoal';
import { currentCyclePhase } from '@/utils/cyclePhase';
import { postAi } from '@/utils/apiBaseUrl';
import { kegelRepository } from '@/data/kegelRepository';
import { EXERCISES } from '@/data/exercises';
import { kegelDayKey, kegelWeek, KegelWeek } from '@/logic/kegel';
import { ProgressRing } from '@/components/ProgressRing';

const formatListDate = (iso: string) => {
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth() + 1}`;
};

const formatFullDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString(dateLocale(), { day: 'numeric', month: 'long', year: 'numeric' });
};

// Debajo de «Apuntar regla», los ejercicios de Kegel con su histórico mínimo, como el bloque de objetivos
// de Hoy (fundador, 2026-11-05: «centrado y tal»): el título fuera y, en la tarjeta, todo centrado: un
// anillo con los días que los hiciste de los últimos 7, un punto por día (lleno si los hiciste), cuándo
// fue la última vez y «Empezar». Toda la tarjeta abre el ejercicio.
const lastKegel = (w: KegelWeek, now = new Date()) => {
  if (!w.last) return t('Not done yet');
  if (w.last === kegelDayKey(now)) return t('Last time: today');
  if (w.last === kegelDayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1))) return t('Last time: yesterday');
  const [y, m, d] = w.last.split('-').map(Number);
  return t('Last time: {date}', { date: new Date(y, m - 1, d).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short' }) });
};

const KegelCard = ({ w, onPress }: { w: KegelWeek; onPress: () => void }) => (
  <View>
    <Text style={styles.sectionTitle}>{t('Kegel exercises')}</Text>
    <TouchableOpacity
      style={styles.kegelCard}
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={`${t('Kegel exercises, last 7 days')}: ${t('{n} of 7 days', { n: w.count })}. ${lastKegel(w)}`}
    >
      <ProgressRing progress={w.count / 7} color={Colors.pulseAccent} size={78} strokeWidth={10} trackColor={withAlpha(Colors.pulseAccent, 0.16)}>
        <Text style={styles.kegelRingNum}>{w.count}</Text>
        <Text style={styles.kegelRingSub}>{t('of 7 days')}</Text>
      </ProgressRing>
      <View style={styles.kegelDays}>
        {w.days.map((d, i) => (
          <View key={d.key} style={styles.kegelDay}>
            <View style={[styles.kegelDot, d.done && styles.kegelDotOn]} />
            <Text style={[styles.kegelDayLabel, i === 6 && styles.kegelToday]}>
              {d.date.toLocaleDateString(dateLocale(), { weekday: 'narrow' })}
            </Text>
          </View>
        ))}
      </View>
      <Text style={styles.kegelNote}>{lastKegel(w)}</Text>
      <View style={styles.kegelStart}>
        <Text style={styles.kegelStartText}>{t('Start · {n} min', { n: EXERCISES.kegel.minutes })}</Text>
        <Ionicons name="chevron-forward" size={16} color={Colors.pulseAccent} />
      </View>
    </TouchableOpacity>
  </View>
);

const CONFIDENCE_LABEL: Record<string, string> = {
  low: 'Low confidence — log more cycles',
  medium: 'Medium confidence',
  high: 'High confidence',
};

export const CycleDetailScreen = () => {
  const router = useRouter();
  const [entries, setEntries] = useState<CycleEntry[]>([]);
  const [cycleGoal, setCycleGoal] = useState<CycleGoalAnswers | null>(null);
  const [prediction, setPrediction] = useState<CyclePrediction | null>(null);
  const [loadingPrediction, setLoadingPrediction] = useState(false);
  const [predictionError, setPredictionError] = useState('');
  const [kegelDates, setKegelDates] = useState<string[]>([]);

  const loadPrediction = async (cycleEntries: CycleEntry[]) => {
    if (cycleEntries.length < 2) {
      setPrediction(null);
      return;
    }
    setLoadingPrediction(true);
    setPredictionError('');
    try {
      const response = await postAi(
        'predict-cycle',
        // Día local, como la estimación de la tarjeta de arriba (el ISO en UTC puede ser el día anterior)
        { cycle_starts: cycleEntries.map((e) => toDayKey(new Date(e.fecha))) },
        30000
      );
      const data = await response.json();
      if (!response.ok || data.error) {
        // El servidor responde en inglés: aquí, siempre el mensaje traducido
        setPredictionError(t('Could not compute prediction'));
        setPrediction(null);
      } else {
        setPrediction(data as CyclePrediction);
      }
    } catch (err) {
      setPredictionError(t('Could not compute prediction'));
    } finally {
      setLoadingPrediction(false);
    }
  };

  const refresh = () => {
    cycleRepository.getAll().then((data) => {
      setEntries(data);
      loadPrediction(data);
    });
    cycleGoalStore.get().then(setCycleGoal).catch(() => setCycleGoal(null));
    kegelRepository
      .getAll()
      .then((xs) => setKegelDates(xs.map((x) => x.fecha)))
      .catch(() => setKegelDates([]));
  };

  const refreshRef = useRef(refresh);
  useEffect(() => {
    refreshRef.current = refresh;
  });
  const load = useCallback(() => refreshRef.current(), []);
  useReloadOnFocus(load);

  const historyDesc = [...entries].sort(
    (a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
  );

  // Duración del periodo (días de regla, inicio y fin incluidos)
  const periodDays = (e: CycleEntry) =>
    e.endFecha
      ? Math.round((new Date(e.endFecha).getTime() - new Date(e.fecha).getTime()) / (24 * 3600 * 1000)) + 1
      : null;
  const durations = entries.map(periodDays).filter((d): d is number => d != null);
  const avgPeriod = durations.length ? Math.round((durations.reduce((a, b) => a + b, 0) / durations.length) * 10) / 10 : null;
  // Día, fase y cuándo llegaría la próxima regla, como en Hoy (solo con reglas suyas, sin el ejemplo)
  const cycle = entries.length ? currentCyclePhase(entries, new Date(), cycleGoal?.cycleLength, cycleGoal) : null;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title={t('Menstrual Cycle')} showBack />
        {cycle && (
          <View style={styles.stripBlock}>
            <CycleStrip info={cycle} />
          </View>
        )}
        <CycleGoalPanel />

        {loadingPrediction && (
          <View style={styles.statusRow}>
            <ActivityIndicator color={Colors.pulseAccent} />
            <Text style={styles.statusText}>{t('Computing prediction…')}</Text>
          </View>
        )}

        {predictionError ? <Text style={styles.errorText}>{predictionError}</Text> : null}

        {prediction && !prediction.error && (
          <View style={styles.predictionCard}>
            {prediction.is_late && (
              <View style={styles.lateBadge}>
                <Ionicons name="alert-circle" size={14} color={Colors.attention} />
                <Text style={styles.lateBadgeText}>
                  {prediction.days_late === 1 ? t('1 day late') : t('{n} days late', { n: prediction.days_late })}
                </Text>
              </View>
            )}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={styles.predictionLabel}>{t('Next period predicted')}</Text>
              <InfoButton topic="cycle_prediction" size={16} />
            </View>
            <Text style={styles.predictionDate}>
              {formatFullDate(prediction.predicted_next_start)}
            </Text>
            <Text style={styles.predictionWindow}>± {t('{n} days', { n: prediction.window_days })}</Text>

            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{prediction.median_cycle_length}</Text>
                <Text style={styles.statLabel}>{t('Median length')}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{prediction.avg_cycle_length}</Text>
                <Text style={styles.statLabel}>{t('Average length')}</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{avgPeriod ?? '—'}</Text>
                <Text style={styles.statLabel}>{t('Period days')}</Text>
              </View>
            </View>

            <Text style={styles.confidenceText}>
              {t(CONFIDENCE_LABEL[prediction.confidence])}
            </Text>
          </View>
        )}

        {entries.length < 2 && !loadingPrediction && !cycle?.next && (
          <View style={styles.emptyPredictionCard}>
            <Text style={styles.emptyText}>
              {t('Log at least 2 periods to get a prediction.')}
            </Text>
          </View>
        )}

        <TouchableOpacity style={styles.addButton} onPress={() => router.push('/log-cycle')}>
          <Ionicons name="add-circle-outline" size={20} color={Colors.pulseAccent} />
          <Text style={styles.addButtonText}>{t('Log period')}</Text>
        </TouchableOpacity>
        <KegelCard w={kegelWeek(kegelDates)} onPress={() => router.push({ pathname: '/exercise', params: { id: 'kegel' } })} />

        <Text style={styles.sectionTitle}>{t('History')}</Text>
        {historyDesc.length === 0 ? (
          <Text style={styles.emptyText}>{t('No entries yet.')}</Text>
        ) : (
          <View style={styles.historyList}>
            {historyDesc.map((entry) => (
              <TouchableOpacity
                key={entry.id}
                style={styles.historyRow}
                onPress={() => router.push({ pathname: '/log-cycle', params: { id: entry.id } })}
              >
                <Text style={styles.historyDate}>{formatListDate(entry.fecha)}</Text>
                <Text style={styles.historyValue}>
                  {entry.endFecha
                    ? t('until {date} · {n} days', { date: formatListDate(entry.endFecha), n: periodDays(entry) ?? 0 })
                    : t('Ongoing / end not logged')}
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
    backgroundColor: 'transparent',
  },
  content: {
    paddingBottom: 40,
  },
  stripBlock: {
    paddingHorizontal: 20,
    marginBottom: 16,
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
    backgroundColor: withAlpha(Colors.attention, 0.12),
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 14,
  },
  lateBadgeText: {
    color: Colors.attention,
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
    marginBottom: 24,
    paddingVertical: 16,
  },
  addButtonText: {
    color: Colors.pulseAccent,
    fontSize: 15,
    fontWeight: '700',
  },
  // Como el bloque de objetivos de Hoy (MetasToday): tarjeta con todo centrado
  kegelCard: {
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 18,
    marginHorizontal: 20,
    marginBottom: 28,
    paddingTop: 18,
    paddingBottom: 12,
    paddingHorizontal: 16,
  },
  kegelRingNum: { color: Colors.textPrimary, fontSize: 20, fontWeight: '800', lineHeight: 22 },
  kegelRingSub: { color: Colors.textMuted, fontSize: 10 },
  kegelDays: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginTop: 14 },
  kegelDay: { alignItems: 'center', gap: 4 },
  kegelDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: withAlpha(Colors.pulseAccent, 0.14) },
  kegelDotOn: { backgroundColor: Colors.pulseAccent },
  kegelDayLabel: { color: Colors.textMuted, fontSize: 10, textTransform: 'uppercase' },
  kegelToday: { color: Colors.textPrimary, fontWeight: '700' },
  kegelNote: { color: Colors.textMuted, fontSize: 11, textAlign: 'center', marginTop: 12 },
  kegelStart: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingTop: 10 },
  kegelStartText: { color: Colors.pulseAccent, fontSize: 14, fontWeight: '700' },
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
