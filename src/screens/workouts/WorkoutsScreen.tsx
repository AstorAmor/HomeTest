import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { confirmAsk } from '@/components/dev/confirmAsk';
import { CometLine } from '@/components/CometLine';
import { Chev, FRow, Pill, SecHead } from '@/components/fine/Fine';
import { DUMBBELL_PATH } from '@/components/fine/dumbbell';
import { FButton, FLink, formStyles } from '@/components/fine/FineForm';
import { PathEmblem } from '@/components/fine/RoleEmblem';
import { useReloadOnFocus } from '@/hooks/useReloadOnFocus';
import { getExercise } from '@/data/workouts/catalog';
import { programFacts, sessionName, sessionTitle } from '@/data/workouts/labels';
import { isSampleProgram, programRepository } from '@/data/workouts/programRepository';
import type { WorkoutProgram } from '@/data/workouts/types';
import { estimateMinutes, progressionText } from '@/logic/workoutGenerator';
import { isCustomProgram } from '@/logic/customRoutine';
import { daysText, nextUp, sessionsPerWeek, whenText } from '@/logic/workoutWeek';
import { ExerciseLoop } from '@/components/workouts/ExerciseLoop';
import { UnfinishedWorkout } from '@/components/workouts/UnfinishedWorkout';
import { type ActiveWorkout, clearActiveWorkout, loadActiveWorkout } from '@/data/workouts/activeWorkout';
import { dateLocale, t, tn } from '@/i18n';
import { FINE, ff, fine } from '@/theme/fine';

// Entrenamientos: el entreno a medias si lo hay, el programa que sigues (hecho por ti con el generador
// o mandado por tu entrenador), la sesión que toca hoy, los demás programas, el historial y la
// biblioteca de ejercicios.
// Rediseño del 2026-11-16 (lenguaje fino del prototipo): sin tarjetas; el programa con su cabecera pequeña, la sesión
// que toca en una sola caja casi transparente (como «Lo siguiente» en Hoy), la semana como una línea cometa, las
// sesiones en filas con línea fina y la letra a línea, los iconos finos y sin círculos de color.
// Desde el 2026-11-17 (fundador: «seguimos teniendo iconos… hay que ser coherente con el resto de experiencia de la
// app»): Historial, Exportar y Biblioteca son filas con línea fina y flecha (FRow), y los enlaces y «Cómo progresar»,
// solo texto; las pesas de cuando aún no hay programa son las del entrenador personal (fine/dumbbell.ts).

const dayMonth = (iso: string) => new Date(iso).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short' });

// Sesiones hechas en los últimos 7 días
const doneThisWeek = (p: WorkoutProgram) => p.completions.filter((c) => Date.now() - new Date(c.at).getTime() < 7 * 864e5).length;

export const sourceText = (p: WorkoutProgram) =>
  p.source === 'professional' ? t('From {name}', { name: p.professionalName || t('your specialist') }) : t('Made by you');

const ProgramCard = ({ p, onUse, onDelete }: { p: WorkoutProgram; onUse?: () => void; onDelete: () => void }) => {
  const router = useRouter();
  // Lo que toca: con días de la semana, la rutina de hoy (o la del siguiente día con rutina); sin días, la siguiente
  const up = nextUp(p);
  const nextSession = p.sessions.find((s) => s.id === up?.id);
  const own = isCustomProgram(p);
  const firstMain = nextSession?.exercises.find((e) => e.block === 'main');
  const hero = firstMain ? getExercise(firstMain.exerciseId) : undefined;
  const [showHow, setShowHow] = useState(false);
  const perWeek = sessionsPerWeek(p);
  const doneWeek = Math.min(doneThisWeek(p), perWeek);

  return (
    <View style={[styles.card, p.active && styles.cardActive]}>
      <View style={styles.head}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[styles.badge, p.active && { color: FINE.jade }]}>
            {p.active ? t('Your programme') : sourceText(p)}
            {isSampleProgram(p) ? ` · ${t('Example')}` : ''}
          </Text>
          <Text style={[styles.title, p.active && styles.titleActive]}>{t(p.title)}</Text>
          <Text style={styles.sub}>
            {[p.active ? sourceText(p) : null, ...programFacts(p)].filter(Boolean).join(' · ')}
          </Text>
        </View>
        {/* Cambiar y borrar, arriba y dentro de la tarjeta (fundador, 2026-11-06: abajo, la papelera se salía del recuadro en
            un móvil estrecho). Cualquier programa se puede cambiar: el editor de entrenamientos */}
        <View style={styles.tools}>
          <TouchableOpacity
            style={styles.tool}
            onPress={() => router.push({ pathname: '/workout-custom', params: { program: p.id } })}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={t('Edit')}
          >
            <Ionicons name="pencil-outline" size={17} color={FINE.jade} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.tool} onPress={onDelete} hitSlop={6} accessibilityRole="button" accessibilityLabel={t('Delete')}>
            <Ionicons name="trash-outline" size={17} color={FINE.mute} />
          </TouchableOpacity>
        </View>
      </View>

      {p.note ? (
        <View style={styles.note}>
          <Ionicons name="chatbox-ellipses-outline" size={14} color={FINE.mute} style={{ marginTop: 2 }} />
          <Text style={styles.noteText}>{t(p.note)}</Text>
        </View>
      ) : null}

      {/* La sesión que toca: la única caja (prototipo, `.next`) */}
      {/* La tarjeta abre la sesión y ▶ la empieza: dos botones uno al lado del otro (en la web un botón no puede
          llevar otro dentro) */}
      {p.active && nextSession && (
        <View style={[fine.tile, styles.next]}>
          <TouchableOpacity
            style={styles.nextOpen}
            activeOpacity={0.85}
            onPress={() => router.push({ pathname: '/workout-session', params: { program: p.id, session: nextSession.id } })}
            accessibilityRole="button"
            accessibilityLabel={`${whenText(up?.inDays ?? null)}: ${sessionTitle(nextSession, own)}`}
          >
            {hero && <ExerciseLoop exercise={hero} size={60} radius={12} />}
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.nextLabel}>{whenText(up?.inDays ?? null)}</Text>
              <Text style={styles.nextTitle}>{sessionTitle(nextSession, own)}</Text>
              <Text style={styles.sub}>
                {tn(nextSession.exercises.filter((e) => e.block !== 'warmup' && e.block !== 'cooldown').length, '{n} exercise', '{n} exercises')} · ~{estimateMinutes(nextSession)} min
              </Text>
            </View>
          </TouchableOpacity>
          {/* ▶ empieza ya, como «Empezar rutina» en Hevy; el resto de la tarjeta abre la sesión para verla */}
          <TouchableOpacity
            style={styles.play}
            onPress={() => router.push({ pathname: '/workout-session', params: { program: p.id, session: nextSession.id, start: 'list' } })}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('Start')}
          >
            <Ionicons name="play" size={17} color={FINE.ivory} style={{ marginLeft: 2 }} />
          </TouchableOpacity>
        </View>
      )}

      {p.active && (
        <>
          {/* La semana: cuántas sesiones llevas, como una línea cometa */}
          <View style={styles.weekBox}>
            <Text style={styles.week}>{t('This week: {done} of {total} sessions', { done: doneWeek, total: perWeek })}</Text>
            <CometLine progress={perWeek ? doneWeek / perWeek : 0} colors={['#2F8F70', FINE.jade]} style={styles.comet} />
          </View>
          <View>
            {p.sessions.map((s) => {
              const last = [...p.completions].filter((c) => c.sessionId === s.id).sort((a, b) => b.at.localeCompare(a.at))[0];
              const when = daysText(s);
              return (
                <TouchableOpacity
                  key={s.id}
                  style={fine.row}
                  onPress={() => router.push({ pathname: '/workout-session', params: { program: p.id, session: s.id } })}
                  accessibilityRole="button"
                  accessibilityLabel={sessionName(s, own)}
                >
                  <View style={styles.letter}>
                    <Text style={styles.letterText}>{s.id}</Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={fine.rowTitle}>{sessionName(s, own)}</Text>
                    <Text style={fine.rowSub}>
                      {when ? `${when} · ` : ''}~{estimateMinutes(s)} min{last ? ` · ${t('last done {date}', { date: dayMonth(last.at) })}` : ''}
                    </Text>
                  </View>
                  <Chev />
                </TouchableOpacity>
              );
            })}
          </View>
          <TouchableOpacity
            style={[fine.row, styles.howRow]}
            onPress={() => setShowHow((v) => !v)}
            accessibilityRole="button"
            accessibilityState={{ expanded: showHow }}
          >
            <Text style={[fine.rowTitle, { flex: 1 }]}>{t('How to progress')}</Text>
            <Ionicons name={showHow ? 'chevron-up' : 'chevron-down'} size={15} color={FINE.mute} />
          </TouchableOpacity>
          {showHow && <Text style={styles.howText}>{t(progressionText(p.prefs.goal))}</Text>}
        </>
      )}

      {!p.active && (
        <View style={styles.actions}>
          {onUse && <Pill label={t('Follow this programme')} onPress={onUse} />}
          <TouchableOpacity
            onPress={() => router.push({ pathname: '/workout-session', params: { program: p.id, session: p.sessions[0]?.id ?? 'A' } })}
            hitSlop={8}
            accessibilityRole="button"
          >
            <Text style={fine.link}>{t('See sessions')} ›</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
};

export const WorkoutsScreen = () => {
  const router = useRouter();
  const scroll = useRef<ScrollView>(null);
  const [programs, setPrograms] = useState<WorkoutProgram[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [unfinished, setUnfinished] = useState<ActiveWorkout | null>(null);
  const followed = useRef<string | null | undefined>(undefined); // el que sigues (undefined: aún sin cargar)
  const toTop = useRef(false);

  // Si cambia el programa que sigues (has elegido otro o acabas de crear uno), se vuelve arriba, donde
  // está: si no, en el hueco que pulsaste aparece el que seguías antes, con el mismo botón, y parece
  // que no ha hecho nada
  const load = useCallback(async () => {
    const [list, w] = await Promise.all([programRepository.list(), loadActiveWorkout()]);
    // Solo si su programa sigue ahí (si no, «Seguir» no tendría adónde ir)
    setUnfinished(w && list.some((p) => p.id === w.programId) ? w : null);
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

  const discard = async () => {
    if (!unfinished || !(await confirmAsk(t('Discard the unfinished workout?'), t('What you marked in {name} will be lost.', { name: sessionTitle(unfinished.session) }), t('Discard')))) return;
    await clearActiveWorkout();
    setUnfinished(null);
  };
  const remove = async (p: WorkoutProgram) => {
    const ok = await confirmAsk(t('Delete this programme?'), t('Its sessions will disappear. Your history keeps the day and minutes of each workout done with it, but not the sets.'), t('Delete'));
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
        {unfinished && (
          <View style={styles.unfinished}>
            <UnfinishedWorkout
              workout={unfinished}
              onContinue={() => router.push({ pathname: '/workout-session', params: { program: unfinished.programId, session: unfinished.session.id } })}
              onDiscard={discard}
            />
          </View>
        )}
        {failed && <Text style={styles.failed}>{t('The programme could not be changed. Check your connection and try again.')}</Text>}
        {!active && (
          <View style={styles.hero}>
            {/* Las pesas de toda la app, las del entrenador personal, en su aro fino (fine/dumbbell.ts) */}
            <PathEmblem d={DUMBBELL_PATH} size={46} color={FINE.jade} />
            <Text style={formStyles.q}>{t('A programme that fits your week')}</Text>
            <Text style={formStyles.lead}>
              {t('Tell us your goal, how many days you can train, for how long and with what. We build the sessions with short videos of each exercise.')}
            </Text>
          </View>
        )}

        {active && <ProgramCard p={active} onDelete={() => remove(active)} />}

        <View style={styles.buttons}>
          <FButton label={active ? t('Create another workout') : t('Create my workout')} icon="sparkles-outline" onPress={() => router.push('/workout-new')} />
          <View style={styles.links}>
            <FLink label={t('Create my own workout')} onPress={() => router.push('/workout-custom')} />
            <FLink label={t('Log a workout you did')} onPress={() => router.push('/log-workout')} />
          </View>
        </View>

        {others.length > 0 && <SecHead title={active ? t('Other programmes') : t('Your programmes')} style={styles.padH} />}
        {others.map((p) => (
          <ProgramCard key={p.id} p={p} onUse={() => use(p)} onDelete={() => remove(p)} />
        ))}

        {/* Historial, Exportar y Biblioteca: filas con línea fina y flecha, sin icono, como el resto de la app
            (fundador, 2026-11-17: «seguimos teniendo iconos (Historial, Exportar, Biblioteca de ejercicios...)») */}
        <View style={styles.more}>
          <FRow title={t('History')} sub={t('What you trained, session by session')} onPress={() => router.push('/workout-history')} />
          {/* Plan e historial en PDF o texto, para el entrenador o una IA (fundador, 2026-11-09) */}
          <FRow title={t('Export')} sub={t('Your plan and history, for your trainer or an AI')} onPress={() => router.push('/workout-export')} />
          <FRow title={t('Exercise library')} sub={t('How to do each exercise, with its video')} onPress={() => router.push('/exercise-library')} last />
        </View>

        <Text style={styles.safety}>
          {t('If you have an injury, a heart condition, are pregnant or have not exercised in a long time, check with your doctor before you start. Stop if you feel sharp pain, chest pain or dizziness.')}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingBottom: 40 },
  padH: { marginHorizontal: 20 },
  hero: { marginHorizontal: 20, marginTop: 8, marginBottom: 20, gap: 8 },
  // Cada programa, sin caja: separado del siguiente por una línea fina
  card: { marginHorizontal: 20, paddingTop: 6, paddingBottom: 16, marginBottom: 6, gap: 12, borderBottomWidth: 1, borderBottomColor: FINE.line },
  cardActive: { borderBottomWidth: 0, paddingBottom: 4, marginBottom: 10 },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  badge: { ...fine.kicker },
  title: { ...ff('medium'), color: FINE.ivory, fontSize: 17, lineHeight: 22, marginTop: 3 },
  titleActive: { fontSize: 22, lineHeight: 28 },
  sub: { ...ff('regular'), color: FINE.mute, fontSize: 12.5, lineHeight: 17, marginTop: 2 },
  note: { flexDirection: 'row', gap: 8 },
  noteText: { flex: 1, ...ff('regular'), color: '#CFD6CF', fontSize: 13, lineHeight: 18 },
  next: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  nextOpen: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 12 },
  nextLabel: { ...fine.kicker },
  nextTitle: { ...ff('medium'), color: FINE.ivory, fontSize: 16, lineHeight: 21, marginTop: 2 },
  play: { width: 42, height: 42, borderRadius: 21, backgroundColor: FINE.emerald, borderWidth: 1, borderColor: FINE.jadeLine, alignItems: 'center', justifyContent: 'center' },
  weekBox: { marginTop: 4 },
  week: { ...ff('regular'), color: FINE.mute, fontSize: 13 },
  comet: { marginTop: 2, marginHorizontal: -8 },
  // La letra de cada sesión, en un círculo a línea
  letter: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: FINE.jadeLine, alignItems: 'center', justifyContent: 'center' },
  letterText: { ...ff('medium'), color: FINE.jade, fontSize: 13 },
  howRow: { borderBottomWidth: 0 },
  howText: { ...ff('regular'), color: FINE.mute, fontSize: 13, lineHeight: 19, marginTop: -6 },
  tools: { flexDirection: 'row', alignItems: 'center', gap: 2, marginRight: -6, marginTop: -4 },
  tool: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 18 },
  buttons: { marginHorizontal: 20, marginTop: 8, marginBottom: 8, gap: 4 },
  links: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', columnGap: 22 },
  more: { marginHorizontal: 20, marginTop: 18, borderTopWidth: 1, borderTopColor: FINE.line },
  safety: { ...fine.note, marginHorizontal: 20, marginTop: 18 },
  unfinished: { marginHorizontal: 20 },
  failed: { ...formStyles.error, marginHorizontal: 20, marginBottom: 12 },
});
