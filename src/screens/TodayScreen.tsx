import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { InfoButton } from '@/components/InfoButton';
import { GlowRing, mixHex, ringTones, type RingColors } from '@/components/GlowRing';
import { FirstAnalysisCard } from '@/components/FirstAnalysisCard';
import { SecHead } from '@/components/fine/Fine';
import { INTER, FINE, ff, fine } from '@/theme/fine';
import { currentReport } from '@/data/reportRepository';
import { MetasToday } from '@/components/metas/MetasToday';
import { reportSeenKey, userFlags } from '@/data/userFlags';
import { Colors, withAlpha } from '@/constants/colors';
import { useAuth } from '@/context/AuthContext';
import { useFirstName } from '@/components/UserAvatar';
import { buildSchedule } from '@/data/schedule';
import { labAppointmentEvents } from '@/data/labAppointments';
import { consult } from '@/data/consultations';
import { buildSummary, summaryAppointments, SummaryLine } from '@/logic/summary';
import { dateLocale, num, t } from '@/i18n';
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
import { thermometerRepository } from '@/data/temperatureRepository';
import { doseRepository, medicationRepository } from '@/data/medicationRepository';
import { dosesForDay, isActiveOn } from '@/logic/medication';
import { MedToday } from '@/components/MedToday';
import { ZoneChangeBanner } from '@/components/ZoneChangeBanner';
import { ScheduledDose } from '@/types/medication';
import { mockBiomarkers, Biomarker } from '@/data/mockData';
import { getLiveBiomarkers, initialBiomarkers } from '@/utils/liveBiomarkers';
import { showSamples } from '@/data/dataMode';
import { sourceLabel } from '@/wearables/sourceLabel';
import { profileRepository, UserProfile } from '@/data/profileRepository';
import { checkInRepository } from '@/data/checkInRepository';
import { CheckInButton } from '@/components/CheckInButton';
import { checkInDayKey } from '@/logic/checkInDay';
import { cycleRepository } from '@/data/cycleRepository';
import { currentCyclePhase, CyclePhaseInfo, PHASE_COLORS } from '@/utils/cyclePhase';
import { cycleGoalStore } from '@/data/cycleGoal';
import { buildPlan } from '@/data/planRepository';
import { labUploadRepository } from '@/data/labUploads';
import { labReports } from '@/utils/labReportView';
import { useMetas } from '@/hooks/useMetas';
import { AREAS, areaScore } from '@/logic/metas';
import { goToTab, TAB } from '@/constants/tabs';
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

// «Empieza por tu primer análisis» cerrada (en la cuenta)
const FIRST_CARD_FLAG = 'today_first_analysis_closed';

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
  const [cycle, setCycle] = useDeepState<CyclePhaseInfo | null>(null);
  // El aviso "Your report is here!" se enseña hasta que el usuario lo abre (user_flags).
  const [reportSeen, setReportSeen] = useState(true);
  // Check-ins del día (el día de la persona: de madrugada aún cuenta el anterior)
  const [checkInsToday, setCheckInsToday] = useState(0);
  // Sin confeti al completar los 3 check-ins (fundador, 2026-11-16): basta con el aro y la nebulosa
  const [bathroomToday, setBathroomToday] = useDeepState<{ bowel: BowelEntry | null; urine: UrineEntry | null }>({
    bowel: null,
    urine: null,
  });
  const [dosesToday, setDosesToday] = useDeepState<ScheduledDose[]>([]);
  // Última lectura con termómetro de las últimas 24 h (manda sobre la del wearable)
  const [thermo, setThermo] = useDeepState<number | null>(null);
  // «Lo siguiente» (antes «Your summary»): lo próximo del calendario (citas, logística, resultados)
  const [summary, setSummary] = useDeepState<SummaryLine[]>([]);
  // Sin ningún análisis todavía (ni informes, ni subidos, ni cita): «Empieza por tu primer análisis», que se
  // puede cerrar (se recuerda en la cuenta)
  const [firstCard, setFirstCard] = useState(false);

  // Peso: el último y cuándo toca pesarse (una vez por semana)
  const [weight, setWeight] = useState<WeighAdvice | null>(null);
  const [savedShown, setSavedShown] = useState<Partial<GoalsShown> | null>(null);
  const water = useWaterToday();
  // La semana de tus metas (el círculo «Semana»): la media de las tres áreas
  const metas = useMetas();
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
    Promise.all([
      userFlags.get(reportSeenKey(currentReport.report_id)),
      labAppointmentEvents().catch(() => []),
      consult.myAppointments().catch(() => []),
      labUploadRepository.getAll().catch(() => []),
      userFlags.get(FIRST_CARD_FLAG).catch(() => undefined),
    ]).then(([seen, labEvents, appts, uploads, firstClosed]) => {
      setReportSeen(!!seen);
      setSummary(
        buildSummary({
          events: [...buildSchedule(), ...labEvents],
          appointments: summaryAppointments(appts),
          newResults: showSamples() && demoMode === 'results' && !seen,
          now: new Date(),
        })
      );
      setFirstCard(!firstClosed && labReports().length === 0 && uploads.length === 0 && labEvents.length === 0);
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
    const [p, checkIns, cycleEntries] = await Promise.all([profileRepository.get(), checkInRepository.getAll(), cycleRepository.getAll()]);
    setProfile(p);
    const todayKey = checkInDayKey({ fecha: new Date().toISOString() });
    setCheckInsToday(checkIns.filter((c) => checkInDayKey(c) === todayKey).length);
    const cycleGoal = p.sex === 'female' ? await cycleGoalStore.get().catch(() => null) : null;
    setCycle(p.sex === 'female' ? currentCyclePhase(cycleEntries, new Date(), cycleGoal?.cycleLength, cycleGoal) : null);
  }, [setBiomarkers, setProfile, setCycle, reloadBathroom, setDosesToday, setThermo, setSummary, demoMode]);

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

  // Objetivos del día: los del plan de tus respuestas (los mismos aunque ya cumplas alguno) o los que haya
  // puesto el usuario
  const goals = effectiveGoals(suggestedGoals(buildPlan(profile), profile).goals, savedGoals);
  // Frente a su objetivo de sueño y, en la fase lútea (con reglas apuntadas), sin restar lo propio del ciclo
  const readiness = computeReadiness(series, new Date(), { sleepNeedMin: goals.sleepMin, luteal: !!cycle && !cycle.isSample && cycle.phase === 'luteal' });
  // Las metas del día que ha elegido. Si el reloj no da kcal y la distancia no está, la distancia ocupa el
  // sitio de las kcal, como antes
  const shownGoals = goalsShown(savedShown, show('bladder'));
  const distanceForKcal = shownGoals.activeKcal && calories == null && distanceKm != null && !shownGoals.distanceM;
  // Desde las 4 pestañas (2026-11-16) son números solos: lo de hoy y la meta («6.240 / 8.000»). Sin reloj,
  // solo el agua (lo demás llega del reloj)
  const km = (m: number) => `${(m / 1000).toLocaleString(dateLocale(), { maximumFractionDigits: 1 })} km`;
  const goalNums = [
    hasAny && shownGoals.steps && { key: 'steps', value: steps.toLocaleString(dateLocale()), goal: goals.steps.toLocaleString(dateLocale()), label: t('Steps') },
    hasAny && shownGoals.activeKcal && !distanceForKcal && {
      key: 'kcal',
      value: calories != null ? `${calories}` : '—',
      goal: `${goals.activeKcal.toLocaleString(dateLocale())} kcal`,
      label: t('Active kcal'),
    },
    hasAny && (shownGoals.distanceM || distanceForKcal) && { key: 'distance', value: distanceKm != null ? km(distanceKm) : '—', goal: km(goals.distanceM), label: t('Distance') },
    hasAny && shownGoals.sleepMin && { key: 'sleep', value: sleep ? formatSleep(sleep) : '—', goal: formatSleep(goals.sleepMin), label: t('Sleep') },
    shownGoals.waterMl && { key: 'water', value: litres(water.total), goal: litres(goals.waterMl), label: t('Water') },
  ].filter((r) => !!r) as GoalNumProps[];

  // Los tres círculos: Hoy (tu estado), Semana (tus metas) y Ciclo (mujeres, con reglas)
  const weekScore = (() => {
    if (!metas.data) return null;
    const scores = AREAS.map((a) => areaScore(metas.data!.state, a, metas.vals, metas.week ?? undefined, metas.known)).filter((x): x is number => x != null);
    return scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
  })();
  const circles = [
    show('readiness') && {
      key: 'today',
      label: t('Today'),
      progress: readiness ? readiness.score / 100 : 0,
      tones: ringTones(Colors.green),
      center: <Text style={styles.circleValue}>{readiness ? readiness.score : '—'}</Text>,
      onPress: () => router.push({ pathname: '/evidence', params: { topic: 'readiness' } }),
      a11y: readiness ? t('Your state today: {n} out of 100', { n: readiness.score }) : t('Your state today'),
    },
    show('plan') && {
      key: 'week',
      label: t('Week'),
      progress: weekScore ?? 0,
      tones: ringTones(Colors.gold),
      center: (
        <Text style={styles.circleValue}>
          {weekScore == null ? '—' : Math.round(weekScore * 100)}
          {weekScore != null && <Text style={styles.circleUnit}>%</Text>}
        </Text>
      ),
      onPress: () => goToTab(TAB.plan),
      a11y: t('Your week: {n} percent', { n: weekScore == null ? 0 : Math.round(weekScore * 100) }),
    },
    cycle && show('cycle') && {
      key: 'cycle',
      label: t('Cycle'),
      progress: cycle.day / cycle.length,
      tones: [PHASE_COLORS.menstrual, PHASE_COLORS[cycle.phase], mixHex(PHASE_COLORS[cycle.phase], '#FFFFFF', 0.4)] as const,
      center: (
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.circleKicker}>{t('Day')}</Text>
          <Text style={[styles.circleValue, { marginTop: -2 }]}>{cycle.day}</Text>
        </View>
      ),
      onPress: () => router.push('/cycle-detail'),
      a11y: t('Menstrual cycle: day {n}, {phase}', { n: cycle.day, phase: t(cycle.label).toLowerCase() }),
    },
  ].filter((c) => !!c) as CircleProps[];

  const dateText = new Date().toLocaleDateString(dateLocale(), { weekday: 'long', day: 'numeric', month: 'long' });

  // Mediciones, en cajas: primero la que toca hoy (pesarse, si toca)
  const weightCard = (
    <BiomarkerCard
      key="weight"
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
  );
  const weightFirst = !!weight?.due || !weight?.last;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView {...tourScroll.props} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* 1. Saludo y fecha (sin la foto de perfil arriba a la derecha, fundador 2026-11-05). La racha de
            check-ins llega en la fase 3 */}
        <View style={styles.greeting}>
          <Text style={styles.greetingTitle}>{t('Hi {name}!', { name: firstName })}</Text>
          <Text style={styles.greetingDate}>{dateText.charAt(0).toUpperCase() + dateText.slice(1)}</Text>
          {noAlias && (
            <TouchableOpacity onPress={() => router.push('/your-name')} hitSlop={8} style={styles.aliasLink}>
              <Text style={styles.aliasLinkText}>{t('How should we call you?')}</Text>
            </TouchableOpacity>
          )}
        </View>

        {!web && (
        <>
        {/* 3. Lo siguiente: citas, logística y resultados (sin nombrar categorías); «Ver» lleva a la cita o al
            análisis. Sin nada previsto y sin ningún análisis, «Empieza por tu primer análisis» */}
        {summary.length > 0 ? (
        <>
        <Text style={styles.sectionTitle}>{t('Up next')}</Text>
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
        ) : firstCard ? (
          <FirstAnalysisCard
            variant="today"
            onClose={() => {
              setFirstCard(false);
              userFlags.set(FIRST_CARD_FLAG, true).catch(() => undefined);
            }}
          />
        ) : null}
        {/* Los avisos ya no salen en Hoy (fundador, 2026-11-05): se ven y se ajustan en Tú → Notificaciones */}
        </>
        )}

        {/* 4. Check-in: la nebulosa viva con su aro de 3 tramos (rediseño 2026-11-15). «Tus últimos días» ya no
            cuelga de aquí: se abre con el enlace de debajo */}
        {show('checkin') && (
          <View style={styles.checkInWrap}>
            <TourTarget id="today.checkin" scroll={tourScroll}>
              <CheckInButton done={checkInsToday} onPress={() => router.push('/check-in')} />
            </TourTarget>
            {/* El «Check-in · N de 3 hoy» ya lo dice la propia nebulosa debajo de la K */}
            <TouchableOpacity onPress={() => router.push('/your-days' as any)} hitSlop={8}>
              <Text style={styles.daysLink}>
                {t('Your last days')} ›
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Medicación y suplementos, arriba (fundador, 2026-11-16: «debería ir arriba»), como en el prototipo: una
            fila por cada cosa que tomas hoy con su «Tomada» */}
        {show('medication') && (
          <TourTarget id="today.medication" scroll={tourScroll} inset={20}>
            <View style={styles.medBlock}>
              <ZoneChangeBanner onChanged={load} />
              <MedToday doses={dosesToday} onChange={load} />
            </View>
          </TourTarget>
        )}

        {/* 5. Tres círculos: Hoy, Semana y Ciclo */}
        {!web && circles.length > 0 && (
          <View style={styles.circles}>
            {circles.map(({ key, ...c }) => (
              <Circle key={key} {...c} />
            ))}
          </View>
        )}

        {/* 6. Esta semana: las 3 áreas en barra (cada una abre su área) */}
        {show('plan') && <MetasToday tourScroll={tourScroll} />}

        {!web && (
        <>
        {/* 7. Hoy: una frase de tu estado y las metas del día en número */}
        {show('readiness') && (
          <>
            <View style={[styles.sectionHeaderRow, { alignItems: 'center' }]}>
              <Text style={[styles.sectionTitle, styles.sectionTitleInline]}>{t('Today')}</Text>
              <InfoButton topic="readiness" />
            </View>
            <TourTarget id="today.readiness" scroll={tourScroll} inset={20}>
            <View style={styles.readinessBlock}>
              <Text style={readiness ? styles.stateLine : styles.readinessEmpty}>
                {readiness
                  ? t(readiness.label)
                  : !hasAny
                    ? t('Connect a wearable to see your readiness.')
                    : !hasHeartOrSleep
                      ? t('Your wearable is only sharing steps. To see how you are today we need your sleep or heart rate.')
                      : t('No sleep or heart rate from today yet. Open your watch app so it syncs.')}
              </Text>
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
              {goalNums.length > 0 && (
                <TourTarget id="today.goals" scroll={tourScroll} style={styles.ringsTap}>
                <TouchableOpacity style={styles.ringsTap} activeOpacity={0.8} onPress={() => router.push('/daily-goals')} accessibilityLabel={t('Your daily goals')}>
                  <View style={styles.goalNums}>
                    {goalNums.map(({ key, ...g }) => (
                      <GoalNum key={key} {...g} />
                    ))}
                  </View>
                  <Text style={styles.goalsLink}>
                    {t('Your daily goals')} ›
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

        {/* 8. Mediciones (antes «Biomarkers»: biomarcador es solo lo del laboratorio): lo que apuntas y lo del
            reloj, en cajas; primero la que toca hoy */}
        <SecHead title={t('Measurements')} more={t('See all')} onMore={() => router.push('/measurements' as any)} style={styles.measureHead} />
        <Text style={styles.sectionHint}>{t('What you log and what comes from your watch. Tap one to see its history.')}</Text>
        <View style={styles.grid}>
          {weightFirst && weightCard}
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
          {!weightFirst && weightCard}
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

        {/* 11. Cambiar lo que ves aquí */}
        <TouchableOpacity style={styles.changeLink} onPress={() => router.push('/app-sections')} hitSlop={8}>
          <Text style={styles.changeLinkText}>{t('Change what you see here')}</Text>
        </TouchableOpacity>
      </ScrollView>
      {/* Perfil genético y, a las mujeres, cuestionario de la regla: las primeras veces que entra */}
      <WelcomePrompts />
    </SafeAreaView>
  );
};

// Uno de los tres círculos de Hoy: un ciclo que se cierra (tu estado, tu semana, tu ciclo menstrual)
type CircleProps = { key: string; label: string; progress: number; tones: RingColors; center: React.ReactNode; onPress: () => void; a11y: string };
const Circle = ({ label, progress, tones, center, onPress, a11y }: Omit<CircleProps, 'key'>) => (
  <TouchableOpacity style={styles.circle} onPress={onPress} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={a11y}>
    <GlowRing progress={progress} colors={tones} size={84} stroke={5}>
      {center}
    </GlowRing>
    <Text style={styles.circleLabel}>{label}</Text>
  </TouchableOpacity>
);

// Una meta del día como número solo: lo de hoy y la meta («6.240 / 8.000»), con su nombre encima
type GoalNumProps = { key: string; value: string; goal: string; label: string };
const GoalNum = ({ value, goal, label }: Omit<GoalNumProps, 'key'>) => (
  <View style={styles.goalNum} accessible accessibilityLabel={`${label}: ${value} / ${goal}`}>
    <Text style={styles.goalNumLabel} numberOfLines={1}>
      {label}
    </Text>
    <Text style={styles.goalNumValue} numberOfLines={1} adjustsFontSizeToFit>
      {value}
      <Text style={styles.goalNumGoal}> / {goal}</Text>
    </Text>
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
    </View>
    {above ? <View style={styles.biomarkerAbove}>{above}</View> : null}
    <View style={styles.biomarkerValueLine}>
      <View style={[styles.biomarkerValueRow, { flex: 1 }]}>
        <Text style={[styles.biomarkerValue, value.length > 5 && !wide && styles.biomarkerValueLong]}>{value}</Text>
        <Text style={styles.biomarkerUnit}> {unit.split(' ')[0]}</Text>
      </View>
      {onAdd ? (
        <TouchableOpacity style={[styles.biomarkerAdd, { backgroundColor: FINE.emerald }]} onPress={onAdd} hitSlop={8} accessibilityLabel={addLabel}>
          <Ionicons name="add" size={16} color={FINE.ivory} />
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
  greetingDate: { ...ff('regular'), color: FINE.mute, fontSize: 13, marginTop: 2 },
  // Los tres círculos, en fila
  circles: { flexDirection: 'row', justifyContent: 'space-around', marginHorizontal: 20, marginTop: 18, marginBottom: 4 },
  circle: { alignItems: 'center', gap: 6, minWidth: 92 },
  circleValue: { ...ff('light'), color: FINE.ivory, fontSize: 24, fontVariant: ['tabular-nums'] },
  circleUnit: { ...ff('regular'), color: FINE.mute, fontSize: 12 },
  circleKicker: { ...ff('regular'), color: FINE.mute, fontSize: 10 },
  circleLabel: { ...fine.kicker },
  stateLine: { ...ff('regular'), color: FINE.ivory, fontSize: 15, lineHeight: 21 },
  // Las metas del día, números solos en rejilla de dos
  goalNums: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 4 },
  goalNum: { width: '47%', paddingVertical: 10, minHeight: 58, borderBottomWidth: 1, borderBottomColor: FINE.line },
  goalNumLabel: { ...ff('regular'), color: FINE.mute, fontSize: 12 },
  goalNumValue: { ...ff('regular'), color: FINE.ivory, fontSize: 20, marginTop: 2, fontVariant: ['tabular-nums'] },
  goalNumGoal: { ...ff('regular'), color: FINE.mute, fontSize: 12 },
  measureHead: { marginHorizontal: 20 },
  changeLink: { alignSelf: 'center', marginTop: 22, minHeight: 36, justifyContent: 'center' },
  changeLinkText: { ...fine.link },
  goalsLink: { ...fine.link, fontSize: 12.5, marginTop: 10 },
  // A todo lo ancho de la tarjeta (centrada): si no, los cuatro círculos se juntan en medio
  ringsTap: { alignSelf: 'stretch' },
  summaryCard: {
    backgroundColor: 'rgba(240,239,230,0.05)',
    borderWidth: 1,
    borderColor: FINE.line,
    borderRadius: 14,
    paddingHorizontal: 14,
    marginHorizontal: 20,
    marginBottom: 8,
  },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  summaryDivider: { borderTopWidth: 1, borderTopColor: FINE.line },
  summaryText: { ...ff('regular'), flex: 1, color: FINE.ivory, fontSize: 14, lineHeight: 19 },
  summaryHighlight: { ...ff('medium'), color: FINE.gold },
  // Sin tarjeta (rediseño «Emerald Luxury», 2026-11-15): la nebulosa flota sobre el fondo y los 7 días
  // quedan debajo de un separador fino
  checkInWrap: {
    paddingHorizontal: 4,
    paddingTop: 4,
    marginHorizontal: 20,
    marginBottom: 12,
  },
  weekToggle: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.divider },
  weekToggleText: { flex: 1, color: Colors.textSecondary, fontSize: 13, fontFamily: INTER.medium },
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
  fullPlanTitle: { color: Colors.textPrimary, fontSize: 15, fontFamily: INTER.medium },
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
  keptTitle: { color: Colors.textMuted, fontSize: 11, fontFamily: INTER.semibold, textTransform: 'uppercase', letterSpacing: 0.4 },
  keptRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  keptText: { color: Colors.textSecondary, fontFamily: INTER.regular, fontSize: 13, lineHeight: 18, flex: 1 },
  planHeroIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: withAlpha(Colors.gold, 0.14),
    alignItems: 'center',
    justifyContent: 'center',
  },
  planHeroTitle: { color: Colors.textPrimary, fontSize: 16, fontFamily: INTER.medium },
  fullPlanLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10 },
  fullPlanLinkText: { color: Colors.accent, fontSize: 14, fontFamily: INTER.medium },
  medBlock: { marginHorizontal: 20 },
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
  miniLogText: { color: Colors.textPrimary, fontSize: 12, fontFamily: INTER.medium },
  fullPlanSub: { ...ff('regular'), color: FINE.mute, fontSize: 12.5, marginTop: 2 },
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
    fontFamily: INTER.medium,
    marginBottom: 2,
  },
  reportBannerSubtitle: {
    color: Colors.textSecondary,
    fontFamily: INTER.regular, fontSize: 12,
  },
  greeting: {
    paddingHorizontal: 20,
    paddingTop: 8,
    marginBottom: 6,
  },
  aliasLink: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  aliasLinkText: { ...fine.link },
  greetingTitle: {
    ...ff('medium'),
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: -0.2,
    color: FINE.ivory,
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
    fontFamily: INTER.regular, fontSize: 15,
    lineHeight: 21,
  },
  link: {
    color: FINE.jade,
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
    fontFamily: INTER.medium,
  },
  cardFootnote: {
    ...ff('regular'),
    color: FINE.mute,
    fontSize: 12,
    marginTop: 8,
  },
  sampleTag: {
    color: Colors.textMuted,
    fontFamily: INTER.regular, fontSize: 11,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  sectionTitle: {
    ...fine.secTitle,
    paddingHorizontal: 20,
    marginTop: 28,
    marginBottom: 8,
  },
  sectionTitleTight: { marginBottom: 2 },
  sectionHint: { ...ff('regular'), color: FINE.mute, fontSize: 12.5, lineHeight: 17, paddingHorizontal: 20, marginBottom: 12 },
  // Disposición sin tarjeta: el número grande a la izquierda y lo que significa al lado
  readinessBlock: {
    marginHorizontal: 20,
    marginBottom: 12,
  },
  readinessTop: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 2 },
  readinessSide: { flex: 1 },
  readinessOf: { color: Colors.textMuted, fontFamily: INTER.regular, fontSize: 12, marginTop: 2 },
  readinessLine: { marginHorizontal: -10 }, // el brillo de los extremos, fuera del margen
  daysLink: {
    ...fine.link,
    marginTop: 8,
    textAlign: 'center',
  },
  readinessEmpty: {
    ...ff('regular'),
    color: FINE.mute,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },
  readinessScoreEmpty: { color: Colors.textMuted },
  readinessScore: {
    color: Colors.textPrimary,
    fontSize: 64,
    lineHeight: 72,
    fontFamily: INTER.light,
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
  },
  readinessLabel: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontFamily: INTER.medium,
  },
  // Círculos de los objetivos del día: anillo cometa con el icono, la cifra y el nombre debajo
  goalRings: { flexDirection: 'row', justifyContent: 'space-around', alignSelf: 'stretch', marginTop: 22 },
  goalRing: { alignItems: 'center' },
  goalRingValue: { color: Colors.textPrimary, fontSize: 15, fontFamily: INTER.medium, marginTop: 8, fontVariant: ['tabular-nums'] },
  goalRingLabel: { color: Colors.textSecondary, fontFamily: INTER.regular, fontSize: 11 },
  sourceText: {
    ...ff('regular'),
    color: FINE.mute,
    fontSize: 11.5,
    marginTop: 12,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 20,
    gap: 10,
    marginBottom: 8,
  },
  biomarkerCard: {
    width: '47%',
    flexGrow: 1,
    backgroundColor: FINE.tile,
    borderWidth: 1,
    borderColor: FINE.line,
    borderRadius: 14,
    padding: 12,
    minHeight: 86,
  },
  biomarkerCardWide: {
    width: '100%',
  },
  biomarkerSlot: { width: '47%', flexGrow: 1 },
  // Las dos capas de Digestión e Hidratación: lo de arriba, una raya, y las veces con su «+»
  biomarkerAbove: { paddingBottom: 10, marginBottom: 10, borderBottomWidth: 1, borderBottomColor: FINE.line },
  biomarkerValueLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  biomarkerAdd: { width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  biomarkerCardInSlot: { width: '100%', flexGrow: 1 },
  biomarkerHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 2 },
  biomarkerName: {
    ...ff('regular'),
    flex: 1,
    color: FINE.mute,
    fontSize: 12,
  },
  biomarkerValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 2,
  },
  biomarkerValue: {
    ...ff('regular'),
    color: FINE.ivory,
    fontSize: 22,
    fontVariant: ['tabular-nums'],
  },
  biomarkerValueLong: {
    fontFamily: INTER.regular, fontSize: 19,
  },
  biomarkerUnit: {
    ...ff('regular'),
    color: FINE.mute,
    fontSize: 12,
  },
  biomarkerStatus: {
    ...ff('regular'),
    fontSize: 12,
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
    alignItems: 'center',
    gap: 6,
    paddingRight: 20,
    marginTop: 28,
    marginBottom: 8,
  },
  sectionTitleInline: {
    marginTop: 0,
    marginBottom: 0,
    paddingRight: 0,
  },
  planCategory: { color: Colors.textMuted, fontSize: 11, fontFamily: INTER.semibold, textTransform: 'uppercase', letterSpacing: 0.4 },
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
    fontFamily: INTER.medium,
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
    fontFamily: INTER.regular, fontSize: 12,
  },
  planNote: {
    color: Colors.textMuted,
    fontFamily: INTER.regular, fontSize: 11,
    textAlign: 'center',
    marginTop: 12,
    paddingHorizontal: 20,
  },
});
