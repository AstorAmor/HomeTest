// Pestaña Plan (2026-11-16, borradores/app-estructura/ESPECIFICACION.md §4): lo que te has propuesto y cómo va tu
// semana. Se arma con lo que ya había: tus objetivos y tus metas (src/screens/MetasScreens.tsx y
// src/components/metas/), tu compromiso, las insignias (antes en Hoy), Entrenamientos y Menús (antes en Más,
// con su candado) y el plan de tu especialista si lo hay. Lo de dentro de cada cosa se rehace en la fase 2.
// Con el lenguaje fino del prototipo (src/theme/fine.ts): cabeceras pequeñas, filas con línea y letra Inter.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MetasToday } from '@/components/metas/MetasToday';
import { BadgesSection } from '@/components/BadgesSection';
import { TourTarget } from '@/components/tour/TourTarget';
import { makeTourScroll } from '@/components/tour/tourStore';
import { FRow, LockTag, Pill, SecHead, TabHead } from '@/components/fine/Fine';
import { useMetas } from '@/hooks/useMetas';
import { GOALS, GOALS_MAX, dayMonth, selectedIds } from '@/logic/metas';
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
import { num, t } from '@/i18n';
import { FINE, ff, fine } from '@/theme/fine';

export const PlanScreen = () => {
  const router = useRouter();
  const show = useSections();
  const tourScroll = useMemo(makeTourScroll, []);
  const on = show('plan');

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView {...tourScroll.props} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.pad}>
          <TabHead title={t('Your plan')} lead={t('What you have set out to do, and how your week is going')} />
        </View>

        {on ? (
          <>
            <GoalsRow />
            <MetasToday variant="plan" tourScroll={tourScroll} />
            <CommitBlock />
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
              <TouchableOpacity key={g} style={[fine.tile, styles.goal]} onPress={() => router.push('/metas')} activeOpacity={0.8}>
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
      <Text style={fine.note}>{t('Up to {n}. Each one is tied to something that is measured.', { n: GOALS_MAX })}</Text>
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
          <FRow
            title={t('Commitment signed on {date}, for {n} weeks', { date: dayMonth(s.commit.day), n: s.commit.weeks })}
            onPress={() => router.push('/metas-firmar')}
            last={!specialist}
          />
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
  goal: { flex: 1, minHeight: 78, justifyContent: 'space-between', gap: 8 },
  goalName: { ...ff('medium'), color: FINE.ivory, fontSize: 14, lineHeight: 18 },
  goalFig: { ...ff('regular'), color: FINE.mute, fontSize: 12.5, fontVariant: ['tabular-nums'] },
});
