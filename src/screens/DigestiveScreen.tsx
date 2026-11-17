import { dateLocale, t, tn } from '@/i18n';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { InfoButton } from '@/components/InfoButton';
import { Chev, Pill, SecHead } from '@/components/fine/Fine';
import { BigFigure, FineLink, SecRow } from '@/components/fine/FineMeasure';
import { WaterCard } from '@/components/WaterCard';
import { TourTarget } from '@/components/tour/TourTarget';
import { makeTourScroll } from '@/components/tour/tourStore';
import { Colors } from '@/constants/colors';
import { useDeepState, useReloadOnFocus } from '@/hooks/useReloadOnFocus';
import { bowelRepository, dayKey, entryForDay, urineRepository } from '@/data/bathroomRepository';
import {
  BUSY_CAUSE_TEXT,
  BusyCause,
  bowelObservations,
  hydrationFromUrine,
  Observation,
  stressedOnDay,
  urineBusyDay,
  urineObservations,
  volumeCheckSuggestion,
  VolumeCheckSuggestion,
} from '@/logic/bathroom';
import { BusyAnswers, urineBusyStore } from '@/data/urineBusyStore';
import { checkInRepository } from '@/data/checkInRepository';
import { checkInTagRepository } from '@/data/checkInTagRepository';
import { parseTagEntryId } from '@/logic/checkInTags';
import { litres, waterRepository } from '@/data/waterRepository';
import { dailyGoalsStore } from '@/data/dailyGoals';
import { FChip } from '@/components/fine/FineForm';
import { BowelEntry, STOOL_COLORS, URINE_COLORS, UrineEntry } from '@/types/bathroom';
import { showSamples } from '@/data/dataMode';
import { digestionRepository, LoadedGut, loadGutContext } from '@/data/digestionRepository';
import { analyseGut, GutAnalysis, groupLabel, MIN_EPISODES } from '@/logic/gutPatterns';
import { mealGroups } from '@/logic/foodGroups';
import { DigestionEntry, GUT_SYMPTOMS, MINUTES_BEFORE } from '@/types/digestion';
import { FINE, ff, fine } from '@/theme/fine';

// Desde el 2026-11-16, en el lenguaje fino del prototipo: sin tarjetas, cada parte con su cabecera pequeña
// («DIGESTIÓN · Últimos 7 días»), barras finas, la acción principal en píldora esmeralda y la segunda en jade,
// y lo que notamos en filas con línea fina. Sin rojo: jade lo que va bien, oro lo que conviene mirar y ámbar (no
// rojo) lo de ir al médico.
// Desde el 2026-11-17 (notas del fundador al probarlo): cada molestia de hoy, con la hora donde iba el icono del
// intestino, «Molestias…» de título y lo que notó debajo, seguido por comas (antes, la hora y cada síntoma
// seguidos de un punto: «es poco fino»); las filas que llevan a otra pantalla, sin icono; y lo de «Esta semana»,
// con un punto de color en vez de un icono por nivel y «Revisar ahora» diciendo que ya ha revisado.
const LEVEL: Record<Observation['level'], string> = {
  good: FINE.jade,
  tip: FINE.gold,
  ask: FINE.gold,
  see_doctor: Colors.attention,
};

// Barras de la semana: la altura es cuántas veces y el color, el que se apuntó (heces u orina)
const WeekBars = ({
  days,
  bars,
  onDay,
}: {
  days: Date[];
  bars: { count: number | null; swatch?: string; logged: boolean }[];
  onDay: (d: Date) => void;
}) => {
  const max = Math.max(3, ...bars.map((b) => b.count ?? 0));
  return (
    <View style={styles.week}>
      {days.map((d, i) => {
        const b = bars[i];
        const h = b.logged ? 6 + ((b.count ?? 0) / max) * 58 : 0;
        return (
          <TouchableOpacity
            key={d.toISOString()}
            style={styles.dayCol}
            onPress={() => onDay(d)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`${d.toLocaleDateString(dateLocale(), { weekday: 'long' })}: ${b.logged && b.count != null ? b.count : '—'}`}
          >
            <Text style={styles.barCount}>{b.logged && b.count != null ? b.count : ''}</Text>
            <View style={styles.barTrack}>
              {b.logged ? (
                <View style={[styles.bar, { height: h, backgroundColor: b.swatch ?? FINE.mute }, !b.count && styles.barZero]} />
              ) : (
                <View style={styles.barEmpty} />
              )}
            </View>
            <Text style={styles.dayLabel}>{d.toLocaleDateString(dateLocale(), { weekday: 'narrow' })}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

// Semana de ejemplo mientras no hay nada apuntado (como en glucosa o tensión): se ve cómo quedan
// las barras y se marca como ejemplo
const SAMPLE_BOWEL: { count: number; color: string }[] = [
  { count: 1, color: 'brown' },
  { count: 2, color: 'light_brown' },
  { count: 1, color: 'brown' },
  { count: 0, color: '' },
  { count: 1, color: 'brown' },
  { count: 2, color: 'brown' },
  { count: 1, color: 'light_brown' },
];
const SAMPLE_URINE: { count: number; color: string }[] = [
  { count: 6, color: 'pale' },
  { count: 7, color: 'pale' },
  { count: 5, color: 'yellow' },
  { count: 4, color: 'dark' },
  { count: 6, color: 'pale' },
  { count: 7, color: 'clear' },
  { count: 6, color: 'pale' },
];

const lastSevenDays = () =>
  Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d;
  });

// Digestión (lo que notas): el peor nivel del día. 0 = "Hoy, bien"; null = nada apuntado. De jade a ámbar, sin rojo
const TUMMY_COLORS = [FINE.jade, FINE.gold, '#D9A04A', Colors.attention];
const TUMMY_LABELS = ['Good', 'Mild', 'Moderate', 'Strong'];
const worstOfDay = (entries: DigestionEntry[], day: string): number | null => {
  const sameDay = entries.filter((e) => dayKey(new Date(e.fecha)) === day);
  if (!sameDay.length) return null;
  return Math.max(0, ...sameDay.flatMap((e) => Object.values(e.symptoms ?? {}) as number[]));
};
const TummyWeek = ({ days, levels, onDay }: { days: Date[]; levels: (number | null)[]; onDay: (d: Date) => void }) => (
  <View style={styles.week}>
    {days.map((d, i) => {
      const level = levels[i];
      return (
        <TouchableOpacity
          key={d.toISOString()}
          style={styles.dayCol}
          onPress={() => onDay(d)}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`${d.toLocaleDateString(dateLocale(), { weekday: 'long' })}: ${level == null ? '—' : t(TUMMY_LABELS[level])}`}
        >
          <View style={styles.barTrack}>
            {level == null ? (
              <View style={styles.barEmpty} />
            ) : (
              <View style={[styles.bar, { height: 10 + level * 18, backgroundColor: TUMMY_COLORS[level] }]} />
            )}
          </View>
          <Text style={styles.dayLabel}>{d.toLocaleDateString(dateLocale(), { weekday: 'narrow' })}</Text>
        </TouchableOpacity>
      );
    })}
  </View>
);
// Una molestia apuntada, en dos líneas tranquilas: el título dice cuánto, por lo más fuerte de lo que marcó
// («Molestias leves»), y debajo, qué notó, seguido por comas («Hinchazón, gases o eructos»)
const DISCOMFORT_TITLE = ['Discomfort', 'Mild discomfort', 'Moderate discomfort', 'Strong discomfort'];
const discomfortTitle = (e: DigestionEntry) => t(DISCOMFORT_TITLE[Math.max(0, ...(Object.values(e.symptoms ?? {}) as number[]))] ?? DISCOMFORT_TITLE[0]);
const lowerFirst = (x: string) => x.charAt(0).toLowerCase() + x.slice(1);
const symptomList = (e: DigestionEntry) =>
  GUT_SYMPTOMS.filter((s) => e.symptoms?.[s.id])
    .map((s, i) => (i ? lowerFirst(t(s.label)) : t(s.label)))
    .join(', ');
const hhmm = (iso: string) => new Date(iso).toLocaleTimeString(dateLocale(), { hour: '2-digit', minute: '2-digit' });
// Lo que comió antes, en una línea: «Antes: café con leche (1–3 h antes)». Si no escribió qué era, lo que llevaba
// («Antes: lácteos con lactosa, café»)
const foodText = (e: DigestionEntry) => {
  const f = e.food;
  if (!f) return null;
  if (f.fasted) return t('Before: nothing for hours');
  const when = MINUTES_BEFORE.find((m) => m.id === f.minutesBefore);
  const ago = when ? t('{time} before', { time: t(when.label) }) : '';
  const what =
    f.description?.trim() ||
    mealGroups('', f.groups ?? null)
      .map((g) => groupLabel(g).toLowerCase())
      .join(', ');
  const text = what ? (ago ? `${what} (${lowerFirst(ago)})` : what) : ago;
  return text ? `${t('Before:')} ${text}` : null;
};

// Gut y Bladder (?part=gut|bladder desde su tarjeta de Today; sin part, las dos): los últimos 7
// días y lo que notamos esta semana. Las observaciones se calculan al momento (también desde el
// aviso semanal); las preguntas de contexto van antes de recomendar el médico.
// Debajo de "Añadir medición": el resumen de un día entero (veces, noche, color…)
const WholeDayButton = ({ onPress }: { onPress: () => void }) => (
  <FineLink icon="calendar-outline" label={t('Add a whole day')} onPress={onPress} style={styles.secondary} />
);

export const DigestiveScreen = () => {
  const router = useRouter();
  const { part } = useLocalSearchParams<{ part?: 'gut' | 'bladder' }>();
  const showGut = part !== 'bladder';
  const showBladder = part !== 'gut';
  const tourScroll = useMemo(makeTourScroll, []);
  const [bowel, setBowel] = useDeepState<BowelEntry[]>([]);
  const [urine, setUrine] = useDeepState<UrineEntry[]>([]);
  const [volume, setVolume] = useDeepState<VolumeCheckSuggestion>(null);
  const [answers, setAnswers] = useState<Record<string, 'yes' | 'no'>>({});
  const [checkedAt, setCheckedAt] = useState<Date>(new Date());
  // «Revisar ahora»: vuelve a mirar lo apuntado y lo dice un momento en el propio enlace («Revisado ahora mismo»)
  const [justChecked, setJustChecked] = useState(false);
  const checkedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [gut, setGut] = useDeepState<LoadedGut | null>(null);
  const [gutAnalysis, setGutAnalysis] = useDeepState<GutAnalysis | null>(null);
  // Para el día de muchas más veces (urineBusyDay): el estrés del check-in, lo bebido y lo que contestó
  const [busyData, setBusyData] = useDeepState<{
    checkIns: { fecha: string; stress?: number; mood?: string }[];
    tags: { fecha: string; tag: string }[];
    drinks: { fecha: string; valor: number }[];
    goalMl: number;
  } | null>(null);
  const [busyAnswers, setBusyAnswers] = useState<BusyAnswers>({});

  const load = useCallback(async () => {
    const [b, u, g, checkIns, tagRows, drinks, goals, answered] = await Promise.all([
      bowelRepository.getAll(),
      urineRepository.getAll(),
      loadGutContext(),
      checkInRepository.getAll().catch(() => []),
      checkInTagRepository.getAll().catch(() => []),
      waterRepository.getAll().catch(() => []),
      dailyGoalsStore.get().catch(() => null),
      urineBusyStore.get(),
    ]);
    setBowel(b);
    setUrine(u);
    setVolume(volumeCheckSuggestion(u));
    setGut(g);
    setGutAnalysis(analyseGut(g));
    setBusyData({
      checkIns: checkIns.map((c) => ({ fecha: c.fecha, stress: c.stress, mood: c.mood })),
      tags: tagRows.map((r) => ({ fecha: r.fecha, tag: parseTagEntryId(r.id)?.tag ?? '' })),
      drinks: drinks.map((d) => ({ fecha: d.fecha, valor: d.valor })),
      goalMl: goals?.waterMl ?? 2000,
    });
    setBusyAnswers(answered);
    setCheckedAt(new Date());
  }, [setBowel, setUrine, setVolume, setGut, setGutAnalysis, setBusyData]);

  // "Hoy, bien" / "Nada más hoy" con un toque
  const markDayOk = async () => {
    const now = new Date().toISOString();
    await digestionRepository.save({ id: `gut-ok-${Date.now()}`, kind: 'day_ok', fecha: now, createdAt: now });
    load();
  };
  useReloadOnFocus(load);

  const checkNow = async () => {
    await load();
    setJustChecked(true);
    if (checkedTimer.current) clearTimeout(checkedTimer.current);
    checkedTimer.current = setTimeout(() => setJustChecked(false), 2500);
  };
  useEffect(
    () => () => {
      if (checkedTimer.current) clearTimeout(checkedTimer.current);
    },
    [],
  );

  const days = lastSevenDays();
  // Semana de ejemplo solo en cuentas de prueba (en una real, vacía hasta el primer apunte)
  const bowelSample = showSamples() && !days.some((d) => entryForDay(bowel, dayKey(d)));
  const urineSample = showSamples() && !days.some((d) => entryForDay(urine, dayKey(d)));

  // "Sí, lo explica algo que comí": se apunta en los registros recientes para no volver a preguntar
  const answer = async (o: Observation, value: 'yes' | 'no') => {
    setAnswers((a) => ({ ...a, [o.id]: value }));
    if (value !== 'yes') return;
    const colour = o.id === 'stool_red' ? 'red' : o.id === 'stool_black' ? 'black' : null;
    if (colour) {
      for (const e of bowel.filter((x) => x.color === colour && !x.explainedBy)) {
        await bowelRepository.update(e.id, { explainedBy: 'Something I ate or took (weekly check)' });
      }
    }
    if (o.id === 'urine_red') {
      for (const e of urine.filter((x) => x.color === 'red' && !x.explainedBy)) {
        await urineRepository.update(e.id, { explainedBy: 'Food or medicine (weekly check)' });
      }
    }
  };

  // Un día de muchas más veces (hoy, si ya ha llegado, o ayer): qué pudo influir. Lo que ya dicen el check-in
  // (estrés) y lo apuntado de bebida no se pregunta (fundador, 2026-11-16)
  const busy =
    busyData && !urineSample
      ? urineBusyDay(
          urine,
          new Date(),
          (day) => ({
            stressed: stressedOnDay(busyData.checkIns, busyData.tags, day),
            drinksMl: busyData.drinks.filter((d) => dayKey(new Date(d.fecha)) === day).reduce((s, d) => s + d.valor, 0),
          }),
          busyData.goalMl
        )
      : null;
  const busyChosen = busy ? busyAnswers[busy.day] ?? [] : [];
  const toggleBusy = async (c: BusyCause) => {
    if (!busy) return;
    // «Ninguno» va solo; cualquier otro lo quita
    const next = c === 'none' ? (busyChosen.includes('none') ? [] : ['none' as const]) : busyChosen.includes(c) ? busyChosen.filter((x) => x !== c) : [...busyChosen.filter((x) => x !== 'none'), c];
    setBusyAnswers((a) => ({ ...a, [busy.day]: next }));
    await urineBusyStore.set(busy.day, next).catch(() => undefined);
  };
  const busyBlock = busy ? (
    <View style={styles.obs}>
      <View style={styles.obsHeader}>
        <View style={[styles.obsDot, { backgroundColor: FINE.gold }]} />
        <Text style={[fine.rowTitle, styles.flex]}>
          {busy.isToday ? t('Today you have gone {n} times so far', { n: busy.count }) : t('Yesterday you went {n} times', { n: busy.count })}
        </Text>
      </View>
      <View style={styles.obsInner}>
        <Text style={styles.obsBody}>
          {busy.usual != null ? t('Your usual day: about {u}.', { u: Math.round(busy.usual) }) : t('The usual range is 4 to 10 times a day.')}{' '}
          {t('It is usually down to what you drink, or to a day of nerves.')}
        </Text>
        {busy.stressFromCheckIn && <Text style={styles.obsBody}>{t('Your check-in that day noted stress, which can also make you need to go more often.')}</Text>}
        {busy.drinksMl != null && <Text style={styles.obsBody}>{t('That day you logged {l} of drinks, more than usual.', { l: litres(busy.drinksMl) })}</Text>}
        <Text style={styles.obsQuestion}>{t('Could any of these have played a part?')}</Text>
        <View style={styles.busyChips}>
          {busy.ask.map((c) => (
            <FChip key={c} label={t(BUSY_CAUSE_TEXT[c].label)} on={busyChosen.includes(c)} onPress={() => toggleBusy(c)} check multi />
          ))}
        </View>
        {busyChosen.map((c) => (
          <Text key={c} style={[styles.obsAnswer, { color: c === 'none' ? FINE.gold : FINE.jade }]}>
            {t(BUSY_CAUSE_TEXT[c].answer)}
          </Text>
        ))}
      </View>
    </View>
  ) : null;

  const renderObservations = (list: Observation[], lead?: React.ReactNode) =>
    list.length || lead ? (
      <View style={styles.obsList}>
        {lead}
        {list.map((o) => {
          const a = answers[o.id];
          return (
            <View key={o.id} style={styles.obs}>
              <View style={styles.obsHeader}>
                <View style={[styles.obsDot, { backgroundColor: LEVEL[o.level] }]} />
                <Text style={[fine.rowTitle, styles.flex]}>{o.title}</Text>
              </View>
              <View style={styles.obsInner}>
                <Text style={styles.obsBody}>{o.body}</Text>
                {o.question && (
                  <>
                    <Text style={styles.obsQuestion}>{o.question.text}</Text>
                    {!a ? (
                      <View style={styles.answerRow}>
                        <TouchableOpacity style={styles.answer} onPress={() => answer(o, 'yes')} accessibilityRole="button">
                          <Text style={styles.answerText}>{t('Yes')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.answer} onPress={() => answer(o, 'no')} accessibilityRole="button">
                          <Text style={styles.answerText}>{t('No')}</Text>
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <Text style={[styles.obsAnswer, { color: a === 'yes' ? FINE.jade : FINE.gold }]}>{a === 'yes' ? o.question.yes : o.question.no}</Text>
                    )}
                  </>
                )}
                {(o.level === 'see_doctor' || a === 'no') && (
                  <TouchableOpacity
                    onPress={() => router.push({ pathname: '/professionals', params: { role: 'doctor' } })}
                    hitSlop={8}
                    style={styles.obsLink}
                    accessibilityRole="link"
                  >
                    <Text style={fine.link}>{t('Find a doctor')} ›</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          );
        })}
      </View>
    ) : null;

  // «Últimos 7 días» a la derecha de cada cabecera
  const last7 = <Text style={styles.meta}>{t('Last 7 days')}</Text>;

  // «ESTA SEMANA (i)            Revisar ahora» y, debajo, cuándo se ha revisado. Igual en Heces y en Orina
  const weekHead = (topic: 'digestion' | 'urine') => (
    <>
      <View style={fine.secHead}>
        <Text style={fine.secTitle} accessibilityRole="header">
          {t('This week')}
        </Text>
        <InfoButton topic={topic} size={16} />
        <TouchableOpacity onPress={checkNow} disabled={justChecked} hitSlop={8} style={styles.headLink} accessibilityRole="button" accessibilityLiveRegion="polite">
          <Text style={[fine.secMore, justChecked && styles.checkedNow]}>{justChecked ? t('Checked just now') : t('Check now')}</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.checked}>{t('Checked {time}.', { time: checkedAt.toLocaleTimeString(dateLocale(), { hour: '2-digit', minute: '2-digit' }) })}</Text>
    </>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView {...tourScroll.props} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title={part === 'gut' ? t('Digestion') : part === 'bladder' ? t('Hydration') : t('Digestion and hydration')} showBack />
        <View style={styles.body}>
          {/* Como las fichas de medición: lo de hoy en grande y ligero, con lo suyo debajo */}
          {part === 'gut' && (() => {
            // Cómo está la tripa hoy (Digestión) y cuántas veces al baño (Heces)
            const level = worstOfDay(gut && !gut.sample ? gut.digestion : [], dayKey(new Date()));
            const e = entryForDay(bowel, dayKey(new Date()));
            const stools = e ? `${t('Stools')}: ${tn(e.count, '{n} time', '{n} times')}` : '';
            return (
              <BigFigure
                word
                value={level != null ? t(TUMMY_LABELS[level]) : '—'}
                lines={[level != null || e ? [t('Today'), stools].filter(Boolean).join(' · ') : t('Nothing logged today yet')]}
              />
            );
          })()}
          {part === 'bladder' && (() => {
            const e = entryForDay(urine, dayKey(new Date()));
            return (
              <BigFigure
                word
                value={e ? t(hydrationFromUrine(e).label) : '—'}
                lines={[e?.count != null ? `${t('Today')} · ${tn(e.count, '{n} time', '{n} times')}` : t('Nothing logged today yet')]}
              />
            );
          })()}
          <Text style={[styles.intro, !part && styles.introAlone]}>
            {part === 'gut'
              ? t('How your tummy feels and your stools. When you note something, we ask what you ate before.')
              : part === 'bladder'
                ? t('What you drink and a quick note on your urine: together they say a lot about how hydrated you are.')
                : t('A quick daily note on your digestion and urine.')}{' '}
            {t('Each week we tell you what we notice, and you can check any time.')}
          </Text>

          {/* Digestión: lo que notas en la tripa, cruzado por detrás con las comidas y las heces */}
          {showGut && gut && (() => {
            const tummy = gut.digestion;
            const todayKey = dayKey(new Date());
            const todayEntries = gut.sample ? [] : tummy.filter((e) => dayKey(new Date(e.fecha)) === todayKey);
            const dayOkToday = todayEntries.some((e) => e.kind === 'day_ok');
            const symptomsToday = todayEntries.filter((e) => e.kind === 'symptoms').sort((x, y) => x.fecha.localeCompare(y.fecha));
            const alarm = gutAnalysis?.alarms[0];
            const pattern = gutAnalysis?.patterns.find((p) => p.confidence !== 'hint');
            return (
              <>
                <TourTarget id="digestive.gut" scroll={tourScroll} inset={20}>
                  <View>
                    <SecRow title={t('Digestion')} right={last7} />
                    <TummyWeek
                      days={days}
                      levels={days.map((d) => worstOfDay(tummy, dayKey(d)))}
                      onDay={(d) => router.push({ pathname: '/log-digestion', params: { day: dayKey(d) } })}
                    />
                    <View style={styles.legend}>
                      {TUMMY_LABELS.map((l, i) => (
                        <View key={l} style={styles.legendItem}>
                          <View style={[styles.legendDot, { backgroundColor: TUMMY_COLORS[i] }]} />
                          <Text style={styles.legendText}>{t(l)}</Text>
                        </View>
                      ))}
                    </View>
                    {gut.sample && <Text style={styles.sampleText}>{t('Sample month: log your own days to see yours.')}</Text>}
                    <View style={styles.actions}>
                      <Pill label={t('I feel something')} onPress={() => router.push('/log-digestion')} />
                    </View>
                  </View>
                </TourTarget>
                <FineLink
                  icon={dayOkToday ? 'checkmark-circle-outline' : 'happy-outline'}
                  label={dayOkToday ? (symptomsToday.length ? t('Noted: nothing else today') : t('Marked as a good day')) : symptomsToday.length ? t('Nothing else today') : t('All good today')}
                  onPress={markDayOk}
                  disabled={dayOkToday}
                  style={styles.secondary}
                />

                {/* Hoy: cada molestia con lo que comiste antes (tocar para añadirlo o corregirlo) */}
                {symptomsToday.length > 0 && <SecHead title={t('Today')} />}
                {symptomsToday.map((e) => {
                  const food = foodText(e);
                  const title = discomfortTitle(e);
                  const what = symptomList(e);
                  // La fila abre la molestia y la × la quita: dos botones uno al lado del otro (en la web un botón no
                  // puede llevar otro dentro)
                  return (
                    <View key={e.id} style={[fine.row, styles.entryRow]}>
                      <TouchableOpacity
                        style={[styles.flex, styles.entryOpen]}
                        onPress={() => router.push({ pathname: '/log-digestion', params: { id: e.id } })}
                        activeOpacity={0.7}
                        accessibilityRole="button"
                        accessibilityLabel={[hhmm(e.fecha), title, what, food ?? t('Add what you ate before')].filter(Boolean).join('. ')}
                      >
                        {/* La hora, pequeña y apagada, donde iba el icono */}
                        <Text style={styles.entryTime}>{hhmm(e.fecha)}</Text>
                        <View style={styles.flex}>
                          <Text style={fine.rowTitle}>{title}</Text>
                          {what ? <Text style={fine.rowSub}>{what}</Text> : null}
                          <Text style={[fine.rowSub, !food && { color: FINE.jade }]}>{food ?? t('Add what you ate before')}</Text>
                        </View>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => digestionRepository.remove(e.id).then(load)} hitSlop={10} style={styles.entryRemove} accessibilityRole="button" accessibilityLabel={t('Remove')}>
                        <Ionicons name="close" size={18} color={FINE.mute} />
                      </TouchableOpacity>
                    </View>
                  );
                })}

                {/* Lo que vemos: lo más importante (alarma primero) y el enlace al análisis completo, en una fila con líneas finas */}
                <TouchableOpacity style={[fine.row, styles.readRow]} onPress={() => router.push('/gut-insights')} activeOpacity={0.7} accessibilityRole="button">
                  <View style={styles.flex}>
                    <Text style={fine.rowTitle}>{t('What we see in your digestion')}</Text>
                    <Text style={fine.rowSub}>
                      {alarm
                        ? alarm.title
                        : pattern
                          ? pattern.title
                          : gutAnalysis?.ready
                            ? t('Nothing stands out yet')
                            : t('{m} of {M} times with what you ate before, so far.', { m: gutAnalysis?.foodEpisodes ?? 0, M: MIN_EPISODES })}
                    </Text>
                  </View>
                  <Chev />
                </TouchableOpacity>
              </>
            );
          })()}

          {/* Heces */}
          {showGut && (
            <>
              <SecRow title={t('Stools')} right={last7} />
              <WeekBars
                days={days}
                bars={days.map((d, i) => {
                  if (bowelSample) {
                    const x = SAMPLE_BOWEL[i];
                    return { count: x.count, swatch: STOOL_COLORS.find((c) => c.id === x.color)?.swatch, logged: true };
                  }
                  const e = entryForDay(bowel, dayKey(d));
                  return { count: e ? e.count : null, swatch: STOOL_COLORS.find((c) => c.id === e?.color)?.swatch, logged: !!e };
                })}
                onDay={(d) => router.push({ pathname: '/log-bowel', params: { day: dayKey(d) } })}
              />
              {bowelSample && <Text style={styles.sampleText}>{t('Sample week: log your first day to see your own.')}</Text>}
              <View style={styles.actions}>
                <Pill label={t('Add measurement (just now)')} onPress={() => router.push({ pathname: '/log-bowel', params: { quick: '1' } })} />
              </View>
              <WholeDayButton onPress={() => router.push('/log-bowel')} />
              {weekHead('digestion')}
              {renderObservations(bowelObservations(bowel))}
            </>
          )}

          {/* Agua y orina */}
          {showBladder && (
            <>
              <TourTarget id="digestive.water" scroll={tourScroll} inset={20}>
                <WaterCard />
              </TourTarget>
              <TourTarget id="digestive.urine" scroll={tourScroll} inset={20}>
                <View>
                  <SecRow title={t('Urine')} right={last7} />
                  <WeekBars
                    days={days}
                    bars={days.map((d, i) => {
                      if (urineSample) {
                        const x = SAMPLE_URINE[i];
                        return { count: x.count, swatch: URINE_COLORS.find((c) => c.id === x.color)?.swatch, logged: true };
                      }
                      const e = entryForDay(urine, dayKey(d));
                      return { count: e ? e.count ?? null : null, swatch: URINE_COLORS.find((c) => c.id === e?.color)?.swatch, logged: !!e };
                    })}
                    onDay={(d) => router.push({ pathname: '/log-urine', params: { day: dayKey(d) } })}
                  />
                  {urineSample && <Text style={styles.sampleText}>{t('Sample week: log your first day to see your own.')}</Text>}
                  <View style={styles.actions}>
                    <Pill label={t('Add measurement (just now)')} onPress={() => router.push({ pathname: '/log-urine', params: { quick: '1' } })} />
                  </View>
                  <WholeDayButton onPress={() => router.push('/log-urine')} />
                </View>
              </TourTarget>
              {volume && (
                <TouchableOpacity style={[fine.row, styles.readRow]} onPress={() => router.push('/volume-check')} activeOpacity={0.7} accessibilityRole="button">
                  <View style={styles.flex}>
                    <Text style={fine.rowTitle}>{volume.kind === 'collect_24h' ? t('Measure a whole day') : t('Quick volume check')}</Text>
                    <Text style={fine.rowSub}>
                      {volume.kind === 'collect_24h'
                        ? t('A 24-hour urine container from the pharmacy shows exactly how much you pass in a day.')
                        : volume.kind === 'repeat'
                          ? t('Last time it did not feel usual. Try once more on a normal day.')
                          : t('Pee once into a 500 ml bottle to get an idea of your usual amount.')}
                    </Text>
                  </View>
                  <Chev />
                </TouchableOpacity>
              )}
              {weekHead('urine')}
              {renderObservations(urineObservations(urine), busyBlock)}
            </>
          )}

          <Text style={styles.footer}>
            {t('These notes are general guidance, not a diagnosis. Get urgent help if there is a lot of blood, black sticky stools with dizziness, strong tummy pain, or you cannot pee.')}
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: 'transparent' },
  content: { paddingBottom: 40 },
  body: { paddingHorizontal: 20 },
  flex: { flex: 1, minWidth: 0 },
  intro: { ...fine.note, fontSize: 13.5, lineHeight: 19, marginTop: 12 },
  introAlone: { marginTop: 0 },
  meta: { ...ff('regular'), color: FINE.mute, fontSize: 12.5 },
  legend: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 12, marginTop: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 7, height: 7, borderRadius: 4 },
  legendText: { ...ff('regular'), color: FINE.mute, fontSize: 11.5 },
  sampleText: { ...fine.note, textAlign: 'center', fontSize: 11.5, marginTop: 10 },
  actions: { alignItems: 'center', marginTop: 16 },
  secondary: { marginTop: 4 },
  // Una fila con línea fina arriba y abajo (prototipo, `.read`)
  readRow: { marginTop: 18, borderTopWidth: 1, borderTopColor: FINE.line },
  headLink: { marginLeft: 'auto' },
  // «Revisado ahora mismo», apagado un momento; y debajo de la cabecera, cuándo se revisó
  checkedNow: { color: FINE.mute },
  checked: { ...fine.note, fontSize: 11.5, lineHeight: 16, marginTop: -2, marginBottom: 8 },
  // Cada molestia de hoy: la hora a la izquierda, pequeña y apagada, a la altura del título
  entryRow: { alignItems: 'flex-start' },
  entryOpen: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  entryTime: { ...ff('regular'), color: FINE.mute, fontSize: 13, lineHeight: 20, width: 44, fontVariant: ['tabular-nums'] },
  entryRemove: { paddingTop: 1 },
  // Semana en barras finas: la altura, cuántas veces; el color, el que se apuntó
  week: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  dayCol: { alignItems: 'center', gap: 4, flex: 1, minHeight: 44 },
  dayLabel: { ...ff('regular'), color: FINE.mute, fontSize: 11 },
  barCount: { ...ff('regular'), color: FINE.mute, fontSize: 11.5, height: 16, fontVariant: ['tabular-nums'] },
  barTrack: { height: 64, justifyContent: 'flex-end', alignItems: 'center' },
  bar: { width: 10, borderRadius: 5, opacity: 0.9 },
  barZero: { backgroundColor: FINE.line },
  barEmpty: { width: 10, height: 3, borderRadius: 2, backgroundColor: 'rgba(240,239,230,0.14)' },
  // Lo que notamos esta semana: filas con línea fina, un punto de color (jade, oro o ámbar) y el texto debajo
  obsList: { borderTopWidth: 1, borderTopColor: FINE.line },
  obs: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: FINE.line, gap: 4 },
  obsHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  obsDot: { width: 6, height: 6, borderRadius: 3, marginTop: 7 },
  obsInner: { paddingLeft: 15, gap: 6 },
  obsBody: { ...ff('regular'), color: '#CFD6CF', fontSize: 13.5, lineHeight: 19 },
  obsQuestion: { ...ff('medium'), color: FINE.ivory, fontSize: 13.5, lineHeight: 19, marginTop: 2 },
  obsAnswer: { ...ff('regular'), fontSize: 13.5, lineHeight: 19 },
  obsLink: { alignSelf: 'flex-start', paddingVertical: 4 },
  answerRow: { flexDirection: 'row', gap: 8 },
  busyChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 },
  answer: { minHeight: 34, justifyContent: 'center', borderWidth: 1, borderColor: FINE.line, borderRadius: 20, paddingHorizontal: 18 },
  answerText: { ...ff('regular'), color: FINE.ivory, fontSize: 13 },
  footer: { ...fine.note, fontSize: 11.5, lineHeight: 16, marginTop: 24 },
});
