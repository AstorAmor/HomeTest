import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import type { ActiveWorkout } from '@/data/workouts/activeWorkout';
import { sessionTitle } from '@/data/workouts/labels';
import { Pill } from '@/components/fine/Fine';
import { dateLocale, t, tn } from '@/i18n';
import { FINE, ff, fine } from '@/theme/fine';

// Aviso de un entreno a medias (src/data/workouts/activeWorkout.ts), arriba en Entrenamientos y en
// otra sesión: «Seguir» vuelve a él tal como estaba; «Descartar», si se pasa, lo borra.
// Con el lenguaje fino (2026-11-16): una tarjeta casi transparente con borde jade y «Seguir» en píldora esmeralda.
// Sin icono desde el 2026-11-17 (fundador: «seguimos teniendo iconos… hay que ser coherente con el resto»): la
// etiqueta pequeña en jade ya dice qué es.

const startedText = (w: ActiveWorkout) => {
  const d = new Date(w.startedAt);
  const time = d.toLocaleTimeString(dateLocale(), { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === new Date().toDateString()) return t('Started at {time}', { time });
  return t('Started {date}', { date: d.toLocaleDateString(dateLocale(), { weekday: 'short', day: 'numeric', month: 'short' }) });
};

export const UnfinishedWorkout = ({ workout, onContinue, onDiscard }: { workout: ActiveWorkout; onContinue: () => void; onDiscard?: () => void }) => {
  const done = workout.rows.reduce((n, r) => n + r.filter((x) => x.done).length, 0);
  return (
    <View style={[fine.tile, styles.card]}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.label}>{t('Unfinished workout')}</Text>
        <Text style={fine.rowTitle} numberOfLines={1}>
          {sessionTitle(workout.session)}
        </Text>
        <Text style={fine.rowSub}>{[startedText(workout), tn(done, '{n} set done', '{n} sets done')].join(' · ')}</Text>
        {onDiscard && (
          <TouchableOpacity onPress={onDiscard} hitSlop={8} style={styles.discard} accessibilityRole="button">
            <Text style={styles.discardText}>{t('Discard')}</Text>
          </TouchableOpacity>
        )}
      </View>
      <Pill label={t('Resume')} onPress={onContinue} />
    </View>
  );
};

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, borderColor: FINE.jadeLine, paddingVertical: 12, marginBottom: 12 },
  label: { ...fine.kicker, color: FINE.jade, marginBottom: 2 },
  discard: { alignSelf: 'flex-start', marginTop: 6 },
  discardText: { ...ff('regular'), color: FINE.mute, fontSize: 13 },
});
