import { dateLocale, num, t } from '@/i18n';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { CycleGoalPanel } from '@/components/CycleGoalPanel';
import { CycleStrip } from '@/components/CycleStrip';
import { toDayKey } from '@/components/MonthCalendar';
import { InfoButton } from '@/components/InfoButton';
import { FRow, SecHead, Tag } from '@/components/fine/Fine';
import { useReloadOnFocus } from '@/hooks/useReloadOnFocus';
import { CycleEntry, CyclePrediction } from '@/types/cycle';
import { cycleRepository } from '@/data/cycleRepository';
import { cycleGoalStore } from '@/data/cycleGoal';
import { CycleGoalAnswers } from '@/types/cycleGoal';
import { currentCyclePhase, CyclePhaseId } from '@/utils/cyclePhase';
import { postAi } from '@/utils/apiBaseUrl';
import { kegelRepository } from '@/data/kegelRepository';
import { EXERCISES } from '@/data/exercises';
import { kegelDayKey, kegelWeek, KegelWeek } from '@/logic/kegel';
import { PHASE_EXPECT, PHASE_EXPECT_NOTE, PHASE_EXPECT_SAFETY, PHASE_FERTILITY_NOTE, showPhaseSafety } from '@/logic/cycleExpectations';
import { FINE, ff, fine } from '@/theme/fine';

// Detalle del ciclo en el lenguaje fino (fundador, 2026-11-17: «cuando entras, sigue siendo formato antiguo; me
// gustaría que la barra sea más brillante como la estética actual, y que en la fase en la que está explique lo que
// se podría esperar de energía, ánimo…»): la fase en grande con la recta cometa luminosa, «En esta fase», la próxima
// regla, tu objetivo y la temperatura, los Kegel y el historial. Cabeceras pequeñas con línea, filas finas, sin
// tarjetas ni iconos.

const shortDate = (iso: string) => new Date(iso).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short' });
const formatFullDate = (iso: string) => new Date(iso).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'long', year: 'numeric' });

// Los Kegel, en una fila: un punto por cada uno de los últimos 7 días (lleno si los hiciste), cuántos y cuándo fue la
// última vez; «Empezar» en la cabecera
const lastKegel = (w: KegelWeek, now = new Date()) => {
  if (!w.last) return t('Not done yet');
  if (w.last === kegelDayKey(now)) return t('Last time: today');
  if (w.last === kegelDayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1))) return t('Last time: yesterday');
  const [y, m, d] = w.last.split('-').map(Number);
  return t('Last time: {date}', { date: new Date(y, m - 1, d).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short' }) });
};

const KegelRow = ({ w, onPress }: { w: KegelWeek; onPress: () => void }) => (
  <>
    <SecHead title={t('Kegel exercises')} more={t('Start · {n} min', { n: EXERCISES.kegel.minutes })} onMore={onPress} />
    <TouchableOpacity
      style={styles.kegel}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`${t('Kegel exercises, last 7 days')}: ${t('{n} of 7 days', { n: w.count })}. ${lastKegel(w)}`}
    >
      <View style={styles.kegelDays}>
        {w.days.map((d, i) => (
          <View key={d.key} style={styles.kegelDay}>
            <View style={[styles.kegelDot, d.done && styles.kegelDotOn]} />
            <Text style={[styles.kegelDayLabel, i === 6 && styles.kegelToday]}>{d.date.toLocaleDateString(dateLocale(), { weekday: 'narrow' })}</Text>
          </View>
        ))}
      </View>
      <View style={styles.kegelSide}>
        <Text style={styles.kegelCount}>{t('{n} of 7 days', { n: w.count })}</Text>
        <Text style={fine.rowSub}>{lastKegel(w)}</Text>
      </View>
    </TouchableOpacity>
  </>
);

// Qué puede notarse en la fase de hoy: energía, ánimo, sueño… (src/logic/cycleExpectations.ts)
const PhaseExpect = ({ phase }: { phase: CyclePhaseId }) => {
  const rows = PHASE_EXPECT[phase];
  return (
    <>
      <SecHead title={t('In this phase')} />
      {rows.map((r, i) => (
        <View key={r.area} style={[styles.expect, i === rows.length - 1 && styles.last]}>
          <Text style={styles.expectArea} numberOfLines={1} maxFontSizeMultiplier={1.15}>
            {t(r.area)}
          </Text>
          <Text style={styles.expectText}>{t(r.text)}</Text>
        </View>
      ))}
      <Text style={[fine.note, styles.expectNote]}>
        {t(PHASE_EXPECT_NOTE)} {t(PHASE_FERTILITY_NOTE)}
        {showPhaseSafety(phase) ? ` ${t(PHASE_EXPECT_SAFETY)}` : ''}
      </Text>
    </>
  );
};

const CONFIDENCE_LABEL: Record<string, string> = {
  low: 'Low confidence — log more cycles',
  medium: 'Medium confidence',
  high: 'High confidence',
};

export const CycleDetailScreen = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
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
        // Día local, como la estimación de arriba (el ISO en UTC puede ser el día anterior)
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
    } catch {
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

  const historyDesc = [...entries].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

  // Duración del periodo (días de regla, inicio y fin incluidos)
  const periodDays = (e: CycleEntry) =>
    e.endFecha ? Math.round((new Date(e.endFecha).getTime() - new Date(e.fecha).getTime()) / (24 * 3600 * 1000)) + 1 : null;
  const durations = entries.map(periodDays).filter((d): d is number => d != null);
  const avgPeriod = durations.length ? Math.round((durations.reduce((a, b) => a + b, 0) / durations.length) * 10) / 10 : null;
  // Día, fase y cuándo llegaría la próxima regla, como en Hoy (solo con reglas suyas, sin el ejemplo)
  const cycle = entries.length ? currentCyclePhase(entries, new Date(), cycleGoal?.cycleLength, cycleGoal) : null;
  const days = (n: number) => t('{n} days', { n: num(String(n)) });
  const serverOk = !!prediction && !prediction.error;
  // La próxima regla de arriba: la de la predicción o, mientras se calcula o si no se ha podido, la estimación de aquí
  // (la de Hoy), para que lo primero sea siempre la fecha y el retraso. «Hace días» solo cuando se esperaba hace poco
  // (sin registros recientes, la frase de la fase lo explica)
  const local = cycle?.next ?? null;
  const top = serverOk
    ? { date: formatFullDate(prediction!.predicted_next_start), window: prediction!.window_days, late: prediction!.is_late ? prediction!.days_late : 0 }
    : local
      ? { date: formatFullDate(`${local.date}T12:00:00`), window: local.windowDays, late: local.status === 'late' ? -local.daysLeft : 0 }
      : null;
  const showPrediction = !!top || loadingPrediction || !!predictionError;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={{ paddingBottom: 48 + insets.bottom }} showsVerticalScrollIndicator={false}>
        <ScreenHeader title={t('Menstrual Cycle')} showBack />
        <View style={styles.body}>
          {/* Lo primero, la próxima regla en grande y si se retrasa; después la fase con su recta, «En esta fase» y las
              duraciones (fundador, 2026-11-18: «me gustaría que empezase con el Next period predicted XX y lo de los días
              late..., luego lo de luteal phase si quieres, con la línea y tal. In this phase me gusta») */}
          {showPrediction && (
            <View style={[fine.secHead, styles.topHead]}>
              <Text style={fine.secTitle}>{t('Next period predicted')}</Text>
              <InfoButton topic="cycle_prediction" size={15} color={FINE.mute} />
            </View>
          )}
          {loadingPrediction && !top && (
            <View style={styles.status}>
              <ActivityIndicator color={FINE.mute} />
              <Text style={fine.note}>{t('Computing prediction…')}</Text>
            </View>
          )}
          {predictionError && !top ? <Text style={fine.note}>{predictionError}</Text> : null}
          {top && (
            <>
              <View style={styles.big}>
                <Text style={styles.bigDate}>{top.date}</Text>
                <Text style={styles.bigSide}>± {days(top.window)}</Text>
              </View>
              {top.late > 0 && (
                <View style={styles.late}>
                  <Tag gold label={top.late === 1 ? t('1 day late') : t('{n} days late', { n: top.late })} />
                </View>
              )}
            </>
          )}

          {cycle && (
            <View style={showPrediction ? styles.phaseAfter : undefined}>
              <CycleStrip info={cycle} variant="hero" />
              <PhaseExpect phase={cycle.phase} />
            </View>
          )}

          {/* Las duraciones en filas finas, con lo fiable que es la previsión */}
          {serverOk && prediction && (
            <>
              <SecHead title={t('Your cycle')} />
              <FRow title={t('Median length')} value={days(prediction.median_cycle_length)} />
              <FRow title={t('Average length')} value={days(prediction.avg_cycle_length)} />
              <FRow title={t('Period days')} value={avgPeriod != null ? days(avgPeriod) : '—'} last />
              <Text style={fine.note}>{t(CONFIDENCE_LABEL[prediction.confidence])}</Text>
            </>
          )}
          {entries.length < 2 && !loadingPrediction && !cycle?.next && (
            <Text style={[fine.note, styles.empty]}>{t('Log at least 2 periods to get a prediction.')}</Text>
          )}

          <TouchableOpacity style={styles.logBtn} onPress={() => router.push('/log-cycle')} activeOpacity={0.85} accessibilityRole="button">
            <Text style={fine.pillText}>{t('Log period')}</Text>
          </TouchableOpacity>

          <CycleGoalPanel />

          <KegelRow w={kegelWeek(kegelDates)} onPress={() => router.push({ pathname: '/exercise', params: { id: 'kegel' } })} />

          <SecHead title={t('History')} />
          {historyDesc.length === 0 ? (
            <Text style={fine.note}>{t('No entries yet.')}</Text>
          ) : (
            historyDesc.map((entry, i) => {
              const n = periodDays(entry);
              return (
                <FRow
                  key={entry.id}
                  title={shortDate(entry.fecha)}
                  value={n != null ? days(n) : t('Ongoing')}
                  onPress={() => router.push({ pathname: '/log-cycle', params: { id: entry.id } })}
                  last={i === historyDesc.length - 1}
                />
              );
            })
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  body: { paddingHorizontal: 20 },
  // «En esta fase»: la etiqueta a la izquierda y la frase al lado, con una línea fina entre filas
  expect: { flexDirection: 'row', gap: 12, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: FINE.line },
  last: { borderBottomWidth: 0 },
  expectArea: { ...ff('medium'), color: FINE.ivory, fontSize: 14, lineHeight: 20, width: 116 },
  expectText: { ...ff('regular'), flex: 1, color: FINE.ivory, fontSize: 14, lineHeight: 20, opacity: 0.86 },
  expectNote: { marginTop: 8 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  big: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: 10, marginTop: 2, marginBottom: 6 },
  bigDate: { ...ff('light'), color: FINE.ivory, fontSize: 30, lineHeight: 36 },
  bigSide: { ...ff('regular'), color: FINE.mute, fontSize: 13 },
  late: { flexDirection: 'row', marginBottom: 6 },
  // Arriba del todo, sin la raya de sección (justo debajo del título de la pantalla)
  topHead: { marginTop: 4, paddingTop: 4, borderTopWidth: 0 },
  phaseAfter: { marginTop: 22 },
  empty: { marginTop: 18 },
  logBtn: { ...fine.pill, alignSelf: 'center', marginTop: 22, minHeight: 44, paddingHorizontal: 22, justifyContent: 'center' },
  kegel: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 8 },
  kegelDays: { flexDirection: 'row', gap: 10 },
  kegelDay: { alignItems: 'center', gap: 5 },
  kegelDot: { width: 11, height: 11, borderRadius: 6, borderWidth: 1, borderColor: FINE.jadeLine },
  kegelDotOn: { backgroundColor: FINE.jade, borderColor: FINE.jade },
  kegelDayLabel: { ...ff('regular'), color: FINE.mute, fontSize: 10, textTransform: 'uppercase' },
  kegelToday: { ...ff('medium'), color: FINE.ivory },
  kegelSide: { flex: 1, alignItems: 'flex-end' },
  kegelCount: { ...ff('medium'), color: FINE.ivory, fontSize: 14 },
});
