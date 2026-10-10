import { dateLocale } from '@/i18n';
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenHeader } from '@/components/ScreenHeader';
import { InfoButton } from '@/components/InfoButton';
import { Colors, withAlpha } from '@/constants/colors';
import { useDeepState, useReloadOnFocus } from '@/hooks/useReloadOnFocus';
import { bowelRepository, dayKey, entryForDay, urineRepository } from '@/data/bathroomRepository';
import { bowelObservations, Observation, urineObservations, volumeCheckSuggestion, VolumeCheckSuggestion } from '@/logic/bathroom';
import { BowelEntry, STOOL_COLORS, URINE_COLORS, UrineEntry } from '@/types/bathroom';

const LEVEL: Record<Observation['level'], { icon: string; color: string }> = {
  good: { icon: 'checkmark-circle', color: Colors.ok },
  tip: { icon: 'bulb-outline', color: Colors.gold },
  ask: { icon: 'help-circle-outline', color: Colors.attention },
  see_doctor: { icon: 'medkit-outline', color: Colors.danger },
};

const lastSevenDays = () =>
  Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d;
  });

// Gut y Bladder (?part=gut|bladder desde su tarjeta de Today; sin part, las dos): los últimos 7
// días y lo que notamos esta semana. Las observaciones se calculan al momento (también desde el
// aviso semanal); las preguntas de contexto van antes de recomendar el médico.
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
  const today = dayKey(new Date());
  const bowelToday = entryForDay(bowel, today);
  const urineToday = entryForDay(urine, today);

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
                    <Text style={styles.answerText}>Yes</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.answer} onPress={() => answer(o, 'no')}>
                    <Text style={styles.answerText}>No</Text>
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
              <Text style={styles.link}>Find a doctor</Text>
            </TouchableOpacity>
          )}
        </View>
      );
    });

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <ScreenHeader title={part === 'gut' ? 'Gut' : part === 'bladder' ? 'Bladder' : 'Gut and bladder'} showBack />
        <Text style={styles.intro}>
          {part === 'gut'
            ? 'A quick daily note on your digestion.'
            : part === 'bladder'
              ? 'A quick daily note on your urine: it says a lot about how hydrated you are.'
              : 'A quick daily note on your digestion and urine.'}{' '}
          Each week we tell you what we notice, and you can check any time.
        </Text>

        {/* Digestión */}
        {showGut && (
          <>
          <View style={styles.card}>
            <View style={styles.cardHeader}>
              <MaterialCommunityIcons name="stomach" size={20} color={Colors.green} />
              <Text style={styles.cardTitle}>Digestion</Text>
              <TouchableOpacity style={styles.logButton} onPress={() => router.push('/log-bowel')}>
                <Text style={styles.logButtonText}>{bowelToday ? 'Edit today' : 'Log today'}</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.week}>
              {days.map((d) => {
                const e = entryForDay(bowel, dayKey(d));
                const swatch = STOOL_COLORS.find((c) => c.id === e?.color)?.swatch;
                return (
                  <TouchableOpacity
                    key={d.toISOString()}
                    style={styles.dayCol}
                    onPress={() => router.push({ pathname: '/log-bowel', params: { day: dayKey(d) } })}
                  >
                    <Text style={styles.dayLabel}>{d.toLocaleDateString(dateLocale(), { weekday: 'narrow' })}</Text>
                    <View style={[styles.dayDot, swatch ? { backgroundColor: swatch } : e ? styles.dayDotZero : styles.dayDotEmpty]}>
                      {e && <Text style={[styles.dayCount, swatch ? { color: '#FFFFFF' } : null]}>{e.count}</Text>}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
          <View style={styles.sectionRow}>
            <View style={styles.titleWithInfo}>
              <Text style={styles.sectionTitle}>This week</Text>
              <InfoButton topic="digestion" />
            </View>
            <TouchableOpacity onPress={load}>
              <Text style={styles.link}>Check now</Text>
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
              <Ionicons name="water-outline" size={20} color={Colors.green} />
              <Text style={styles.cardTitle}>Urine</Text>
              <TouchableOpacity style={styles.logButton} onPress={() => router.push('/log-urine')}>
                <Text style={styles.logButtonText}>{urineToday ? 'Edit today' : 'Log today'}</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.week}>
              {days.map((d) => {
                const e = entryForDay(urine, dayKey(d));
                const swatch = URINE_COLORS.find((c) => c.id === e?.color)?.swatch;
                return (
                  <TouchableOpacity
                    key={d.toISOString()}
                    style={styles.dayCol}
                    onPress={() => router.push({ pathname: '/log-urine', params: { day: dayKey(d) } })}
                  >
                    <Text style={styles.dayLabel}>{d.toLocaleDateString(dateLocale(), { weekday: 'narrow' })}</Text>
                    <View style={[styles.dayDot, swatch ? { backgroundColor: swatch } : e ? styles.dayDotZero : styles.dayDotEmpty]}>
                      {e?.count != null && <Text style={styles.dayCount}>{e.count}</Text>}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
          {volume && (
            <TouchableOpacity
              style={styles.volumeCard}
              onPress={() => router.push({ pathname: '/log-urine', params: { volume: '1' } })}
              activeOpacity={0.85}
            >
              <Ionicons name="beaker-outline" size={20} color={Colors.gold} />
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{volume.kind === 'collect_24h' ? 'Measure a whole day' : 'Quick volume check'}</Text>
                <Text style={styles.obsBody}>
                  {volume.kind === 'collect_24h'
                    ? 'A 24-hour urine container from the pharmacy shows exactly how much you pass in a day.'
                    : volume.kind === 'repeat'
                      ? 'Last time it did not feel usual. Try once more on a normal day.'
                      : 'Pee once into a 500 ml bottle to get an idea of your usual amount.'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
          <View style={styles.titleWithInfo}>
            <Text style={styles.sectionTitle}>This week</Text>
            <InfoButton topic="urine" />
          </View>
          {renderObservations(urineObservations(urine))}
          </>
        )}

        <Text style={styles.footer}>
          Checked {checkedAt.toLocaleTimeString(dateLocale(), { hour: '2-digit', minute: '2-digit' })}. These notes are general
          guidance, not a diagnosis. Get urgent help if there is a lot of blood, black sticky stools with dizziness, strong
          tummy pain, or you cannot pee.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
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
  logButton: { backgroundColor: Colors.accent, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 7 },
  logButtonText: { color: Colors.background, fontSize: 12, fontWeight: '800' },
  week: { flexDirection: 'row', justifyContent: 'space-between' },
  dayCol: { alignItems: 'center', gap: 6, flex: 1 },
  dayLabel: { color: Colors.textMuted, fontSize: 11, fontWeight: '700' },
  dayDot: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  dayDotEmpty: { borderWidth: 1, borderStyle: 'dashed', borderColor: Colors.cardBorder },
  dayDotZero: { backgroundColor: Colors.divider },
  dayCount: { color: Colors.textPrimary, fontSize: 12, fontWeight: '800' },
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
