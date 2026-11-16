import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { ScreenHeader } from '@/components/ScreenHeader';
import { InfoButton } from '@/components/InfoButton';
import { GlowRing, ringTones } from '@/components/GlowRing';
import { CometLine } from '@/components/CometLine';
import { TrendChart } from '@/components/TrendChart';
import { CycleStrip } from '@/components/CycleStrip';
import { currentReport } from '@/data/reportRepository';
import { MetasToday } from '@/components/metas/MetasToday';
import { reportSeenKey, userFlags } from '@/data/userFlags';
import { Colors, withAlpha } from '@/constants/colors';
import { useAuth } from '@/context/AuthContext';
import { useFirstName } from '@/components/UserAvatar';
import { BadgesSection } from '@/components/BadgesSection';
import { SpecialistCarousel } from '@/components/SpecialistCarousel';
import { LEARNING_TOPICS } from '@/data/learning';
import { buildSchedule } from '@/data/schedule';
import { labAppointmentEvents } from '@/data/labAppointments';
import { consult } from '@/data/consultations';
import { buildSummary, summaryAppointments, SummaryLine } from '@/logic/summary';
import { dateLocale, num, t } from '@/i18n';
import { computeAchievements } from '@/data/achievements';
import { useDeepState, useReloadOnFocus } from '@/hooks/useReloadOnFocus';
import { TourTarget } from '@/components/tour/TourTarget';
import { WaterQuick } from '@/components/WaterQuick';
import { makeTourScroll, TourScroll } from '@/components/tour/tourStore';
import { DailyGoals, effectiveGoals, goalsShown, GoalsShown, suggestedGoals } from '@/logic/dailyGoals';
import { dailyGoalsStore, goalsShownStore } from '@/data/dailyGoals';
import { useWaterToday } from '@/hooks/useWaterToday';
import { litres } from '@/data/waterRepository';
import { TummyFaces } from '@/components/TummyFaces';
import { weightRepository } from '@/data/weightRepository';
import { WeighAdvice, weighAdvice } from '@/logic/weight';
import { useSections } from '@/data/appPrefs';
import { WelcomePrompts } from '@/components/WelcomePrompts';
import { nudgeStore } from '@/data/nudgeStore';
import { addBowelVisit, addUrineVisit, bowelRepository, dayKey, entryForDay, urineRepository } from '@/data/bathroomRepository';
import { hydrationFromUrine, HYDRATION_SCALE } from '@/logic/bathroom';
import { BowelEntry, STOOL_COLORS, UrineEntry, URINE_COLORS } from '@/types/bathroom';
import { GaugeBar } from '@/components/GaugeBar';
import { IconBadge } from '@/components/HealthIcons';
import { thermometerRepository } from '@/data/temperatureRepository';
import { doseRepository, medicationRepository } from '@/data/medicationRepository';
import { dosesForDay, isActiveOn, isReminderMuted } from '@/logic/medication';
import { DoseRows } from '@/components/DoseRows';
import { ZoneChangeBanner } from '@/components/ZoneChangeBanner';
import { ScheduledDose } from '@/types/medication';
import { mockBiomarkers, Biomarker } from '@/data/mockData';
import { getLiveBiomarkers, initialBiomarkers } from '@/utils/liveBiomarkers';
import { showSamples } from '@/data/dataMode';
import { sourceLabel } from '@/wearables/sourceLabel';
import { profileRepository, UserProfile } from '@/data/profileRepository';
import { checkInRepository, dailyCheckInSeries, sampleCheckInSeries, DailyCheckInPoint } from '@/data/checkInRepository';
import { CheckInEntry, MOMENT_OPTIONS } from '@/types/checkIn';
import { CheckInButton } from '@/components/CheckInButton';
import { checkInDayKey } from '@/logic/checkInDay';
import { cycleRepository } from '@/data/cycleRepository';
import { currentCyclePhase, CyclePhaseInfo } from '@/utils/cyclePhase';
import { cycleGoalStore } from '@/data/cycleGoal';
import {
  buildPlan,
  mealRepository,
  mindfulRepository,
  workoutRepository,
  mealsLoggedToday,
} from '@/data/planRepository';
import { computeReadiness, formatSleep, latest, shortDate, todayValue, useDailyWearables, DailyPoint } from '@/wearables/dailySeries';
import { useWebShell } from '@/web/webMode';


const statusColor = (status: Biomarker['status']) => {
  switch (status) {
    case 'excellent':
    case 'good':
      return Colors.accent;
    case 'attention':
      return Colors.warning;
    case 'high':
      return Colors.danger;
    default:
      return Colors.textSecondary;
  }
};

// Azúcar y tensión con datos tuyos: de cuándo es y de dónde sale, sin juicio; en la demo, el estado del ejemplo
const ownStatus = (b: Biomarker) =>
  b.fecha ? t(b.fromLab ? 'From your lab test · {date}' : 'Logged {date}', { date: shortDate(b.fecha) }) : t(b.statusLabel);

// Estado de un valor de wearable frente a su media reciente
const vsUsual = (points: DailyPoint[] | undefined, higherIsBetter: boolean) => {
  if (!points || points.length < 3) return { label: '—', color: Colors.textSecondary };
  const today = points[points.length - 1].value;
  const base = points.slice(0, -1).reduce((a, p) => a + p.value, 0) / (points.length - 1);
  const diff = (today - base) / base;
  if (Math.abs(diff) < 0.06) return { label: 'As usual', color: Colors.accent };
  const better = higherIsBetter ? diff > 0 : diff < 0;
  return better
    ? { label: higherIsBetter ? 'Above your usual' : 'Below your usual', color: Colors.accent }
    : { label: higherIsBetter ? 'Below your usual' : 'Above your usual', color: Colors.warning };
};

const MED_OPEN_KEY = 'today.medOpen.v1';

const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const TodayScreen = () => {
  const router = useRouter();
  const { demoMode, user } = useAuth();
  const firstName = useFirstName();
  // Sin alias, la app saluda con la parte del email: se ofrece poner un nombre
  const noAlias = !!user?.email && user.nombre === user.email.split('@')[0];
  const show = useSections();
  // Web del paciente en escritorio: Hoy se queda con lo del día; agenda, estado y biomarcadores ya están en el resumen
  const web = useWebShell();
  // Today trae lo nuevo de Health Connect al abrirse (como mucho cada 10 minutos)
  const { series, isSample, sources, hasAny } = useDailyWearables(29, { autoSync: true });
  const [biomarkers, setBiomarkers] = useDeepState<Biomarker[]>(initialBiomarkers());
  const [profile, setProfile] = useDeepState<UserProfile | null>(null);
  const [savedGoals, setSavedGoals] = useDeepState<Partial<DailyGoals> | null>(null);
  // Para que el tutorial pueda bajar hasta lo que señala
  const tourScroll = useMemo(makeTourScroll, []);
  const [achievementData, setAchievementData] = useDeepState<{
    workouts: { fecha: string; type: string }[];
    meals: { fecha: string }[];
    checkIns: { fecha: string }[];
    mindful: { fecha: string }[];
  }>({ workouts: [], meals: [], checkIns: [], mindful: [] });
  const [lastCheckIn, setLastCheckIn] = useDeepState<CheckInEntry | null>(null);
  const [checkInSeries, setCheckInSeries] = useDeepState<{ points: DailyCheckInPoint[]; sample: boolean }>({
    points: [],
    sample: true,
  });
  const [cycle, setCycle] = useDeepState<CyclePhaseInfo | null>(null);
  const [mealsToday, setMealsToday] = useState(0);
  // El aviso "Your report is here!" se enseña hasta que el usuario lo abre (user_flags).
  const [reportSeen, setReportSeen] = useState(true);
  // Avisos sin leer (src/logic/nudges: se evalúan al abrir Today) y registro de baño de hoy
  // Check-ins del día (el día de la persona: de madrugada aún cuenta el anterior)
  const [checkInsToday, setCheckInsToday] = useState(0);
  // Sin confeti al completar los 3 check-ins (fundador, 2026-11-16): basta con el aro y la nebulosa
  const [bathroomToday, setBathroomToday] = useDeepState<{ bowel: BowelEntry | null; urine: UrineEntry | null }>({
    bowel: null,
    urine: null,
  });
  const [dosesToday, setDosesToday] = useDeepState<ScheduledDose[]>([]);
  // Lo que tiene recordatorio: sus tomas de hoy se marcan desde aquí (Taken / Skip)
  const [reminderIds, setReminderIds] = useDeepState<string[]>([]);
  // Flechita de Medicación y suplementos: enseña u oculta todas las tomas de hoy (tengan o no
  // recordatorio). Se recuerda en el dispositivo; sin elegir, abierta si hay alguna con recordatorio.
  const [medOpen, setMedOpen] = useState<boolean | null>(null);
  useEffect(() => {
    AsyncStorage.getItem(MED_OPEN_KEY)
      .then((v) => v !== null && setMedOpen(v === '1'))
      .catch(() => undefined);
  }, []);
  // Última lectura con termómetro de las últimas 24 h (manda sobre la del wearable)
  const [thermo, setThermo] = useDeepState<number | null>(null);
  // "Your summary": lo próximo del calendario (citas, logística, resultados)
  const [summary, setSummary] = useDeepState<SummaryLine[]>([]);
  // Los últimos 7 días cuelgan del check-in: desplegados por defecto, la flecha los pliega y se
  // recuerda (clave v2: antes empezaban plegados y la elección guardada era la contraria)
  // «Tus últimos 7 días» sale plegado de primeras (fundador, 2026-11-15); se recuerda si lo abres (clave nueva v3)
  const [weekOpen, setWeekOpen] = useState(false);

  // Peso: el último y cuándo toca pesarse (una vez por semana)
  const [weight, setWeight] = useState<WeighAdvice | null>(null);
  const [savedShown, setSavedShown] = useState<Partial<GoalsShown> | null>(null);
  const water = useWaterToday();
  // Veces al baño de hoy (heces y orina); el «+» de sus tarjetas suma una y vuelve a leer
  const reloadBathroom = useCallback(
    () =>
      Promise.all([bowelRepository.getAll(), urineRepository.getAll()])
        .then(([b, u]) => setBathroomToday({ bowel: entryForDay(b, dayKey(new Date())) ?? null, urine: entryForDay(u, dayKey(new Date())) ?? null }))
        .catch(() => undefined),
    [setBathroomToday],
  );
  const load = useCallback(async () => {
    getLiveBiomarkers().then(setBiomarkers);
    userFlags.get('today_week_open.v3').then((v) => setWeekOpen(v === true));
    Promise.all([
      userFlags.get(reportSeenKey(currentReport.report_id)),
      labAppointmentEvents().catch(() => []),
      consult.myAppointments().catch(() => []),
    ]).then(([seen, labEvents, appts]) => {
      setReportSeen(!!seen);
      setSummary(
        buildSummary({
          events: [...buildSchedule(), ...labEvents],
          appointments: summaryAppointments(appts),
          newResults: showSamples() && demoMode === 'results' && !seen,
          now: new Date(),
        })
      );
    });
    // Los avisos se siguen calculando (para Notificaciones), aunque ya no salen en Hoy
    nudgeStore
      .refresh()
      .catch((e) => console.warn('Notifications not refreshed', e));
    // Sin la tabla de medicación (migración pendiente) simplemente no hay tomas que enseñar
    Promise.all([medicationRepository.getAll(), doseRepository.getAll()])
      .then(([m, l]) => {
        const active = m.filter((i) => isActiveOn(i, new Date()));
        setDosesToday(dosesForDay(active, new Date(), l));
        setReminderIds(active.filter((i) => i.reminders && !isReminderMuted(i)).map((i) => i.id));
      })
      .catch(() => setDosesToday([]));
    dailyGoalsStore.get().then(setSavedGoals);
    goalsShownStore.get().then(setSavedShown);
    weightRepository
      .getAll()
      .then((all) => setWeight(weighAdvice(all)))
      .catch(() => setWeight(null));
    thermometerRepository
      .getAll()
      .then((all) => {
        const last = all.reduce<(typeof all)[number] | null>((a, t) => (!a || t.fecha > a.fecha ? t : a), null);
        setThermo(last && Date.now() - new Date(last.fecha).getTime() < 24 * 3600 * 1000 ? last.valor : null);
      })
      .catch(() => setThermo(null));
    reloadBathroom();
    const [p, checkIns, cycleEntries, meals, workoutList, mealList, mindfulList] = await Promise.all([
      profileRepository.get(),
      checkInRepository.getAll(),
      cycleRepository.getAll(),
      mealsLoggedToday(),
      workoutRepository.getAll(),
      mealRepository.getAll(),
      mindfulRepository.getAll(),
    ]);
    setAchievementData({
      workouts: workoutList.map((w) => ({ fecha: w.fecha, type: w.type })),
      meals: mealList.map((m) => ({ fecha: m.fecha })),
      checkIns: checkIns.map((c) => ({ fecha: c.fecha })),
      mindful: mindfulList.map((m) => ({ fecha: m.fecha })),
    });
    setProfile(p);
    setLastCheckIn(checkIns.length ? checkIns[0] : null);
    const todayKey = checkInDayKey({ fecha: new Date().toISOString() });
    setCheckInsToday(checkIns.filter((c) => checkInDayKey(c) === todayKey).length);
    const real = dailyCheckInSeries(checkIns);
    // Cuenta real: solo sus días (aunque sea uno); la demo rellena con un ejemplo
    setCheckInSeries(
      real.length >= 2 || (!showSamples() && real.length > 0)
        ? { points: real, sample: false }
        : showSamples()
          ? { points: sampleCheckInSeries(), sample: true }
          : { points: [], sample: false },
    );
    const cycleGoal = p.sex === 'female' ? await cycleGoalStore.get().catch(() => null) : null;
    setCycle(p.sex === 'female' ? currentCyclePhase(cycleEntries, new Date(), cycleGoal?.cycleLength, cycleGoal) : null);
    setMealsToday(meals);
  }, [setBiomarkers, setProfile, setLastCheckIn, setCheckInSeries, setCycle, setAchievementData, reloadBathroom, setDosesToday, setReminderIds, setThermo, setSummary, demoMode]);

  useReloadOnFocus(load);

  // Lo de HOY (si el último dato es de ayer, hoy aún no hay: 0). En la demo, el último día de ejemplo.
  const ofToday = (p?: DailyPoint[]) => (isSample ? latest(p) : todayValue(p));
  const steps = ofToday(series.steps) ?? 0;
  const calories = ofToday(series.active_energy);
  const sleep = ofToday(series.sleep_duration) ?? 0;
  const distanceKm = ofToday(series.distance);
  // Por qué no hay estado de hoy: sin datos, solo pasos, o sin datos de hoy todavía
  const hasHeartOrSleep = !!(series.sleep_duration?.length || series.resting_heart_rate?.length || series.hrv?.length);
  const lastWearableDay = Object.values(series)
    .map((p) => p?.[p.length - 1]?.date ?? '')
    .sort()
    .pop();

  const sugar = biomarkers.find((b) => b.id === 'sugar');
  const bp = biomarkers.find((b) => b.id === 'blood_pressure');
  const rhr = latest(series.resting_heart_rate);
  const hrv = latest(series.hrv);
  const temp = thermo ?? latest(series.body_temperature);

  const lastMoment = lastCheckIn ? MOMENT_OPTIONS.find((m) => m.id === lastCheckIn.moment) : null;

  // Objetivos de los círculos de «Tu estado de hoy»: los del plan de tus respuestas (los mismos
  // aunque ya cumplas alguno) o los que haya puesto el usuario
  const goals = effectiveGoals(suggestedGoals(buildPlan(profile), profile).goals, savedGoals);
  // Frente a su objetivo de sueño y, en la fase lútea (con reglas apuntadas), sin restar lo propio del ciclo
  const readiness = computeReadiness(series, new Date(), { sleepNeedMin: goals.sleepMin, luteal: !!cycle && !cycle.isSample && cycle.phase === 'luteal' });
  // Los círculos que ha elegido (Tus objetivos del día). Si el reloj no da kcal y la distancia no está,
  // la distancia ocupa el sitio de las kcal, como antes
  const shownGoals = goalsShown(savedShown, show('bladder'));
  const distanceForKcal = shownGoals.activeKcal && calories == null && distanceKm != null && !shownGoals.distanceM;
  // Círculos de «Tus objetivos del día»: lo de hoy y el objetivo
  const km = (m: number) => `${(m / 1000).toLocaleString(dateLocale(), { maximumFractionDigits: 1 })} km`;
  const rings = [
    shownGoals.steps && {
      key: 'steps',
      icon: <Ionicons name="footsteps" size={16} color={Colors.sky} />,
      color: Colors.sky,
      progress: steps / goals.steps,
      value: steps.toLocaleString(dateLocale()),
      goal: goals.steps.toLocaleString(dateLocale()),
      label: t('Steps'),
    },
    shownGoals.activeKcal && !distanceForKcal && {
      key: 'kcal',
      icon: <Ionicons name="flame" size={16} color={Colors.coral} />,
      color: Colors.coral,
      progress: (calories ?? 0) / goals.activeKcal,
      value: calories != null ? `${calories}` : '—',
      goal: goals.activeKcal.toLocaleString(dateLocale()),
      label: t('Active kcal'),
    },
    (shownGoals.distanceM || distanceForKcal) && {
      key: 'distance',
      icon: <Ionicons name="navigate-outline" size={16} color={Colors.amber} />,
      color: Colors.amber,
      progress: (distanceKm ?? 0) / goals.distanceM,
      value: distanceKm != null ? km(distanceKm) : '—',
      goal: km(goals.distanceM),
      label: t('Distance'),
    },
    shownGoals.sleepMin && {
      key: 'sleep',
      icon: <Ionicons name="moon" size={15} color={Colors.violet} />,
      color: Colors.violet,
      progress: sleep / goals.sleepMin,
      value: sleep ? formatSleep(sleep) : '—',
      goal: formatSleep(goals.sleepMin),
      label: t('Sleep'),
    },
    shownGoals.waterMl && {
      key: 'water',
      icon: <Ionicons name="water" size={16} color={Colors.water} />,
      color: Colors.water,
      progress: water.total / goals.waterMl,
      value: litres(water.total),
      goal: litres(goals.waterMl),
      label: t('Water'),
    },
  ].filter((r) => !!r) as GoalRingProps[];
  const ringSize = rings.length >= 5 ? 54 : rings.length === 4 ? 60 : 66;
  const achievements = computeAchievements({
    dailySteps: series.steps ?? [],
    ...achievementData,
    badges: profile?.badges ?? [],
  });

  const medShown = medOpen ?? dosesToday.some((d) => reminderIds.includes(d.medId));

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView {...tourScroll.props} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Sin la foto de perfil arriba a la derecha (fundador, 2026-11-05) */}
        <ScreenHeader title={t('Today')} />

        <View style={styles.greeting}>
          <Text style={styles.greetingTitle}>{t('Hi {name}!', { name: firstName })}</Text>
          {noAlias && (
            <TouchableOpacity onPress={() => router.push('/your-name')} hitSlop={8} style={styles.aliasLink}>
              <Ionicons name="create-outline" size={14} color={Colors.accent} />
              <Text style={styles.aliasLinkText}>{t('How should we call you?')}</Text>
            </TouchableOpacity>
          )}
        </View>

        {!web && (
        <>
        {/* Lo próximo del calendario: citas, logística y resultados (sin nombrar categorías). Sin nada
            previsto no sale (fundador, 2026-11-05): lo primero pasa a ser el check-in */}
        {summary.length > 0 && (
        <>
        <Text style={styles.sectionTitle}>{t('Your summary')}</Text>
        <View style={styles.summaryCard}>
          {summary.map((l, i) => (
              <TouchableOpacity
                key={l.id}
                style={[styles.summaryRow, i > 0 && styles.summaryDivider]}
                onPress={() => {
                  if (l.id === 'results-new') {
                    // Visto: el aviso desaparece ya (al volver atrás no reaparece)
                    setReportSeen(true);
                    setSummary(summary.filter((x) => x.id !== 'results-new'));
                    userFlags.set(reportSeenKey(currentReport.report_id));
                  }
                  router.push(l.target as any);
                }}
                activeOpacity={0.8}
              >
                <Ionicons name={l.icon as any} size={18} color={l.highlight ? Colors.gold : Colors.accent} />
                <Text style={[styles.summaryText, l.highlight && styles.summaryHighlight]}>{l.text}</Text>
                <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
              </TouchableOpacity>
            ))}
        </View>
        </>
        )}
        {/* Los avisos ya no salen en Hoy (fundador, 2026-11-05): se ven y se ajustan en Más → Notificaciones */}
        </>
        )}

        {/* Check-in */}
        {show('checkin') && (
          <>
            <View style={styles.checkInWrap}>
              {/* La nebulosa viva con su aro de 3 tramos: los check-ins del día (rediseño 2026-11-15) */}
              <TourTarget id="today.checkin" scroll={tourScroll}>
                <CheckInButton done={checkInsToday} onPress={() => router.push('/check-in')} />
              </TourTarget>

              <TouchableOpacity
                style={styles.weekToggle}
                onPress={() => {
                  setWeekOpen(!weekOpen);
                  userFlags.set('today_week_open.v3', !weekOpen);
                }}
                accessibilityRole="button"
                accessibilityState={{ expanded: weekOpen }}
              >
                <Text style={styles.weekToggleText}>{t('Your last 7 days')}</Text>
                {checkInSeries.sample && <Text style={styles.sampleTag}>{t('sample')}</Text>}
                <Ionicons name={weekOpen ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.textMuted} />
              </TouchableOpacity>
              {weekOpen && (
                // Tocar la tendencia abre "Tus últimos días": qué pasó cada día (check-ins, sueño, medicación…)
                <TouchableOpacity
                  style={{ marginTop: 6 }}
                  activeOpacity={0.85}
                  disabled={checkInSeries.sample}
                  onPress={() => router.push('/your-days' as any)}
                >
                  <TrendChart
                    interactive={false}
                    height={96}
                    labels={checkInSeries.points.map((p) => shortDate(p.date))}
                    series={[
                      { label: t('Energy'), color: Colors.green, values: checkInSeries.points.map((p) => p.energy) },
                      { label: t('Mood'), color: Colors.gold, values: checkInSeries.points.map((p) => p.mood) },
                    ]}
                    formatY={(v) => v.toFixed(0)}
                  />
                  {lastMoment && !checkInSeries.sample && (
                    <Text style={styles.cardFootnote}>{t('Last: {moment}', { moment: t(lastMoment.label).toLowerCase() })}</Text>
                  )}
                  {!checkInSeries.sample && (
                    <Text style={styles.daysLink}>
                      {t('What happened each day')} <Ionicons name="chevron-forward" size={12} color={Colors.accent} />
                    </Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </>
        )}

        {show('medication') && (
          <TourTarget id="today.medication" scroll={tourScroll} inset={20}>
          {/* Sin tarjeta (rediseño «Emerald Luxury», 2026-11-16): flota sobre el fondo ambiental */}
          <View style={styles.medBlock}>
          <ZoneChangeBanner onChanged={load} />
          <View style={styles.medHeader}>
          <TouchableOpacity style={styles.medHeaderMain} onPress={() => router.push('/medications')} activeOpacity={0.85}>
            <Ionicons name="medical-outline" size={20} color={Colors.gold} style={styles.medIcon} />
            <View style={{ flex: 1 }}>
              <Text style={styles.medTitle}>{t('Medication & supplements')}</Text>
              <Text style={styles.fullPlanSub}>
                {dosesToday.length === 0
                  ? t('Add what you take to keep track')
                  : (() => {
                      const pending = dosesToday.find((d) => !d.log);
                      const done = dosesToday.filter((d) => d.log?.status === 'taken').length;
                      return pending
                        ? t('Next: {name} at {time} · {done}/{total} taken', { name: pending.name, time: `${String(pending.at.getHours()).padStart(2, '0')}:${String(pending.at.getMinutes()).padStart(2, '0')}`, done, total: dosesToday.length })
                        : t('All {n} doses done today', { n: dosesToday.length });
                    })()}
              </Text>
            </View>
            {dosesToday.length === 0 && <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />}
          </TouchableOpacity>
          {dosesToday.length > 0 && (
            <TouchableOpacity
              style={styles.medToggle}
              hitSlop={10}
              onPress={() => {
                const next = !medShown;
                setMedOpen(next);
                AsyncStorage.setItem(MED_OPEN_KEY, next ? '1' : '0').catch(() => undefined);
              }}
              accessibilityLabel={medShown ? t('Hide today’s doses') : t('Show today’s doses')}
            >
              <Ionicons name={medShown ? 'chevron-up' : 'chevron-down'} size={20} color={Colors.textSecondary} />
            </TouchableOpacity>
          )}
          </View>
          {medShown && dosesToday.length > 0 && (
            <View style={styles.medDoses}>
              <DoseRows doses={dosesToday} onChange={load} />
            </View>
          )}
          </View>
          </TourTarget>
        )}

        {cycle && show('cycle') && (
          <View style={styles.block}>
            <CycleStrip variant="line" info={cycle} onPress={() => router.push('/cycle-detail')} />
          </View>
        )}

        {/* Cumple tus objetivos (sustituye al plan desde la fase 1 de las metas): la enhorabuena de la semana
            y un donut por área, encima de «Tu estado de hoy» (fundador, 2026-11-05) */}
        {show('plan') && <MetasToday tourScroll={tourScroll} />}

        {!web && (
        <>
        {/* Daily readiness */}
        {show('readiness') && (
          <>
            <View style={[styles.sectionHeaderRow, { alignItems: 'center' }]}>
              <Text style={[styles.sectionTitle, styles.sectionTitleInline]}>{t('Daily readiness')}</Text>
              <InfoButton topic="readiness" />
            </View>
            <TourTarget id="today.readiness" scroll={tourScroll} inset={20}>
            {/* Sin tarjeta ni círculo (rediseño 2026-11-16): un número grande y una línea cometa que va de
                coral a verde según la puntuación. Sin datos de hoy, «—» y la línea vacía con la frase debajo:
                siempre se ve que está (fundador, 2026-11-16: «no puedo ver si hay un Daily readiness»). Los
                objetivos del día, en círculos */}
            <View style={styles.readinessBlock}>
              <View style={styles.readinessTop}>
                <Text style={[styles.readinessScore, !readiness && styles.readinessScoreEmpty]}>{readiness ? readiness.score : '—'}</Text>
                <View style={styles.readinessSide}>
                  {readiness && <Text style={styles.readinessLabel}>{t(readiness.label)}</Text>}
                  <Text style={styles.readinessOf}>{t('out of 100')}</Text>
                </View>
              </View>
              <CometLine progress={readiness ? readiness.score / 100 : 0} colors={[Colors.coral, Colors.gold, Colors.green]} spread="track" thickness={5} style={styles.readinessLine} />
              {!readiness && (
                <Text style={styles.readinessEmpty}>
                  {!hasAny
                    ? t('Connect a wearable to see your readiness.')
                    : !hasHeartOrSleep
                      ? t('Your wearable is only sharing steps. To see how you are today we need your sleep or heart rate.')
                      : t('No sleep or heart rate from today yet. Open your watch app so it syncs.')}
                </Text>
              )}
              {readiness?.cycleAdjusted && (
                <Text style={styles.cardFootnote}>{t('Luteal phase: a slightly higher resting heart rate and lower HRV are normal now, so they do not count against you.')}</Text>
              )}
              {readiness && readiness.missing.length > 0 && (
                <Text style={styles.cardFootnote}>
                  {t('Worked out without: {parts}', {
                    parts: readiness.missing.map((m) => t(m === 'sleep' ? 'sleep' : m === 'hrv' ? 'HRV' : 'resting heart rate')).join(', '),
                  })}
                </Text>
              )}
              {hasAny && (
                <TourTarget id="today.goals" scroll={tourScroll} style={styles.ringsTap}>
                <TouchableOpacity style={styles.ringsTap} activeOpacity={0.8} onPress={() => router.push('/daily-goals')} accessibilityLabel={t('Your daily goals')}>
                {rings.length > 0 && (
                  <View style={styles.goalRings}>
                    {rings.map(({ key, ...r }) => (
                      <GoalRing key={key} size={ringSize} {...r} />
                    ))}
                  </View>
                )}
                <Text style={styles.goalsLink}>
                  <Ionicons name="flag-outline" size={12} color={Colors.accent} /> {t('Your daily goals')}
                </Text>
                </TouchableOpacity>
                </TourTarget>
              )}
              <Text style={styles.sourceText}>
                {hasAny
                  ? `${t('From {source}', { source: sourceLabel(sources, false) })}${isSample ? ` (${t('sample data')})` : ''}${
                      !isSample && lastWearableDay && lastWearableDay < localToday() ? ` · ${t('last data {date}', { date: shortDate(lastWearableDay) })}` : ''
                    } · `
                  : ''}
                <Text style={styles.link} onPress={() => router.push('/wearables')}>
                  {hasAny ? t('manage') : t('Connect')}
                </Text>
              </Text>
            </View>
            </TourTarget>
          </>
        )}

        {/* Biomarkers: lo que apuntas y lo del reloj (fundador, 2026-11-06: «todo son biomarcadores»); una línea
            dice de dónde sale y cada tarjeta, de cuándo es lo tuyo */}
        <Text style={[styles.sectionTitle, styles.sectionTitleTight]}>{t('Biomarkers')}</Text>
        <Text style={styles.sectionHint}>{t('What you log and what comes from your watch. Tap one to see its history.')}</Text>
        <View style={styles.grid}>
          {sugar && (
            <BiomarkerCard
              name={t('Sugar')}
              icon="glucose"
              iconColor={Colors.accent}
              value={sugar.valor}
              unit={sugar.unidad}
              status={ownStatus(sugar)}
              color={statusColor(sugar.status)}
              onPress={() => router.push('/glucose-detail')}
            />
          )}
          {bp && (
            <BiomarkerCard
              name={t('Blood pressure')}
              icon="speedometer-outline"
              iconColor={Colors.coral}
              value={bp.valor}
              unit={bp.unidad}
              status={ownStatus(bp)}
              color={statusColor(bp.status)}
              onPress={() => router.push('/blood-pressure-detail')}
              tourId="today.bp"
              tourScroll={tourScroll}
            />
          )}
          <BiomarkerCard
            name={t('Weight')}
            icon="mci:scale-bathroom"
            iconColor={Colors.violet}
            value={weight?.last ? num(weight.last.valor.toFixed(1)) : '—'}
            unit="kg"
            status={
              !weight?.last
                ? t('Tap to log')
                : weight.due
                  ? t('Time to weigh in')
                  : t('Next: {day}', { day: weight.next ? weight.next.toLocaleDateString(dateLocale(), { weekday: 'short', day: 'numeric' }) : '' })
            }
            color={weight?.due ? Colors.accent : Colors.textMuted}
            onPress={() => router.push(weight?.last ? '/weight-detail' : '/log-weight')}
          />
          {show('wearables') && (
            <>
              <BiomarkerCard
                name={t('Resting HR')}
                icon="heart-outline"
                iconColor={Colors.coral}
                value={rhr != null ? String(rhr) : '—'}
                unit="bpm"
                status={t(vsUsual(series.resting_heart_rate, false).label)}
                color={vsUsual(series.resting_heart_rate, false).color}
                onPress={() => router.push({ pathname: '/metric', params: { kind: 'resting_heart_rate' } })}
              />
              <BiomarkerCard
                name={t('HRV')}
                icon="pulse-outline"
                iconColor={Colors.accent}
                value={hrv != null ? String(hrv) : '—'}
                unit="ms"
                status={t(vsUsual(series.hrv, true).label)}
                color={vsUsual(series.hrv, true).color}
                onPress={() => router.push({ pathname: '/metric', params: { kind: 'hrv' } })}
              />
              <BiomarkerCard
                name={t('Temperature')}
                icon="thermometer-outline"
                iconColor={Colors.pinkSoft}
                value={temp != null ? temp.toFixed(1) : '—'}
                unit="°C"
                status={temp == null ? '—' : temp >= 36.1 && temp <= 37.2 ? t('Normal') : t('Check')}
                color={temp == null ? Colors.textMuted : temp >= 36.1 && temp <= 37.2 ? Colors.accent : Colors.warning}
                onPress={() => router.push({ pathname: '/metric', params: { kind: 'body_temperature' } })}
                wide
              >
                {/* Franja normal (36,1–37,2 °C) y el punto en el valor de hoy */}
                <GaugeBar
                  min={35.5}
                  max={38.5}
                  value={temp ?? null}
                  range={[36.1, 37.2]}
                  rangeLabel={t('Normal 36.1–37.2')}
                  stops={[
                    { at: 35.5, color: Colors.sky },
                    { at: 36.1, color: Colors.green },
                    { at: 37.2, color: Colors.green },
                    { at: 38.5, color: Colors.coral },
                  ]}
                  leftLabel="35.5"
                  rightLabel="38.5 °C"
                />
              </BiomarkerCard>
            </>
          )}
          {show('gut') && (() => {
            const b = bathroomToday.bowel;
            const flag = STOOL_COLORS.find((c) => c.id === b?.color)?.flag;
            const status = !b
              ? 'Tap to log'
              : b.count === 0
                ? 'None today'
                : flag && !b.explainedBy
                  ? 'See note'
                  : b.consistency && b.consistency <= 2
                    ? 'A bit hard'
                    : b.consistency && b.consistency >= 6
                      ? 'Loose'
                      : 'Regular';
            const tone = !b ? Colors.textMuted : status === 'Regular' ? Colors.ok : status === 'See note' ? Colors.attention : Colors.warning;
            return (
              <BiomarkerCard
                name={t('Digestion')}
                icon="intestine"
                iconColor={Colors.green}
                value={b ? String(b.count) : '—'}
                unit={b?.count === 1 ? t('time') : t('times')}
                status={t(status)}
                color={tone}
                onPress={() => router.push({ pathname: '/digestive', params: { part: 'gut' } })}
                tourId="today.gut"
                tourScroll={tourScroll}
                above={<TummyFaces />}
                onAdd={() => addBowelVisit().then(reloadBathroom)}
                addLabel={t('Add one bathroom visit')}
              />
            );
          })()}
          {show('bladder') && (() => {
            const u = bathroomToday.urine;
            const h = hydrationFromUrine(u);
            const tone = { good: Colors.ok, tip: Colors.warning, low: Colors.attention, check: Colors.attention, unknown: Colors.textMuted }[h.level];
            return (
              <BiomarkerCard
                name={t('Hydration')}
                icon="water-outline"
                iconColor={Colors.water}
                value={u?.count != null ? String(u.count) : '—'}
                unit={u?.count === 1 ? t('time') : t('times')}
                status={t(h.label)}
                color={tone}
                onPress={() => router.push({ pathname: '/digestive', params: { part: 'bladder' } })}
                tourId="today.hydration"
                tourScroll={tourScroll}
                above={<WaterQuick goalMl={goals.waterMl} />}
                onAdd={() => addUrineVisit().then(reloadBathroom)}
                addLabel={t('Add one time you peed')}
              >
                {/* Regla de hidratación: del color más claro al más oscuro de la orina */}
                <GaugeBar
                  min={0}
                  max={HYDRATION_SCALE.length - 1}
                  value={h.position}
                  stops={HYDRATION_SCALE.map((c, i) => ({ at: i, color: URINE_COLORS.find((x) => x.id === c)!.swatch }))}
                  leftLabel={t('Hydrated')}
                  rightLabel={t('Drink more')}
                />
              </BiomarkerCard>
            );
          })()}
        </View>
        </>
        )}

        {/* Your badges */}
        {show('badges') && (
          <>
            <Text style={styles.sectionTitle}>{t('Your badges')}</Text>
            <BadgesSection achievements={achievements} />
          </>
        )}

        {/* Talk to a specialist */}
        {show('specialists') && (
          <>
            <Text style={styles.sectionTitle}>{t('Talk to a specialist')}</Text>
            <SpecialistCarousel loop onSelect={(s) => router.push({ pathname: '/professionals', params: { role: s.id } })} />
          </>
        )}

        {/* Keep learning */}
        {show('learning') && (
          <TourTarget id="today.learning" scroll={tourScroll}>
            <Text style={styles.sectionTitle}>{t('Keep learning')}</Text>
            <SpecialistCarousel
              loop
              items={LEARNING_TOPICS.filter((x) => x.featured)}
              onSelect={(x) => router.push({ pathname: '/learn', params: { topic: x.id } })}
              more={{ label: t('More'), subtitle: t('All topics'), onPress: () => router.push('/learn-all') }}
            />
          </TourTarget>
        )}
      </ScrollView>
      {/* Perfil genético y, a las mujeres, cuestionario de la regla: las primeras veces que entra */}
      <WelcomePrompts />
    </SafeAreaView>
  );
};

// Un círculo de «Tus objetivos del día»: el anillo cometa con el icono dentro, lo de hoy y el nombre debajo
// (fundador, 2026-11-16: mejor círculos aquí y líneas en «Tus objetivos»; antes del rediseño, ProgressRing)
type GoalRingProps = { key: string; icon: React.ReactNode; color: string; progress: number; value: string; goal: string; label: string };
const GoalRing = ({ icon, color, progress, value, goal, label, size }: Omit<GoalRingProps, 'key'> & { size: number }) => (
  <View style={styles.goalRing} accessible accessibilityLabel={`${label}: ${value} / ${goal}`}>
    <GlowRing progress={progress} colors={ringTones(color)} size={size} stroke={size < 60 ? 4 : 4.5}>
      {icon}
    </GlowRing>
    <Text style={styles.goalRingValue}>{value}</Text>
    <Text style={styles.goalRingLabel}>{label}</Text>
  </View>
);

const BiomarkerCard = ({
  name,
  icon,
  iconColor,
  value,
  unit,
  status,
  color,
  onPress,
  wide,
  children,
  tourId,
  tourScroll,
  above,
  onAdd,
  addLabel,
}: {
  name: string;
  icon: string;
  iconColor: string;
  value: string;
  unit: string;
  status: string;
  color: string;
  onPress: () => void;
  wide?: boolean;
  children?: React.ReactNode; // p. ej. una regla con el rango normal
  tourId?: string; // si el tutorial la señala
  tourScroll?: TourScroll;
  above?: React.ReactNode; // primera capa, encima del valor (p. ej. Digestión: cómo te sienta)
  onAdd?: () => void; // «+» junto al valor: una vez más hoy
  addLabel?: string;
}) => {
  const card = (
  <TouchableOpacity style={[styles.biomarkerCard, wide && styles.biomarkerCardWide, tourId ? styles.biomarkerCardInSlot : null]} onPress={onPress} activeOpacity={0.85}>
    <View style={styles.biomarkerHead}>
      <Text style={styles.biomarkerName}>{name}</Text>
      <IconBadge name={icon} color={iconColor} size={28} />
    </View>
    {above ? <View style={styles.biomarkerAbove}>{above}</View> : null}
    <View style={styles.biomarkerValueLine}>
      <View style={[styles.biomarkerValueRow, { flex: 1 }]}>
        <Text style={[styles.biomarkerValue, value.length > 5 && !wide && styles.biomarkerValueLong]}>{value}</Text>
        <Text style={styles.biomarkerUnit}> {unit.split(' ')[0]}</Text>
      </View>
      {onAdd ? (
        <TouchableOpacity style={[styles.biomarkerAdd, { backgroundColor: iconColor }]} onPress={onAdd} hitSlop={8} accessibilityLabel={addLabel}>
          <Ionicons name="add" size={16} color={Colors.background} />
        </TouchableOpacity>
      ) : null}
    </View>
    <Text style={[styles.biomarkerStatus, { color }]}>{status}</Text>
    {children ? <View style={{ marginTop: 10 }}>{children}</View> : null}
  </TouchableOpacity>
  );
  // En el tutorial, el sitio en la cuadrícula lo ocupa el marco (con el ancho de la tarjeta) y la
  // tarjeta lo llena; flexGrow y no flex: 1, que dentro de una columna la dejaría sin altura en Android
  return tourId ? (
    <TourTarget id={tourId} scroll={tourScroll} style={[styles.biomarkerSlot, wide && styles.biomarkerCardWide]}>
      {card}
    </TourTarget>
  ) : (
    card
  );
};

const styles = StyleSheet.create({
  goalsLink: { color: Colors.accent, fontSize: 12, fontWeight: '700', marginTop: 12 },
  // A todo lo ancho de la tarjeta (centrada): si no, los cuatro círculos se juntan en medio
  ringsTap: { alignSelf: 'stretch' },
  summaryCard: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    paddingHorizontal: 14,
    marginHorizontal: 20,
    marginBottom: 16,
  },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  summaryDivider: { borderTopWidth: 1, borderTopColor: Colors.divider },
  summaryText: { flex: 1, color: Colors.textPrimary, fontSize: 14, lineHeight: 19 },
  summaryHighlight: { fontWeight: '800', color: Colors.gold },
  // Sin tarjeta (rediseño «Emerald Luxury», 2026-11-15): la nebulosa flota sobre el fondo y los 7 días
  // quedan debajo de un separador fino
  checkInWrap: {
    paddingHorizontal: 4,
    paddingTop: 4,
    marginHorizontal: 20,
    marginBottom: 12,
  },
  weekToggle: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.divider },
  weekToggleText: { flex: 1, color: Colors.textSecondary, fontSize: 13, fontWeight: '700' },
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent', // deja ver el fondo ambiental de las pestañas
  },
  content: {
    paddingBottom: 32,
  },
  fullPlan: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    padding: 14,
    marginHorizontal: 20,
    marginBottom: 16,
  },
  fullPlanIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullPlanTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700' },
  inboxCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.gold,
    borderRadius: 16,
    padding: 14,
    marginHorizontal: 20,
    marginBottom: 16,
  },
  inboxIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planHero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 20,
    marginTop: 12,
  },
  planHeroNew: { borderColor: Colors.gold },
  keptBox: { marginHorizontal: 20, marginTop: 12, gap: 6 },
  keptTitle: { color: Colors.textMuted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  keptRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  keptText: { color: Colors.textSecondary, fontSize: 13, lineHeight: 18, flex: 1 },
  planHeroIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: withAlpha(Colors.gold, 0.14),
    alignItems: 'center',
    justifyContent: 'center',
  },
  planHeroTitle: { color: Colors.textPrimary, fontSize: 16, fontWeight: '800' },
  fullPlanLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10 },
  fullPlanLinkText: { color: Colors.accent, fontSize: 14, fontWeight: '700' },
  // Sin tarjeta (2026-11-16): título y tomas sobre el fondo, con una raya fina encima de las tomas
  medBlock: {
    paddingVertical: 6,
    marginHorizontal: 20,
    marginBottom: 8,
  },
  medHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  medHeaderMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  medIcon: { width: 22, textAlign: 'center' },
  medTitle: { color: Colors.textPrimary, fontSize: 16, fontWeight: '700' },
  medToggle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  medDoses: { marginTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.divider },
  bathroomCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    padding: 14,
    marginHorizontal: 20,
    marginBottom: 12,
  },
  miniLog: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 14,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  miniLogDone: { borderColor: Colors.ok },
  miniLogText: { color: Colors.textPrimary, fontSize: 12, fontWeight: '700' },
  fullPlanSub: { color: Colors.textSecondary, fontSize: 12, marginTop: 2 },
  reportBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.accent,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 24,
  },
  reportBannerIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.accentSoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reportBannerText: {
    flex: 1,
  },
  reportBannerTitle: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  reportBannerSubtitle: {
    color: Colors.textSecondary,
    fontSize: 12,
  },
  greeting: {
    paddingHorizontal: 20,
    marginBottom: 22,
  },
  aliasLink: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  aliasLinkText: { color: Colors.accent, fontSize: 14, fontWeight: '700' },
  greetingTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 10,
  },
  bullet: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  bulletDot: {
    color: Colors.textSecondary,
    marginRight: 8,
  },
  bulletText: {
    flex: 1,
    color: Colors.textSecondary,
    fontSize: 15,
    lineHeight: 21,
  },
  link: {
    color: Colors.accent,
    textDecorationLine: 'underline',
  },
  checkInCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 18,
    padding: 14,
    marginHorizontal: 20,
    marginBottom: 12,
  },
  block: {
    marginHorizontal: 20,
    marginBottom: 12,
  },
  card: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 20,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardTitle: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  cardFootnote: {
    color: Colors.textMuted,
    fontSize: 12,
    marginTop: 8,
  },
  sampleTag: {
    color: Colors.textMuted,
    fontSize: 11,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.textPrimary,
    paddingHorizontal: 20,
    marginBottom: 14,
    marginTop: 16,
  },
  sectionTitleTight: { marginBottom: 2 },
  sectionHint: { color: Colors.textMuted, fontSize: 12, lineHeight: 17, paddingHorizontal: 20, marginBottom: 12 },
  // Disposición sin tarjeta: el número grande a la izquierda y lo que significa al lado
  readinessBlock: {
    marginHorizontal: 20,
    marginBottom: 12,
  },
  readinessTop: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 2 },
  readinessSide: { flex: 1 },
  readinessOf: { color: Colors.textMuted, fontSize: 12, marginTop: 2 },
  readinessLine: { marginHorizontal: -10 }, // el brillo de los extremos, fuera del margen
  daysLink: {
    color: Colors.accent,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 8,
  },
  readinessEmpty: {
    color: Colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
  },
  readinessScoreEmpty: { color: Colors.textMuted },
  readinessScore: {
    color: Colors.textPrimary,
    fontSize: 64,
    lineHeight: 72,
    fontWeight: '200',
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
  },
  readinessLabel: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  // Círculos de los objetivos del día: anillo cometa con el icono, la cifra y el nombre debajo
  goalRings: { flexDirection: 'row', justifyContent: 'space-around', alignSelf: 'stretch', marginTop: 22 },
  goalRing: { alignItems: 'center' },
  goalRingValue: { color: Colors.textPrimary, fontSize: 15, fontWeight: '700', marginTop: 8, fontVariant: ['tabular-nums'] },
  goalRingLabel: { color: Colors.textSecondary, fontSize: 11 },
  sourceText: {
    color: Colors.textMuted,
    fontSize: 11,
    marginTop: 14,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 8,
  },
  biomarkerCard: {
    width: '47%',
    flexGrow: 1,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    padding: 16,
  },
  biomarkerCardWide: {
    width: '100%',
  },
  biomarkerSlot: { width: '47%', flexGrow: 1 },
  // Las dos capas de Digestión e Hidratación: lo de arriba, una raya, y las veces con su «+»
  biomarkerAbove: { paddingBottom: 10, marginBottom: 10, borderBottomWidth: 1, borderBottomColor: Colors.divider },
  biomarkerValueLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  biomarkerAdd: { width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  biomarkerCardInSlot: { width: '100%', flexGrow: 1 },
  biomarkerHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 },
  biomarkerName: {
    flex: 1,
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  biomarkerValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 6,
  },
  biomarkerValue: {
    color: Colors.textPrimary,
    fontSize: 26,
    fontWeight: '700',
  },
  biomarkerValueLong: {
    fontSize: 21,
  },
  biomarkerUnit: {
    color: Colors.textSecondary,
    fontSize: 13,
  },
  biomarkerStatus: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'right',
  },
  planList: {
    paddingHorizontal: 20,
    gap: 10,
  },
  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    padding: 14,
  },
  // La (i) va justo detrás del título, como en «Cumple tus objetivos» (fundador, 2026-11-11)
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    paddingRight: 20,
    marginTop: 16,
    marginBottom: 14,
  },
  sectionTitleInline: {
    marginTop: 0,
    marginBottom: 0,
    paddingRight: 0,
  },
  planCategory: { color: Colors.textMuted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  planIcon: {
    width: 46,
    height: 46,
    borderRadius: 23,
    justifyContent: 'center',
    alignItems: 'center',
  },
  planTitle: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 8,
  },
  planBarTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.divider,
    overflow: 'hidden',
    marginBottom: 6,
  },
  planBarFill: {
    height: 6,
    borderRadius: 3,
  },
  planProgress: {
    color: Colors.textSecondary,
    fontSize: 12,
  },
  planNote: {
    color: Colors.textMuted,
    fontSize: 11,
    textAlign: 'center',
    marginTop: 12,
    paddingHorizontal: 20,
  },
});
