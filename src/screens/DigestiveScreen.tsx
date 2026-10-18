import { dateLocale, t, tn } from '@/i18n';
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { InfoButton } from '@/components/InfoButton';
import { AppIcon } from '@/components/HealthIcons';
import { AddMeasurementButton, MetricHero } from '@/components/MetricDetailParts';
import { Colors, withAlpha } from '@/constants/colors';
import { useDeepState, useReloadOnFocus } from '@/hooks/useReloadOnFocus';
import { bowelRepository, dayKey, entryForDay, urineRepository } from '@/data/bathroomRepository';
import { bowelObservations, hydrationFromUrine, Observation, urineObservations, volumeCheckSuggestion, VolumeCheckSuggestion } from '@/logic/bathroom';
import { BowelEntry, STOOL_COLORS, URINE_COLORS, UrineEntry } from '@/types/bathroom';
import { showSamples } from '@/data/dataMode';
import { digestionRepository, LoadedGut, loadGutContext } from '@/data/digestionRepository';
import { analyseGut, CONFIDENCE_LABEL, GutAnalysis, groupLabel, MIN_EPISODES } from '@/logic/gutPatterns';
import { mealGroups } from '@/logic/foodGroups';
import { DigestionEntry, GUT_SYMPTOMS, INTENSITIES, MINUTES_BEFORE } from '@/types/digestion';

const LEVEL: Record<Observation['level'], { icon: string; color: string }> = {
  good: { icon: 'checkmark-circle', color: Colors.ok },
  tip: { icon: 'bulb-outline', color: Colors.gold },
  ask: { icon: 'help-circle-outline', color: Colors.attention },
  see_doctor: { icon: 'medkit-outline', color: Colors.danger },
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
          <TouchableOpacity key={d.toISOString()} style={styles.dayCol} onPress={() => onDay(d)} activeOpacity={0.7}>
            <Text style={styles.barCount}>{b.logged && b.count != null ? b.count : ''}</Text>
            <View style={styles.barTrack}>
              {b.logged ? (
                <View style={[styles.bar, { height: h, backgroundColor: b.swatch ?? Colors.textMuted }, !b.count && styles.barZero]} />
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

// Digestión (lo que notas): el peor nivel del día. 0 = "Hoy, bien"; null = nada apuntado
const TUMMY_COLORS = [Colors.ok, Colors.warning, Colors.attention, Colors.danger];
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
        <TouchableOpacity key={d.toISOString()} style={styles.dayCol} onPress={() => onDay(d)} activeOpacity={0.7}>
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
const symptomText = (e: DigestionEntry) =>
  GUT_SYMPTOMS.filter((s) => e.symptoms?.[s.id])
    .map((s) => `${t(s.label)} (${t(INTENSITIES.find((i) => i.id === e.symptoms![s.id])!.label).toLowerCase()})`)
    .join(' · ');
const hhmm = (iso: string) => new Date(iso).toLocaleTimeString(dateLocale(), { hour: '2-digit', minute: '2-digit' });
// Lo que comió antes, en una línea: "Antes: café con leche (1-3 h antes) · lácteos con lactosa, café"
const foodText = (e: DigestionEntry) => {
  const f = e.food;
  if (!f) return null;
  if (f.fasted) return t('Before: nothing for hours');
  const groups = mealGroups(f.description ?? '', f.groups ?? null);
  const when = MINUTES_BEFORE.find((m) => m.id === f.minutesBefore);
  const ago = when ? t('{time} before', { time: t(when.label) }) : '';
  const what = f.description ? (ago ? `${f.description} (${ago})` : f.description) : ago;
  return [what && `${t('Before:')} ${what}`, groups.map((g) => groupLabel(g).toLowerCase()).join(', ')].filter(Boolean).join(' · ') || null;
};

// Gut y Bladder (?part=gut|bladder desde su tarjeta de Today; sin part, las dos): los últimos 7
// días y lo que notamos esta semana. Las observaciones se calculan al momento (también desde el
// aviso semanal); las preguntas de contexto van antes de recomendar el médico.
// Debajo de "Añadir medición": el resumen de un día entero (veces, noche, color…)
const WholeDayButton = ({ onPress }: { onPress: () => void }) => (
  <TouchableOpacity style={styles.wholeDay} onPress={onPress} activeOpacity={0.85}>
    <Ionicons name="calendar-outline" size={18} color={Colors.textSecondary} />
    <Text style={styles.wholeDayText}>{t('Add a whole day')}</Text>
  </TouchableOpacity>
);

export const DigestiveScreen = () => {
  const router = useRouter();
  const { part } = useLocalSearchParams<{ part?: 'gut' | 'bladder' }>();
  const showGut = part !== 'bladder';
  const showBladder = part !== 'gut';
  const [bowel, setBowel] = useDeepState<BowelEntry[]>([]);
  const [urine, setUrine] = useDeepState<UrineEntry[]>([]);
  const [volume, setVolume] = useDeepState<VolumeCheckSuggestion>(null);
  const [answers, setAnswers] = useState<Record<string, 'yes' | 'no'>>({});
  const [checkedAt, setCheckedAt] = useState<Date>(new Date());
  const [gut, setGut] = useDeepState<LoadedGut | null>(null);
  const [gutAnalysis, setGutAnalysis] = useDeepState<GutAnalysis | null>(null);

  const load = useCallback(async () => {
    const [b, u, g] = await Promise.all([bowelRepository.getAll(), urineRepository.getAll(), loadGutContext()]);
    setBowel(b);
    setUrine(u);
    setVolume(volumeCheckSuggestion(u));
    setGut(g);
    setGutAnalysis(analyseGut(g));
    setCheckedAt(new Date());
  }, [setBowel, setUrine, setVolume, setGut, setGutAnalysis]);

  // "Hoy, bien" / "Nada más hoy" con un toque
  const markDayOk = async () => {
    const now = new Date().toISOString();
    await digestionRepository.save({ id: `gut-ok-${Date.now()}`, kind: 'day_ok', fecha: now, createdAt: now });
    load();
  };
  useReloadOnFocus(load);

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

  const renderObservations = (list: Observation[]) =>
    list.map((o) => {
      const level = LEVEL[o.level];
      const a = answers[o.id];
      return (
        <View key={o.id} style={[styles.obs, { borderColor: withAlpha(level.color, 0.4) }]}>
          <View style={styles.obsHeader}>
            <Ionicons name={level.icon as any} size={18} color={level.color} />
            <Text style={styles.obsTitle}>{o.title}</Text>
          </View>
          <Text style={styles.obsBody}>{o.body}</Text>
          {o.question && (
            <>
              <Text style={styles.obsQuestion}>{o.question.text}</Text>
              {!a ? (
                <View style={styles.answerRow}>
                  <TouchableOpacity style={styles.answer} onPress={() => answer(o, 'yes')}>
                    <Text style={styles.answerText}>{t('Yes')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.answer} onPress={() => answer(o, 'no')}>
                    <Text style={styles.answerText}>{t('No')}</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <Text style={[styles.obsAnswer, { color: a === 'yes' ? Colors.ok : Colors.attention }]}>
                  {a === 'yes' ? o.question.yes : o.question.no}
                </Text>
              )}
            </>
          )}
          {(o.level === 'see_doctor' || a === 'no') && (
            <TouchableOpacity onPress={() => router.push({ pathname: '/professionals', params: { role: 'doctor' } })}>
              <Text style={styles.link}>{t('Find a doctor')}</Text>
            </TouchableOpacity>
          )}
        </View>
      );
    });

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title={part === 'gut' ? t('Digestion') : part === 'bladder' ? t('Hydration') : t('Digestion and hydration')} showBack />
        {/* Como las fichas de VFC o glucosa: título en negrita y, debajo, el icono y lo de hoy */}
        {part === 'gut' && (() => {
          // Cómo está la tripa hoy (Digestión) y cuántas veces al baño (Heces)
          const level = worstOfDay(gut && !gut.sample ? gut.digestion : [], dayKey(new Date()));
          const e = entryForDay(bowel, dayKey(new Date()));
          const stools = e ? `${t('Stools')}: ${tn(e.count, '{n} time', '{n} times')}` : '';
          return (
            <MetricHero
              icon="intestine"
              color={Colors.green}
              value={level != null ? t(TUMMY_LABELS[level]) : '—'}
              sub={level != null || e ? [t('Today'), stools].filter(Boolean).join(' · ') : t('Nothing logged today yet')}
            />
          );
        })()}
        {part === 'bladder' && (() => {
          const e = entryForDay(urine, dayKey(new Date()));
          return (
            <MetricHero
              icon="water-outline"
              color={Colors.gold}
              value={e ? t(hydrationFromUrine(e).label) : '—'}
              sub={e?.count != null ? `${t('Today')} · ${tn(e.count, '{n} time', '{n} times')}` : t('Nothing logged today yet')}
            />
          );
        })()}
        <Text style={styles.intro}>
          {part === 'gut'
            ? t('How your tummy feels and your stools. When you note something, we ask what you ate before.')
            : part === 'bladder'
              ? t('A quick daily note on your urine: it says a lot about how hydrated you are.')
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
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardTitle}>{t('Digestion')}</Text>
                  <Text style={styles.cardMeta}>{t('Last 7 days')}</Text>
                </View>
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
              </View>
              <AddMeasurementButton onPress={() => router.push('/log-digestion')} label={t('I feel something')} />
              <TouchableOpacity style={styles.wholeDay} onPress={markDayOk} disabled={dayOkToday} activeOpacity={0.85}>
                <Ionicons name={dayOkToday ? 'checkmark-circle' : 'happy-outline'} size={18} color={Colors.ok} />
                <Text style={styles.wholeDayText}>
                  {dayOkToday ? t('Marked as a good day') : symptomsToday.length ? t('Nothing else today') : t('All good today')}
                </Text>
              </TouchableOpacity>

              {/* Hoy: cada molestia con lo que comiste antes (tocar para añadirlo o corregirlo) */}
              {symptomsToday.length > 0 && <Text style={styles.sectionTitle}>{t('Today')}</Text>}
              {symptomsToday.map((e) => {
                const food = foodText(e);
                return (
                  <TouchableOpacity
                    key={e.id}
                    style={styles.row}
                    onPress={() => router.push({ pathname: '/log-digestion', params: { id: e.id } })}
                    activeOpacity={0.85}
                  >
                    <AppIcon name="intestine" size={18} color={Colors.attention} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowTitle}>
                        {hhmm(e.fecha)} · {symptomText(e)}
                      </Text>
                      <Text style={[styles.rowSub, !food && { color: Colors.accent }]}>{food ?? t('Add what you ate before')}</Text>
                    </View>
                    <TouchableOpacity onPress={() => digestionRepository.remove(e.id).then(load)} hitSlop={10}>
                      <Ionicons name="trash-outline" size={16} color={Colors.textMuted} />
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              })}

              {/* Lo que vemos: lo más importante (alarma primero) y el enlace al análisis completo */}
              <TouchableOpacity style={styles.insight} onPress={() => router.push('/gut-insights')} activeOpacity={0.85}>
                <Ionicons name={alarm ? 'medkit-outline' : 'sparkles-outline'} size={20} color={alarm ? Colors.danger : Colors.gold} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{t('What we see in your digestion')}</Text>
                  <Text style={styles.obsBody}>
                    {alarm
                      ? alarm.title
                      : pattern
                        ? `${pattern.title} · ${t(CONFIDENCE_LABEL[pattern.confidence])}`
                        : gutAnalysis?.ready
                          ? t('Nothing stands out yet')
                          : t('{m} of {M} times with what you ate before, so far.', { m: gutAnalysis?.foodEpisodes ?? 0, M: MIN_EPISODES })}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
              </TouchableOpacity>
            </>
          );
        })()}

        {/* Heces */}
        {showGut && (
          <>
          <View style={[styles.card, { marginTop: 22 }]}>
            <View style={styles.cardHeader}>
              {!part && <AppIcon name="intestine" size={20} color={Colors.green} />}
              <Text style={styles.cardTitle}>{t('Stools')}</Text>
              <Text style={styles.cardMeta}>{t('Last 7 days')}</Text>
            </View>
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
          </View>
          <AddMeasurementButton onPress={() => router.push({ pathname: '/log-bowel', params: { quick: '1' } })} label={t('Add measurement (just now)')} />
          <WholeDayButton onPress={() => router.push('/log-bowel')} />
          <View style={styles.sectionRow}>
            <View style={styles.titleWithInfo}>
              <Text style={styles.sectionTitle}>{t('This week')}</Text>
              <InfoButton topic="digestion" />
            </View>
            <TouchableOpacity onPress={load}>
              <Text style={styles.link}>{t('Check now')}</Text>
            </TouchableOpacity>
          </View>
          {renderObservations(bowelObservations(bowel))}
          </>
        )}

        {/* Orina */}
        {showBladder && (
          <>
          <View style={[styles.card, showGut && { marginTop: 22 }]}>
            <View style={styles.cardHeader}>
              {!part && <AppIcon name="water-outline" size={20} color={Colors.gold} />}
              <Text style={styles.cardTitle}>{t('Urine')}</Text>
              <Text style={styles.cardMeta}>{t('Last 7 days')}</Text>
            </View>
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
          </View>
          <AddMeasurementButton onPress={() => router.push({ pathname: '/log-urine', params: { quick: '1' } })} label={t('Add measurement (just now)')} />
          <WholeDayButton onPress={() => router.push('/log-urine')} />
          {volume && (
            <TouchableOpacity
              style={styles.volumeCard}
              onPress={() => router.push('/volume-check')}
              activeOpacity={0.85}
            >
              <Ionicons name="beaker-outline" size={20} color={Colors.gold} />
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{volume.kind === 'collect_24h' ? t('Measure a whole day') : t('Quick volume check')}</Text>
                <Text style={styles.obsBody}>
                  {volume.kind === 'collect_24h'
                    ? t('A 24-hour urine container from the pharmacy shows exactly how much you pass in a day.')
                    : volume.kind === 'repeat'
                      ? t('Last time it did not feel usual. Try once more on a normal day.')
                      : t('Pee once into a 500 ml bottle to get an idea of your usual amount.')}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
          <View style={styles.titleWithInfo}>
            <Text style={styles.sectionTitle}>{t('This week')}</Text>
            <InfoButton topic="urine" />
          </View>
          {renderObservations(urineObservations(urine))}
          </>
        )}

        <Text style={styles.footer}>
          {t('Checked {time}.', { time: checkedAt.toLocaleTimeString(dateLocale(), { hour: '2-digit', minute: '2-digit' }) })}{' '}
          {t('These notes are general guidance, not a diagnosis. Get urgent help if there is a lot of blood, black sticky stools with dizziness, strong tummy pain, or you cannot pee.')}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  legend: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginTop: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { color: Colors.textMuted, fontSize: 11 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 14,
    padding: 12,
    marginHorizontal: 20,
    marginBottom: 8,
  },
  rowTitle: { color: Colors.textPrimary, fontSize: 14, fontWeight: '600' },
  rowSub: { color: Colors.textSecondary, fontSize: 12, lineHeight: 17, marginTop: 2 },
  insight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: withAlpha(Colors.gold, 0.5),
    borderRadius: 16,
    padding: 14,
    marginHorizontal: 20,
    marginTop: 6,
  },
  wholeDay: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginTop: 10,
    marginBottom: 10,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  wholeDayText: { color: Colors.textSecondary, fontSize: 14, fontWeight: '600' },
  safeArea: { flex: 1, backgroundColor: Colors.background },
  content: { paddingBottom: 40 },
  intro: { color: Colors.textSecondary, fontSize: 14, lineHeight: 20, paddingHorizontal: 20, marginBottom: 16 },
  card: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    padding: 14,
    marginHorizontal: 20,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  cardTitle: { flex: 1, color: Colors.textPrimary, fontSize: 15, fontWeight: '700' },
  cardMeta: { color: Colors.textMuted, fontSize: 12 },
  sampleText: { color: Colors.textMuted, fontSize: 11, textAlign: 'center', marginTop: 10 },
  week: { flexDirection: 'row', justifyContent: 'space-between' },
  dayCol: { alignItems: 'center', gap: 4, flex: 1 },
  dayLabel: { color: Colors.textMuted, fontSize: 11, fontWeight: '700' },
  barCount: { color: Colors.textPrimary, fontSize: 12, fontWeight: '800', height: 16 },
  barTrack: { height: 64, justifyContent: 'flex-end', alignItems: 'center' },
  bar: { width: 20, borderRadius: 6 },
  barZero: { backgroundColor: Colors.divider },
  barEmpty: { width: 20, height: 6, borderRadius: 3, borderWidth: 1, borderStyle: 'dashed', borderColor: Colors.cardBorder },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingRight: 20 },
  titleWithInfo: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  sectionTitle: { color: Colors.textPrimary, fontSize: 17, fontWeight: '700', paddingHorizontal: 20, marginTop: 16, marginBottom: 10 },
  obs: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginHorizontal: 20,
    marginBottom: 10,
    gap: 6,
  },
  obsHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  obsTitle: { flex: 1, color: Colors.textPrimary, fontSize: 14, fontWeight: '700' },
  obsBody: { color: Colors.textSecondary, fontSize: 13, lineHeight: 19 },
  obsQuestion: { color: Colors.textPrimary, fontSize: 13, lineHeight: 19, fontWeight: '600', marginTop: 4 },
  obsAnswer: { fontSize: 13, lineHeight: 19, fontWeight: '600' },
  answerRow: { flexDirection: 'row', gap: 8 },
  answer: {
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 8,
    backgroundColor: Colors.background,
  },
  answerText: { color: Colors.textPrimary, fontSize: 13, fontWeight: '700' },
  link: { color: Colors.accent, fontSize: 13, fontWeight: '700', textDecorationLine: 'underline' },
  volumeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: withAlpha(Colors.gold, 0.5),
    borderRadius: 16,
    padding: 14,
    marginHorizontal: 20,
    marginTop: 10,
  },
  footer: { color: Colors.textMuted, fontSize: 11, lineHeight: 16, paddingHorizontal: 20, marginTop: 18 },
});
