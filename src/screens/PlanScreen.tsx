// Pestaña Plan (2026-11-16, borradores/app-estructura/ESPECIFICACION.md §4): lo que te has propuesto y cómo va tu
// semana. Se arma con lo que ya había: tus objetivos y tus metas (src/screens/MetasScreens.tsx y
// src/components/metas/), tu compromiso, las insignias (antes en Hoy), Entrenamientos y Menús (antes en Más,
// con su candado) y el plan de tu especialista si lo hay. Lo de dentro de cada cosa se rehace en la fase 2.
// Con el lenguaje fino del prototipo (src/theme/fine.ts): cabeceras pequeñas, filas con línea y letra Inter.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MetasToday } from '@/components/metas/MetasToday';
import { BadgesSection } from '@/components/BadgesSection';
import { GoalEmblem } from '@/components/fine/GoalEmblem';
import { goalHref } from '@/screens/GoalDetailScreen';
import { TourTarget } from '@/components/tour/TourTarget';
import { makeTourScroll } from '@/components/tour/tourStore';
import { FRow, LockTag, Pill, SecHead, TabHead } from '@/components/fine/Fine';
import { FineLink } from '@/components/fine/FineMeasure';
import { useMetas } from '@/hooks/useMetas';
import { GOALS, commitProgress, dateOfKey, dayKeyOf, dayMonth, selectedIds } from '@/logic/metas';
import { CometLine } from '@/components/CometLine';
import { Ionicons } from '@expo/vector-icons';
import { useSections } from '@/data/appPrefs';
import { useFeature } from '@/data/access';
import { computeAchievements } from '@/data/achievements';
import { checkInRepository } from '@/data/checkInRepository';
import { mealRepository, mindfulRepository, workoutRepository } from '@/data/planRepository';
import { profileRepository } from '@/data/profileRepository';
import { planVersionRepository } from '@/data/planVersions';
import { specialistPlans } from '@/logic/specialistPlan';
import { useDailyWearables } from '@/wearables/dailySeries';
import { useDeepState, useReloadOnFocus } from '@/hooks/useReloadOnFocus';
import { dateLocale, num, t } from '@/i18n';
import { onTabSection, pendingTabSection, TAB } from '@/constants/tabs';
import { FINE, ff, fine } from '@/theme/fine';

export const PlanScreen = () => {
  const router = useRouter();
  const show = useSections();
  const tourScroll = useMemo(makeTourScroll, []);
  const on = show('plan');

  // «Semana» en Hoy trae aquí a la altura de «Tu semana» (fundador, 2026-11-17). Mientras la petición es reciente se
  // vuelve a colocar cada vez que el bloque se mueve (tus objetivos cargan encima y lo empujan hacia abajo).
  const weekY = useRef<number | null>(null);
  const toWeek = useCallback(() => {
    if (pendingTabSection(TAB.plan) !== 'week' || weekY.current == null) return;
    tourScroll.ref.current?.scrollTo({ y: Math.max(0, weekY.current - 8), animated: true });
  }, [tourScroll]);
  useEffect(() => {
    toWeek();
    return onTabSection(toWeek);
  }, [toWeek]);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView {...tourScroll.props} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.pad}>
          <TabHead title={t('Your plan')} lead={t('What you have set out to do, and how your week is going')} />
        </View>

        {on ? (
          <>
            <GoalsRow />
            {/* Tu compromiso justo debajo de tus objetivos (fundador, 2026-11-18: «Tus objetivos y justo debajo pondría
                ya Tu compromiso. Semana 1 de X») */}
            <CommitBlock />
            <View
              onLayout={(e) => {
                weekY.current = e.nativeEvent.layout.y;
                toWeek();
              }}
            >
              <MetasToday variant="plan" tourScroll={tourScroll} />
            </View>
          </>
        ) : (
          // Quien usa Kuova solo para sus análisis (sin plan): cómo encenderlo
          <View style={[styles.pad, { marginTop: 20 }]}>
            <Text style={fine.body}>{t('Your plan is turned off. Turn it on to choose your goals and your weekly targets.')}</Text>
            <TouchableOpacity onPress={() => router.push('/app-sections')} hitSlop={8} style={{ marginTop: 10 }}>
              <Text style={fine.link}>{t('Configure my experience')} ›</Text>
            </TouchableOpacity>
          </View>
        )}

        {show('badges') && <Badges />}

        {on && <PaidBlock />}
      </ScrollView>
    </SafeAreaView>
  );
};

// Tus objetivos: hasta tres bloques con su nombre y, debajo, su medida (la cifra del análisis)
function GoalsRow() {
  const router = useRouter();
  const { data } = useMetas();
  if (!data) return null;
  const goals = data.state.goals;
  return (
    <View style={styles.pad}>
      <SecHead title={t('Your goals')} />
      {goals.length ? (
        <View style={styles.goals}>
          {goals.map((g) => {
            const lg = data.lab.find((x) => x.key === g);
            return (
              // Cada objetivo abre su pantalla, con lo que lo mide (fundador, 2026-11-16; antes, todos a /metas)
              <TouchableOpacity
                key={g}
                style={[fine.tile, styles.goal]}
                onPress={() => router.push(goalHref(g))}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={lg ? `${t(GOALS[g].name)}: ${num(lg.reading.value)} ${lg.reading.unit}` : t(GOALS[g].name)}
              >
                {/* Su emblema: un dibujo a línea en un círculo con luz (fundador, 2026-11-16) */}
                <GoalEmblem goal={g} lab={!!GOALS[g].lab} size={40} />
                <Text style={styles.goalName} numberOfLines={3}>
                  {t(GOALS[g].name)}
                </Text>
                {lg ? (
                  <Text style={styles.goalFig}>
                    {num(lg.reading.value)} {lg.reading.unit}
                  </Text>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>
      ) : (
        <FRow title={t('Choose your goals')} onPress={() => router.push('/metas-objetivos')} />
      )}
      {/* Cambiarlos todos a la vez, debajo y centrado (fundador, 2026-11-18: «que aparezca Edit your goals debajo de
          estos y que te lleve a la edición de todos») */}
      {goals.length ? (
        <FineLink label={t('Edit your goals')} icon="create-outline" onPress={() => router.push('/metas-objetivos')} style={styles.editGoals} />
      ) : null}
      {/* Sin la nota «Hasta 3. Cada uno va ligado a algo que se mide» (fundador, 2026-11-18: «eso sobra y mete ruido») */}
    </View>
  );
}

// Tu compromiso (firmarlo o cuándo lo firmaste) y el plan de tu especialista, si lo hay
function CommitBlock() {
  const router = useRouter();
  const { data } = useMetas();
  const [specialist, setSpecialist] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    planVersionRepository
      .getAll()
      .then((v) => alive && setSpecialist(specialistPlans(v)[0]?.createdAt ?? null))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  if (!data) return null;
  const s = data.state;
  if (!selectedIds(s).length && !specialist) return null;
  return (
    <View style={styles.pad}>
      <SecHead title={t('Your commitment')} />
      {selectedIds(s).length > 0 &&
        (s.commit ? (
          <CommitTimeline commit={s.commit} onPress={() => router.push('/metas-firmar')} last={!specialist} />
        ) : (
          <View style={{ alignItems: 'flex-start', paddingVertical: 8 }}>
            <Pill label={t('Sign your commitment')} onPress={() => router.push('/metas-firmar')} />
          </View>
        ))}
      {specialist ? (
        <FRow
          title={t('Your specialist’s plan')}
          sub={t('Sent on {date}', { date: dayMonth(specialist.slice(0, 10)) })}
          onPress={() => router.push('/plans')}
          last
        />
      ) : null}
    </View>
  );
}

// Tu compromiso como línea temporal (fundador, 2026-11-16: «estaría bien que fuese una línea temporal de cuándo
// empezó y cuándo termina y por dónde vas»): arriba la semana en la que estás y lo que queda; debajo, una línea
// cometa en oro (el de «Semana») del día que firmaste hasta hoy, con una marca por semana; y bajo los extremos, el
// día que empezó y el que termina. Se toca para ver o cambiar el compromiso.
const COMMIT_TONES = ['#93713A', '#CFAE6C', '#F3E0AE'];
function CommitTimeline({ commit, onPress, last }: { commit: { day: string; weeks: number }; onPress: () => void; last?: boolean }) {
  const p = commitProgress(commit, dayKeyOf(new Date()));
  const short = (k: string) => dateOfKey(k).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short' }).replace('.', '');
  const status = !p.started
    ? t('Starts on {date}', { date: dayMonth(commit.day) })
    : p.finished
      ? t('Finished on {date}', { date: dayMonth(p.end) })
      : p.left === 0
        ? t('last day')
        : p.left === 1
          ? t('1 day left')
          : t('{n} days left', { n: p.left });
  const head = p.finished ? t('{n} weeks', { n: commit.weeks }) : t('Week {n} of {total}', { n: p.week, total: commit.weeks });
  return (
    <TouchableOpacity
      style={[styles.commit, !last && styles.commitLine]}
      onPress={onPress}
      activeOpacity={0.8}
      accessibilityRole="button"
      accessibilityLabel={`${t('Your commitment')}: ${head}, ${status}. ${short(commit.day)} – ${short(p.end)}`}
    >
      <View style={styles.commitHead}>
        <Text style={styles.commitWeek}>{head}</Text>
        <Text style={styles.commitLeft}>{status}</Text>
        <Ionicons name="chevron-forward" size={15} color={FINE.mute} />
      </View>
      <View style={styles.commitTrack}>
        <CometLine progress={p.fraction} colors={COMMIT_TONES} thickness={3.5} style={styles.commitComet} />
        {/* Una marca por semana, de la firma al final */}
        <View style={styles.commitTicks} pointerEvents="none">
          {Array.from({ length: commit.weeks + 1 }, (_, i) => (
            <View key={i} style={[styles.commitTick, i / commit.weeks <= p.fraction && styles.commitTickOn]} />
          ))}
        </View>
      </View>
      <View style={styles.commitEnds}>
        <Text style={styles.commitEnd}>{short(commit.day)}</Text>
        <Text style={styles.commitEnd}>{short(p.end)}</Text>
      </View>
    </TouchableOpacity>
  );
}

// Insignias y rachas (antes en Hoy)
function Badges() {
  const { series } = useDailyWearables();
  const [data, setData] = useDeepState<Parameters<typeof computeAchievements>[0] | null>(null);
  useReloadOnFocus(
    useCallback(async () => {
      const [p, checkIns, workouts, meals, mindful] = await Promise.all([
        profileRepository.get().catch(() => null),
        checkInRepository.getAll().catch(() => []),
        workoutRepository.getAll().catch(() => []),
        mealRepository.getAll().catch(() => []),
        mindfulRepository.getAll().catch(() => []),
      ]);
      setData({
        dailySteps: [],
        workouts: workouts.map((w) => ({ fecha: w.fecha, type: w.type })),
        meals: meals.map((m) => ({ fecha: m.fecha })),
        checkIns: checkIns.map((c) => ({ fecha: c.fecha })),
        mindful: mindful.map((m) => ({ fecha: m.fecha })),
        badges: p?.badges ?? [],
      });
    }, [setData]),
  );
  if (!data) return null;
  const achievements = computeAchievements({ ...data, dailySteps: series.steps ?? [] });
  return (
    <View>
      <SecHead title={t('Badges and streaks')} style={styles.padH} />
      <BadgesSection achievements={achievements} />
    </View>
  );
}

// Entrenamientos y Menús (antes en Más): con candado y vista previa sin suscripción (la de cada pantalla)
function PaidBlock() {
  const router = useRouter();
  const workoutsOk = useFeature('workouts');
  const dietOk = useFeature('diet_menu');
  const rows = [
    { id: 'workouts', title: 'Workouts', sub: 'Your training plan and the log of what you do', to: '/workouts' as const, locked: workoutsOk === false },
    { id: 'diet', title: 'Meal plan', sub: 'Your weekly menu, made from your data', to: '/diet' as const, locked: dietOk === false },
  ];
  return (
    <View style={styles.pad}>
      <SecHead title={t('Workouts and meals')} />
      {rows.map((r, i) => (
        <TourTarget key={r.id} id={`plan.${r.id}`}>
          <FRow
            title={t(r.title)}
            sub={t(r.sub)}
            onPress={() => router.push(r.to)}
            right={r.locked ? <LockTag /> : undefined}
            last={i === rows.length - 1}
          />
        </TourTarget>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingBottom: 40 },
  pad: { paddingHorizontal: 20 },
  padH: { marginHorizontal: 20 },
  goals: { flexDirection: 'row', gap: 8 },
  editGoals: { alignSelf: 'center', marginTop: 10 },
  // Emblema, nombre y cifra centrados a lo ancho de la tarjeta (fundador, 2026-11-17: «centrados lateralmente, no verticalmente»)
  goal: { flex: 1, minHeight: 78, gap: 8, alignItems: 'center' },
  goalName: { ...ff('medium'), color: FINE.ivory, fontSize: 14, lineHeight: 18, textAlign: 'center' },
  goalFig: { ...ff('regular'), color: FINE.mute, fontSize: 12.5, fontVariant: ['tabular-nums'], textAlign: 'center' },
  commit: { paddingTop: 12, paddingBottom: 14 },
  commitLine: { borderBottomWidth: 1, borderBottomColor: FINE.line },
  commitHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  commitWeek: { ...ff('medium'), flex: 1, color: FINE.ivory, fontSize: 15 },
  commitLeft: { ...ff('regular'), color: FINE.mute, fontSize: 13, fontVariant: ['tabular-nums'] },
  // La línea cometa deja sitio a su brillo a los lados: se saca ese margen para que vaya de borde a borde
  commitTrack: { marginTop: 4 },
  commitComet: { marginHorizontal: -8 },
  commitTicks: { position: 'absolute', left: 0, right: 0, top: 13, flexDirection: 'row', justifyContent: 'space-between' },
  commitTick: { width: 1, height: 6, backgroundColor: FINE.rule },
  commitTickOn: { backgroundColor: 'rgba(216,185,120,0.55)' },
  commitEnds: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 },
  commitEnd: { ...ff('regular'), color: FINE.mute, fontSize: 11.5 },
});
