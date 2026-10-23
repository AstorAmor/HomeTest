import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { confirmAsk } from '@/components/dev/confirmAsk';
import { Colors } from '@/constants/colors';
import { useReloadOnFocus } from '@/hooks/useReloadOnFocus';
import { getExercise } from '@/data/workouts/catalog';
import { programFacts, sessionName, sessionTitle } from '@/data/workouts/labels';
import { isSampleProgram, programRepository } from '@/data/workouts/programRepository';
import type { WorkoutProgram } from '@/data/workouts/types';
import { estimateMinutes, nextSessionId, progressionText } from '@/logic/workoutGenerator';
import { ExerciseLoop } from '@/components/workouts/ExerciseLoop';
import { dateLocale, t, tn } from '@/i18n';

// Entrenamientos: el programa que sigues (hecho por ti con el generador o mandado por tu entrenador),
// la sesión que toca hoy, los demás programas y la biblioteca de ejercicios.

const dayMonth = (iso: string) => new Date(iso).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short' });

// Sesiones hechas en los últimos 7 días
const doneThisWeek = (p: WorkoutProgram) => p.completions.filter((c) => Date.now() - new Date(c.at).getTime() < 7 * 864e5).length;

export const sourceText = (p: WorkoutProgram) =>
  p.source === 'professional' ? t('From {name}', { name: p.professionalName || t('your specialist') }) : t('Made by you');

const ProgramCard = ({ p, onUse, onDelete }: { p: WorkoutProgram; onUse?: () => void; onDelete: () => void }) => {
  const router = useRouter();
  const next = nextSessionId(p);
  const nextSession = p.sessions.find((s) => s.id === next);
  const firstMain = nextSession?.exercises.find((e) => e.block === 'main');
  const hero = firstMain ? getExercise(firstMain.exerciseId) : undefined;
  const [showHow, setShowHow] = useState(false);

  return (
    <View style={[styles.card, p.active && styles.cardActive]}>
      <View style={styles.head}>
        <View style={styles.icon}>
          <MaterialCommunityIcons name={p.source === 'professional' ? 'account-tie-outline' : 'dumbbell'} size={20} color={Colors.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.badge}>
            {p.active ? t('Your programme') : sourceText(p)}
            {isSampleProgram(p) ? ` · ${t('Example')}` : ''}
          </Text>
          <Text style={styles.title}>{t(p.title)}</Text>
          <Text style={styles.sub}>
            {[p.active ? sourceText(p) : null, ...programFacts(p)].filter(Boolean).join(' · ')}
          </Text>
        </View>
      </View>

      {p.note ? (
        <View style={styles.note}>
          <Ionicons name="chatbox-ellipses-outline" size={14} color={Colors.textSecondary} />
          <Text style={styles.noteText}>{t(p.note)}</Text>
        </View>
      ) : null}

      {p.active && nextSession && (
        <TouchableOpacity
          style={styles.next}
          activeOpacity={0.85}
          onPress={() => router.push({ pathname: '/workout-session', params: { program: p.id, session: nextSession.id } })}
        >
          {hero && <ExerciseLoop exercise={hero} size={64} radius={12} />}
          <View style={{ flex: 1 }}>
            <Text style={styles.nextLabel}>{t('Next session')}</Text>
            <Text style={styles.nextTitle}>{sessionTitle(nextSession)}</Text>
            <Text style={styles.sub}>
              {tn(nextSession.exercises.filter((e) => e.block !== 'warmup' && e.block !== 'cooldown').length, '{n} exercise', '{n} exercises')} · ~{estimateMinutes(nextSession)} min
            </Text>
          </View>
          {/* ▶ empieza ya, como «Empezar rutina» en Hevy; el resto de la tarjeta abre la sesión para verla */}
          <TouchableOpacity
            style={styles.play}
            onPress={() => router.push({ pathname: '/workout-session', params: { program: p.id, session: nextSession.id, start: 'list' } })}
            hitSlop={8}
            accessibilityLabel={t('Start')}
          >
            <Ionicons name="play" size={18} color={Colors.background} />
          </TouchableOpacity>
        </TouchableOpacity>
      )}

      {p.active && (
        <>
          <Text style={styles.week}>
            {t('This week: {done} of {total} sessions', { done: Math.min(doneThisWeek(p), p.sessions.length), total: p.sessions.length })}
          </Text>
          <View style={styles.sessions}>
            {p.sessions.map((s) => {
              const last = [...p.completions].filter((c) => c.sessionId === s.id).sort((a, b) => b.at.localeCompare(a.at))[0];
              return (
                <TouchableOpacity
                  key={s.id}
                  style={styles.session}
                  onPress={() => router.push({ pathname: '/workout-session', params: { program: p.id, session: s.id } })}
                >
                  <View style={styles.letter}>
                    <Text style={styles.letterText}>{s.id}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sessionTitle}>{sessionName(s)}</Text>
                    <Text style={styles.sessionSub}>
                      ~{estimateMinutes(s)} min{last ? ` · ${t('last done {date}', { date: dayMonth(last.at) })}` : ''}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
                </TouchableOpacity>
              );
            })}
          </View>
          <TouchableOpacity style={styles.howRow} onPress={() => setShowHow((v) => !v)}>
            <Ionicons name="trending-up" size={16} color={Colors.accent} />
            <Text style={styles.howTitle}>{t('How to progress')}</Text>
            <Ionicons name={showHow ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.textMuted} />
          </TouchableOpacity>
          {showHow && <Text style={styles.howText}>{t(progressionText(p.prefs.goal))}</Text>}
        </>
      )}

      <View style={styles.actions}>
        {!p.active && onUse && (
          <TouchableOpacity style={styles.use} onPress={onUse}>
            <Text style={styles.useText}>{t('Follow this programme')}</Text>
          </TouchableOpacity>
        )}
        {!p.active && (
          <TouchableOpacity style={styles.ghost} onPress={() => router.push({ pathname: '/workout-session', params: { program: p.id, session: p.sessions[0]?.id ?? 'A' } })}>
            <Text style={styles.ghostText}>{t('See sessions')}</Text>
          </TouchableOpacity>
        )}
        <View style={{ flex: 1 }} />
        {/* Cualquier programa se puede cambiar: quitar, añadir y ordenar ejercicios (el editor de rutinas) */}
        <TouchableOpacity style={styles.edit} onPress={() => router.push({ pathname: '/workout-custom', params: { program: p.id } })} hitSlop={8}>
          <Ionicons name="pencil" size={14} color={Colors.accent} />
          <Text style={styles.editText}>{t('Edit')}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onDelete} hitSlop={8} accessibilityLabel={t('Delete')}>
          <Ionicons name="trash-outline" size={18} color={Colors.textMuted} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

export const WorkoutsScreen = () => {
  const router = useRouter();
  const scroll = useRef<ScrollView>(null);
  const [programs, setPrograms] = useState<WorkoutProgram[] | null>(null);
  const [failed, setFailed] = useState(false);
  const followed = useRef<string | null | undefined>(undefined); // el que sigues (undefined: aún sin cargar)
  const toTop = useRef(false);

  // Si cambia el programa que sigues (has elegido otro o acabas de crear uno), se vuelve arriba, donde
  // está: si no, en el hueco que pulsaste aparece el que seguías antes, con el mismo botón, y parece
  // que no ha hecho nada
  const load = useCallback(async () => {
    const list = await programRepository.list();
    const now = list.find((p) => p.active)?.id ?? null;
    toTop.current = followed.current !== undefined && followed.current !== now;
    followed.current = now;
    setPrograms(list);
  }, []);
  useReloadOnFocus(load);
  useEffect(() => {
    if (!toTop.current) return;
    toTop.current = false;
    scroll.current?.scrollTo({ y: 0, animated: true });
  }, [programs]);

  const remove = async (p: WorkoutProgram) => {
    const ok = await confirmAsk(t('Delete this programme?'), t('Its sessions and what you logged in it will disappear from this list. Workouts already counted in your plan stay.'), t('Delete'));
    if (!ok) return;
    await programRepository.remove(p.id);
    load();
  };
  const use = async (p: WorkoutProgram) => {
    setFailed(false);
    try {
      await programRepository.setActive(p.id);
    } catch {
      setFailed(true);
      return;
    }
    load();
  };

  const active = programs?.find((p) => p.active);
  const others = (programs ?? []).filter((p) => !p.active);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScreenHeader title={t('Workouts')} showBack backFallback="/" />
      <ScrollView ref={scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {failed && <Text style={styles.failed}>{t('The programme could not be changed. Check your connection and try again.')}</Text>}
        {!active && (
          <View style={styles.hero}>
            <MaterialCommunityIcons name="dumbbell" size={28} color={Colors.accent} />
            <Text style={styles.heroTitle}>{t('A programme that fits your week')}</Text>
            <Text style={styles.heroText}>
              {t('Tell us your goal, how many days you can train, for how long and with what. We build the sessions with short videos of each exercise.')}
            </Text>
          </View>
        )}

        {active && <ProgramCard p={active} onDelete={() => remove(active)} />}

        <View style={styles.buttons}>
          <TouchableOpacity style={styles.primary} onPress={() => router.push('/workout-new')}>
            <Ionicons name="sparkles-outline" size={18} color={Colors.background} />
            <Text style={styles.primaryText}>{active ? t('Create another workout') : t('Create my workout')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondary} onPress={() => router.push('/workout-custom')}>
            <Ionicons name="list-outline" size={18} color={Colors.accent} />
            <Text style={styles.secondaryText}>{t('Create my own routine')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondary} onPress={() => router.push('/log-workout')}>
            <Ionicons name="add-circle-outline" size={18} color={Colors.accent} />
            <Text style={styles.secondaryText}>{t('Log a workout you did')}</Text>
          </TouchableOpacity>
        </View>

        {others.length > 0 && <Text style={styles.section}>{active ? t('Other programmes') : t('Your programmes')}</Text>}
        {others.map((p) => (
          <ProgramCard key={p.id} p={p} onUse={() => use(p)} onDelete={() => remove(p)} />
        ))}

        <TouchableOpacity style={styles.library} onPress={() => router.push('/exercise-library')}>
          <Ionicons name="albums-outline" size={20} color={Colors.accent} />
          <View style={{ flex: 1 }}>
            <Text style={styles.libraryTitle}>{t('Exercise library')}</Text>
            <Text style={styles.sub}>{t('How to do each exercise, with its video')}</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
        </TouchableOpacity>

        <Text style={styles.safety}>
          {t('If you have an injury, a heart condition, are pregnant or have not exercised in a long time, check with your doctor before you start. Stop if you feel sharp pain, chest pain or dizziness.')}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: 40 },
  hero: { marginHorizontal: 20, marginBottom: 16, gap: 8 },
  heroTitle: { color: Colors.textPrimary, fontSize: 22, fontWeight: '900' },
  heroText: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20 },
  card: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 16, padding: 16, marginHorizontal: 20, marginBottom: 12, gap: 12 },
  cardActive: { borderColor: Colors.accent },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 42, height: 42, borderRadius: 21, backgroundColor: Colors.accentSoft, alignItems: 'center', justifyContent: 'center' },
  badge: { color: Colors.accent, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  title: { color: Colors.textPrimary, fontSize: 17, fontWeight: '800' },
  sub: { color: Colors.textSecondary, fontSize: 13, marginTop: 2 },
  note: { flexDirection: 'row', gap: 8, backgroundColor: Colors.background, borderRadius: 12, padding: 10 },
  noteText: { flex: 1, color: Colors.textPrimary, fontSize: 13, lineHeight: 18, fontStyle: 'italic' },
  next: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.accentSoft, borderRadius: 14, padding: 10 },
  nextLabel: { color: Colors.accent, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  nextTitle: { color: Colors.textPrimary, fontSize: 16, fontWeight: '800' },
  play: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.accent, alignItems: 'center', justifyContent: 'center' },
  week: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600' },
  sessions: { gap: 2 },
  session: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8, borderTopWidth: 1, borderTopColor: Colors.divider },
  letter: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: Colors.accent, alignItems: 'center', justifyContent: 'center' },
  letterText: { color: Colors.accent, fontSize: 13, fontWeight: '800' },
  sessionTitle: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },
  sessionSub: { color: Colors.textMuted, fontSize: 12 },
  howRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  howTitle: { flex: 1, color: Colors.textPrimary, fontSize: 13, fontWeight: '700' },
  howText: { color: Colors.textSecondary, fontSize: 13, lineHeight: 19 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  use: { backgroundColor: Colors.accent, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8 },
  useText: { color: Colors.background, fontSize: 13, fontWeight: '800' },
  ghost: { borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8 },
  ghostText: { color: Colors.textPrimary, fontSize: 13, fontWeight: '700' },
  edit: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 4 },
  editText: { color: Colors.accent, fontSize: 13, fontWeight: '700' },
  buttons: { marginHorizontal: 20, gap: 10, marginBottom: 16 },
  primary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: Colors.accent, borderRadius: 24, paddingVertical: 13 },
  primaryText: { color: Colors.background, fontSize: 15, fontWeight: '800' },
  secondary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 24, paddingVertical: 12 },
  secondaryText: { color: Colors.accent, fontSize: 14, fontWeight: '700' },
  section: { color: Colors.textPrimary, fontSize: 16, fontWeight: '800', marginHorizontal: 20, marginTop: 4, marginBottom: 10 },
  library: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 16, padding: 14, marginHorizontal: 20, marginTop: 4 },
  libraryTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: '800' },
  safety: { color: Colors.textMuted, fontSize: 12, lineHeight: 17, marginHorizontal: 20, marginTop: 18 },
  failed: { color: Colors.textSecondary, fontSize: 13, lineHeight: 18, marginHorizontal: 20, marginBottom: 12 },
});
