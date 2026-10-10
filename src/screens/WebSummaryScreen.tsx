import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, LayoutChangeEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Svg, { Polyline } from 'react-native-svg';
import { Colors, withAlpha } from '@/constants/colors';
import { useFirstName } from '@/components/UserAvatar';
import { IntestineIcon } from '@/components/IntestineIcon';
import { TrendChart } from '@/components/TrendChart';
import { useSections } from '@/data/appPrefs';
import { useDeepState, useReloadOnFocus } from '@/hooks/useReloadOnFocus';
import { dateLocale, t, tn } from '@/i18n';
import { LAB_REPORTS, formatReportDate, flaggedMarkers, markerNameEn, reportCounts } from '@/utils/labReportView';
import { getMarkerValueTextEn } from '@/data/reportContentEn';
import { checkInRepository } from '@/data/checkInRepository';
import { CheckInEntry, MOOD_OPTIONS } from '@/types/checkIn';
import { profileRepository } from '@/data/profileRepository';
import { cycleRepository } from '@/data/cycleRepository';
import { currentCyclePhase, CyclePhaseInfo } from '@/utils/cyclePhase';
import { bowelRepository, dayKey, entryForDay, urineRepository } from '@/data/bathroomRepository';
import { hydrationFromUrine } from '@/logic/bathroom';
import { BowelEntry, UrineEntry } from '@/types/bathroom';
import { doseRepository, medicationRepository } from '@/data/medicationRepository';
import { dosesForDay, isActiveOn } from '@/logic/medication';
import { ScheduledDose } from '@/types/medication';
import { buildSchedule } from '@/data/schedule';
import { labAppointmentEvents } from '@/data/labAppointments';
import { buildSummary, SummaryLine } from '@/logic/summary';
import { computeReadiness, formatSleep, latest, useDailyWearables, DailyPoint } from '@/wearables/dailySeries';

// "Resumen" de la web del paciente en escritorio (estilo Salud de Apple): cabecera con la
// persona, bloques fijados con el último dato de cada parte y tendencias. Cada bloque abre su
// pantalla de la app. Solo enseña lo que el usuario tiene encendido (Configure my experience).

const time = (d: Date) => d.toLocaleTimeString(dateLocale(), { hour: '2-digit', minute: '2-digit' });
const day = (iso: string) => new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short' });

// Barras pequeñas (últimos días) a la derecha de un bloque
const MiniBars = ({ values, color }: { values: number[]; color: string }) => {
  const max = Math.max(...values, 1);
  return (
    <View style={styles.miniBars}>
      {values.map((v, i) => (
        <View
          key={i}
          style={[styles.miniBar, { height: 6 + (v / max) * 34, backgroundColor: color, opacity: i === values.length - 1 ? 1 : 0.45 }]}
        />
      ))}
    </View>
  );
};

// Línea pequeña (últimos días)
const MiniLine = ({ values, color }: { values: number[]; color: string }) => {
  if (values.length < 2) return null;
  const w = 84;
  const h = 40;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - 4 - ((v - min) / span) * (h - 8)}`).join(' ');
  return (
    <Svg width={w} height={h}>
      <Polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
    </Svg>
  );
};

interface CardProps {
  title: string;
  color: string;
  icon: React.ReactNode;
  when?: string;
  value: string;
  unit?: string;
  caption?: string;
  right?: React.ReactNode;
  onPress: () => void;
  width: number;
}

const Card = ({ title, color, icon, when, value, unit, caption, right, onPress, width }: CardProps) => (
  <TouchableOpacity style={[styles.card, { width }]} onPress={onPress} activeOpacity={0.85}>
    <View style={styles.cardHead}>
      <View style={[styles.cardIcon, { backgroundColor: withAlpha(color, 0.14) }]}>{icon}</View>
      <Text style={styles.cardTitle} numberOfLines={1}>
        {title}
      </Text>
      {!!when && <Text style={styles.cardWhen}>{when}</Text>}
      <Ionicons name="chevron-forward" size={15} color={Colors.textMuted} />
    </View>
    <View style={styles.cardBody}>
      <View style={{ flex: 1 }}>
        {!!caption && <Text style={styles.cardCaption}>{caption}</Text>}
        <Text style={styles.cardValue} numberOfLines={1}>
          {value}
          {!!unit && <Text style={styles.cardUnit}> {unit}</Text>}
        </Text>
      </View>
      {right}
    </View>
  </TouchableOpacity>
);

const values = (points?: DailyPoint[], n = 7) => (points ?? []).slice(-n).map((p) => p.value);

export const WebSummaryScreen = () => {
  const router = useRouter();
  const show = useSections();
  const { series, isSample } = useDailyWearables();
  const [width, setWidth] = useState(0);
  const [loadedAt, setLoadedAt] = useState(new Date());
  const [lastCheckIn, setLastCheckIn] = useDeepState<CheckInEntry | null>(null);
  const [cycle, setCycle] = useDeepState<CyclePhaseInfo | null>(null);
  const [bathroom, setBathroom] = useDeepState<{ bowel: BowelEntry | null; urine: UrineEntry | null }>({ bowel: null, urine: null });
  const [doses, setDoses] = useDeepState<ScheduledDose[]>([]);
  const [upcoming, setUpcoming] = useDeepState<SummaryLine[]>([]);

  const load = useCallback(async () => {
    setLoadedAt(new Date());
    labAppointmentEvents()
      .catch(() => [])
      .then((labEvents) =>
        setUpcoming(buildSummary({ events: [...buildSchedule(), ...labEvents], appointments: [], newResults: false, now: new Date() }).slice(0, 3)),
      );
    Promise.all([medicationRepository.getAll(), doseRepository.getAll()])
      .then(([m, l]) => setDoses(dosesForDay(m.filter((i) => isActiveOn(i, new Date())), new Date(), l)))
      .catch(() => setDoses([]));
    Promise.all([bowelRepository.getAll(), urineRepository.getAll()])
      .then(([b, u]) => setBathroom({ bowel: entryForDay(b, dayKey(new Date())) ?? null, urine: entryForDay(u, dayKey(new Date())) ?? null }))
      .catch(() => undefined);
    const [p, checkIns, cycleEntries] = await Promise.all([profileRepository.get(), checkInRepository.getAll(), cycleRepository.getAll()]);
    setLastCheckIn(checkIns.length ? checkIns[0] : null);
    setCycle(p.sex === 'female' ? currentCyclePhase(cycleEntries) : null);
  }, [setLastCheckIn, setCycle, setBathroom, setDoses, setUpcoming]);
  useReloadOnFocus(load);

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  const GAP = 14;
  const cols = width >= 980 ? 3 : width >= 620 ? 2 : 1;
  const cardW = width ? (width - GAP * (cols - 1)) / cols : 300;

  const lab = LAB_REPORTS[0];
  const counts = reportCounts(lab.report);
  const flagged = flaggedMarkers(lab.report, 3);
  const sleep = latest(series.sleep_duration);
  const steps = latest(series.steps);
  const rhr = latest(series.resting_heart_rate);
  const readiness = computeReadiness(series);
  const mood = lastCheckIn?.mood ? MOOD_OPTIONS.find((m) => m.id === lastCheckIn.mood) : null;
  const hydration = hydrationFromUrine(bathroom.urine);
  const taken = doses.filter((d) => d.log?.status === 'taken').length;
  const firstName = useFirstName();
  const go = (pathname: string, params?: Record<string, string>) => router.navigate({ pathname, params } as any);
  const icon = (n: string, c: string) => <Ionicons name={n as any} size={16} color={c} />;
  const sampleNote = isSample ? ` · ${t('sample')}` : '';

  // "Para hoy": hasta 3 cosas concretas que mirar, sacadas de los datos (en vez de una ficha de perfil)
  const now = new Date();
  const checkedInToday = !!lastCheckIn && dayKey(new Date(lastCheckIn.fecha)) === dayKey(now);
  const pendingDoses = doses.filter((d) => !d.log && d.at.getTime() <= now.getTime()).length;
  const todo: { key: string; icon: string; color: string; text: string; onPress: () => void }[] = [];
  if (show('checkin') && !checkedInToday)
    todo.push({ key: 'checkin', icon: 'happy-outline', color: Colors.gold, text: t('Do your check-in: 30 seconds'), onPress: () => router.push('/check-in') });
  if (counts.needsReview)
    todo.push({
      key: 'lab',
      icon: 'flask-outline',
      color: Colors.danger,
      text: tn(counts.needsReview, '{n} marker to review in your latest lab report', '{n} markers to review in your latest lab report'),
      onPress: () => go('/lab-report', { id: lab.id }),
    });
  if (show('medication') && pendingDoses)
    todo.push({ key: 'meds', icon: 'medical-outline', color: Colors.gold, text: tn(pendingDoses, '{n} dose to mark', '{n} doses to mark'), onPress: () => go('/medications') });
  if (show('bladder') && (hydration.level === 'tip' || hydration.level === 'low'))
    todo.push({ key: 'water', icon: 'water-outline', color: Colors.sky, text: t('You could drink a bit more water today'), onPress: () => go('/digestive', { part: 'bladder' }) });
  if (upcoming[0])
    todo.push({ key: 'next', icon: upcoming[0].icon, color: Colors.accent, text: upcoming[0].text, onPress: () => router.navigate(upcoming[0].target as any) });
  const today = now.toLocaleDateString(dateLocale(), { weekday: 'long', day: 'numeric', month: 'long' });

  const cards: (Omit<CardProps, 'width'> & { key: string })[] = [
    {
      key: 'lab',
      title: t('Lab results'),
      color: Colors.danger,
      icon: icon('flask', Colors.danger),
      when: formatReportDate(lab.report.test_date),
      caption: lab.lab,
      value: t('{n} in range', { n: counts.inRange }),
      unit: `· ${t('{n} need a look', { n: counts.needsReview })}`,
      onPress: () => go('/lab-report', { id: lab.id }),
    },
  ];
  if (show('checkin'))
    cards.push({
      key: 'mood',
      title: t('Check-in'),
      color: Colors.gold,
      icon: icon('happy-outline', Colors.gold),
      when: lastCheckIn ? day(lastCheckIn.fecha) : undefined,
      caption: lastCheckIn?.energy ? t('Energy {n}/5', { n: lastCheckIn.energy }) : t('How are you feeling?'),
      value: mood ? `${mood.emoji} ${t(mood.label)}` : t('Check in'),
      onPress: () => router.push('/check-in'),
    });
  if (show('wearables') && sleep != null)
    cards.push({
      key: 'sleep',
      title: t('Sleep'),
      color: Colors.sky,
      icon: icon('bed', Colors.sky),
      when: t('Last night'),
      caption: t('Time asleep') + sampleNote,
      value: formatSleep(sleep),
      right: <MiniBars values={values(series.sleep_duration)} color={Colors.sky} />,
      onPress: () => go('/metric', { kind: 'sleep_duration' }),
    });
  if (show('wearables') && steps != null)
    cards.push({
      key: 'steps',
      title: t('Activity'),
      color: Colors.coral,
      icon: icon('flame', Colors.coral),
      when: t('Today'),
      caption: t('Steps') + sampleNote,
      value: steps.toLocaleString(dateLocale()),
      right: <MiniBars values={values(series.steps)} color={Colors.coral} />,
      onPress: () => go('/metric', { kind: 'steps' }),
    });
  if (show('wearables') && rhr != null)
    cards.push({
      key: 'rhr',
      title: t('Resting heart rate'),
      color: Colors.danger,
      icon: icon('heart', Colors.danger),
      when: t('Today'),
      caption: t('Average this week: {n} bpm', { n: Math.round(values(series.resting_heart_rate).reduce((a, b) => a + b, 0) / Math.max(1, values(series.resting_heart_rate).length)) }),
      value: String(Math.round(rhr)),
      unit: t('bpm'),
      right: <MiniLine values={values(series.resting_heart_rate)} color={Colors.danger} />,
      onPress: () => go('/metric', { kind: 'resting_heart_rate' }),
    });
  if (show('readiness') && readiness)
    cards.push({
      key: 'readiness',
      title: t('Daily readiness'),
      color: Colors.green,
      icon: icon('speedometer', Colors.green),
      when: t('Today'),
      caption: t(readiness.label),
      value: String(readiness.score),
      unit: '/ 100',
      onPress: () => go('/(tabs)', { tab: '0' }),
    });
  if (show('bladder'))
    cards.push({
      key: 'hydration',
      title: t('Hydration'),
      color: Colors.gold,
      icon: icon('water-outline', Colors.gold),
      when: bathroom.urine ? t('Today') : undefined,
      caption: t('From your urine colour'),
      value: t(hydration.label),
      onPress: () => go('/digestive', { part: 'bladder' }),
    });
  if (show('gut'))
    cards.push({
      key: 'gut',
      title: t('Gut'),
      color: Colors.green,
      icon: <IntestineIcon size={16} color={Colors.green} />,
      when: bathroom.bowel ? t('Today') : undefined,
      caption: t('Bowel movements today'),
      value: bathroom.bowel ? String(bathroom.bowel.count) : '—',
      onPress: () => go('/digestive', { part: 'gut' }),
    });
  if (show('cycle') && cycle)
    cards.push({
      key: 'cycle',
      title: t('Cycle'),
      color: Colors.pinkSoft,
      icon: icon('rose', Colors.pinkSoft),
      when: t('Day {n} of {total}', { n: cycle.day, total: cycle.length }),
      caption: t(cycle.hint),
      value: t(cycle.label),
      onPress: () => go('/cycle-detail'),
    });
  if (show('medication') && doses.length)
    cards.push({
      key: 'meds',
      title: t('Medication'),
      color: Colors.gold,
      icon: icon('medical', Colors.gold),
      when: t('Today'),
      caption: t('Doses marked as taken'),
      value: t('{n} of {total}', { n: taken, total: doses.length }),
      onPress: () => go('/medications'),
    });

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.date}>{today.charAt(0).toUpperCase() + today.slice(1)}</Text>
      <Text style={styles.greeting}>{t('Hi {name}!', { name: firstName })}</Text>
      {todo.length > 0 && (
        <View style={styles.todo}>
          <Text style={styles.todoTitle}>{todo.length === 1 ? t('One thing to look at today') : t('{n} things to look at today', { n: Math.min(3, todo.length) })}</Text>
          {todo.slice(0, 3).map((it, i) => (
            <TouchableOpacity key={it.key} style={[styles.todoRow, i > 0 && styles.rowBorder]} onPress={it.onPress} activeOpacity={0.85}>
              <View style={[styles.cardIcon, { backgroundColor: withAlpha(it.color, 0.14) }]}>
                <Ionicons name={it.icon as any} size={16} color={it.color} />
              </View>
              <Text style={styles.rowText}>{it.text}</Text>
              <Ionicons name="chevron-forward" size={15} color={Colors.textMuted} />
            </TouchableOpacity>
          ))}
        </View>
      )}

      <View style={styles.sectionRow}>
        <Text style={styles.section}>{t('Your dashboard')}</Text>
        <Text style={styles.sync}>{t('Updated at {time}', { time: time(loadedAt) })}</Text>
      </View>
      <View style={styles.grid} onLayout={onLayout}>
        {cards.map(({ key, ...c }) => (
          <Card key={key} {...c} width={cardW} />
        ))}
      </View>

      {upcoming.length > 0 && (
        <>
          <Text style={styles.section}>{t('Coming up')}</Text>
          <View style={styles.panel}>
            {upcoming.map((l, i) => (
              <TouchableOpacity key={l.id} style={[styles.row, i > 0 && styles.rowBorder]} onPress={() => router.navigate(l.target as any)}>
                <Ionicons name={l.icon as any} size={18} color={Colors.accent} />
                <Text style={styles.rowText}>{l.text}</Text>
                <Text style={styles.rowWhen}>{day(l.when)}</Text>
                <Ionicons name="chevron-forward" size={15} color={Colors.textMuted} />
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      <Text style={styles.section}>{t('Trends')}</Text>
      <View style={styles.grid}>
        {show('wearables') && series.sleep_duration && series.sleep_duration.length > 1 && (
          <TouchableOpacity style={[styles.card, { width: cols > 1 ? (width - GAP) / 2 : cardW }]} onPress={() => go('/metric', { kind: 'sleep_duration' })} activeOpacity={0.85}>
            <View style={styles.cardHead}>
              <View style={[styles.cardIcon, { backgroundColor: withAlpha(Colors.sky, 0.14) }]}>{icon('bed', Colors.sky)}</View>
              <Text style={styles.cardTitle}>{t('Sleep, last 14 days')}</Text>
            </View>
            <TrendChart
              height={90}
              labels={series.sleep_duration.map((p) => day(p.date))}
              series={[{ color: Colors.sky, values: series.sleep_duration.map((p) => p.value / 60) }]}
              formatY={(v) => `${v.toFixed(0)} h`}
              formatValue={(v) => formatSleep(Math.round(v * 60))}
            />
          </TouchableOpacity>
        )}
        <TouchableOpacity style={[styles.card, { width: cols > 1 ? (width - GAP) / 2 : cardW }]} onPress={() => go('/lab-report', { id: lab.id })} activeOpacity={0.85}>
          <View style={styles.cardHead}>
            <View style={[styles.cardIcon, { backgroundColor: withAlpha(Colors.attention, 0.14) }]}>{icon('alert-circle-outline', Colors.attention)}</View>
            <Text style={styles.cardTitle}>{t('Markers that need a look')}</Text>
          </View>
          {flagged.map((m) => (
            <View key={m.marker_id} style={styles.markerRow}>
              <Text style={styles.markerName} numberOfLines={1}>
                {markerNameEn(m)}
              </Text>
              <Text style={styles.markerValue}>{getMarkerValueTextEn(m.value, m.unit)}</Text>
            </View>
          ))}
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.allData} onPress={() => go('/(tabs)', { tab: '1' })} activeOpacity={0.85}>
        <Ionicons name="grid-outline" size={18} color={Colors.accent} />
        <Text style={styles.allDataText}>{t('Show all health data')}</Text>
        <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: 28, paddingTop: 28, paddingBottom: 48 },
  date: { color: Colors.textMuted, fontSize: 13, fontWeight: '700' },
  greeting: { color: Colors.textPrimary, fontSize: 30, fontWeight: '800', marginTop: 2, marginBottom: 16 },
  todo: {
    backgroundColor: Colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 4,
    marginBottom: 24,
  },
  todoTitle: { color: Colors.textPrimary, fontSize: 15, fontWeight: '800', marginBottom: 4 },
  todoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
  sectionRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  sync: { color: Colors.textMuted, fontSize: 12 },
  section: { color: Colors.textPrimary, fontSize: 19, fontWeight: '800', marginTop: 8, marginBottom: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginBottom: 18 },
  card: {
    backgroundColor: Colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: 14,
    minHeight: 112,
    justifyContent: 'space-between',
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 10 },
  cardIcon: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { color: Colors.textPrimary, fontSize: 14, fontWeight: '700', flex: 1 },
  cardWhen: { color: Colors.textMuted, fontSize: 12 },
  cardBody: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
  cardCaption: { color: Colors.textSecondary, fontSize: 12, marginBottom: 2 },
  cardValue: { color: Colors.textPrimary, fontSize: 24, fontWeight: '800' },
  cardUnit: { color: Colors.textSecondary, fontSize: 13, fontWeight: '600' },
  miniBars: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, height: 40 },
  miniBar: { width: 8, borderRadius: 3 },
  panel: { backgroundColor: Colors.card, borderRadius: 18, borderWidth: 1, borderColor: Colors.cardBorder, paddingHorizontal: 14, marginBottom: 18 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 13 },
  rowBorder: { borderTopWidth: 1, borderTopColor: Colors.divider },
  rowText: { flex: 1, color: Colors.textPrimary, fontSize: 14 },
  rowWhen: { color: Colors.textMuted, fontSize: 12 },
  markerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  markerName: { flex: 1, color: Colors.textPrimary, fontSize: 14 },
  markerValue: { color: Colors.attention, fontSize: 14, fontWeight: '800' },
  allData: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: 14,
  },
  allDataText: { flex: 1, color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },
});
