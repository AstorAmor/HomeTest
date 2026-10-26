import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Colors } from '@/constants/colors';
import type { ActiveWorkout } from '@/data/workouts/activeWorkout';
import { sessionTitle } from '@/data/workouts/labels';
import { dateLocale, t, tn } from '@/i18n';

// Aviso de un entreno a medias (src/data/workouts/activeWorkout.ts), arriba en Entrenamientos y en
// otra sesión: «Seguir» vuelve a él tal como estaba; «Descartar», si se pasa, lo borra.

const startedText = (w: ActiveWorkout) => {
  const d = new Date(w.startedAt);
  const time = d.toLocaleTimeString(dateLocale(), { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === new Date().toDateString()) return t('Started at {time}', { time });
  return t('Started {date}', { date: d.toLocaleDateString(dateLocale(), { weekday: 'short', day: 'numeric', month: 'short' }) });
};

export const UnfinishedWorkout = ({ workout, onContinue, onDiscard }: { workout: ActiveWorkout; onContinue: () => void; onDiscard?: () => void }) => {
  const done = workout.rows.reduce((n, r) => n + r.filter((x) => x.done).length, 0);
  return (
    <View style={styles.card}>
      <View style={styles.icon}>
        <MaterialCommunityIcons name="progress-clock" size={20} color={Colors.accent} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.label}>{t('Unfinished workout')}</Text>
        <Text style={styles.title} numberOfLines={1}>
          {sessionTitle(workout.session)}
        </Text>
        <Text style={styles.sub}>{[startedText(workout), tn(done, '{n} set done', '{n} sets done')].join(' · ')}</Text>
        {onDiscard && (
          <TouchableOpacity onPress={onDiscard} hitSlop={8} style={styles.discard}>
            <Text style={styles.discardText}>{t('Discard')}</Text>
          </TouchableOpacity>
        )}
      </View>
      <TouchableOpacity style={styles.go} onPress={onContinue}>
        <Text style={styles.goText}>{t('Resume')}</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  card: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.accentSoft, borderWidth: 1, borderColor: Colors.accent, borderRadius: 16, padding: 12, marginBottom: 12 },
  icon: { width: 38, height: 38, borderRadius: 19, backgroundColor: Colors.background, alignItems: 'center', justifyContent: 'center' },
  label: { color: Colors.accent, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  title: { color: Colors.textPrimary, fontSize: 15, fontWeight: '800' },
  sub: { color: Colors.textSecondary, fontSize: 12, marginTop: 1 },
  discard: { alignSelf: 'flex-start', marginTop: 6 },
  discardText: { color: Colors.textSecondary, fontSize: 13, fontWeight: '700' },
  go: { backgroundColor: Colors.accent, borderRadius: 18, paddingHorizontal: 16, paddingVertical: 9 },
  goText: { color: Colors.background, fontSize: 14, fontWeight: '800' },
});
