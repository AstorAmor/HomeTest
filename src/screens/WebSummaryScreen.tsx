import React, { useCallback, useId, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, LayoutChangeEvent } from 'react-native';
import { useRouter } from 'expo-router';
import Svg, { Circle as SvgCircle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { Colors } from '@/constants/colors';
import { useFirstName } from '@/components/UserAvatar';
import { TrendChart, smoothPath } from '@/components/TrendChart';
import { CheckInButton } from '@/components/CheckInButton';
import { GlowRing, mixHex, ringTones, type RingColors } from '@/components/GlowRing';
import { Chev, FRow, Pill, SecHead } from '@/components/fine/Fine';
import { DonutLegend, FineDonut, LabGauge } from '@/components/fine/FineLab';
import { MetasToday } from '@/components/metas/MetasToday';
import { useSections } from '@/data/appPrefs';
import { useDeepState, useReloadOnFocus } from '@/hooks/useReloadOnFocus';
import { useMetas } from '@/hooks/useMetas';
import { setVisibleTab } from '@/hooks/useLiveMotion';
import { weekScore as weekScoreOf } from '@/logic/metas';
import { dateLocale, t, tn } from '@/i18n';
import { labReports, formatReportDate, flaggedMarkers, markerNameEn, reportCounts } from '@/utils/labReportView';
import { markerHref } from '@/utils/markerLinks';
import { getMarkerValueTextEn } from '@/data/reportContentEn';
import { checkInRepository } from '@/data/checkInRepository';
import { checkInDayKey } from '@/logic/checkInDay';
import { profileRepository, UserProfile } from '@/data/profileRepository';
import { cycleRepository } from '@/data/cycleRepository';
import { currentCyclePhase, CyclePhaseInfo, PHASE_COLORS } from '@/utils/cyclePhase';
import { cycleGoalStore } from '@/data/cycleGoal';
import { bowelRepository, dayKey, entryForDay, urineRepository } from '@/data/bathroomRepository';
import { hydrationFromUrine } from '@/logic/bathroom';
import { BowelEntry, UrineEntry } from '@/types/bathroom';
import { doseRepository, medicationRepository } from '@/data/medicationRepository';
import { dosesForDay, isActiveOn } from '@/logic/medication';
import { ScheduledDose } from '@/types/medication';
import { buildSchedule } from '@/data/schedule';
import { labAppointmentEvents } from '@/data/labAppointments';
import { consult } from '@/data/consultations';
import { buildSummary, summaryAppointments, SummaryLine } from '@/logic/summary';
import { DailyGoals, effectiveGoals, suggestedGoals } from '@/logic/dailyGoals';
import { dailyGoalsStore } from '@/data/dailyGoals';
import { buildPlan } from '@/data/planRepository';
import { computeReadiness, formatSleep, latest, useDailyWearables, DailyPoint } from '@/wearables/dailySeries';
import { goToTabSection, TAB } from '@/constants/tabs';
import { WelcomePrompts } from '@/components/WelcomePrompts';
import { FINE, ff, fine } from '@/theme/fine';

// "Hoy" de la web del paciente en escritorio. No es la misma pantalla que la del móvil (aprovecha el ancho: dos
// columnas arriba y una rejilla de bloques), pero desde el 2026-11-19 va con su mismo lenguaje fino (fundador: «me
// encaja que no sea igual que la del móvil, cuando está expandido, pero la estética tiene que ir en la misma línea»;
// antes eran tarjetas de colores al estilo de Salud de Apple). Arriba, la nebulosa del check-in y los tres círculos
// de Hoy (Preparación, Semana, Ciclo) con lo que conviene mirar hoy; luego tus datos del día en cajas finas con su
// línea de los últimos días (cometa, como las metas de Hoy), y abajo tu último informe como en Análisis y el sueño de
// las dos últimas semanas. Cada bloque abre su pantalla. Solo enseña lo que el usuario tiene encendido.

const time = (d: Date) => d.toLocaleTimeString(dateLocale(), { hour: '2-digit', minute: '2-digit' });
const day = (iso: string) => new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short' });

// Un color por dato, los mismos que las metas de Hoy: pasos jade, sueño lavanda, agua azul; el pulso en oro
const TONE = { steps: FINE.jade, sleep: '#A9A5E6', heart: FINE.gold, water: '#74B9E8', gut: FINE.jade, meds: FINE.gold } as const;

// La línea de los últimos días de un bloque: curva fina que se aviva hacia hoy y acaba en un punto de luz (como la
// cabeza de las líneas cometa y de los aros)
// El ancho llega del bloque (no se mide): al cambiar el tamaño de la ventana, la línea se rehace con él
const Spark = ({ values, color, width: w }: { values: number[]; color: string; width: number }) => {
  const id = `sp${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const H = 38;
  const pad = 7; // sitio para el brillo del punto
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts =
    values.length > 1 && w > 0
      ? values.map((v, i) => ({ x: pad + (i / (values.length - 1)) * (w - pad * 2), y: H - pad - ((v - min) / span) * (H - pad * 2) }))
      : [];
  const head = pts[pts.length - 1];
  return (
    <View style={[styles.spark, { width: w }]}>
      {head && (
        <Svg width={w} height={H}>
          <Defs>
            <LinearGradient id={id} x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={mixHex(color, FINE.deep, 0.5)} stopOpacity="0.25" />
              <Stop offset="1" stopColor={color} stopOpacity="1" />
            </LinearGradient>
          </Defs>
          <Path d={smoothPath(pts)} stroke={`url(#${id})`} strokeWidth={1.8} fill="none" strokeLinecap="round" />
          <SvgCircle cx={head.x} cy={head.y} r={6.5} fill={color} opacity={0.18} />
          <SvgCircle cx={head.x} cy={head.y} r={2.8} fill={mixHex(color, '#FFFFFF', 0.35)} />
        </Svg>
      )}
    </View>
  );
};

const TILE_PAD = 16;

// Un bloque de tus datos: el nombre pequeño en mayúsculas, la cifra grande y ligera, su línea y una nota apagada
interface TileProps {
  title: string;
  when?: string;
  value: string;
  unit?: string;
  note?: string;
  noteTone?: string;
  spark?: { values: number[]; color: string };
  onPress: () => void;
  width: number;
}

const Tile = ({ title, when, value, unit, note, noteTone, spark, onPress, width }: TileProps) => (
  <TouchableOpacity style={[fine.tile, styles.tile, { width }]} onPress={onPress} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel={`${title}: ${value}${unit ? ` ${unit}` : ''}`}>
    <View style={styles.tileHead}>
      <Text style={[fine.kicker, { flex: 1 }]} numberOfLines={1}>
        {title}
      </Text>
      {!!when && <Text style={styles.tileWhen}>{when}</Text>}
      <Chev />
    </View>
    <Text style={styles.tileValue} numberOfLines={1}>
      {value}
      {!!unit && <Text style={fine.unit}> {unit}</Text>}
    </Text>
    {spark && spark.values.length > 1 ? <Spark {...spark} width={width - TILE_PAD * 2 + 14} /> : <View style={styles.sparkSpace} />}
    {!!note && (
      <Text style={[styles.tileNote, noteTone ? { color: noteTone } : null]} numberOfLines={1}>
        {note}
      </Text>
    )}
  </TouchableOpacity>
);

// Uno de los tres círculos de Hoy (el mismo aro que en el móvil)
type CircleProps = { key: string; label: string; progress: number; tones: RingColors; center: React.ReactNode; onPress: () => void; a11y: string };
const Ring = ({ label, progress, tones, center, onPress, a11y }: Omit<CircleProps, 'key'>) => (
  <TouchableOpacity style={styles.circle} onPress={onPress} activeOpacity={0.85} accessibilityRole="button" accessibilityLabel={a11y}>
    <GlowRing progress={progress} colors={tones} size={96} stroke={5}>
      {center}
    </GlowRing>
    <Text style={fine.kicker}>{label}</Text>
  </TouchableOpacity>
);

const values = (points?: DailyPoint[], n = 7) => (points ?? []).slice(-n).map((p) => p.value);

export const WebSummaryScreen = () => {
  const router = useRouter();
  const show = useSections();
  const metas = useMetas();
  const { series, isSample } = useDailyWearables(29);
  const [width, setWidth] = useState(0);
  const [loadedAt, setLoadedAt] = useState(new Date());
  const [checkInsToday, setCheckInsToday] = useState(0);
  const [profile, setProfile] = useDeepState<UserProfile | null>(null);
  const [savedGoals, setSavedGoals] = useDeepState<Partial<DailyGoals> | null>(null);
  const [cycle, setCycle] = useDeepState<CyclePhaseInfo | null>(null);
  const [bathroom, setBathroom] = useDeepState<{ bowel: BowelEntry | null; urine: UrineEntry | null }>({ bowel: null, urine: null });
  const [doses, setDoses] = useDeepState<ScheduledDose[]>([]);
  const [upcoming, setUpcoming] = useDeepState<SummaryLine[]>([]);

  const load = useCallback(async () => {
    // La nebulosa del check-in solo se mueve con Hoy a la vista (useLiveMotion): aquí Hoy es esta pantalla
    setVisibleTab(TAB.today);
    setLoadedAt(new Date());
    Promise.all([labAppointmentEvents().catch(() => []), consult.myAppointments().catch(() => [])]).then(([labEvents, appts]) =>
      setUpcoming(
        buildSummary({ events: [...buildSchedule(), ...labEvents], appointments: summaryAppointments(appts), newResults: false, now: new Date() }).slice(0, 3),
      ),
    );
    Promise.all([medicationRepository.getAll(), doseRepository.getAll()])
      .then(([m, l]) => setDoses(dosesForDay(m.filter((i) => isActiveOn(i, new Date())), new Date(), l)))
      .catch(() => setDoses([]));
    Promise.all([bowelRepository.getAll(), urineRepository.getAll()])
      .then(([b, u]) => setBathroom({ bowel: entryForDay(b, dayKey(new Date())) ?? null, urine: entryForDay(u, dayKey(new Date())) ?? null }))
      .catch(() => undefined);
    dailyGoalsStore.get().then(setSavedGoals).catch(() => undefined);
    const [p, checkIns, cycleEntries] = await Promise.all([profileRepository.get(), checkInRepository.getAll(), cycleRepository.getAll()]);
    setProfile(p);
    const todayKey = checkInDayKey({ fecha: new Date().toISOString() });
    setCheckInsToday(checkIns.filter((c) => checkInDayKey(c) === todayKey).length);
    const cycleGoal = p.sex === 'female' ? await cycleGoalStore.get().catch(() => null) : null;
    setCycle(p.sex === 'female' ? currentCyclePhase(cycleEntries, new Date(), cycleGoal?.cycleLength, cycleGoal) : null);
  }, [setProfile, setSavedGoals, setCycle, setBathroom, setDoses, setUpcoming]);
  useReloadOnFocus(load);

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const GAP = 14;
  const wide = width >= 760; // dos columnas arriba y abajo
  const halfW = wide ? (width - 40) / 2 : width || 300;

  // Cuenta real sin analíticas: no hay informe (nada de ejemplo)
  const lab = labReports()[0] as ReturnType<typeof labReports>[number] | undefined;
  const counts = lab ? reportCounts(lab.report) : { inRange: 0, needsReview: 0, total: 0 };
  const flagged = lab ? flaggedMarkers(lab.report, 3) : [];
  const openReport = () => (lab?.id === 'current' ? router.push('/report-summary') : lab && router.push({ pathname: '/lab-report', params: { id: lab.id } }));
  const sleep = latest(series.sleep_duration);
  const steps = latest(series.steps);
  const rhr = latest(series.resting_heart_rate);
  // La misma preparación que en Hoy del móvil: frente a tu objetivo de sueño y sin restar lo propio de la fase lútea
  const goals = effectiveGoals(suggestedGoals(buildPlan(profile), profile).goals, savedGoals);
  const readiness = computeReadiness(series, new Date(), { sleepNeedMin: goals.sleepMin, luteal: !!cycle && !cycle.isSample && cycle.phase === 'luteal' });
  const weekScore = metas.data ? weekScoreOf(metas.data.state, metas.vals, metas.week ?? undefined, metas.known) : null;
  const hydration = hydrationFromUrine(bathroom.urine);
  const taken = doses.filter((d) => d.log?.status === 'taken').length;
  const firstName = useFirstName();
  const go = (pathname: string, params?: Record<string, string>) => router.navigate({ pathname, params } as any);
  const sampleNote = isSample ? ` · ${t('sample')}` : '';

  // Los tres círculos de Hoy: Preparación, Semana (tus metas) y Ciclo (mujeres, con reglas)
  const circles = [
    show('readiness') && {
      key: 'readiness',
      label: t('Readiness'),
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
      onPress: () => goToTabSection(TAB.plan, 'week'),
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
      onPress: () => go('/cycle-detail'),
      a11y: t('Menstrual cycle: day {n}, {phase}', { n: cycle.day, phase: t(cycle.label).toLowerCase() }),
    },
  ].filter((c) => !!c) as CircleProps[];

  // Lo que conviene mirar hoy: hasta 3 cosas concretas sacadas de los datos (el check-in ya lo pide la nebulosa)
  const now = new Date();
  const pendingDoses = doses.filter((d) => !d.log && d.at.getTime() <= now.getTime()).length;
  const todo: { key: string; text: string; gold?: boolean; onPress: () => void }[] = [];
  if (counts.needsReview)
    todo.push({
      key: 'lab',
      text: tn(counts.needsReview, '{n} marker to review in your latest lab report', '{n} markers to review in your latest lab report'),
      gold: true,
      onPress: openReport,
    });
  if (show('medication') && pendingDoses)
    todo.push({ key: 'meds', text: tn(pendingDoses, '{n} dose to mark', '{n} doses to mark'), onPress: () => go('/medications') });
  if (show('bladder') && (hydration.level === 'tip' || hydration.level === 'low'))
    todo.push({ key: 'water', text: t('You could drink a bit more water today'), onPress: () => go('/digestive', { part: 'bladder' }) });
  if (upcoming[0]) todo.push({ key: 'next', text: upcoming[0].text, onPress: () => router.navigate(upcoming[0].target as any) });
  const today = now.toLocaleDateString(dateLocale(), { weekday: 'long', day: 'numeric', month: 'long' });
  // Lo que ya sale arriba no se repite en «Próximamente»
  const comingUp = todo.slice(0, 3).some((x) => x.key === 'next') ? upcoming.slice(1) : upcoming;

  const tiles: (Omit<TileProps, 'width'> & { key: string })[] = [];
  if (show('wearables') && steps != null)
    tiles.push({
      key: 'steps',
      title: t('Steps'),
      when: t('Today'),
      value: steps.toLocaleString(dateLocale()),
      note: t('Goal {v}', { v: goals.steps.toLocaleString(dateLocale()) }) + sampleNote,
      spark: { values: values(series.steps), color: TONE.steps },
      onPress: () => go('/metric', { kind: 'steps' }),
    });
  if (show('wearables') && sleep != null)
    tiles.push({
      key: 'sleep',
      title: t('Sleep'),
      when: t('Last night'),
      value: formatSleep(sleep),
      note: t('Time asleep') + sampleNote,
      spark: { values: values(series.sleep_duration), color: TONE.sleep },
      onPress: () => go('/metric', { kind: 'sleep_duration' }),
    });
  if (show('wearables') && rhr != null)
    tiles.push({
      key: 'rhr',
      title: t('Resting heart rate'),
      when: t('Today'),
      value: String(Math.round(rhr)),
      unit: t('bpm'),
      note: t('Average this week: {n} bpm', {
        n: Math.round(values(series.resting_heart_rate).reduce((a, b) => a + b, 0) / Math.max(1, values(series.resting_heart_rate).length)),
      }),
      spark: { values: values(series.resting_heart_rate), color: TONE.heart },
      onPress: () => go('/metric', { kind: 'resting_heart_rate' }),
    });
  if (show('bladder'))
    tiles.push({
      key: 'hydration',
      title: t('Hydration'),
      when: bathroom.urine ? t('Today') : undefined,
      value: t(hydration.label),
      note: t('From your urine colour'),
      onPress: () => go('/digestive', { part: 'bladder' }),
    });
  if (show('gut'))
    tiles.push({
      key: 'gut',
      title: t('Digestion'),
      when: bathroom.bowel ? t('Today') : undefined,
      value: bathroom.bowel ? String(bathroom.bowel.count) : '—',
      note: t('Bowel movements today'),
      onPress: () => go('/digestive', { part: 'gut' }),
    });
  if (show('medication') && doses.length)
    tiles.push({
      key: 'meds',
      title: t('Medication'),
      when: t('Today'),
      value: t('{n} of {total}', { n: taken, total: doses.length }),
      note: t('Doses marked as taken'),
      noteTone: taken < doses.length ? FINE.gold : FINE.jade,
      onPress: () => go('/medications'),
    });

  // Tres por fila en lo ancho (o los que haya, para que no quede un hueco); dos o uno si la ventana es estrecha
  const cols = width >= 760 ? Math.min(3, Math.max(1, tiles.length)) : width >= 520 ? 2 : 1;
  const tileW = width ? (width - GAP * (cols - 1)) / cols : 300;
  const sleepTrend = show('wearables') && series.sleep_duration && series.sleep_duration.length > 1 ? series.sleep_duration.slice(-14) : null;

  return (
    <>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View onLayout={onLayout}>
          <Text style={styles.greeting}>{t('Hi {name}!', { name: firstName })}</Text>
          <Text style={fine.lead}>{today.charAt(0).toUpperCase() + today.slice(1)}</Text>

          {/* Arriba, en dos columnas: la nebulosa del check-in y, al lado, los tres círculos y lo que mirar hoy */}
          <View style={[styles.hero, wide && styles.heroWide]}>
            {show('checkin') && (
              <View style={[styles.checkIn, wide && styles.checkInWide]}>
                <CheckInButton done={checkInsToday} onPress={() => router.push('/check-in')} />
                <TouchableOpacity onPress={() => router.push('/your-days' as any)} hitSlop={8}>
                  <Text style={styles.daysLink}>{t('Your last days')} ›</Text>
                </TouchableOpacity>
              </View>
            )}
            <View style={styles.heroSide}>
              {circles.length > 0 && (
                <View style={styles.circles}>
                  {circles.map(({ key, ...c }) => (
                    <Ring key={key} {...c} />
                  ))}
                </View>
              )}
              {readiness && <Text style={styles.stateLine}>{`${t('Readiness')}: ${t(readiness.label).toLowerCase()}`}</Text>}
              {todo.length > 0 && (
                <View style={styles.todo}>
                  <Text style={fine.kicker}>
                    {todo.length === 1 ? t('One thing to look at today') : t('{n} things to look at today', { n: Math.min(3, todo.length) })}
                  </Text>
                  {/* El texto y el «Ver» abren lo mismo, pero por separado: en la web un botón no puede llevar otro dentro */}
                  {todo.slice(0, 3).map((it, i) => (
                    <View key={it.key} style={[styles.todoRow, i > 0 && styles.todoDivider]}>
                      <TouchableOpacity style={{ flex: 1 }} onPress={it.onPress} activeOpacity={0.8} accessibilityRole="button">
                        <Text style={[styles.todoText, it.gold && { color: FINE.gold }]}>{it.text}</Text>
                      </TouchableOpacity>
                      <Pill gold={!!it.gold} label={t('See')} onPress={it.onPress} />
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>

          {/* Al cerrar la semana, la enhorabuena o el ánimo (lo mismo que en Hoy del móvil) */}
          {show('plan') && <MetasToday />}

          {tiles.length > 0 && (
            <>
              <View style={[fine.secHead, styles.secHead]}>
                <Text style={fine.secTitle}>{t('Your dashboard')}</Text>
                <Text style={[styles.tileWhen, { marginLeft: 'auto' }]}>{t('Updated at {time}', { time: time(loadedAt) })}</Text>
              </View>
              <View style={styles.grid}>
                {tiles.map(({ key, ...c }) => (
                  <Tile key={key} {...c} width={tileW} />
                ))}
              </View>
            </>
          )}

          {/* Abajo, en dos columnas: tu último informe como en Análisis y el sueño de las dos últimas semanas */}
          {(lab || sleepTrend) && (
            <View style={[styles.bottom, wide && styles.bottomWide]}>
              {lab && (
                <View style={{ width: halfW }}>
                  <SecHead title={t('Your latest report')} onPress={openReport} style={styles.secHead} />
                  <TouchableOpacity style={styles.ringRow} onPress={openReport} activeOpacity={0.8} accessibilityRole="button">
                    <FineDonut size={116} stroke={5} inRange={counts.inRange} review={counts.needsReview} label={`${counts.total}`} />
                    <View style={{ flex: 1 }}>
                      <DonutLegend inRange={counts.inRange} review={counts.needsReview} />
                    </View>
                    <Chev />
                  </TouchableOpacity>
                  <Text style={[fine.note, { marginTop: 6 }]}>{`${formatReportDate(lab.report.test_date)} · ${lab.lab}${lab.title ? ` · ${lab.title}` : ''}`}</Text>
                  {flagged.length > 0 && <Text style={[fine.kicker, styles.flaggedHead]}>{t('Markers that need a look')}</Text>}
                  {flagged.map((m, i) => {
                    const v = typeof m.value === 'number' ? m.value : Number(m.value);
                    const near = m.flag === 'limite_alto' || m.flag === 'limite_bajo';
                    const status = near ? t('In range, close to the limit') : m.flag === 'bajo' ? t('Below range') : t('Above range');
                    return (
                      <TouchableOpacity
                        key={m.marker_id}
                        style={[fine.row, i === flagged.length - 1 && { borderBottomWidth: 0 }]}
                        onPress={() => router.push(markerHref(m.marker_id, `report:${lab.id}`))}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={styles.paramName} numberOfLines={1}>
                            {markerNameEn(m)}
                          </Text>
                          <Text style={[styles.paramValue, !near && { color: FINE.gold }]}>
                            {getMarkerValueTextEn(m.value, m.unit)}
                            <Text style={styles.paramStatus}> · {status}</Text>
                          </Text>
                        </View>
                        <LabGauge value={Number.isNaN(v) ? null : v} low={m.range.low} high={m.range.high} style={styles.gauge} />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
              {sleepTrend && (
                <View style={{ width: halfW }}>
                  <SecHead title={t('Sleep, last 14 days')} onPress={() => go('/metric', { kind: 'sleep_duration' })} style={styles.secHead} />
                  <View style={styles.chart}>
                    <TrendChart
                      height={150}
                      labels={sleepTrend.map((p) => day(p.date))}
                      series={[{ color: TONE.sleep, values: sleepTrend.map((p) => p.value / 60) }]}
                      formatY={(v) => `${v.toFixed(0)} h`}
                      formatValue={(v) => formatSleep(Math.round(v * 60))}
                    />
                  </View>
                  {isSample && <Text style={fine.note}>{t('sample data')}</Text>}
                </View>
              )}
            </View>
          )}

          {comingUp.length > 0 && (
            <>
              <SecHead title={t('Coming up')} style={styles.secHead} />
              {comingUp.map((l, i) => (
                <FRow key={l.id} title={l.text} value={day(l.when)} onPress={() => router.navigate(l.target as any)} last={i === comingUp.length - 1} />
              ))}
            </>
          )}

          <TouchableOpacity style={styles.allData} onPress={() => go('/(tabs)', { tab: String(TAB.analysis) })} hitSlop={8} accessibilityRole="link">
            <Text style={fine.link}>{t('Show all health data')} ›</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
      {/* Perfil genético y, a las mujeres, cuestionario de la regla: las primeras veces que entra */}
      <WelcomePrompts />
    </>
  );
};

const styles = StyleSheet.create({
  // Transparente: deja ver el fondo ambiental esmeralda, como Análisis y Plan (ScreenBackdrop del _layout)
  scroll: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingHorizontal: 28, paddingTop: 24, paddingBottom: 48 },
  greeting: { ...ff('medium'), color: FINE.ivory, fontSize: 30, lineHeight: 36, letterSpacing: -0.3 },
  hero: { marginTop: 18, gap: 18 },
  heroWide: { flexDirection: 'row', alignItems: 'center', gap: 40 },
  checkIn: { alignItems: 'center' },
  checkInWide: { width: 300 },
  daysLink: { ...fine.link, marginTop: 6 },
  heroSide: { flex: 1, minWidth: 0 },
  circles: { flexDirection: 'row', justifyContent: 'space-around' },
  circle: { alignItems: 'center', gap: 8, minWidth: 104 },
  circleValue: { ...ff('light'), color: FINE.ivory, fontSize: 26, fontVariant: ['tabular-nums'] },
  circleUnit: { ...ff('regular'), color: FINE.mute, fontSize: 12 },
  circleKicker: { ...ff('regular'), color: FINE.mute, fontSize: 10 },
  stateLine: { ...ff('regular'), color: FINE.mute, fontSize: 13, textAlign: 'center', marginTop: 12 },
  // Lo que mirar hoy: la misma caja fina que «Lo siguiente» en Hoy del móvil
  todo: { backgroundColor: FINE.tile, borderWidth: 1, borderColor: FINE.line, borderRadius: 14, paddingHorizontal: 14, paddingTop: 12, marginTop: 18 },
  todoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  todoDivider: { borderTopWidth: 1, borderTopColor: FINE.line },
  todoText: { ...ff('medium'), color: FINE.ivory, fontSize: 14.5, lineHeight: 20 },
  secHead: { marginTop: 26 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  tile: { paddingHorizontal: TILE_PAD, paddingTop: 14, paddingBottom: 12, minHeight: 132 },
  tileHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tileWhen: { ...ff('regular'), color: FINE.mute, fontSize: 12 },
  tileValue: { ...ff('light'), color: FINE.ivory, fontSize: 30, lineHeight: 36, marginTop: 8, fontVariant: ['tabular-nums'] },
  tileNote: { ...ff('regular'), color: FINE.mute, fontSize: 12.5, marginTop: 2 },
  spark: { height: 38, marginTop: 4, marginHorizontal: -7 },
  sparkSpace: { height: 10 },
  bottom: { gap: 8 },
  bottomWide: { flexDirection: 'row', alignItems: 'flex-start', gap: 40 },
  ringRow: { flexDirection: 'row', alignItems: 'center', gap: 18, paddingTop: 6 },
  flaggedHead: { marginTop: 18, marginBottom: 2 },
  paramName: { ...ff('regular'), color: FINE.ivory, fontSize: 14 },
  paramValue: { ...ff('regular'), color: FINE.ivory, fontSize: 12.5, marginTop: 1, fontVariant: ['tabular-nums'] },
  paramStatus: { ...ff('regular'), color: FINE.mute },
  gauge: { width: 96 },
  chart: { paddingTop: 8 },
  allData: { alignSelf: 'center', marginTop: 28, minHeight: 36, justifyContent: 'center' },
});
