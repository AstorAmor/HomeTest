import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { ScreenHeader } from '@/components/ScreenHeader';
import { InfoButton } from '@/components/InfoButton';
import { ProgressRing } from '@/components/ProgressRing';
import { TrendChart } from '@/components/TrendChart';
import { CycleStrip } from '@/components/CycleStrip';
import { currentReport } from '@/data/reportRepository';
import { reportSeenKey, userFlags } from '@/data/userFlags';
import { Colors } from '@/constants/colors';
import { useAuth } from '@/context/AuthContext';
import { useFirstName } from '@/components/UserAvatar';
import { BadgesSection } from '@/components/BadgesSection';
import { SpecialistCarousel } from '@/components/SpecialistCarousel';
import { LEARNING_TOPICS } from '@/data/learning';
import { buildSchedule } from '@/data/schedule';
import { labAppointmentEvents } from '@/data/labAppointments';
import { consult } from '@/data/consultations';
import { KIND_LABEL } from '@/data/specialistTypes';
import { buildSummary, SummaryLine } from '@/logic/summary';
import { loadNutrientFocus, nutrientsDoneToday } from '@/screens/NutrientsScreen';
import { dateLocale, t } from '@/i18n';
import { computeAchievements } from '@/data/achievements';
import { planImage } from '@/data/planImages';
import { Image } from 'expo-image';
import { useDeepState, useReloadOnFocus } from '@/hooks/useReloadOnFocus';
import { useSections } from '@/data/appPrefs';
import { InboxItem, nudgeStore } from '@/data/nudgeStore';
import { bowelRepository, dayKey, entryForDay, urineRepository } from '@/data/bathroomRepository';
import { hydrationFromUrine, HYDRATION_SCALE } from '@/logic/bathroom';
import { BowelEntry, STOOL_COLORS, UrineEntry, URINE_COLORS } from '@/types/bathroom';
import { GaugeBar } from '@/components/GaugeBar';
import { thermometerRepository } from '@/data/temperatureRepository';
import { doseRepository, medicationRepository } from '@/data/medicationRepository';
import { dosesForDay, isActiveOn, isReminderMuted } from '@/logic/medication';
import { DoseRows } from '@/components/DoseRows';
import { ZoneChangeBanner } from '@/components/ZoneChangeBanner';
import { ScheduledDose } from '@/types/medication';
import { mockBiomarkers, Biomarker } from '@/data/mockData';
import { getLiveBiomarkers } from '@/utils/liveBiomarkers';
import { profileRepository, UserProfile } from '@/data/profileRepository';
import { checkInRepository, dailyCheckInSeries, sampleCheckInSeries, DailyCheckInPoint } from '@/data/checkInRepository';
import { CheckInEntry, MOOD_OPTIONS, MOMENT_OPTIONS } from '@/types/checkIn';
import { cycleRepository } from '@/data/cycleRepository';
import { currentCyclePhase, CyclePhaseInfo } from '@/utils/cyclePhase';
import {
  buildPlan,
  mealRepository,
  mindfulRepository,
  mindfulSessionsThisWeek,
  PlanItemKind,
  workoutRepository,
  mealsLoggedToday,
  strengthSessionsThisWeek,
} from '@/data/planRepository';
import { computeReadiness, formatSleep, latest, shortDate, useDailyWearables, DailyPoint } from '@/wearables/dailySeries';


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

const timeAgo = (iso: string) => {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 60) return t('{n} min ago', { n: Math.max(1, minutes) });
  const hours = Math.round(minutes / 60);
  if (hours < 24) return t('{n} h ago', { n: hours });
  return t('{n} d ago', { n: Math.round(hours / 24) });
};

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

// Icono del check-in: la carita de "Mood & check-ins" sobre un círculo dorado liso (sin degradado)
const CheckInOrb = () => (
  <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: Colors.gold, alignItems: 'center', justifyContent: 'center' }}>
    <Ionicons name="happy-outline" size={28} color={Colors.isLight ? '#FFFFFF' : '#0E2A24'} />
  </View>
);

const PLAN_COLOR: Record<PlanItemKind, string> = {
  strength: Colors.coral,
  steps: Colors.sky,
  nutrition: Colors.amber,
  sleep: Colors.violet,
  mindfulness: Colors.accent,
};

export const TodayScreen = () => {
  const router = useRouter();
  const { demoMode } = useAuth();
  const firstName = useFirstName();
  const show = useSections();
  const { series, isSample } = useDailyWearables();
  const [biomarkers, setBiomarkers] = useDeepState<Biomarker[]>(mockBiomarkers);
  const [profile, setProfile] = useDeepState<UserProfile | null>(null);
  const [achievementData, setAchievementData] = useDeepState<{
    workouts: { fecha: string; type: string }[];
    meals: { fecha: string }[];
    checkIns: { fecha: string }[];
    mindful: { fecha: string }[];
  }>({ workouts: [], meals: [], checkIns: [], mindful: [] });
  const [mindfulWeek, setMindfulWeek] = useState(0);
  const [lastCheckIn, setLastCheckIn] = useDeepState<CheckInEntry | null>(null);
  const [checkInSeries, setCheckInSeries] = useDeepState<{ points: DailyCheckInPoint[]; sample: boolean }>({
    points: [],
    sample: true,
  });
  const [cycle, setCycle] = useDeepState<CyclePhaseInfo | null>(null);
  const [strengthDone, setStrengthDone] = useState(0);
  const [mealsToday, setMealsToday] = useState(0);
  // El aviso "Your report is here!" se enseña hasta que el usuario lo abre (user_flags).
  const [reportSeen, setReportSeen] = useState(true);
  // Avisos sin leer (src/logic/nudges: se evalúan al abrir Today) y registro de baño de hoy
  const [unread, setUnread] = useDeepState<InboxItem[]>([]);
  const [bathroomToday, setBathroomToday] = useDeepState<{ bowel: BowelEntry | null; urine: UrineEntry | null }>({
    bowel: null,
    urine: null,
  });
  const [dosesToday, setDosesToday] = useDeepState<ScheduledDose[]>([]);
  // Lo que tiene recordatorio: sus tomas de hoy se marcan desde aquí (Taken / Skip)
  const [reminderIds, setReminderIds] = useDeepState<string[]>([]);
  // Última lectura con termómetro de las últimas 24 h (manda sobre la del wearable)
  const [thermo, setThermo] = useDeepState<number | null>(null);
  // "Your summary": lo próximo del calendario (citas, logística, resultados)
  const [summary, setSummary] = useDeepState<SummaryLine[]>([]);
  // Los últimos 7 días cuelgan del check-in y se despliegan con la flecha
  const [weekOpen, setWeekOpen] = useState(false);
  const [nutrients, setNutrients] = useDeepState<{ done: number; total: number }>({ done: 0, total: 0 });

  const load = useCallback(async () => {
    getLiveBiomarkers().then(setBiomarkers);
    userFlags.get('today_week_open').then((v) => setWeekOpen(v === true));
    Promise.all([loadNutrientFocus(), nutrientsDoneToday()])
      .then(([items, done]) => setNutrients({ done: done.filter((d) => items.some((i) => i.id === d)).length, total: items.length }))
      .catch(() => undefined);
    Promise.all([
      userFlags.get(reportSeenKey(currentReport.report_id)),
      labAppointmentEvents().catch(() => []),
      consult.myAppointments().catch(() => []),
    ]).then(([seen, labEvents, appts]) => {
      setReportSeen(!!seen);
      setSummary(
        buildSummary({
          events: [...buildSchedule(), ...labEvents],
          appointments: appts
            .filter((a) => a.status === 'pending' || a.status === 'confirmed')
            .map((a) => ({
              id: a.id,
              startsAt: a.startsAt,
              label: `${t(KIND_LABEL[a.kind])}${a.professionalName ? ` ${t('with')} ${a.professionalName}` : ''}`,
              canJoin: /^[0-9a-f-]{36}$/i.test(a.id) && a.status === 'confirmed',
            })),
          newResults: demoMode === 'results' && !seen,
          now: new Date(),
        })
      );
    });
    nudgeStore
      .refresh()
      .then(({ inbox }) => setUnread(inbox.filter((i) => !i.read)))
      .catch((e) => console.warn('Notifications not refreshed', e));
    // Sin la tabla de medicación (migración pendiente) simplemente no hay tomas que enseñar
    Promise.all([medicationRepository.getAll(), doseRepository.getAll()])
      .then(([m, l]) => {
        const active = m.filter((i) => isActiveOn(i, new Date()));
        setDosesToday(dosesForDay(active, new Date(), l));
        setReminderIds(active.filter((i) => i.reminders && !isReminderMuted(i)).map((i) => i.id));
      })
      .catch(() => setDosesToday([]));
    thermometerRepository
      .getAll()
      .then((all) => {
        const last = all.reduce<(typeof all)[number] | null>((a, t) => (!a || t.fecha > a.fecha ? t : a), null);
        setThermo(last && Date.now() - new Date(last.fecha).getTime() < 24 * 3600 * 1000 ? last.valor : null);
      })
      .catch(() => setThermo(null));
    Promise.all([bowelRepository.getAll(), urineRepository.getAll()])
      .then(([b, u]) => setBathroomToday({ bowel: entryForDay(b, dayKey(new Date())) ?? null, urine: entryForDay(u, dayKey(new Date())) ?? null }))
      .catch(() => undefined);
    const [p, checkIns, cycleEntries, strength, meals, workoutList, mealList, mindfulList, mindfulThisWeek] =
      await Promise.all([
        profileRepository.get(),
        checkInRepository.getAll(),
        cycleRepository.getAll(),
        strengthSessionsThisWeek(),
        mealsLoggedToday(),
        workoutRepository.getAll(),
        mealRepository.getAll(),
        mindfulRepository.getAll(),
        mindfulSessionsThisWeek(),
      ]);
    setAchievementData({
      workouts: workoutList.map((w) => ({ fecha: w.fecha, type: w.type })),
      meals: mealList.map((m) => ({ fecha: m.fecha })),
      checkIns: checkIns.map((c) => ({ fecha: c.fecha })),
      mindful: mindfulList.map((m) => ({ fecha: m.fecha })),
    });
    setMindfulWeek(mindfulThisWeek);
    setProfile(p);
    setLastCheckIn(checkIns.length ? checkIns[0] : null);
    const real = dailyCheckInSeries(checkIns);
    setCheckInSeries(real.length >= 2 ? { points: real, sample: false } : { points: sampleCheckInSeries(), sample: true });
    setCycle(p.sex === 'female' ? currentCyclePhase(cycleEntries) : null);
    setStrengthDone(strength);
    setMealsToday(meals);
  }, [setBiomarkers, setProfile, setLastCheckIn, setCheckInSeries, setCycle, setAchievementData, setUnread, setBathroomToday, setDosesToday, setReminderIds, setThermo, setSummary, setNutrients, demoMode]);

  useReloadOnFocus(load);

  const readiness = computeReadiness(series);
  const steps = latest(series.steps) ?? 0;
  const calories = latest(series.active_energy) ?? 0;
  const sleep = latest(series.sleep_duration) ?? 0;

  const sugar = biomarkers.find((b) => b.id === 'sugar');
  const bp = biomarkers.find((b) => b.id === 'blood_pressure');
  const rhr = latest(series.resting_heart_rate);
  const hrv = latest(series.hrv);
  const temp = thermo ?? latest(series.body_temperature);

  const lastMood = lastCheckIn?.mood ? MOOD_OPTIONS.find((m) => m.id === lastCheckIn.mood) : null;
  const lastMoment = lastCheckIn ? MOMENT_OPTIONS.find((m) => m.id === lastCheckIn.moment) : null;

  const plan = buildPlan(profile);
  const achievements = computeAchievements({
    dailySteps: series.steps ?? [],
    ...achievementData,
    badges: profile?.badges ?? [],
  });

  const planProgress = (kind: PlanItemKind, target: number) => {
    if (kind === 'strength') return { value: strengthDone / target, text: t('{done}/{target} this week', { done: strengthDone, target }) };
    if (kind === 'steps') return { value: steps / target, text: t('{n} today', { n: steps.toLocaleString(dateLocale()) }) };
    if (kind === 'sleep') return { value: sleep / 60 / target, text: t('{v} last night', { v: formatSleep(sleep) }) };
    if (kind === 'mindfulness') return { value: mindfulWeek / target, text: t('{done}/{target} this week', { done: mindfulWeek, target }) };
    return { value: nutrients.total ? nutrients.done / nutrients.total : 0, text: t('{done}/{total} done today', { done: nutrients.done, total: nutrients.total }) };
  };

  const onPlanPress = (kind: PlanItemKind) => {
    if (kind === 'strength') router.push('/log-workout');
    else if (kind === 'steps') router.push({ pathname: '/metric', params: { kind: 'steps' } });
    else if (kind === 'sleep') router.push({ pathname: '/metric', params: { kind: 'sleep_duration' } });
    else if (kind === 'mindfulness') router.push({ pathname: '/exercise', params: { id: 'box_breathing' } });
    else router.push('/nutrients');
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title={t('Today')} showAvatar />

        <View style={styles.greeting}>
          <Text style={styles.greetingTitle}>{t('Hi {name}!', { name: firstName })}</Text>
        </View>

        {/* Lo próximo del calendario: citas, logística y resultados (sin nombrar categorías) */}
        <Text style={styles.sectionTitle}>{t('Your summary')}</Text>
        <View style={styles.summaryCard}>
          {summary.length === 0 ? (
            <TouchableOpacity style={styles.summaryRow} onPress={() => router.push({ pathname: '/(tabs)', params: { tab: '2' } })}>
              <Ionicons name="calendar-clear-outline" size={18} color={Colors.textMuted} />
              <Text style={styles.summaryText}>{t('Nothing planned for the next few weeks. Your schedule is clear.')}</Text>
            </TouchableOpacity>
          ) : (
            summary.map((l, i) => (
              <TouchableOpacity
                key={l.id}
                style={[styles.summaryRow, i > 0 && styles.summaryDivider]}
                onPress={() => {
                  if (l.id === 'results-new') {
                    setReportSeen(true);
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
            ))
          )}
        </View>

        {unread.length > 0 && (
          <TouchableOpacity style={styles.inboxCard} onPress={() => router.push('/notifications')} activeOpacity={0.85}>
            <View style={styles.inboxIcon}>
              <Ionicons name="notifications-outline" size={20} color={Colors.gold} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.fullPlanTitle}>{unread[0].title}</Text>
              <Text style={styles.fullPlanSub} numberOfLines={2}>
                {unread.length > 1 ? t('And {n} more', { n: unread.length - 1 }) : unread[0].body}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
          </TouchableOpacity>
        )}


        {/* Check-in */}
        {show('checkin') && (
          <>
            <View style={styles.checkInWrap}>
              <TouchableOpacity style={styles.checkInRow} onPress={() => router.push('/check-in')} activeOpacity={0.85}>
                <CheckInOrb />
                <View style={{ flex: 1 }}>
                  <Text style={styles.checkInTitle}>{t('How are you feeling?')}</Text>
                  <Text style={styles.checkInSubtitle}>
                    {lastCheckIn
                      ? `${t('Last check-in {ago}', { ago: timeAgo(lastCheckIn.fecha) })}${lastMood ? ` · ${lastMood.emoji} ${t(lastMood.label)}` : ''}`
                      : t('Sleep, energy and mood in 30 seconds')}
                  </Text>
                </View>
                <View style={styles.checkInButton}>
                  <Text style={styles.checkInButtonText}>{t('Check in')}</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.weekToggle}
                onPress={() => {
                  setWeekOpen(!weekOpen);
                  userFlags.set('today_week_open', !weekOpen);
                }}
                accessibilityRole="button"
                accessibilityState={{ expanded: weekOpen }}
              >
                <Text style={styles.weekToggleText}>{t('Your last 7 days')}</Text>
                {checkInSeries.sample && <Text style={styles.sampleTag}>{t('sample')}</Text>}
                <Ionicons name={weekOpen ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.textMuted} />
              </TouchableOpacity>
              {weekOpen && (
                <View style={{ marginTop: 6 }}>
                  <TrendChart
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
                </View>
              )}
            </View>
          </>
        )}

        {show('medication') && (
          <View style={styles.medCard}>
          <ZoneChangeBanner onChanged={load} />
          <TouchableOpacity style={styles.medHeader} onPress={() => router.push('/medications')} activeOpacity={0.85}>
            <View style={styles.inboxIcon}>
              <Ionicons name="medical-outline" size={20} color={Colors.gold} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.fullPlanTitle}>{t('Medication & supplements')}</Text>
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
            <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
          </TouchableOpacity>
          {dosesToday.some((d) => reminderIds.includes(d.medId)) && (
            <View style={styles.medDoses}>
              <DoseRows doses={dosesToday.filter((d) => reminderIds.includes(d.medId))} onChange={load} />
            </View>
          )}
          </View>
        )}

        {cycle && show('cycle') && (
          <View style={styles.block}>
            <CycleStrip info={cycle} onPress={() => router.push('/cycle-detail')} />
          </View>
        )}

        {/* Daily readiness */}
        {show('readiness') && (
          <>
            <View style={[styles.sectionHeaderRow, { alignItems: 'center' }]}>
              <Text style={[styles.sectionTitle, styles.sectionTitleInline]}>{t('Daily readiness')}</Text>
              <InfoButton topic="readiness" />
            </View>
            <View style={[styles.card, styles.readinessCard]}>
              {readiness ? (
                <>
                  <ProgressRing
                    size={156}
                    strokeWidth={14}
                    progress={readiness.score / 100}
                    color={Colors.green}
                    gradient={[Colors.coral, Colors.gold, Colors.green]}
                  >
                    <Text style={styles.readinessScore}>{readiness.score}</Text>
                    <Text style={styles.readinessLabel}>{t(readiness.label)}</Text>
                  </ProgressRing>
                  <View style={styles.smallRings}>
                    <SmallRing
                      icon={<Ionicons name="footsteps" size={16} color={Colors.sky} />}
                      color={Colors.sky}
                      progress={steps / 8000}
                      value={steps.toLocaleString(dateLocale())}
                      label={t('Steps')}
                    />
                    <SmallRing
                      icon={<Ionicons name="flame" size={16} color={Colors.coral} />}
                      color={Colors.coral}
                      progress={calories / 500}
                      value={`${calories}`}
                      label={t('Active kcal')}
                    />
                    <SmallRing
                      icon={<Ionicons name="moon" size={15} color={Colors.violet} />}
                      color={Colors.violet}
                      progress={sleep / 480}
                      value={formatSleep(sleep)}
                      label={t('Sleep')}
                    />
                  </View>
                  <Text style={styles.sourceText}>
                    {t('From Huawei Health')}{isSample ? ` (${t('sample data')})` : ''} · <Text style={styles.link} onPress={() => router.push('/wearables')}>{t('manage')}</Text>
                  </Text>
                </>
              ) : (
                <Text style={styles.cardFootnote}>{t('Connect a wearable to see your readiness.')}</Text>
              )}
            </View>
          </>
        )}

        {/* Biomarkers */}
        <Text style={styles.sectionTitle}>{t('Biomarkers')}</Text>
        <View style={styles.grid}>
          {sugar && (
            <BiomarkerCard
              name={t('Sugar')}
              value={sugar.valor}
              unit={sugar.unidad}
              status={t(sugar.statusLabel)}
              color={statusColor(sugar.status)}
              onPress={() => router.push('/glucose-detail')}
            />
          )}
          {bp && (
            <BiomarkerCard
              name={t('Blood pressure')}
              value={bp.valor}
              unit={bp.unidad}
              status={t(bp.statusLabel)}
              color={statusColor(bp.status)}
              onPress={() => router.push('/blood-pressure-detail')}
            />
          )}
          {show('wearables') && (
            <>
              <BiomarkerCard
                name={t('Resting HR')}
                value={rhr != null ? String(rhr) : '—'}
                unit="bpm"
                status={t(vsUsual(series.resting_heart_rate, false).label)}
                color={vsUsual(series.resting_heart_rate, false).color}
                onPress={() => router.push({ pathname: '/metric', params: { kind: 'resting_heart_rate' } })}
              />
              <BiomarkerCard
                name={t('HRV')}
                value={hrv != null ? String(hrv) : '—'}
                unit="ms"
                status={t(vsUsual(series.hrv, true).label)}
                color={vsUsual(series.hrv, true).color}
                onPress={() => router.push({ pathname: '/metric', params: { kind: 'hrv' } })}
              />
              <BiomarkerCard
                name={t('Temperature')}
                value={temp != null ? temp.toFixed(1) : '—'}
                unit="°C"
                status={temp != null && temp >= 36.1 && temp <= 37.2 ? t('Normal') : t('Check')}
                color={temp != null && temp >= 36.1 && temp <= 37.2 ? Colors.accent : Colors.warning}
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
                name={t('Gut')}
                value={b ? String(b.count) : '—'}
                unit={b?.count === 1 ? t('time') : t('times')}
                status={t(status)}
                color={tone}
                onPress={() => router.push({ pathname: '/digestive', params: { part: 'gut' } })}
              />
            );
          })()}
          {show('bladder') && (() => {
            const u = bathroomToday.urine;
            const h = hydrationFromUrine(u);
            const tone = { good: Colors.ok, tip: Colors.warning, low: Colors.attention, check: Colors.attention, unknown: Colors.textMuted }[h.level];
            return (
              <BiomarkerCard
                name={t('Bladder')}
                value={u?.count != null ? String(u.count) : '—'}
                unit={t('times')}
                status={t(h.label)}
                color={tone}
                onPress={() => router.push({ pathname: '/digestive', params: { part: 'bladder' } })}
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

        {/* Your plan */}
        {show('plan') && (
          <>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionTitle, styles.sectionTitleInline]}>{t('Your plan')}</Text>
              <TouchableOpacity onPress={() => router.push('/action-plan')} hitSlop={8}>
                <Text style={styles.link}>{t('Full view')}</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.planList}>
              {plan.map((item) => {
                const color = PLAN_COLOR[item.kind];
                const progress = planProgress(item.kind, item.target);
                return (
                  <TouchableOpacity
                    key={item.kind}
                    style={styles.planRow}
                    onPress={() => onPlanPress(item.kind)}
                    activeOpacity={0.85}
                  >
                    <View style={styles.planThumb}>
                      <Image source={planImage(item.kind, profile?.sex)} style={StyleSheet.absoluteFill} contentFit="cover" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.planTitle}>{item.kind === 'nutrition' ? t('Your nutrients') : t(item.title)}</Text>
                      <View style={styles.planBarTrack}>
                        <View
                          style={[
                            styles.planBarFill,
                            { width: `${Math.min(1, progress.value) * 100}%`, backgroundColor: color },
                          ]}
                        />
                      </View>
                      <Text style={styles.planProgress}>{progress.text}</Text>
                    </View>
                    <Ionicons
                      name={
                        item.kind === 'steps' || item.kind === 'sleep'
                          ? 'chevron-forward'
                          : item.kind === 'mindfulness'
                            ? 'play-circle'
                            : 'add-circle'
                      }
                      size={item.kind === 'steps' || item.kind === 'sleep' ? 18 : 26}
                      color={item.kind === 'steps' || item.kind === 'sleep' ? Colors.textMuted : color}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>
            <Text style={styles.planNote}>{t('Built from your answers. Your results will add to it when they arrive.')}</Text>
            <TouchableOpacity style={styles.fullPlanLink} onPress={() => router.push('/plans')} activeOpacity={0.8}>
              <Ionicons name="document-text-outline" size={16} color={Colors.accent} />
              <Text style={styles.fullPlanLinkText}>{t('See your full plan and earlier ones')}</Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.accent} />
            </TouchableOpacity>
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
            <SpecialistCarousel onSelect={(s) => router.push({ pathname: '/professionals', params: { role: s.id } })} />
          </>
        )}

        {/* Keep learning */}
        {show('learning') && (
          <>
            <Text style={styles.sectionTitle}>{t('Keep learning')}</Text>
            <SpecialistCarousel
              items={LEARNING_TOPICS.filter((x) => x.featured)}
              onSelect={(x) => router.push({ pathname: '/learn', params: { topic: x.id } })}
              more={{ label: t('More'), subtitle: t('All topics'), onPress: () => router.push('/learn-all') }}
            />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const SmallRing = ({
  icon,
  color,
  progress,
  value,
  label,
}: {
  icon: React.ReactNode;
  color: string;
  progress: number;
  value: string;
  label: string;
}) => (
  <View style={styles.smallRing}>
    <ProgressRing size={64} strokeWidth={7} progress={progress} color={color}>
      {icon}
    </ProgressRing>
    <Text style={styles.smallRingValue}>{value}</Text>
    <Text style={styles.smallRingLabel}>{label}</Text>
  </View>
);

const BiomarkerCard = ({
  name,
  value,
  unit,
  status,
  color,
  onPress,
  wide,
  children,
}: {
  name: string;
  value: string;
  unit: string;
  status: string;
  color: string;
  onPress: () => void;
  wide?: boolean;
  children?: React.ReactNode; // p. ej. una regla con el rango normal
}) => (
  <TouchableOpacity style={[styles.biomarkerCard, wide && styles.biomarkerCardWide]} onPress={onPress} activeOpacity={0.85}>
    <Text style={styles.biomarkerName}>{name}</Text>
    <View style={styles.biomarkerValueRow}>
      <Text style={[styles.biomarkerValue, value.length > 5 && !wide && styles.biomarkerValueLong]}>{value}</Text>
      <Text style={styles.biomarkerUnit}> {unit.split(' ')[0]}</Text>
    </View>
    <Text style={[styles.biomarkerStatus, { color }]}>{status}</Text>
    {children ? <View style={{ marginTop: 10 }}>{children}</View> : null}
  </TouchableOpacity>
);

const styles = StyleSheet.create({
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
  checkInWrap: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    padding: 14,
    marginHorizontal: 20,
    marginBottom: 16,
  },
  checkInRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  weekToggle: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.divider },
  weekToggleText: { flex: 1, color: Colors.textSecondary, fontSize: 13, fontWeight: '700' },
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
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
  fullPlanLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10 },
  fullPlanLinkText: { color: Colors.accent, fontSize: 14, fontWeight: '700' },
  medCard: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    padding: 14,
    marginHorizontal: 20,
    marginBottom: 12,
  },
  medHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  medDoses: { marginTop: 8, borderTopWidth: 1, borderTopColor: Colors.divider },
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
  checkInTitle: {
    color: Colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 2,
  },
  checkInSubtitle: {
    color: Colors.textSecondary,
    fontSize: 12,
  },
  checkInButton: {
    backgroundColor: Colors.accent,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  checkInButtonText: {
    color: Colors.background,
    fontSize: 13,
    fontWeight: '800',
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
  readinessCard: {
    alignItems: 'center',
    paddingVertical: 22,
  },
  readinessScore: {
    color: Colors.textPrimary,
    fontSize: 44,
    fontWeight: '800',
  },
  readinessLabel: {
    color: Colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    maxWidth: 110,
  },
  smallRings: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignSelf: 'stretch',
    marginTop: 22,
  },
  smallRing: {
    alignItems: 'center',
  },
  smallRingValue: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    marginTop: 8,
  },
  smallRingLabel: {
    color: Colors.textSecondary,
    fontSize: 11,
  },
  sourceText: {
    color: Colors.textMuted,
    fontSize: 11,
    marginTop: 16,
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
  biomarkerName: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 10,
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
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingRight: 20,
    marginTop: 16,
    marginBottom: 14,
  },
  sectionTitleInline: {
    marginTop: 0,
    marginBottom: 0,
  },
  planThumb: {
    width: 50,
    height: 50,
    borderRadius: 14,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
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
