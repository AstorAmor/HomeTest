import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Colors } from '@/constants/colors';
import { useReloadOnFocus } from '@/hooks/useReloadOnFocus';
import { exerciseName, getExercise } from '@/data/workouts/catalog';
import { sessionTitle, setsText } from '@/data/workouts/labels';
import { programRepository } from '@/data/workouts/programRepository';
import { workoutRepository } from '@/data/planRepository';
import { byMonth, setsByExercise, workoutHistory, type HistoryEntry, type LoggedWorkout } from '@/logic/workoutHistory';
import { dateLocale, t, tn } from '@/i18n';

// Historial (Entrenamientos → Historial): cada entreno con su día, sus minutos y, en las sesiones de un
// programa, lo que se hizo en cada ejercicio. Solo para mirar: no se edita. La lógica, en
// src/logic/workoutHistory.ts.

const PAGE = 30;

const TYPE: Record<LoggedWorkout['type'], { label: string; icon: string }> = {
  strength: { label: 'Strength', icon: 'dumbbell' },
  cardio: { label: 'Cardio', icon: 'run' },
  mobility: { label: 'Mobility', icon: 'yoga' },
  sport: { label: 'Sport', icon: 'tennis' },
};
const INTENSITY: Record<LoggedWorkout['intensity'], string> = { easy: 'Easy', moderate: 'Moderate', hard: 'Hard' };

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const whenText = (iso: string) => {
  const d = new Date(iso);
  return `${capital(d.toLocaleDateString(dateLocale(), { weekday: 'short', day: 'numeric', month: 'short' }))}, ${d.toLocaleTimeString(dateLocale(), { hour: '2-digit', minute: '2-digit' })}`;
};
const monthText = (month: string) => {
  const [y, m] = month.split('-').map(Number);
  return capital(new Date(y, m - 1, 1).toLocaleDateString(dateLocale(), { month: 'long', year: 'numeric' }));
};

const Entry = ({ e }: { e: HistoryEntry }) => {
  if (e.kind === 'logged') {
    return (
      <View style={styles.card}>
        <View style={styles.head}>
          <View style={styles.icon}>
            <MaterialCommunityIcons name={TYPE[e.type].icon as any} size={18} color={Colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{t(TYPE[e.type].label)}</Text>
            <Text style={styles.sub}>{[whenText(e.at), t(INTENSITY[e.intensity])].join(' · ')}</Text>
          </View>
          <Text style={styles.minutes}>{t('{m} min', { m: e.minutes })}</Text>
        </View>
      </View>
    );
  }
  const groups = setsByExercise(e.sets);
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={styles.icon}>
          <MaterialCommunityIcons name="dumbbell" size={18} color={Colors.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={2}>
            {e.session ? sessionTitle(e.session) : t(e.programTitle)}
          </Text>
          <Text style={styles.sub}>
            {[whenText(e.at), e.sets.length ? tn(e.sets.length, '{n} set', '{n} sets') : null, e.volumeKg ? `${e.volumeKg.toLocaleString(dateLocale())} kg` : null]
              .filter(Boolean)
              .join(' · ')}
          </Text>
        </View>
        <Text style={styles.minutes}>{t('{m} min', { m: e.minutes })}</Text>
      </View>
      {groups.length > 0 && (
        <View style={styles.exercises}>
          {groups.map((g, i) => {
            const ex = getExercise(g.exerciseId);
            if (!ex) return null;
            return (
              <View key={`${g.exerciseId}-${i}`} style={styles.exercise}>
                <Text style={styles.exName} numberOfLines={2}>
                  {exerciseName(ex)}
                </Text>
                <Text style={styles.exSets}>{setsText(g.sets)}</Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
};

export const WorkoutHistoryScreen = () => {
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [shown, setShown] = useState(PAGE);

  const load = useCallback(async () => {
    try {
      const [programs, logged] = await Promise.all([programRepository.list(), workoutRepository.getAll()]);
      setEntries(workoutHistory(programs, logged));
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);
  useReloadOnFocus(load);

  const months = useMemo(() => byMonth((entries ?? []).slice(0, shown)), [entries, shown]);
  // Lo que hay en cada mes, aunque aún no se vea entero
  const perMonth = useMemo(() => new Map(byMonth(entries ?? []).map((m) => [m.month, m.entries.length])), [entries]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScreenHeader title={t('History')} showBack backFallback="/workouts" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {failed && <Text style={styles.muted}>{t('Your history could not be loaded. Check your connection and try again.')}</Text>}
        {entries && !entries.length && (
          <View style={styles.empty}>
            <MaterialCommunityIcons name="calendar-blank-outline" size={28} color={Colors.accent} />
            <Text style={styles.muted}>{t('No workouts yet. When you finish a session or log a workout, it will appear here.')}</Text>
          </View>
        )}
        {months.map((m) => (
          <View key={m.month}>
            <View style={styles.monthRow}>
              <Text style={styles.month}>{monthText(m.month)}</Text>
              <Text style={styles.monthCount}>{tn(perMonth.get(m.month) ?? m.entries.length, '{n} workout', '{n} workouts')}</Text>
            </View>
            {m.entries.map((e) => (
              <Entry key={e.key} e={e} />
            ))}
          </View>
        ))}
        {entries && entries.length > shown && (
          <TouchableOpacity style={styles.more} onPress={() => setShown((n) => n + PAGE)}>
            <Text style={styles.moreText}>{t('See more')}</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  muted: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  empty: { alignItems: 'center', gap: 10, marginTop: 40, paddingHorizontal: 20 },
  monthRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 14, marginBottom: 8 },
  month: { color: Colors.textPrimary, fontSize: 16, fontWeight: '800' },
  monthCount: { color: Colors.textMuted, fontSize: 13, fontWeight: '600' },
  card: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 16, padding: 12, marginBottom: 10 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  title: { color: Colors.textPrimary, fontSize: 15, fontWeight: '800' },
  sub: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  minutes: { color: Colors.textPrimary, fontSize: 14, fontWeight: '800', fontVariant: ['tabular-nums'] },
  exercises: { marginTop: 10, paddingTop: 6, borderTopWidth: 1, borderTopColor: Colors.divider, gap: 6 },
  exercise: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  exName: { flex: 1, color: Colors.textPrimary, fontSize: 13, fontWeight: '600' },
  exSets: { flexShrink: 1, maxWidth: '55%', color: Colors.textSecondary, fontSize: 13, textAlign: 'right', fontVariant: ['tabular-nums'] },
  more: { alignItems: 'center', paddingVertical: 12 },
  moreText: { color: Colors.accent, fontSize: 14, fontWeight: '700' },
});
