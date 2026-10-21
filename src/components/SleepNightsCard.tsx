import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, withAlpha } from '@/constants/colors';
import { StatsRow } from '@/components/MetricDetailParts';
import { dateLocale, t } from '@/i18n';
import { formatClock, formatSleep, shortDate, SleepNight } from '@/wearables/dailySeries';

// Detalle de cada noche en la ficha del sueño: una barra por noche con sus fases (tocarla la elige; en
// 6M, una por semana con la media de esa semana),
// los minutos de cada fase de la noche elegida, la hora de dormirte y de despertarte, y la media de
// esas horas en el periodo. Una noche sin fases (la fuente solo da la sesión) enseña solo la
// duración y las horas, sin barra de fases.

type StageKey = 'deep' | 'light' | 'rem' | 'other' | 'awake' | 'outOfBed';

// De abajo arriba en las barras. Despierto y fuera de la cama también cuentan en la altura (es el
// tiempo en la cama); "sin fase" y "fuera de la cama" solo salen si los hay.
const STAGES: { key: StageKey; label: string; color: () => string; always: boolean }[] = [
  { key: 'deep', label: 'Deep sleep', color: () => Colors.violet, always: true },
  { key: 'light', label: 'Light sleep', color: () => Colors.sky, always: true },
  { key: 'rem', label: 'REM sleep', color: () => Colors.pulseAccent, always: true },
  { key: 'other', label: 'Asleep, no stage', color: () => withAlpha(Colors.violet, 0.45), always: false },
  { key: 'awake', label: 'Awake', color: () => Colors.amber, always: true },
  { key: 'outOfBed', label: 'Out of bed', color: () => Colors.textMuted, always: false },
];

const BARS_HEIGHT = 110;

const formatStage = (m: number) => (m < 60 ? `${Math.round(m)} min` : formatSleep(m));

const total = (n: SleepNight) => (n.stages ? STAGES.reduce((a, s) => a + n.stages![s.key], 0) : n.asleep);

// "Noche del 15 al 16 oct" (la noche es del día en que te despiertas)
const nightLabel = (date: string) => {
  const wake = new Date(`${date}T12:00:00`);
  const eve = new Date(wake);
  eve.setDate(eve.getDate() - 1);
  const to = wake.toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short' });
  const from = eve.getMonth() === wake.getMonth() ? String(eve.getDate()) : eve.toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short' });
  return t('Night of {from}–{to}', { from, to });
};

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

const weekLabel = (date: string) =>
  t('Week of {date}', { date: new Date(`${date}T12:00:00`).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short' }) });

export const SleepNightsCard = ({ nights, weekly = false }: { nights: SleepNight[]; weekly?: boolean }) => {
  const showBars = true;
  const labelOf = weekly ? weekLabel : nightLabel;
  const [picked, setPicked] = useState<string | null>(null);
  const staged = nights.some((n) => n.stages);
  if (!nights.length || !nights.some((n) => n.stages || n.start != null)) return null;

  const night = nights.find((n) => n.date === picked) ?? nights[nights.length - 1];
  const max = Math.max(...nights.map(total), 1);
  const starts = nights.flatMap((n) => (n.start != null ? [n.start] : []));
  const ends = nights.flatMap((n) => (n.end != null ? [n.end] : []));
  const mid = Math.floor((nights.length - 1) / 2);

  return (
    <>
      <Text style={styles.sectionTitle}>{t(staged ? 'Sleep stages' : 'Bed and wake times')}</Text>
      <View style={styles.card}>
        {showBars && staged && nights.length > 1 && (
          <>
            <View style={styles.bars}>
              {nights.map((n) => (
                <TouchableOpacity
                  key={n.date}
                  style={[styles.barSlot, n.date !== night.date && styles.barDim]}
                  onPress={() => setPicked(n.date)}
                  accessibilityLabel={labelOf(n.date)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.bar, { height: (total(n) / max) * BARS_HEIGHT }]}>
                    {n.stages ? (
                      STAGES.filter((s) => n.stages![s.key] > 0).map((s) => (
                        <View key={s.key} style={{ flex: n.stages![s.key], backgroundColor: s.color() }} />
                      ))
                    ) : (
                      <View style={{ flex: 1, backgroundColor: withAlpha(Colors.violet, 0.45) }} />
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.xLabels}>
              <Text style={styles.xLabel}>{shortDate(nights[0].date)}</Text>
              {nights.length > 2 && <Text style={styles.xLabel}>{shortDate(nights[mid].date)}</Text>}
              <Text style={styles.xLabel}>{shortDate(nights[nights.length - 1].date)}</Text>
            </View>
            <Text style={styles.hint}>{weekly ? t('Weekly averages · tap a week to see it') : t('Tap a night to see its stages')}</Text>
          </>
        )}

        <View style={[styles.nightHead, showBars && staged && nights.length > 1 && styles.nightHeadSpaced]}>
          <Text style={styles.nightTitle}>{labelOf(night.date)}</Text>
          <Text style={styles.nightTotal}>{formatSleep(night.asleep)}</Text>
        </View>

        {night.start != null && night.end != null && (
          <View style={styles.times}>
            <View style={styles.time}>
              <Ionicons name="moon-outline" size={15} color={Colors.violet} />
              <Text style={styles.timeLabel}>{t('Fell asleep')}</Text>
              <Text style={styles.timeValue}>{formatClock(night.start)}</Text>
            </View>
            <View style={styles.time}>
              <Ionicons name="sunny-outline" size={15} color={Colors.amber} />
              <Text style={styles.timeLabel}>{t('Woke up')}</Text>
              <Text style={styles.timeValue}>{formatClock(night.end)}</Text>
            </View>
          </View>
        )}

        {night.stages ? (
          <>
            <View style={styles.stageBar}>
              {STAGES.filter((s) => night.stages![s.key] > 0).map((s) => (
                <View key={s.key} style={{ flex: night.stages![s.key], backgroundColor: s.color() }} />
              ))}
            </View>
            {STAGES.filter((s) => s.always || night.stages![s.key] > 0).map((s) => (
              <View key={s.key} style={styles.stageRow}>
                <View style={[styles.dot, { backgroundColor: s.color() }]} />
                <Text style={styles.stageLabel}>{t(s.label)}</Text>
                <Text style={styles.stageValue}>{formatStage(night.stages![s.key])}</Text>
              </View>
            ))}
          </>
        ) : (
          staged && <Text style={styles.noStages}>{t('No sleep stages for this night.')}</Text>
        )}
      </View>

      {starts.length > 0 && ends.length > 0 && (
        <StatsRow
          items={[
            { label: 'Bedtime (average)', value: formatClock(mean(starts)) },
            { label: 'Wake-up (average)', value: formatClock(mean(ends)) },
          ]}
        />
      )}
    </>
  );
};

const styles = StyleSheet.create({
  sectionTitle: { color: Colors.textPrimary, fontSize: 17, fontWeight: '700', paddingHorizontal: 20, marginTop: 20, marginBottom: 10 },
  card: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 20,
  },
  bars: { flexDirection: 'row', alignItems: 'flex-end', height: BARS_HEIGHT, gap: 3 },
  barSlot: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  barDim: { opacity: 0.45 },
  // De abajo arriba: profundo abajo, despierto arriba
  bar: { borderRadius: 3, overflow: 'hidden', flexDirection: 'column-reverse', minHeight: 2 },
  xLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  xLabel: { color: Colors.textMuted, fontSize: 10 },
  hint: { color: Colors.textMuted, fontSize: 11, textAlign: 'center', marginTop: 8 },
  nightHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  nightHeadSpaced: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: Colors.divider },
  nightTitle: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },
  nightTotal: { color: Colors.textPrimary, fontSize: 15, fontWeight: '800' },
  times: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 16, rowGap: 4, marginTop: 8 },
  time: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  timeLabel: { color: Colors.textSecondary, fontSize: 13 },
  timeValue: { color: Colors.textPrimary, fontSize: 13, fontWeight: '700' },
  stageBar: { flexDirection: 'row', height: 12, borderRadius: 6, overflow: 'hidden', marginTop: 14, marginBottom: 6 },
  stageRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5 },
  dot: { width: 9, height: 9, borderRadius: 5, marginRight: 8 },
  stageLabel: { flex: 1, color: Colors.textSecondary, fontSize: 13 },
  stageValue: { color: Colors.textPrimary, fontSize: 13, fontWeight: '700' },
  noStages: { color: Colors.textMuted, fontSize: 12, marginTop: 10 },
});
