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

  const load = useCallback(async () => {
    const [b, u] = await Promise.all([bowelRepository.getAll(), urineRepository.getAll()]);
    setBowel(b);
    setUrine(u);
    setVolume(volumeCheckSuggestion(u));
    setCheckedAt(new Date());
  }, [setBowel, setUrine, setVolume]);
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
          const e = entryForDay(bowel, dayKey(new Date()));
          return (
            <MetricHero
              icon="intestine"
              color={Colors.green}
              value={e ? tn(e.count, '{n} time', '{n} times') : '—'}
              sub={e ? t('Today') : t('Nothing logged today yet')}
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
            ? t('A quick daily note on your digestion.')
            : part === 'bladder'
              ? t('A quick daily note on your urine: it says a lot about how hydrated you are.')
              : t('A quick daily note on your digestion and urine.')}{' '}
          {t('Each week we tell you what we notice, and you can check any time.')}
        </Text>

        {/* Digestión */}
        {showGut && (
          <>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              {!part && <AppIcon name="intestine" size={20} color={Colors.green} />}
              <Text style={styles.cardTitle}>{t('Bowel movements')}</Text>
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
