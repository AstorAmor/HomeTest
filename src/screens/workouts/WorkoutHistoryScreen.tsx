import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { confirmAsk } from '@/components/dev/confirmAsk';
import { ScreenHeader } from '@/components/ScreenHeader';
import { FLink, formStyles } from '@/components/fine/FineForm';
import { WorkoutTypeIcon } from '@/components/workouts/WorkoutTypeIcon';
import { useReloadOnFocus } from '@/hooks/useReloadOnFocus';
import { exerciseName, getExercise } from '@/data/workouts/catalog';
import { sessionTitle, setsText } from '@/data/workouts/labels';
import { programRepository } from '@/data/workouts/programRepository';
import { workoutRepository } from '@/data/planRepository';
import { byMonth, historyRemoval, setsByExercise, workoutHistory, type HistoryEntry, type LoggedWorkout } from '@/logic/workoutHistory';
import { workoutLabel } from '@/logic/workoutSports';
import type { WorkoutProgram } from '@/data/workouts/types';
import { dateLocale, t, tn } from '@/i18n';
import { FINE, ff, fine } from '@/theme/fine';

// Historial (Entrenamientos → Historial): cada entreno con su día, sus minutos y, en las sesiones de un
// programa, lo que se hizo en cada ejercicio. No se edita; la papelera de cada uno lo borra, con confirmación
// (fundador, 2026-11-06). La lógica, en src/logic/workoutHistory.ts.
// Rediseño del 2026-11-16 (lenguaje fino): cada mes con su cabecera pequeña y cada entreno en una fila con línea
// fina, su dibujo a línea (sin círculo de color) y los minutos a la derecha.
// Desde el 2026-11-17 (fundador: «sé coherente con los iconos»), el dibujo es el de su tipo (WorkoutTypeIcon: las
// pesas son las del entrenador personal, las mismas en toda la app) en lugar de un icono de Ionicons; un entreno de
// «Otro» sale con su deporte («Tenis») si se apuntó, y «Exportar», arriba, es un enlace de texto.

const PAGE = 30;

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

const Trash = ({ onPress }: { onPress: () => void }) => (
  <TouchableOpacity onPress={onPress} hitSlop={10} style={styles.trash} accessibilityRole="button" accessibilityLabel={t('Delete this workout')}>
    <Ionicons name="trash-outline" size={17} color={FINE.mute} />
  </TouchableOpacity>
);

const Entry = ({ e, onDelete }: { e: HistoryEntry; onDelete: () => void }) => {
  if (e.kind === 'logged') {
    return (
      <View style={styles.card}>
        <View style={styles.head}>
          <WorkoutTypeIcon type={e.type} size={19} style={styles.icon} />
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{workoutLabel(e)}</Text>
            <Text style={styles.sub}>{[whenText(e.at), t(INTENSITY[e.intensity])].join(' · ')}</Text>
          </View>
          <Text style={styles.minutes}>{t('{m} min', { m: e.minutes })}</Text>
          <Trash onPress={onDelete} />
        </View>
      </View>
    );
  }
  const groups = setsByExercise(e.sets);
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <WorkoutTypeIcon type="strength" size={19} style={styles.icon} />
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
        <Trash onPress={onDelete} />
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
  const router = useRouter();
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [deleteFailed, setDeleteFailed] = useState(false);
  // Lo cargado, para saber qué borrar
  const [source, setSource] = useState<{ programs: WorkoutProgram[]; logged: LoggedWorkout[] }>({ programs: [], logged: [] });
  const [shown, setShown] = useState(PAGE);

  const load = useCallback(async () => {
    try {
      const [programs, logged] = await Promise.all([programRepository.list(), workoutRepository.getAll()]);
      setSource({ programs, logged });
      setEntries(workoutHistory(programs, logged));
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);
  useReloadOnFocus(load);

  const remove = async (e: HistoryEntry) => {
    const what = e.kind === 'session' ? (e.session ? sessionTitle(e.session) : t(e.programTitle)) : workoutLabel(e);
    const ok = await confirmAsk(
      t('Delete this workout?'),
      t('{what}, {when}. It will disappear from your history and stop counting towards your targets.', { what, when: whenText(e.at) }),
      t('Delete'),
    );
    if (!ok) return;
    setDeleteFailed(false);
    const plan = historyRemoval(e, source.programs, source.logged);
    try {
      const p = plan.program && source.programs.find((x) => x.id === plan.program!.id);
      if (p && plan.program) await programRepository.save({ ...p, completions: plan.program.completions });
      for (const id of plan.loggedIds) await workoutRepository.remove(id);
    } catch {
      setDeleteFailed(true);
    }
    load();
  };

  const months = useMemo(() => byMonth((entries ?? []).slice(0, shown)), [entries, shown]);
  // Lo que hay en cada mes, aunque aún no se vea entero
  const perMonth = useMemo(() => new Map(byMonth(entries ?? []).map((m) => [m.month, m.entries.length])), [entries]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScreenHeader
        title={t('History')}
        showBack
        backFallback="/workouts"
        right={
          // Exportar el plan y el historial (fundador, 2026-11-09), como enlace de texto
          <TouchableOpacity onPress={() => router.push('/workout-export')} hitSlop={12} accessibilityRole="button" accessibilityLabel={t('Export')}>
            <Text style={styles.export}>{t('Export')}</Text>
          </TouchableOpacity>
        }
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {failed && <Text style={styles.failed}>{t('Your history could not be loaded. Check your connection and try again.')}</Text>}
        {deleteFailed && <Text style={styles.failed}>{t('The workout could not be deleted. Check your connection and try again.')}</Text>}
        {entries && !entries.length && (
          <View style={styles.empty}>
            <Text style={styles.muted}>{t('No workouts yet. When you finish a session or log a workout, it will appear here.')}</Text>
          </View>
        )}
        {months.map((m) => (
          <View key={m.month}>
            <View style={fine.secHead}>
              <Text style={fine.secTitle} accessibilityRole="header">
                {monthText(m.month)}
              </Text>
              <Text style={styles.monthCount}>{tn(perMonth.get(m.month) ?? m.entries.length, '{n} workout', '{n} workouts')}</Text>
            </View>
            {m.entries.map((e) => (
              <Entry key={e.key} e={e} onDelete={() => remove(e)} />
            ))}
          </View>
        ))}
        {entries && entries.length > shown && (
          <FLink label={t('See more')} onPress={() => setShown((n) => n + PAGE)} style={{ marginTop: 6 }} />
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  muted: { ...ff('regular'), color: FINE.mute, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  failed: { ...formStyles.error, textAlign: 'center', marginTop: 8 },
  empty: { alignItems: 'center', gap: 10, marginTop: 40, paddingHorizontal: 20 },
  monthCount: { ...ff('regular'), color: FINE.mute, fontSize: 12.5, marginLeft: 'auto' },
  export: { ...fine.link, fontSize: 14 },
  // Cada entreno, una fila con línea fina
  card: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: FINE.line },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 24 },
  title: { ...fine.rowTitle },
  sub: { ...fine.rowSub },
  minutes: { ...fine.rowValue },
  trash: { paddingLeft: 4 },
  // Lo hecho en cada ejercicio, debajo y alineado con el nombre
  exercises: { marginTop: 8, marginLeft: 36, gap: 5 },
  exercise: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  exName: { flex: 1, ...ff('regular'), color: '#CFD6CF', fontSize: 13, lineHeight: 18 },
  exSets: { flexShrink: 1, maxWidth: '55%', ...ff('regular'), color: FINE.mute, fontSize: 12.5, lineHeight: 18, textAlign: 'right', fontVariant: ['tabular-nums'] },
});
