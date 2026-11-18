import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Colors, withAlpha } from '@/constants/colors';
import { FRow, SecHead } from '@/components/fine/Fine';
import { dateLocale, t } from '@/i18n';
import { formatClock, formatSleep, shortDate, SleepNight } from '@/wearables/dailySeries';
import { FINE, ff, fine } from '@/theme/fine';

// Detalle de cada noche en la ficha del sueño: una barra por noche con sus fases (tocarla la elige; en
// 6M, una por semana con la media de esa semana),
// los minutos de cada fase de la noche elegida, la hora de dormirte y de despertarte, y la media de
// esas horas en el periodo. Una noche sin fases (la fuente solo da la sesión) enseña solo la
// duración y las horas, sin barra de fases.
// Desde el 2026-11-16, en fino como el resto de la ficha: sin tarjeta, sin la luna ni el sol de colores, las horas
// y las medias en filas con línea fina. Va dentro del margen de la ficha (no pone el suyo).

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
  const withBars = showBars && staged && nights.length > 1;

  return (
    <>
      <SecHead title={t(staged ? 'Sleep stages' : 'Bed and wake times')} />
      {withBars && (
        <>
          <View style={styles.bars}>
            {nights.map((n) => (
              <TouchableOpacity
                key={n.date}
                style={[styles.barSlot, n.date !== night.date && styles.barDim]}
                onPress={() => setPicked(n.date)}
                accessibilityRole="button"
                accessibilityState={{ selected: n.date === night.date }}
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

      <View style={[styles.nightHead, withBars && styles.nightHeadSpaced]}>
        <Text style={styles.nightTitle}>{labelOf(night.date)}</Text>
        <Text style={styles.nightTotal}>{formatSleep(night.asleep)}</Text>
      </View>

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

      {night.start != null && night.end != null && (
        <View style={styles.times}>
          <FRow title={t('Fell asleep')} value={formatClock(night.start)} />
          <FRow title={t('Woke up')} value={formatClock(night.end)} last={!(starts.length > 0 && ends.length > 0)} />
        </View>
      )}

      {starts.length > 0 && ends.length > 0 && (
        <View style={night.start != null && night.end != null ? undefined : styles.times}>
          <FRow title={t('Bedtime (average)')} value={formatClock(mean(starts))} />
          <FRow title={t('Wake-up (average)')} value={formatClock(mean(ends))} last />
        </View>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  bars: { flexDirection: 'row', alignItems: 'flex-end', height: BARS_HEIGHT, gap: 3, marginTop: 6 },
  barSlot: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  barDim: { opacity: 0.45 },
  // De abajo arriba: profundo abajo, despierto arriba
  bar: { borderRadius: 3, overflow: 'hidden', flexDirection: 'column-reverse', minHeight: 2 },
  xLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  xLabel: { ...ff('regular'), color: FINE.mute, fontSize: 10 },
  hint: { ...fine.note, textAlign: 'center', marginTop: 6 },
  nightHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 4 },
  nightHeadSpaced: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: FINE.line },
  nightTitle: { ...fine.rowTitle, flex: 1 },
  nightTotal: { ...fine.num, fontSize: 20, lineHeight: 24 },
  stageBar: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', marginTop: 12, marginBottom: 6 },
  stageRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5 },
  dot: { width: 7, height: 7, borderRadius: 4, marginRight: 9 },
  stageLabel: { ...ff('regular'), flex: 1, color: FINE.mute, fontSize: 13.5 },
  stageValue: { ...ff('regular'), color: FINE.ivory, fontSize: 13.5, fontVariant: ['tabular-nums'] },
  noStages: { ...fine.note },
  times: { marginTop: 10, borderTopWidth: 1, borderTopColor: FINE.line },
});
