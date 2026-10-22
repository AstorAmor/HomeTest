import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import { CyclePhaseInfo, PHASE_COLORS, phaseBoundaries } from '@/utils/cyclePhase';
import { t } from '@/i18n';

interface CycleStripProps {
  info: CyclePhaseInfo;
  onPress?: () => void;
}

// Barra del ciclo con sus fases, un marcador en el día actual y, con datos suyos, cuándo llegaría la
// próxima regla. Si se retrasa, el marcador se queda al final y el día sigue contando (día 31).
export const CycleStrip = ({ info, onPress }: CycleStripProps) => {
  const { menstrualEnd, ovulationStart, ovulationEnd } = phaseBoundaries(info.length);
  const segments = [
    { color: PHASE_COLORS.menstrual, days: menstrualEnd },
    { color: PHASE_COLORS.follicular, days: ovulationStart - 1 - menstrualEnd },
    { color: PHASE_COLORS.ovulation, days: ovulationEnd - ovulationStart + 1 },
    { color: PHASE_COLORS.luteal, days: info.length - ovulationEnd },
  ];
  const markerPct = ((Math.min(info.day, info.length) - 0.5) / info.length) * 100;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} disabled={!onPress} activeOpacity={0.85}>
      <View style={styles.header}>
        <View style={styles.phaseRow}>
          <Ionicons name="rose-outline" size={16} color={Colors.pulseAccent} />
          <Text style={[styles.phase, { color: PHASE_COLORS[info.phase] }]}>{t(info.label)}</Text>
        </View>
        <Text style={styles.day}>
          {cycleDayLabel(info)}
          {info.isSample ? ` · ${t('sample')}` : ''}
        </Text>
      </View>
      <View style={styles.bar}>
        {segments.map((s, i) => (
          <View key={i} style={{ flex: Math.max(1, s.days), backgroundColor: s.color, opacity: 0.55 }} />
        ))}
        <View style={[styles.marker, { left: `${markerPct}%` }]} />
      </View>
      {info.next && (
        <Text style={styles.next}>
          {t(info.next.text, info.next.vars)}
          {info.next.note ? <Text style={styles.note}>{` ${t(info.next.note, info.next.noteVars)}`}</Text> : null}
        </Text>
      )}
      <Text style={styles.hint}>{t(info.hint)}</Text>
    </TouchableOpacity>
  );
};

// «Día 9 de 28»; pasada la duración habitual, solo «Día 31»
export const cycleDayLabel = (info: CyclePhaseInfo) =>
  info.day > info.length ? t('Day {n}', { n: info.day }) : t('Day {n} of {total}', { n: info.day, total: info.length });

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    padding: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: 10,
  },
  phaseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  phase: {
    fontSize: 14,
    fontWeight: '700',
  },
  day: {
    color: Colors.textSecondary,
    fontSize: 12,
  },
  bar: {
    flexDirection: 'row',
    height: 8,
    borderRadius: 4,
    overflow: 'visible',
    gap: 2,
  },
  marker: {
    position: 'absolute',
    top: -4,
    width: 4,
    height: 16,
    marginLeft: -2,
    borderRadius: 2,
    backgroundColor: Colors.textPrimary,
  },
  next: {
    color: Colors.textPrimary,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 12,
  },
  note: {
    color: Colors.textMuted,
  },
  hint: {
    color: Colors.textSecondary,
    fontSize: 12,
    marginTop: 10,
  },
});
